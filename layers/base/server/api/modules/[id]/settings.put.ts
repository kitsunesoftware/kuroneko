import {
  type ModuleSettingsMap,
  patchModuleSettings,
  seedModuleSettings,
} from '../../../utils/module-settings'

export default defineEventHandler(async (event) => {
  const moduleId = getRouterParam(event, 'id')
  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Módulo inválido.' })
  }

  const body = await readBody<{
    values?: ModuleSettingsMap
    replace?: boolean
  }>(event)

  const values = body?.values ?? {}
  if (body?.replace) {
    await seedModuleSettings(moduleId, values)
  }
  else {
    await patchModuleSettings(moduleId, values)
  }

  return { ok: true, moduleId, values }
})
