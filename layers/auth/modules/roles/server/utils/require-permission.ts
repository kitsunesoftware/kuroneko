import type { H3Event } from 'h3'
import { usePrisma } from '../../../../../base/server/utils/prisma'
import { requireAuthUser } from '../../../account/server/utils/require-auth-user'
import { SYSTEM_ROLE_KEYS } from '../../shared/permissions'
import { ensureRolesSeeded } from './roles'

export async function requirePermission(event: H3Event, permissionKey: string) {
  const user = await requireAuthUser(event)
  await ensureRolesSeeded()

  const prisma = usePrisma()
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      role: {
        select: {
          key: true,
          permissions: {
            where: { allowed: true },
            select: { key: true },
          },
        },
      },
    },
  })

  if (!dbUser) {
    throw createError({ statusCode: 401, message: 'Sessão inválida.' })
  }

  if (dbUser.role?.key === SYSTEM_ROLE_KEYS.admin) {
    return user
  }

  const allowed = dbUser.role?.permissions.some((item) => item.key === permissionKey)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: 'Você não tem permissão para esta ação.',
    })
  }

  return user
}
