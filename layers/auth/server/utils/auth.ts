import type { User } from '@prisma/client'
import { usePrisma } from '../../../base/server/utils/prisma'
import { getAdminRoleId } from '../../modules/roles/server/utils/roles'
import { hashPassword, passwordNeedsRehash, verifyPassword } from './password'
import {
  createAuthSession,
  createAuthSessionFromEvent,
  resolveAuthSession,
  toAuthUser,
  type AuthUser,
} from './sessions'

const DEMO_EMAIL = 'demo@kuroneko.dev'
const DEMO_USERNAME = 'demo'
const DEMO_PASSWORD = 'kuroneko'

/**
 * Cria usuário demo sob demanda (dev). Não é chamado no login —
 * em VPS a primeira conta sai do wizard /install.
 */
export async function ensureDemoUser() {
  const prisma = usePrisma()
  const adminRoleId = await getAdminRoleId()

  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: { role: { select: { key: true } } },
  })
  if (existing) {
    if (!existing.roleId) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { roleId: adminRoleId },
        include: { role: { select: { key: true } } },
      })
    }
    return existing
  }

  return prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      username: DEMO_USERNAME,
      name: 'Demo Kuroneko',
      passwordHash: await hashPassword(DEMO_PASSWORD),
      roleId: adminRoleId,
    },
    include: { role: { select: { key: true } } },
  })
}

export async function findUserByIdentifier(
  identifier: string,
  options: { allowUsername?: boolean } = {},
) {
  const prisma = usePrisma()
  const value = identifier.trim().toLowerCase()
  if (!value) return null

  if (value.includes('@')) {
    return prisma.user.findUnique({
      where: { email: value },
      include: { role: { select: { key: true } } },
    })
  }

  if (!options.allowUsername) return null

  return prisma.user.findFirst({
    where: {
      username: {
        equals: value,
        mode: 'insensitive',
      },
    },
    include: { role: { select: { key: true } } },
  })
}

export async function validateCredentials(
  identifier: string,
  password: string,
  options: { allowUsername?: boolean } = {},
) {
  const user = await findUserByIdentifier(identifier, options)
  if (!user?.passwordHash) return null

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) return null

  if (!user.enabled) {
    throw createError({
      statusCode: 403,
      message: 'Esta conta está desativada. Contate um administrador.',
    })
  }

  // Migra scrypt (ou hash antigo) → Argon2id no login.
  if (passwordNeedsRehash(user.passwordHash)) {
    const prisma = usePrisma()
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    })
  }

  return toAuthUser(user)
}

/** @deprecated Prefer createAuthSessionFromEvent — mantido para compat tipada. */
export async function createToken(userId: string) {
  const { token } = await createAuthSession(userId)
  return token
}

export async function parseToken(token?: string) {
  const resolved = await resolveAuthSession(token)
  return resolved?.user ?? null
}

export async function getUserById(userId: string) {
  const prisma = usePrisma()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { select: { key: true } } },
  })
  return user ? toAuthUser(user) : null
}

export type { User }
