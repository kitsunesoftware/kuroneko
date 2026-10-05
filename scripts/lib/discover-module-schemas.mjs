import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Espelho de layers/base/shared/discover-module-schemas.ts para scripts Node (mjs).
 */
export function discoverLocalModuleSchemas(projectRoot) {
  const results = []
  const layersDir = join(projectRoot, 'layers')
  if (!existsSync(layersDir)) return results

  walk(layersDir, results)
  return results.sort((a, b) => a.moduleId.localeCompare(b.moduleId))
}

function walk(dir, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const base = join(dir, entry.name)
    const manifestPath = join(base, 'kuroneko.module.json')

    if (existsSync(manifestPath)) {
      const meta = metaFromManifestFile(manifestPath)
      if (meta) out.push(meta)
    }

    const modulesDir = join(base, 'modules')
    if (existsSync(modulesDir)) walk(modulesDir, out)
  }
}

function metaFromManifestFile(manifestPath) {
  let raw
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
  }
  catch {
    return null
  }

  const moduleId = typeof raw.id === 'string' ? raw.id.trim() : ''
  const schemaRel = typeof raw.prisma?.schema === 'string' ? raw.prisma.schema.trim() : ''
  const tables = Array.isArray(raw.prisma?.tables)
    ? raw.prisma.tables.filter((item) => typeof item === 'string' && item.trim())
    : []
  const target = typeof raw.layer?.target === 'string'
    ? raw.layer.target.replace(/\\/g, '/').replace(/\/+$/, '')
    : ''

  if (!moduleId || !schemaRel || !tables.length || !target) return null

  const schemaPath = `${target}/${schemaRel}`.replace(/\\/g, '/').replace(/\/{2,}/g, '/')
  return { moduleId, schemaPath, tables }
}

export async function loadGeneratedSchemas(projectRoot) {
  try {
    const text = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(projectRoot, '.kuroneko', 'module-schemas.generated.json'), 'utf8'),
    )
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

/** System + disco + gerados pela loja. */
export async function resolveAllSchemaMetas(projectRoot, systemSchemas) {
  const byId = new Map()
  for (const meta of systemSchemas) byId.set(meta.moduleId, meta)
  for (const meta of await loadGeneratedSchemas(projectRoot)) byId.set(meta.moduleId, meta)
  for (const meta of discoverLocalModuleSchemas(projectRoot)) byId.set(meta.moduleId, meta)
  return [...byId.values()]
}
