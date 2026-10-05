import { syncDiscoveredSchemasToGenerated } from '../utils/schema-meta'

/**
 * No boot, alinha .kuroneko/module-schemas.generated.json com os
 * kuroneko.module.json presentes em layers/ (evita client Prisma sem models do módulo).
 */
export default defineNitroPlugin(() => {
  void syncDiscoveredSchemasToGenerated().catch((err) => {
    console.warn(
      '[kuroneko] Falha ao sincronizar schemas de módulos:',
      err instanceof Error ? err.message : err,
    )
  })
})
