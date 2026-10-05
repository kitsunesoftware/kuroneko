import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { discoverLocalModuleSchemas } from '../../shared/discover-module-schemas'
import {
  MODULE_SCHEMAS,
  type ModuleSchemaMeta,
  schemaMetaFor as builtInSchemaMetaFor,
} from '../../shared/module-schemas'
import { resolvePlatformRoot, resolveProjectRoot } from './platform-root'

async function loadGeneratedSchemas(projectRoot: string): Promise<ModuleSchemaMeta[]> {
  try {
    const text = await readFile(
      join(projectRoot, '.kuroneko', 'module-schemas.generated.json'),
      'utf8',
    )
    const parsed = JSON.parse(text) as ModuleSchemaMeta[]
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

/**
 * Persiste schemas descobertos em disco no arquivo gerado,
 * para scripts e instalações futuras não “esquecerem” o módulo.
 */
export async function syncDiscoveredSchemasToGenerated() {
  const projectRoot = await resolveProjectRoot()
  const platformRoot = await resolvePlatformRoot(projectRoot).catch(() => projectRoot)
  const localProject = discoverLocalModuleSchemas(projectRoot)
  const localPlatform = platformRoot === projectRoot
    ? []
    : discoverLocalModuleSchemas(platformRoot)
  const local = [...localPlatform, ...localProject]
  if (!local.length) return local

  const generated = await loadGeneratedSchemas(projectRoot)
  const byId = new Map<string, ModuleSchemaMeta>()
  for (const meta of generated) byId.set(meta.moduleId, meta)
  for (const meta of local) byId.set(meta.moduleId, meta)

  const next = [...byId.values()].sort((a, b) => a.moduleId.localeCompare(b.moduleId))
  const dir = join(projectRoot, '.kuroneko')
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, 'module-schemas.generated.json'),
    `${JSON.stringify(next, null, 2)}\n`,
    'utf8',
  )
  return next
}

/** Schemas built-in + baixados pela loja + módulos em layers/ (projeto e plataforma). */
export async function resolveAllSchemaMetas(): Promise<ModuleSchemaMeta[]> {
  const projectRoot = await resolveProjectRoot()
  const platformRoot = await resolvePlatformRoot(projectRoot).catch(() => projectRoot)
  const generated = await loadGeneratedSchemas(projectRoot)
  const localProject = discoverLocalModuleSchemas(projectRoot)
  const localPlatform = platformRoot === projectRoot
    ? []
    : discoverLocalModuleSchemas(platformRoot)
  const byId = new Map<string, ModuleSchemaMeta>()
  for (const meta of MODULE_SCHEMAS) byId.set(meta.moduleId, meta)
  for (const meta of generated) byId.set(meta.moduleId, meta)
  for (const meta of localPlatform) byId.set(meta.moduleId, meta)
  for (const meta of localProject) byId.set(meta.moduleId, meta)
  return [...byId.values()]
}

export async function resolveSchemaMeta(moduleId: string) {
  const all = await resolveAllSchemaMetas()
  return all.find((item) => item.moduleId === moduleId) ?? builtInSchemaMetaFor(moduleId)
}
