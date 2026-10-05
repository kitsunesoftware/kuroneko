import { SYSTEM_MODULE_IDS } from '../../../../shared/module-schemas'
import { SYSTEM_MODULE_SETTINGS_DEFAULTS } from '../../../../shared/system-module-defaults'
import { ensureRolesSeeded } from '../../../../../auth/modules/roles/server/utils/roles'
import { assertInstallAllowed, getInstallStatus } from '../../../utils/install'
import { getModuleSettings, seedModuleSettings } from '../../../utils/module-settings'
import { usePrisma } from '../../../utils/prisma'

export default defineEventHandler(async () => {
  await assertInstallAllowed()

  const before = await getInstallStatus()
  if (!before.databaseConnected || !before.schemaReady) {
    throw createError({
      statusCode: 400,
      message: 'Aplique o schema antes de subir o seed.',
    })
  }

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
    if (Object.keys(existing).length === 0) {
      await seedModuleSettings(moduleId, defaults)
    }
  }

  const roles = await ensureRolesSeeded()

  return {
    ok: true,
    seeded: {
      modules: SYSTEM_MODULE_IDS.length,
      roles: [roles.admin.key, roles.user.key],
    },
    status: await getInstallStatus(),
  }
})
