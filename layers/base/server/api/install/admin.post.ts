import { createAuthSessionFromEvent, toAuthUser } from '../../../../auth/server/utils/sessions'
import { hashPassword, validatePasswordPolicy } from '../../../../auth/server/utils/password'
import { getPasswordPolicy } from '../../../../auth/server/utils/register'
import {
  ensureRolesSeeded,
  getAdminRoleId,
  getUserPermissionKeys,
} from '../../../../auth/modules/roles/server/utils/roles'
import {
  assertInstallAllowed,
  getInstallStatus,
  markInstallComplete,
} from '../../utils/install'
import { usePrisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await assertInstallAllowed()

  const status = await getInstallStatus()
  if (!status.schemaReady) {
    throw createError({
      statusCode: 400,
      message: 'Aplique o schema do banco antes de criar o administrador.',
    })
  }
  if (status.userCount > 0) {
    throw createError({
      statusCode: 403,
      message: 'Já existe uma conta cadastrada.',
    })
  }

  const body = await readBody<{
    name?: string
    email?: string
    password?: string
  }>(event)

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, message: 'Informe um e-mail válido.' })
  }
  if (!password) {
    throw createError({ statusCode: 400, message: 'Informe a senha.' })
  }

  const policy = await getPasswordPolicy()
  const passwordError = validatePasswordPolicy(password, policy)
  if (passwordError) {
    throw createError({ statusCode: 400, message: passwordError })
  }

  await ensureRolesSeeded()
  const adminRoleId = await getAdminRoleId()
  const prisma = usePrisma()

  const user = await prisma.user.create({
    data: {
      email,
      name: name || email.split('@')[0] || 'Administrador',
      username: 'administrador',
      passwordHash: await hashPassword(password),
      roleId: adminRoleId,
    },
    include: { role: { select: { key: true } } },
  })

  await markInstallComplete()

  const authUser = toAuthUser(user)
  const access = await getUserPermissionKeys(user.id)
  const { token } = await createAuthSessionFromEvent(event, user.id)

  return {
    ok: true,
    token,
    user: {
      ...authUser,
      roleKey: access.roleKey ?? authUser.roleKey ?? null,
      permissions: access.permissions,
    },
    status: await getInstallStatus(),
  }
})
