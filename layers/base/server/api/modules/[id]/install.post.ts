import { join } from 'node:path'
import { SYSTEM_MODULE_IDS } from '../../../../shared/module-schemas'
import {
  type ModuleSettingsMap,
  seedModuleSettings,
} from '../../../utils/module-settings'
import {
  assertDownloadedModulePlatformCompatible,
  findManifestByIdInLayers,
  parseManifest,
  registerStorePrismaSchema,
} from '../../../utils/module-store'
import { enqueueModuleChange } from '../../../utils/module-queue'
import { usePrisma } from '../../../utils/prisma'
import {
  resolveSchemaMeta,
  syncDiscoveredSchemasToGenerated,
} from '../../../utils/schema-meta'

/**
 * Instala a partir de layers/ já baixado: enfileira install (sem generate/push).
 * Preferir a loja (queue-install) que baixa + enfileira.
 */
export default defineEventHandler(async (event) => {
  const moduleId = getRouterParam(event, 'id')
  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Módulo inválido.' })
  }

  if ((SYSTEM_MODULE_IDS as readonly string[]).includes(moduleId)) {
    throw createError({ statusCode: 400, message: 'Este módulo já faz parte do sistema.' })
  }

  await assertDownloadedModulePlatformCompatible(moduleId)

  let defaults: ModuleSettingsMap | undefined
  try {
    const body = await readBody<{ defaults?: ModuleSettingsMap }>(event)
    defaults = body?.defaults
  }
  catch {
    defaults = undefined
  }

  await syncDiscoveredSchemasToGenerated()
  const rawManifest = await findManifestByIdInLayers(join(process.cwd(), 'layers'), moduleId)
  if (rawManifest?.prisma?.schema && rawManifest.prisma.tables?.length) {
    try {
      await registerStorePrismaSchema(parseManifest(rawManifest))
    }
    catch {
      await registerStorePrismaSchema(rawManifest)
    }
  }

  const meta = await resolveSchemaMeta(moduleId)
  const label = rawManifest && 'name' in rawManifest
    ? String((rawManifest as { name?: string }).name || moduleId)
    : moduleId
  const version = rawManifest && 'version' in rawManifest
    ? String((rawManifest as { version?: string }).version || '')
    : null
  const target = rawManifest && 'layer' in rawManifest
    ? String((rawManifest as { layer?: { target?: string } }).layer?.target || '')
    : null

  if (defaults && Object.keys(defaults).length) {
    await seedModuleSettings(moduleId, defaults)
  }

  // Placeholder no banco para aparecer em Meus módulos (ativado no process da fila).
  const prisma = usePrisma()
  await prisma.installedModule.upsert({
    where: { moduleId },
    create: { moduleId, enabled: false },
    update: { enabled: false },
  })

  await enqueueModuleChange({
    moduleId,
    action: 'install',
    label,
    version,
    target: target || null,
    hasSchema: Boolean(meta),
  })

  return {
    ok: true,
    moduleId,
    installed: true,
    enabled: false,
    queued: true,
    needsRestart: true,
    hint: 'Módulo na fila de instalação. Reinicie a aplicação Kuroneko para aplicar.',
  }
})
