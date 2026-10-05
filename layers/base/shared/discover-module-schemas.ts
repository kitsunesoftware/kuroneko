import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ModuleSchemaMeta } from './module-schemas'

type ManifestPrisma = {
  id?: string
  prisma?: {
    schema?: string
    tables?: string[]
  }
  layer?: {
    target?: string
  }
}

/**
 * Descobre schemas Prisma declarados em `kuroneko.module.json` sob layers/.
 * Assim o client inclui models de módulos presentes no disco (ex.: auth.two-factor),
 * sem depender só da lista hardcoded ou do download pela loja.
 */
export function discoverLocalModuleSchemas(projectRoot: string): ModuleSchemaMeta[] {
  const results: ModuleSchemaMeta[] = []
  const layersDir = join(projectRoot, 'layers')
  if (!existsSync(layersDir)) return results

  walk(layersDir, results)
  return results.sort((a, b) => a.moduleId.localeCompare(b.moduleId))
}

function walk(dir: string, out: ModuleSchemaMeta[]) {
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

function metaFromManifestFile(manifestPath: string): ModuleSchemaMeta | null {
  let raw: ManifestPrisma
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestPrisma
  }
  catch {
    return null
  }

  const moduleId = typeof raw.id === 'string' ? raw.id.trim() : ''
  const schemaRel = typeof raw.prisma?.schema === 'string' ? raw.prisma.schema.trim() : ''
  const tables = Array.isArray(raw.prisma?.tables)
    ? raw.prisma!.tables!.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : []
  const target = typeof raw.layer?.target === 'string'
    ? raw.layer.target.replace(/\\/g, '/').replace(/\/+$/, '')
    : ''

  if (!moduleId || !schemaRel || !tables.length || !target) return null

  const schemaPath = `${target}/${schemaRel}`.replace(/\\/g, '/').replace(/\/{2,}/g, '/')
  return {
    moduleId,
    schemaPath,
    tables,
  }
}
