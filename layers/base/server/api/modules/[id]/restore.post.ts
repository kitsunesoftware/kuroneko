import {
  parseModuleBackup,
  restoreModuleBackup,
} from '../../../utils/module-backup'

export default defineEventHandler(async (event) => {
  const moduleId = getRouterParam(event, 'id')
  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Módulo inválido.' })
  }

  const body = await readBody(event)
  const payload = parseModuleBackup(body)
  return restoreModuleBackup(moduleId, payload)
})
