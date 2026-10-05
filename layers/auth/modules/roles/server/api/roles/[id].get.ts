import { getRoleById } from '../../utils/roles'
import { requirePermission } from '../../utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'panel.roles.manage')
  const id = getRouterParam(event, 'id')?.trim() ?? ''
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID inválido.' })
  }

  const role = await getRoleById(id)
  if (!role) {
    throw createError({ statusCode: 404, message: 'Tipo de permissão não encontrado.' })
  }

  return { role }
})
