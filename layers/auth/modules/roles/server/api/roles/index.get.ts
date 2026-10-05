import { getPermissionCatalog, listRoles } from '../../utils/roles'
import { requirePermission } from '../../utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'panel.roles.manage')
  const roles = await listRoles()
  return {
    roles,
    catalog: getPermissionCatalog(),
  }
})
