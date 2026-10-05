import type { InstallStatus } from '../../shared/install'
import { access, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { usePrisma } from './prisma'

export type { InstallStatus }

const INSTALL_MARKER_KEY = 'install'
const INSTALL_MARKER_FILE = '.kuroneko-installed'

function maskDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.password) parsed.password = '••••'
    return parsed.toString()
  }
  catch {
    return url.replace(/:([^:@/]+)@/, ':••••@')
  }
}

async function resolveRootDir() {
  const candidates = [
    process.cwd(),
    process.env.INIT_CWD,
    process.env.NUXT_ROOT_DIR,
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      await access(join(candidate, 'nuxt.config.ts'))
      return candidate
    }
    catch {
      // next
    }
  }
  return process.cwd()
}

export function getConfiguredDatabaseUrl() {
  return (process.env.DATABASE_URL || '').trim()
}

function isMissingDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return /P1003|does not exist/i.test(message)
}

/**
 * Se o Postgres responde mas o database da URL ainda não existe,
 * cria o database (conectado em `postgres`) e tenta de novo.
 */
export async function ensureDatabaseExists(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] || '').trim()
  if (!database || database === 'postgres') return

  const adminUrl = new URL(url)
  adminUrl.pathname = '/postgres'
  adminUrl.search = ''

  const admin = new PrismaClient({
    datasources: { db: { url: adminUrl.toString() } },
  })
  try {
    const rows = await admin.$queryRawUnsafe<Array<{ ok: number }>>(
      'SELECT 1 AS ok FROM pg_database WHERE datname = $1',
      database,
    )
    if (!rows.length) {
      // Identificador escapado com aspas duplas (permite hífen etc.).
      const safeName = database.replace(/"/g, '')
      await admin.$executeRawUnsafe(`CREATE DATABASE "${safeName}"`)
    }
  }
  finally {
    await admin.$disconnect().catch(() => {})
  }
}

export async function testDatabaseUrl(url: string) {
  const client = new PrismaClient({
    datasources: { db: { url } },
  })
  try {
    await client.$connect()
    await client.$queryRaw`SELECT 1`
    return true
  }
  catch (error) {
    if (!isMissingDatabaseError(error)) throw error
    await ensureDatabaseExists(url)
    const retry = new PrismaClient({
      datasources: { db: { url } },
    })
    try {
      await retry.$connect()
      await retry.$queryRaw`SELECT 1`
      return true
    }
    finally {
      await retry.$disconnect().catch(() => {})
    }
  }
  finally {
    await client.$disconnect().catch(() => {})
  }
}

async function hasDiskInstallMarker() {
  try {
    await access(join(await resolveRootDir(), INSTALL_MARKER_FILE))
    return true
  }
  catch {
    return false
  }
}

async function writeDiskInstallMarker() {
  const rootDir = await resolveRootDir()
  await writeFile(
    join(rootDir, INSTALL_MARKER_FILE),
    `${JSON.stringify({ completedAt: new Date().toISOString() })}\n`,
    'utf8',
  )
}

async function clearDiskInstallMarker() {
  const { unlink } = await import('node:fs/promises')
  await unlink(join(await resolveRootDir(), INSTALL_MARKER_FILE))
}

export async function markInstallComplete() {
  await writeDiskInstallMarker()

  try {
    const prisma = usePrisma()
    await prisma.siteSetting.upsert({
      where: { key: INSTALL_MARKER_KEY },
      create: {
        key: INSTALL_MARKER_KEY,
        value: { completedAt: new Date().toISOString() },
      },
      update: {
        value: { completedAt: new Date().toISOString() },
      },
    })
  }
  catch {
    // Marcador em disco já basta se o banco falhar neste momento.
  }
}

export async function getInstallStatus(): Promise<InstallStatus> {
  const configuredUrl = getConfiguredDatabaseUrl()
  const databaseConfigured = Boolean(configuredUrl)
  const diskMarker = await hasDiskInstallMarker()

  let databaseConnected = false
  let schemaReady = false
  let userCount = 0
  let dbMarker = false

  if (databaseConfigured) {
    try {
      await testDatabaseUrl(configuredUrl)
      databaseConnected = true
    }
    catch {
      databaseConnected = false
    }
  }

  if (databaseConnected) {
    try {
      const prisma = usePrisma()
      userCount = await prisma.user.count()
      schemaReady = true
      const marker = await prisma.siteSetting.findUnique({
        where: { key: INSTALL_MARKER_KEY },
      })
      dbMarker = Boolean(marker)
    }
    catch {
      schemaReady = false
      userCount = 0
    }
  }

  // Fonte da verdade quando o banco responde: usuários ou SiteSetting `install`.
  // O arquivo em disco só conta se o Postgres estiver inacessível
  // (evita loop para /install em queda temporária).
  let installed = false
  if (schemaReady) {
    installed = userCount > 0 || dbMarker

    // Sem usuários e sem marcador no banco: limpa arquivo órfão.
    if (!installed && diskMarker) {
      await clearDiskInstallMarker().catch(() => {})
    }
    // Já havia usuários: garante o arquivo para resiliência offline.
    if (installed && !diskMarker && userCount > 0) {
      await writeDiskInstallMarker().catch(() => {})
    }
  }
  else if (!databaseConnected && diskMarker) {
    installed = true
  }

  let suggestedStep: InstallStatus['suggestedStep'] = 'database'
  if (installed) suggestedStep = 'done'
  else if (!databaseConfigured || !databaseConnected) suggestedStep = 'database'
  else if (!schemaReady) suggestedStep = 'schema'
  else suggestedStep = 'admin'

  return {
    installed,
    databaseConfigured,
    databaseConnected,
    schemaReady,
    userCount,
    suggestedStep,
    databaseUrlPreview: configuredUrl ? maskDatabaseUrl(configuredUrl) : null,
  }
}

export async function assertInstallAllowed() {
  const status = await getInstallStatus()
  // Bloqueia só com conta criada — marcadores sozinhos não impedem reaplicar schema/conexão no wizard.
  if (status.userCount > 0) {
    throw createError({
      statusCode: 403,
      message: 'A instalação já foi concluída.',
    })
  }
  return status
}
