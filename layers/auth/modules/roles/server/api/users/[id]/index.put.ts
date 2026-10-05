import { requirePermission } from '../../../utils/require-permission'
import { updatePanelUser } from '../../../utils/users'

export default defineEventHandler(async (event) => {
  const actor = await requirePermission(event, 'users.manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Usuário inválido.' })
  }

  const body = await readBody<{
    name?: string
    roleId?: string | null
    enabled?: boolean
  }>(event)

  const user = await updatePanelUser(id, {
    name: body?.name,
    roleId: body?.roleId,
    enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined,
  }, actor.id)

  return { ok: true, user }
})
