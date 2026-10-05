import { getModuleSettings } from '../../../utils/module-settings'

export default defineEventHandler(async (event) => {
  const moduleId = getRouterParam(event, 'id')
  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Módulo inválido.' })
  }

  const values = await getModuleSettings(moduleId)
  return { moduleId, values }
})
