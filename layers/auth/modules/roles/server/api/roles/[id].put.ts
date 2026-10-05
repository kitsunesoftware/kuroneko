import { updateRole } from '../../utils/roles'
import { requirePermission } from '../../utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'panel.roles.manage')
  const id = getRouterParam(event, 'id')?.trim() ?? ''
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID inválido.' })
  }

  const body = await readBody<{
    name?: string
    description?: string | null
    permissions?: Record<string, boolean>
  }>(event)

  const role = await updateRole(id, {
    name: body?.name,
    description: body?.description,
    permissions: body?.permissions,
  })

  return { ok: true, role }
})
