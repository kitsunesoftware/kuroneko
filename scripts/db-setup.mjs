import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolveAllSchemaMetas } from './lib/discover-module-schemas.mjs'

config({ path: '.env.development' })
config({ path: '.env' })

/** Schemas de sistema (sem kuroneko.module.json). Paths relativos à raiz da plataforma. */
const SYSTEM_MODULE_SCHEMAS = [
  { moduleId: 'auth', schemaPath: 'layers/auth/prisma/schema.prisma' },
  { moduleId: 'auth.register', schemaPath: 'layers/auth/modules/register/prisma/schema.prisma' },
  { moduleId: 'auth.account', schemaPath: 'layers/auth/modules/account/prisma/schema.prisma' },
]

const SYSTEM_IDS = new Set(SYSTEM_MODULE_SCHEMAS.map((item) => item.moduleId))

/** Projeto consumidor (ou o próprio monorepo) — onde fica prisma/schema e o generate. */
const projectRoot = process.cwd()

/**
 * Raiz do pacote Kuroneko (layers da plataforma).
 * - Monorepo: = projectRoot
 * - Consumidor: node_modules/@kitsunesoftware/kuroneko
 */
function resolvePlatformRoot(root) {
  if (existsSync(join(root, 'layers/base/prisma/schema.prisma'))) return root

  const candidates = [
    join(root, 'node_modules', '@kitsunesoftware', 'kuroneko'),
    join(root, 'node_modules', 'kuroneko'),
  ]
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'layers/base/prisma/schema.prisma'))) {
      return candidate
    }
  }

  throw new Error(
    '[db-setup] Plataforma Kuroneko não encontrada. '
    + 'Instale @kitsunesoftware/kuroneko ou rode na raiz do monorepo.',
  )
}

const platformRoot = resolvePlatformRoot(projectRoot)
const activeDir = join(projectRoot, 'prisma', 'schema')
const onlyCompose = process.argv.includes('--compose-only')
const skipGenerate = process.argv.includes('--skip-generate')
const generateOnly = process.argv.includes('--generate-only')
const installedOnly = process.argv.includes('--installed-only')

console.log(`[db-setup] projeto: ${projectRoot}`)
console.log(`[db-setup] plataforma: ${platformRoot}`)

async function loadInstalledModuleIds() {
  if (!process.env.DATABASE_URL) return null
  try {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    try {
      const rows = await prisma.installedModule.findMany({ select: { moduleId: true } })
      return new Set(rows.map((row) => row.moduleId))
    }
    finally {
      await prisma.$disconnect()
    }
  }
  catch (error) {
    console.warn('[db-setup] não foi possível ler InstalledModule — compose completo.', error?.message || error)
    return null
  }
}

async function clearActiveDir() {
  await mkdir(activeDir, { recursive: true })
  const existing = await readdir(activeDir).catch(() => [])
  await Promise.all(
    existing
      .filter((name) => name.endsWith('.prisma'))
      .map((name) => rm(join(activeDir, name), { force: true })),
  )
}

async function resolveSchemaAbsolute(meta) {
  const candidates = [
    join(projectRoot, meta.schemaPath),
    join(platformRoot, meta.schemaPath),
  ]
  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return null
}

/** Sistema + módulos em layers/ da plataforma e do projeto. */
async function composeAll() {
  await clearActiveDir()
  const basePath = join(platformRoot, 'layers/base/prisma/schema.prisma')
  const base = await readFile(basePath, 'utf8')
  await writeFile(join(activeDir, '00-base.prisma'), base, 'utf8')

  const fromPlatform = await resolveAllSchemaMetas(platformRoot, SYSTEM_MODULE_SCHEMAS)
  const fromProject = platformRoot === projectRoot
    ? []
    : await resolveAllSchemaMetas(projectRoot, [])

  const byId = new Map()
  for (const meta of fromPlatform) byId.set(meta.moduleId, meta)
  for (const meta of fromProject) byId.set(meta.moduleId, meta)
  let schemas = [...byId.values()]

  if (installedOnly) {
    const installed = await loadInstalledModuleIds()
    if (installed) {
      schemas = schemas.filter(
        (meta) => SYSTEM_IDS.has(meta.moduleId) || installed.has(meta.moduleId),
      )
      console.log(`Compose installed-only: ${schemas.length} schema(s)`)
    }
  }

  const dir = join(projectRoot, '.kuroneko')
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, 'module-schemas.generated.json'),
    `${JSON.stringify(schemas.filter((item) => !SYSTEM_IDS.has(item.moduleId)), null, 2)}\n`,
    'utf8',
  )

  let index = 1
  for (const meta of schemas) {
    const abs = await resolveSchemaAbsolute(meta)
    if (!abs) {
      console.warn(`Schema ausente para ${meta.moduleId} (${meta.schemaPath}) — ignorado.`)
      continue
    }
    const content = await readFile(abs, 'utf8')
    const prefix = String(index).padStart(2, '0')
    const safeName = meta.moduleId.replace(/\./g, '-')
    await writeFile(join(activeDir, `${prefix}-${safeName}.prisma`), content, 'utf8')
    index += 1
  }

  console.log(`Schemas compostos: ${schemas.map((item) => item.moduleId).join(', ') || '(nenhum módulo)'}`)
}

function resolvePrismaCli() {
  const require = createRequire(join(projectRoot, 'package.json'))
  try {
    return require.resolve('prisma/build/index.js')
  }
  catch {
    try {
      return require.resolve('prisma/build/index.js', {
        paths: [platformRoot, projectRoot],
      })
    }
    catch {
      return join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js')
    }
  }
}

function runPrisma(args) {
  const bin = resolvePrismaCli()
  if (!existsSync(bin)) {
    return Promise.reject(
      new Error(
        'CLI prisma não encontrada. No projeto consumidor: npm i -D prisma && npm i @prisma/client',
      ),
    )
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd: projectRoot,
      shell: false,
      stdio: 'inherit',
      env: process.env,
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`prisma failed with ${code}`))
    })
  })
}

await composeAll()
console.log(`Schema composto em ${join(projectRoot, 'prisma/schema')}`)

if (generateOnly) {
  await runPrisma(['generate', '--schema', 'prisma/schema'])
  console.log('Prisma client gerado.')
}
else if (!onlyCompose) {
  if (!skipGenerate) {
    await runPrisma(['generate', '--schema', 'prisma/schema'])
  }
  await runPrisma([
    'db',
    'push',
    '--schema',
    'prisma/schema',
    '--accept-data-loss',
    ...(skipGenerate ? ['--skip-generate'] : []),
  ])
  console.log('Prisma sync concluído.')
}
