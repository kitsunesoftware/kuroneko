/**
 * Processa ModuleChangeQueue com o app parado (job PM2).
 * install → InstalledModule enabled + settings seed opcional
 * uninstall → drop tables + settings + InstalledModule
 */
import { config } from 'dotenv'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { join, normalize, resolve, sep } from 'node:path'

config({ path: '.env.production' })
config({ path: '.env' })
config({ path: '.env.development' })

const root = process.cwd()
const logPath = join(root, '.kuroneko', 'restart.log')
const schemasPath = join(root, '.kuroneko', 'module-schemas.generated.json')

function log(line) {
  try {
    mkdirSync(join(root, '.kuroneko'), { recursive: true })
    appendFileSync(logPath, `${line}\n`, 'utf8')
  }
  catch {
    // ignore
  }
  console.log(line)
}

function loadSchemaMetas() {
  if (!existsSync(schemasPath)) return []
  try {
    const raw = JSON.parse(readFileSync(schemasPath, 'utf8'))
    return Array.isArray(raw) ? raw : []
  }
  catch {
    return []
  }
}

async function dropTables(prisma, tables) {
  for (const table of tables) {
    const name = String(table || '').trim()
    if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${name}" CASCADE`)
    log(`[queue] drop table ${name}`)
  }
}

function safeLayerAbs(target) {
  if (!target) return null
  const rootAbs = resolve(root)
  const abs = resolve(rootAbs, normalize(String(target)))
  const layersRoot = join(rootAbs, 'layers') + sep
  if (!abs.startsWith(layersRoot) && abs !== join(rootAbs, 'layers')) return null
  return abs
}

function removeLayerFolder(target, moduleId) {
  const abs = safeLayerAbs(target)
    || (() => {
      // fallback: panel.seafile → layers/panel/modules/seafile
      const parts = String(moduleId || '').split('.').filter(Boolean)
      if (parts.length < 2) return null
      const [parent, ...rest] = parts
      return safeLayerAbs(join('layers', parent, 'modules', ...rest))
    })()

  if (!abs || !existsSync(abs)) return false
  rmSync(abs, { recursive: true, force: true })
  log(`[queue] removed layer ${abs.replace(/\\/g, '/')}`)
  return true
}

const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient()
const schemaMetas = loadSchemaMetas()

log(`\n--- ${new Date().toISOString()} process-module-queue ---`)

try {
  const items = await prisma.moduleChangeQueue.findMany({
    orderBy: { createdAt: 'asc' },
  })
  log(`[queue] ${items.length} item(s)`)

  for (const item of items) {
    const moduleId = item.moduleId
    const action = item.action

    if (action === 'uninstall') {
      const meta = schemaMetas.find((m) => m.moduleId === moduleId)
      const tables = Array.isArray(meta?.tables) ? meta.tables : []
      if (tables.length) await dropTables(prisma, tables)
      await prisma.moduleSetting.deleteMany({ where: { moduleId } }).catch(() => undefined)
      await prisma.installedModule.deleteMany({ where: { moduleId } })
      removeLayerFolder(item.target, moduleId)
      log(`[queue] uninstalled ${moduleId}`)
    }
    else if (action === 'install') {
      await prisma.installedModule.upsert({
        where: { moduleId },
        create: { moduleId, enabled: true },
        update: { enabled: true },
      })
      // parentId vem do manifesto — ids com ponto (ex.: demo.hello) podem ser raiz.
      let parentId = ''
      const targetRel = item.target ? String(item.target).replace(/\\/g, '/') : ''
      if (targetRel && !targetRel.includes('..')) {
        const manifestPath = join(root, ...targetRel.split('/'), 'kuroneko.module.json')
        if (existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
            parentId = manifest?.parentId != null ? String(manifest.parentId).trim() : ''
          }
          catch {
            parentId = ''
          }
        }
      }
      if (parentId) {
        await prisma.installedModule.upsert({
          where: { moduleId: parentId },
          create: { moduleId: parentId, enabled: true },
          update: { enabled: true },
        })
      }
      log(`[queue] installed ${moduleId}`)
    }
    else {
      log(`[queue] ação ignorada: ${action} (${moduleId})`)
    }

    await prisma.moduleChangeQueue.delete({ where: { id: item.id } })
  }
}
finally {
  await prisma.$disconnect()
}

log('[queue] concluído.')
