import { createError } from 'h3'
import { getModuleSettings, seedModuleSettings, type ModuleSettingsMap } from './module-settings'
import { usePrisma } from './prisma'
import { resolveAllSchemaMetas, resolveSchemaMeta } from './schema-meta'

export const MODULE_BACKUP_VERSION = 1 as const

export type ModuleBackupSlice = {
  settings: ModuleSettingsMap
  tables: Record<string, Record<string, unknown>[]>
}

export type ModuleBackupPayload = {
  version: typeof MODULE_BACKUP_VERSION
  moduleId: string
  exportedAt: string
  /** Dados do módulo raiz (compatibilidade com backups antigos). */
  settings: ModuleSettingsMap
  tables: Record<string, Record<string, unknown>[]>
  /**
   * Fatias por módulo: raiz + descendentes instalados.
   * Ex.: auth, auth.login, auth.account, auth.account.two-factor
   */
  modules: Record<string, ModuleBackupSlice>
}

function quoteIdent(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw createError({ statusCode: 400, message: `Nome de tabela inválido: ${name}` })
  }
  return `"${name}"`
}

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      next[key] = value.toISOString()
      continue
    }
    if (typeof value === 'bigint') {
      next[key] = value.toString()
      continue
    }
    next[key] = value
  }
  return next
}

function sortByDepth(ids: string[]) {
  return [...ids].sort(
    (a, b) => a.split('.').length - b.split('.').length || a.localeCompare(b),
  )
}

/** Tabelas declaradas no schema do módulo (vazio se não houver). */
export async function tablesForModule(moduleId: string): Promise<string[]> {
  return (await resolveSchemaMeta(moduleId))?.tables ?? []
}

/** IDs do módulo + filhos/netos instalados (`auth` → `auth.login`, `auth.account`, …). */
export async function resolveBackupModuleIds(rootId: string): Promise<string[]> {
  const prisma = usePrisma()
  const rows = await prisma.installedModule.findMany({
    where: {
      OR: [
        { moduleId: rootId },
        { moduleId: { startsWith: `${rootId}.` } },
      ],
    },
    select: { moduleId: true },
  })

  const ids = new Set(rows.map((row) => row.moduleId))
  ids.add(rootId)

  const schemas = await resolveAllSchemaMetas()
  for (const meta of schemas) {
    if (meta.moduleId === rootId || meta.moduleId.startsWith(`${rootId}.`)) {
      if (ids.has(meta.moduleId) || meta.moduleId === rootId) {
        ids.add(meta.moduleId)
      }
    }
  }

  return sortByDepth([...ids])
}

async function exportModuleSlice(moduleId: string): Promise<ModuleBackupSlice> {
  const prisma = usePrisma()
  const tables = await tablesForModule(moduleId)
  const tableData: ModuleBackupSlice['tables'] = {}

  for (const table of tables) {
    try {
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM ${quoteIdent(table)}`,
      )
      tableData[table] = rows.map((row) => serializeRow(row))
    }
    catch {
      // Tabela ainda não criada (filho não instalado / schema não aplicado).
      tableData[table] = []
    }
  }

  return {
    settings: await getModuleSettings(moduleId),
    tables: tableData,
  }
}

export async function buildModuleBackup(moduleId: string): Promise<ModuleBackupPayload> {
  const prisma = usePrisma()
  const installed = await prisma.installedModule.findUnique({ where: { moduleId } })
  if (!installed) {
    throw createError({ statusCode: 400, message: 'Instale o módulo antes de gerar o backup.' })
  }

  const moduleIds = await resolveBackupModuleIds(moduleId)
  const modules: Record<string, ModuleBackupSlice> = {}

  for (const id of moduleIds) {
    modules[id] = await exportModuleSlice(id)
  }

  const root = modules[moduleId] ?? { settings: {}, tables: {} }

  return {
    version: MODULE_BACKUP_VERSION,
    moduleId,
    exportedAt: new Date().toISOString(),
    settings: root.settings,
    tables: root.tables,
    modules,
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseSlice(raw: unknown, label: string): ModuleBackupSlice {
  if (!isPlainObject(raw)) {
    throw createError({ statusCode: 400, message: `Fatia inválida no backup: ${label}` })
  }

  const settings = isPlainObject(raw.settings)
    ? (raw.settings as ModuleSettingsMap)
    : {}

  const tablesRaw = isPlainObject(raw.tables) ? raw.tables : {}
  const tables: ModuleBackupSlice['tables'] = {}
  for (const [table, rows] of Object.entries(tablesRaw)) {
    if (!Array.isArray(rows)) {
      throw createError({ statusCode: 400, message: `Tabela inválida no backup: ${table}` })
    }
    tables[table] = rows.map((row) => {
      if (!isPlainObject(row)) {
        throw createError({ statusCode: 400, message: `Linha inválida em ${table}.` })
      }
      return row
    })
  }

  return { settings, tables }
}

export function parseModuleBackup(raw: unknown): ModuleBackupPayload {
  if (!isPlainObject(raw)) {
    throw createError({ statusCode: 400, message: 'Arquivo de backup inválido.' })
  }

  const moduleId = raw.moduleId
  if (typeof moduleId !== 'string' || !moduleId) {
    throw createError({ statusCode: 400, message: 'Backup sem moduleId.' })
  }

  const version = raw.version
  if (version !== MODULE_BACKUP_VERSION) {
    throw createError({ statusCode: 400, message: 'Versão de backup não suportada.' })
  }

  const rootSlice = parseSlice(
    { settings: raw.settings, tables: raw.tables },
    moduleId,
  )

  const modules: Record<string, ModuleBackupSlice> = {
    [moduleId]: rootSlice,
  }

  if (isPlainObject(raw.modules)) {
    for (const [id, slice] of Object.entries(raw.modules)) {
      if (id !== moduleId && !id.startsWith(`${moduleId}.`)) {
        throw createError({
          statusCode: 400,
          message: `O backup contém o módulo "${id}", fora da árvore de "${moduleId}".`,
        })
      }
      modules[id] = parseSlice(slice, id)
    }
  }

  return {
    version: MODULE_BACKUP_VERSION,
    moduleId,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    settings: rootSlice.settings,
    tables: rootSlice.tables,
    modules,
  }
}

async function clearTable(table: string) {
  const prisma = usePrisma()
  await prisma.$executeRawUnsafe(`DELETE FROM ${quoteIdent(table)}`)
}

async function insertTableRows(table: string, rows: Record<string, unknown>[]) {
  const prisma = usePrisma()
  const quoted = quoteIdent(table)

  for (const row of rows) {
    const columns = Object.keys(row)
    if (!columns.length) continue

    const colList = columns.map(quoteIdent).join(', ')
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
    const values = columns.map((column) => row[column] ?? null)

    await prisma.$executeRawUnsafe(
      `INSERT INTO ${quoted} (${colList}) VALUES (${placeholders})`,
      ...values,
    )
  }
}

async function allowedTablesForTree(rootId: string): Promise<Set<string>> {
  const allowed = new Set<string>()
  const schemas = await resolveAllSchemaMetas()
  for (const meta of schemas) {
    if (meta.moduleId === rootId || meta.moduleId.startsWith(`${rootId}.`)) {
      for (const table of meta.tables) allowed.add(table)
    }
  }
  return allowed
}

export async function restoreModuleBackup(
  moduleId: string,
  payload: ModuleBackupPayload,
) {
  if (payload.moduleId !== moduleId) {
    throw createError({
      statusCode: 400,
      message: `Este backup é do módulo "${payload.moduleId}", não de "${moduleId}".`,
    })
  }

  const prisma = usePrisma()
  const installed = await prisma.installedModule.findUnique({ where: { moduleId } })
  if (!installed) {
    throw createError({ statusCode: 400, message: 'Instale o módulo antes de restaurar o backup.' })
  }

  const allowedTables = await allowedTablesForTree(moduleId)
  for (const [id, slice] of Object.entries(payload.modules)) {
    for (const table of Object.keys(slice.tables)) {
      const ownedBySlice = (await tablesForModule(id)).includes(table)
      if (!ownedBySlice && !allowedTables.has(table)) {
        throw createError({
          statusCode: 400,
          message: `O backup contém a tabela "${table}", que não pertence a esta árvore de módulos.`,
        })
      }
    }
  }

  const installedRows = await prisma.installedModule.findMany({
    where: {
      OR: [
        { moduleId },
        { moduleId: { startsWith: `${moduleId}.` } },
      ],
    },
    select: { moduleId: true },
  })
  const installedSet = new Set(installedRows.map((row) => row.moduleId))

  const restoreIds = sortByDepth(
    Object.keys(payload.modules).filter((id) => installedSet.has(id)),
  )

  // Limpa tabelas dos mais profundos para os menos (respeita FKs).
  for (const id of [...restoreIds].reverse()) {
    for (const table of await tablesForModule(id)) {
      try {
        await clearTable(table)
      }
      catch {
        // tabela inexistente
      }
    }
  }

  // Insere do pai para os filhos.
  const restoredTables: string[] = []
  for (const id of restoreIds) {
    const slice = payload.modules[id]!
    const tables = await tablesForModule(id)
    for (const table of tables) {
      await insertTableRows(table, slice.tables[table] ?? [])
      restoredTables.push(table)
    }

    await prisma.moduleSetting.deleteMany({ where: { moduleId: id } })
    if (Object.keys(slice.settings).length) {
      await seedModuleSettings(id, slice.settings)
    }
  }

  return {
    ok: true,
    moduleId,
    restoredModules: restoreIds,
    tables: restoredTables,
    settingsCount: restoreIds.reduce(
      (sum, id) => sum + Object.keys(payload.modules[id]?.settings ?? {}).length,
      0,
    ),
  }
}
