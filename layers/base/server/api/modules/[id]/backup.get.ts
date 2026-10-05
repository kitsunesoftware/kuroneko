import { buildModuleBackup } from '../../../utils/module-backup'

export default defineEventHandler(async (event) => {
  const moduleId = getRouterParam(event, 'id')
  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Módulo inválido.' })
  }

  const backup = await buildModuleBackup(moduleId)
  const safeName = moduleId.replace(/[^\w.-]+/g, '_')
  const date = backup.exportedAt.slice(0, 10)

  setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="kuroneko-${safeName}-${date}.json"`,
  )

  return backup
})
