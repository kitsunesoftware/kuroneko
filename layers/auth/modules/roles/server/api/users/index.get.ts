import { listPanelUsers, listRoleOptions } from '../../utils/users'
import { requirePermission } from '../../utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'users.view')
  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q : ''
  const [users, roles] = await Promise.all([
    listPanelUsers(q),
    listRoleOptions(),
  ])
  return { users, roles }
})
