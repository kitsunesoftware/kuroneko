import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SYSTEM_MODULE_IDS } from '../../shared/module-schemas'
import {
  resolvePlatformRoot,
  resolveProjectRoot,
  resolveSchemaAbsolute,
} from './platform-root'
import { resolveAllSchemaMetas } from './schema-meta'

async function clearActiveDir(activeDir: string) {
  await mkdir(activeDir, { recursive: true })
  const existing = await readdir(activeDir).catch(() => [] as string[])
  await Promise.all(
    existing
      .filter((name) => name.endsWith('.prisma'))
      .map((name) => rm(join(activeDir, name), { force: true })),
  )
}

/**
 * Compõe o schema Prisma.
 * Por padrão inclui TODOS os módulos conhecidos no client (evita `prisma generate` em runtime).
 * Passe `onlyInstalled: true` para compor só o que está instalado (uso em scripts offline).
 *
 * Lê layers da plataforma (monorepo ou node_modules) e grava em `<projeto>/prisma/schema`.
 */
export async function composePrismaSchema(
  installedModuleIds: string[] = [],
  options: { onlyInstalled?: boolean } = {},
) {
  const projectRoot = await resolveProjectRoot()
  const platformRoot = await resolvePlatformRoot(projectRoot)
  const activeDir = join(projectRoot, 'prisma', 'schema')
  await clearActiveDir(activeDir)

  const basePath = join(platformRoot, 'layers/base/prisma/schema.prisma')
  const base = await readFile(basePath, 'utf8')
  await writeFile(join(activeDir, '00-base.prisma'), base, 'utf8')

  const installed = new Set<string>([
    ...SYSTEM_MODULE_IDS,
    ...installedModuleIds,
  ])

  let index = 1
  const schemas = await resolveAllSchemaMetas()
  for (const meta of schemas) {
    if (options.onlyInstalled && !installed.has(meta.moduleId)) continue
    const schemaFile = await resolveSchemaAbsolute(
      meta.schemaPath,
      projectRoot,
      platformRoot,
    )
    if (!schemaFile) {
      console.warn(
        `[kuroneko] Schema ausente para ${meta.moduleId} (${meta.schemaPath}) — ignorado.`,
      )
      continue
    }
    const content = await readFile(schemaFile, 'utf8')
    const prefix = String(index).padStart(2, '0')
    const safeName = meta.moduleId.replace(/\./g, '-')
    await writeFile(join(activeDir, `${prefix}-${safeName}.prisma`), content, 'utf8')
    index += 1
  }

  return projectRoot
}

function prismaBin(rootDir: string) {
  return join(rootDir, 'node_modules', 'prisma', 'build', 'index.js')
}

function runPrisma(rootDir: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [prismaBin(rootDir), ...args], {
      cwd: rootDir,
      shell: false,
      stdio: 'pipe',
      env: process.env,
    })

    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`prisma ${args.join(' ')}\n${stderr}`))
    })
  })
}

function runPrismaCapture(rootDir: string, args: string[]) {
  return new Promise<{ code: number, stdout: string, stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [prismaBin(rootDir), ...args], {
      cwd: rootDir,
      shell: false,
      stdio: 'pipe',
      env: process.env,
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

const BASE_TABLES = [
  'InstalledModule',
  'SiteSetting',
  'ModuleSetting',
  'StoreCatalogModule',
] as const

export async function listExpectedTables(installedModuleIds: string[] = []) {
  const schemas = await resolveAllSchemaMetas()
  const installed = new Set<string>([
    ...SYSTEM_MODULE_IDS,
    ...installedModuleIds,
  ])
  const tables = new Set<string>(BASE_TABLES)
  for (const meta of schemas) {
    if (!installed.has(meta.moduleId)) continue
    for (const table of meta.tables) tables.add(table)
  }
  return [...tables].sort()
}

export type SchemaInspection = {
  exists: boolean
  upToDate: boolean
  expectedTables: string[]
  presentTables: string[]
  missingTables: string[]
  extraTables: string[]
  driftSummary: string | null
}

export async function inspectDatabaseSchema(
  installedModuleIds: string[] = [],
): Promise<SchemaInspection> {
  const { usePrisma } = await import('./prisma')
  const prisma = usePrisma()
  const expectedTables = await listExpectedTables(installedModuleIds)

  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = current_schema()
  `
  const present = new Set(rows.map((row) => row.tablename))
  const presentTables = expectedTables.filter((name) => present.has(name))
  const missingTables = expectedTables.filter((name) => !present.has(name))
  const knownExtra = [...present].filter(
    (name) => !expectedTables.includes(name) && !name.startsWith('_'),
  )

  const rootDir = await composePrismaSchema(installedModuleIds)
  const databaseUrl = (process.env.DATABASE_URL || '').trim()
  let upToDate = missingTables.length === 0
  let driftSummary: string | null = null

  if (databaseUrl && missingTables.length === 0) {
    const diff = await runPrismaCapture(rootDir, [
      'migrate',
      'diff',
      '--from-url',
      databaseUrl,
      '--to-schema-datamodel',
      'prisma/schema',
      '--exit-code',
    ])
    // 0 = sem drift, 2 = há diferenças, 1 = erro
    if (diff.code === 0) {
      upToDate = true
    }
    else if (diff.code === 2) {
      upToDate = false
      driftSummary = (diff.stdout || diff.stderr || 'Schema diverge do banco.').trim().slice(0, 800)
    }
    else {
      // Fallback: se o diff falhar, considera atualizado só se todas as tabelas existem
      upToDate = missingTables.length === 0
      driftSummary = (diff.stderr || diff.stdout || null)?.trim().slice(0, 400) || null
    }
  }
  else if (missingTables.length > 0) {
    upToDate = false
    driftSummary = `Faltam tabelas: ${missingTables.join(', ')}`
  }

  return {
    exists: presentTables.length > 0,
    upToDate,
    expectedTables,
    presentTables,
    missingTables,
    extraTables: knownExtra.sort(),
    driftSummary,
  }
}

/**
 * Aplica o schema no Postgres SEM regenerar o client.
 * Seguro com o servidor Nuxt rodando no Windows.
 */
export async function applyDatabaseSchema(installedModuleIds: string[] = []) {
  const rootDir = await composePrismaSchema(installedModuleIds)
  await runPrisma(rootDir, [
    'db',
    'push',
    '--schema',
    'prisma/schema',
    '--accept-data-loss',
    '--skip-generate',
  ])
}

export type GeneratePrismaClientResult = {
  ok: boolean
  eperm: boolean
  error?: string
}

/**
 * Regenera o Prisma Client com todos os schemas descobertos.
 * No Windows, pode falhar com EPERM se o Nuxt estiver usando a DLL.
 */
export async function generatePrismaClient(
  installedModuleIds: string[] = [],
): Promise<GeneratePrismaClientResult> {
  const rootDir = await composePrismaSchema(installedModuleIds)
  try {
    await runPrisma(rootDir, ['generate', '--schema', 'prisma/schema'])
    return { ok: true, eperm: false }
  }
  catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      // Windows: EPERM ou arquivo em uso pelo query engine carregado no Nuxt
      eperm: /EPERM|operation not permitted|being used by another process|EBUSY/i.test(error),
      error,
    }
  }
}

/** Apaga e recria o schema (destrutivo). */
export async function resetDatabaseSchema(installedModuleIds: string[] = []) {
  const rootDir = await composePrismaSchema(installedModuleIds)
  await runPrisma(rootDir, [
    'db',
    'push',
    '--schema',
    'prisma/schema',
    '--force-reset',
    '--skip-generate',
    '--accept-data-loss',
  ])
}

/** @deprecated Use applyDatabaseSchema — generate em runtime causa EPERM no Windows. */
export async function applyComposedSchema(installedModuleIds: string[]) {
  return applyDatabaseSchema(installedModuleIds)
}

/** Remove tabelas do módulo. */
export async function dropModuleTables(tables: string[]) {
  const { usePrisma } = await import('./prisma')
  const prisma = usePrisma()
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}" CASCADE`)
  }
}
