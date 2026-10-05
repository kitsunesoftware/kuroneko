import { SYSTEM_MODULE_IDS } from '../../shared/module-schemas'
import { SYSTEM_MODULE_SETTINGS_DEFAULTS } from '../../shared/system-module-defaults'
import { getModuleSettings, seedModuleSettings } from '../utils/module-settings'
import { usePrisma } from '../utils/prisma'

function isSchemaMissingError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: string }).code) : ''
  // P2021 = table does not exist; P2022 = column; P1001 = can't reach DB
  return code === 'P2021' || code === 'P2022' || code === 'P1001' || code === 'P1000'
}

export default defineNitroPlugin(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn('[kuroneko] DATABASE_URL não definido — configure o Postgres no .env')
    return
  }

  try {
    const prisma = usePrisma()
    for (const moduleId of SYSTEM_MODULE_IDS) {
      await prisma.installedModule.upsert({
        where: { moduleId },
        create: { moduleId, enabled: true },
        update: { enabled: true },
      })
    }

    for (const [moduleId, defaults] of Object.entries(SYSTEM_MODULE_SETTINGS_DEFAULTS)) {
      const existing = await getModuleSettings(moduleId)
      const missing: Record<string, string | number | boolean | string[]> = {}
      for (const [key, value] of Object.entries(defaults)) {
        if (!(key in existing)) missing[key] = value
      }
      if (Object.keys(missing).length > 0) {
        await seedModuleSettings(moduleId, missing)
      }
    }
  }
  catch (error) {
    if (isSchemaMissingError(error)) {
      // Esperado antes/durante o wizard de instalação (schema ainda não aplicado).
      console.warn('[kuroneko] Schema do banco ainda não aplicado — conclua o deploy em /install.')
      return
    }
    console.error('[kuroneko] Prisma ainda não pronto (rode npm run db:setup):', error)
  }
})
