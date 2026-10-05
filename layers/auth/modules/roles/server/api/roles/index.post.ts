import { createRole } from '../../utils/roles'
import { requirePermission } from '../../utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'panel.roles.manage')
  const body = await readBody<{
    name?: string
    key?: string
    description?: string
    permissions?: Record<string, boolean>
  }>(event)

  const role = await createRole({
    name: body?.name ?? '',
    key: body?.key,
    description: body?.description,
    permissions: body?.permissions,
  })

  return { ok: true, role }
})
