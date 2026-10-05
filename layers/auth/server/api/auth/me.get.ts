import { parseToken } from '../../utils/auth'
import { getUserPermissionKeys } from '../../../modules/roles/server/utils/roles'

export default defineEventHandler(async (event) => {
  const header = getHeader(event, 'authorization')
  const token = header?.startsWith('Bearer ')
    ? header.slice(7)
    : undefined

  const user = await parseToken(token)

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Sessão inválida.',
    })
  }

  const access = await getUserPermissionKeys(user.id)

  return {
    ...user,
    roleKey: access.roleKey ?? user.roleKey ?? null,
    permissions: access.permissions,
  }
})
