import { getPanelUserDetail, listRoleOptions } from '../../../utils/users'
import { requirePermission } from '../../../utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'users.view')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Usuário inválido.' })
  }

  const user = await getPanelUserDetail(id)
  if (!user) {
    throw createError({ statusCode: 404, message: 'Usuário não encontrado.' })
  }

  const roles = await listRoleOptions()
  return { user, roles }
})
