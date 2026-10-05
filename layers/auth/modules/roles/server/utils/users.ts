import { usePrisma } from '../../../../../base/server/utils/prisma'
import { revokeAllSessionsForUser } from '../../../../server/utils/sessions'
import {
  defaultAvatarTransform,
  normalizeAvatarTransform,
  type AvatarTransform,
} from '../../../account/shared/avatar-transform'
import { SYSTEM_ROLE_KEYS } from '../../shared/permissions'
import { ensureRolesSeeded, listRoles } from './roles'

export type PanelUserDto = {
  id: string
  email: string | null
  username: string | null
  name: string | null
  roleId: string | null
  roleKey: string | null
  roleName: string | null
  enabled: boolean
  avatarUrl: string | null
  avatarTransform: AvatarTransform | null
  createdAt: string
  updatedAt: string
}

export type PanelUserDetailDto = PanelUserDto & {
  birthDate: string | null
  oldEmail: string | null
  hasPassword: boolean
  loginAttemptCount: number
  loginGlobalCount: number
  loginWindowEndsAt: string | null
  loginBlockedUntil: string | null
  loginLastAttemptAt: string | null
  profile: {
    avatarUrl: string | null
    avatarTransform: AvatarTransform | null
    recoveryEmail: string | null
    showBirthDate: boolean
    hideBirthYear: boolean
    passwordAlerts: boolean
    usernameChangeCount: number
    usernameWindowStartedAt: string | null
    createdAt: string
    updatedAt: string
  } | null
  sessions: {
    active: number
    total: number
  }
  twoFactor: {
    available: boolean
    enabled: boolean
    totpEnabled: boolean
    securityKeyCount: number
    recoveryCodesRemaining: number
  }
}

function panelAvatarUrl(userId: string, hasStoredAvatar: boolean, version?: string | null) {
  if (!hasStoredAvatar) return null
  const v = version ? `?v=${encodeURIComponent(version)}` : ''
  return `/api/users/${encodeURIComponent(userId)}/avatar${v}`
}

function parseAvatarTransform(raw: unknown): AvatarTransform | null {
  return normalizeAvatarTransform(raw) ?? null
}

export type PanelRoleOption = {
  id: string
  key: string
  name: string
  isSystem: boolean
}

function toUserDto(
  user: {
    id: string
    email: string | null
    username: string | null
    name: string | null
    roleId: string | null
    enabled: boolean
    createdAt: Date
    updatedAt: Date
    role: { key: string, name: string } | null
  },
  avatar?: {
    avatarUrl: string | null
    avatarTransform: AvatarTransform | null
  } | null,
): PanelUserDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    roleId: user.roleId,
    roleKey: user.role?.key ?? null,
    roleName: user.role?.name ?? null,
    enabled: user.enabled,
    avatarUrl: avatar?.avatarUrl ?? null,
    avatarTransform: avatar?.avatarTransform ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

function formatDateOnly(value: Date | null | undefined) {
  if (!value) return null
  const y = value.getUTCFullYear()
  const m = String(value.getUTCMonth() + 1).padStart(2, '0')
  const d = String(value.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function listPanelUsers(query?: string): Promise<PanelUserDto[]> {
  await ensureRolesSeeded()
  const prisma = usePrisma()
  const q = String(query || '').trim()

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: {
      role: { select: { key: true, name: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  const avatarByUser = new Map<string, { avatarUrl: string | null, avatarTransform: AvatarTransform | null }>()
  try {
    const profiles = await prisma.accountProfile.findMany({
      where: { userId: { in: users.map((item) => item.id) } },
      select: { userId: true, avatarUrl: true, avatarTransform: true, updatedAt: true },
    })
    for (const row of profiles) {
      avatarByUser.set(row.userId, {
        avatarUrl: panelAvatarUrl(row.userId, Boolean(row.avatarUrl), row.updatedAt.toISOString()),
        avatarTransform: parseAvatarTransform(row.avatarTransform) ?? defaultAvatarTransform(),
      })
    }
  }
  catch {
    // módulo Conta ausente
  }

  return users.map((user) => toUserDto(user, avatarByUser.get(user.id) ?? null))
}

export async function listRoleOptions(): Promise<PanelRoleOption[]> {
  const roles = await listRoles()
  return roles.map((role) => ({
    id: role.id,
    key: role.key,
    name: role.name,
    isSystem: role.isSystem,
  }))
}

export async function getPanelUser(id: string): Promise<PanelUserDto | null> {
  await ensureRolesSeeded()
  const prisma = usePrisma()
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      role: { select: { key: true, name: true } },
    },
  })
  return user ? toUserDto(user) : null
}

export async function getPanelUserDetail(id: string): Promise<PanelUserDetailDto | null> {
  await ensureRolesSeeded()
  const prisma = usePrisma()
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      role: { select: { key: true, name: true } },
    },
  })
  if (!user) return null

  const base = toUserDto(user)

  let profile: PanelUserDetailDto['profile'] = null
  let avatarUrl: string | null = null
  let avatarTransform: AvatarTransform | null = null
  try {
    const row = await prisma.accountProfile.findUnique({ where: { userId: id } })
    if (row) {
      const transform = parseAvatarTransform(row.avatarTransform)
      avatarUrl = panelAvatarUrl(id, Boolean(row.avatarUrl), row.updatedAt.toISOString())
      avatarTransform = transform ?? (row.avatarUrl ? defaultAvatarTransform() : null)
      profile = {
        avatarUrl,
        avatarTransform,
        recoveryEmail: row.recoveryEmail,
        showBirthDate: row.showBirthDate,
        hideBirthYear: row.hideBirthYear,
        passwordAlerts: row.passwordAlerts,
        usernameChangeCount: row.usernameChangeCount,
        usernameWindowStartedAt: row.usernameWindowStartedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
    }
  }
  catch {
    profile = null
  }

  let sessions = { active: 0, total: 0 }
  try {
    const now = new Date()
    const [active, total] = await Promise.all([
      prisma.authSession.count({
        where: {
          userId: id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      }),
      prisma.authSession.count({ where: { userId: id } }),
    ])
    sessions = { active, total }
  }
  catch {
    sessions = { active: 0, total: 0 }
  }

  let twoFactor: PanelUserDetailDto['twoFactor'] = {
    available: false,
    enabled: false,
    totpEnabled: false,
    securityKeyCount: 0,
    recoveryCodesRemaining: 0,
  }
  try {
    const settings = await prisma.twoFactorSettings.findUnique({ where: { userId: id } })
    const [securityKeyCount, recoveryCodesRemaining] = await Promise.all([
      prisma.webAuthnCredential.count({ where: { userId: id } }),
      prisma.twoFactorRecoveryCode.count({ where: { userId: id, usedAt: null } }),
    ])
    const totpEnabled = Boolean(settings?.totpEnabled)
    twoFactor = {
      available: true,
      enabled: totpEnabled || securityKeyCount > 0,
      totpEnabled,
      securityKeyCount,
      recoveryCodesRemaining,
    }
  }
  catch {
    twoFactor = {
      available: false,
      enabled: false,
      totpEnabled: false,
      securityKeyCount: 0,
      recoveryCodesRemaining: 0,
    }
  }

  return {
    ...base,
    avatarUrl,
    avatarTransform,
    birthDate: formatDateOnly(user.birthDate),
    oldEmail: user.oldEmail,
    hasPassword: Boolean(user.passwordHash),
    loginAttemptCount: user.loginAttemptCount,
    loginGlobalCount: user.loginGlobalCount,
    loginWindowEndsAt: user.loginWindowEndsAt?.toISOString() ?? null,
    loginBlockedUntil: user.loginBlockedUntil?.toISOString() ?? null,
    loginLastAttemptAt: user.loginLastAttemptAt?.toISOString() ?? null,
    profile,
    sessions,
    twoFactor,
  }
}

async function countEnabledAdmins(excludeUserId?: string) {
  const prisma = usePrisma()
  return prisma.user.count({
    where: {
      enabled: true,
      role: { key: SYSTEM_ROLE_KEYS.admin },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  })
}

export async function updatePanelUser(
  id: string,
  input: {
    name?: string
    roleId?: string | null
    enabled?: boolean
  },
  actorUserId: string,
) {
  await ensureRolesSeeded()
  const prisma = usePrisma()

  const existing = await prisma.user.findUnique({
    where: { id },
    include: { role: { select: { key: true } } },
  })
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Usuário não encontrado.' })
  }

  const data: {
    name?: string | null
    roleId?: string | null
    enabled?: boolean
  } = {}

  if (typeof input.name === 'string') {
    const name = input.name.trim()
    data.name = name || null
  }

  if (input.roleId !== undefined) {
    const nextRoleId = input.roleId ? String(input.roleId).trim() : null
    if (!nextRoleId) {
      throw createError({ statusCode: 400, message: 'Informe um tipo de permissão.' })
    }

    const nextRole = await prisma.role.findUnique({ where: { id: nextRoleId } })
    if (!nextRole) {
      throw createError({ statusCode: 400, message: 'Tipo de permissão inválido.' })
    }

    const wasAdmin = existing.role?.key === SYSTEM_ROLE_KEYS.admin
    const willBeAdmin = nextRole.key === SYSTEM_ROLE_KEYS.admin

    if (wasAdmin && !willBeAdmin && existing.enabled) {
      const remaining = await countEnabledAdmins(existing.id)
      if (remaining < 1) {
        throw createError({
          statusCode: 400,
          message: 'Não é possível remover o último administrador.',
        })
      }
    }

    data.roleId = nextRoleId
  }

  if (typeof input.enabled === 'boolean' && input.enabled !== existing.enabled) {
    if (!input.enabled && id === actorUserId) {
      throw createError({
        statusCode: 400,
        message: 'Você não pode desativar a própria conta.',
      })
    }

    if (
      !input.enabled
      && existing.enabled
      && existing.role?.key === SYSTEM_ROLE_KEYS.admin
    ) {
      const remaining = await countEnabledAdmins(existing.id)
      if (remaining < 1) {
        throw createError({
          statusCode: 400,
          message: 'Não é possível desativar o último administrador ativo.',
        })
      }
    }

    data.enabled = input.enabled
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    include: {
      role: { select: { key: true, name: true } },
    },
  })

  if (data.enabled === false) {
    await revokeAllSessionsForUser(id).catch(() => {})
  }

  return toUserDto(updated)
}
