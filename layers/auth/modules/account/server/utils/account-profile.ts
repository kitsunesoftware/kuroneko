import { getModuleSettings } from '../../../../../base/server/utils/module-settings'
import { usePrisma } from '../../../../../base/server/utils/prisma'
import { changeUserEmail } from '../../../../server/utils/login-rate-limit'
import {
  getPasswordPolicy,
  parseBirthDate,
} from '../../../../server/utils/register'
import {
  hashPassword,
  validatePasswordPolicy,
  verifyPassword,
} from '../../../../server/utils/password'
import { toAuthUser } from '../../../../server/utils/sessions'
import { normalizeUsername } from '../../../../shared/username-policy'
import { ACCOUNT_MODULE_ID, accountSettingsDefaults } from '../../shared/account-settings'
import { deleteUserAvatars, getUserAvatar } from './avatar-storage'

function asNumber(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function formatDateBr(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = String(date.getUTCFullYear())
  return `${day}/${month}/${year}`
}

function formatBirthDateInput(date: Date | null | undefined) {
  if (!date) return null
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = String(date.getUTCFullYear())
  return `${year}-${month}-${day}`
}

function ageFromBirthDate(birth: Date) {
  const now = new Date()
  let age = now.getUTCFullYear() - birth.getUTCFullYear()
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1
  }
  return age
}

export type UsernameChangeStatus = {
  allowChange: boolean
  canChange: boolean
  alreadyChanged: boolean
  remaining: number
  nextChangeDate: string | null
  nextChangeAt: string | null
}

export async function getUsernamePolicySettings() {
  const stored = await getModuleSettings(ACCOUNT_MODULE_ID)
  return {
    allowChange: asBoolean(stored.usernameAllowChange, accountSettingsDefaults.usernameAllowChange),
    minLength: asNumber(stored.usernameMinLength, accountSettingsDefaults.usernameMinLength),
    maxLength: asNumber(stored.usernameMaxLength, accountSettingsDefaults.usernameMaxLength),
    maxChanges: asNumber(stored.usernameMaxChanges, accountSettingsDefaults.usernameMaxChanges),
    intervalDays: asNumber(stored.usernameChangeIntervalDays, accountSettingsDefaults.usernameChangeIntervalDays),
    birthDateMinAge: asNumber(stored.birthDateMinAge, accountSettingsDefaults.birthDateMinAge),
    allowAccountDeletion: asBoolean(stored.allowAccountDeletion, accountSettingsDefaults.allowAccountDeletion),
  }
}

function resolveUsernameWindow(
  profile: {
    usernameChangeCount: number
    usernameWindowStartedAt: Date | null
  } | null,
  intervalDays: number,
  maxChanges: number,
  now = new Date(),
) {
  const count = profile?.usernameChangeCount ?? 0
  const windowStart = profile?.usernameWindowStartedAt ?? null
  const windowMs = Math.max(1, intervalDays) * 24 * 60 * 60 * 1000

  if (!windowStart || now.getTime() - windowStart.getTime() >= windowMs) {
    return {
      count: 0,
      windowStart: null as Date | null,
      expired: true,
      canChange: true,
      remaining: Math.max(1, maxChanges),
      nextAt: null as Date | null,
    }
  }

  const remaining = Math.max(0, Math.max(1, maxChanges) - count)
  const nextAt = remaining > 0 ? null : new Date(windowStart.getTime() + windowMs)
  return {
    count,
    windowStart,
    expired: false,
    canChange: remaining > 0,
    remaining,
    nextAt,
  }
}

export function buildUsernameChangeStatus(
  profile: {
    usernameChangeCount: number
    usernameWindowStartedAt: Date | null
  } | null,
  settings: Awaited<ReturnType<typeof getUsernamePolicySettings>>,
): UsernameChangeStatus {
  if (!settings.allowChange) {
    return {
      allowChange: false,
      canChange: false,
      alreadyChanged: false,
      remaining: 0,
      nextChangeDate: null,
      nextChangeAt: null,
    }
  }

  const window = resolveUsernameWindow(profile, settings.intervalDays, settings.maxChanges)
  return {
    allowChange: true,
    canChange: window.canChange,
    alreadyChanged: !window.expired && window.count > 0 && !window.canChange,
    remaining: window.remaining,
    nextChangeDate: window.nextAt ? formatDateBr(window.nextAt) : null,
    nextChangeAt: window.nextAt ? window.nextAt.toISOString() : null,
  }
}

async function ensureAccountProfile(userId: string) {
  const prisma = usePrisma()
  return prisma.accountProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })
}

export async function getAccountProfile(userId: string) {
  const prisma = usePrisma()
  const [user, profile, avatar, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { role: { select: { key: true } } },
    }),
    ensureAccountProfile(userId),
    getUserAvatar(userId),
    getUsernamePolicySettings(),
  ])

  if (!user) {
    throw createError({ statusCode: 404, message: 'Usuário não encontrado.' })
  }

  const authUser = toAuthUser(user)
  const usernameStatus = buildUsernameChangeStatus(profile, settings)

  return {
    user: {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
      username: authUser.username,
      birthDate: formatBirthDateInput(user.birthDate),
      birthDateDisplay: user.birthDate ? formatDateBr(user.birthDate) : null,
    },
    profile: {
      recoveryEmail: profile.recoveryEmail ?? null,
      showBirthDate: profile.showBirthDate,
      hideBirthYear: profile.hideBirthYear,
      passwordAlerts: profile.passwordAlerts,
      avatarUrl: avatar.avatarUrl,
      avatarTransform: avatar.avatarTransform,
    },
    usernameStatus,
    settings: {
      birthDateMinAge: settings.birthDateMinAge,
      allowAccountDeletion: settings.allowAccountDeletion,
      usernameAllowChange: settings.allowChange,
    },
  }
}

export async function updateAccountProfile(
  userId: string,
  input: {
    name?: string
    birthDate?: string | null
    showBirthDate?: boolean
    hideBirthYear?: boolean
    passwordAlerts?: boolean
    recoveryEmail?: string | null
  },
) {
  const prisma = usePrisma()
  const settings = await getUsernamePolicySettings()
  const userData: { name?: string, birthDate?: Date | null } = {}

  if (typeof input.name === 'string') {
    const name = input.name.trim()
    if (!name || name.length < 2) {
      throw createError({ statusCode: 400, message: 'Informe um nome com pelo menos 2 caracteres.' })
    }
    if (name.length > 80) {
      throw createError({ statusCode: 400, message: 'Nome muito longo (máx. 80 caracteres).' })
    }
    userData.name = name
  }

  if (input.birthDate !== undefined) {
    if (input.birthDate === null || input.birthDate === '') {
      userData.birthDate = null
    }
    else {
      const birth = parseBirthDate(input.birthDate)
      if (!birth) {
        throw createError({ statusCode: 400, message: 'Informe uma data de nascimento válida.' })
      }
      if (ageFromBirthDate(birth) < settings.birthDateMinAge) {
        throw createError({
          statusCode: 400,
          message: `Idade mínima: ${settings.birthDateMinAge} anos.`,
        })
      }
      userData.birthDate = birth
    }
  }

  if (Object.keys(userData).length) {
    await prisma.user.update({
      where: { id: userId },
      data: userData,
    })
  }

  const profileData: {
    showBirthDate?: boolean
    hideBirthYear?: boolean
    passwordAlerts?: boolean
    recoveryEmail?: string | null
  } = {}

  if (typeof input.showBirthDate === 'boolean') {
    profileData.showBirthDate = input.showBirthDate
  }
  if (typeof input.hideBirthYear === 'boolean') {
    profileData.hideBirthYear = input.hideBirthYear
  }
  if (typeof input.passwordAlerts === 'boolean') {
    profileData.passwordAlerts = input.passwordAlerts
  }
  if (input.recoveryEmail !== undefined) {
    if (input.recoveryEmail === null || input.recoveryEmail === '') {
      profileData.recoveryEmail = null
    }
    else {
      const email = normalizeEmail(input.recoveryEmail)
      if (!isValidEmail(email)) {
        throw createError({ statusCode: 400, message: 'E-mail de recuperação inválido.' })
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      })
      if (user?.email && user.email === email) {
        throw createError({
          statusCode: 400,
          message: 'Use um e-mail diferente do e-mail principal.',
        })
      }
      profileData.recoveryEmail = email
    }
  }

  if (Object.keys(profileData).length) {
    await prisma.accountProfile.upsert({
      where: { userId },
      create: { userId, ...profileData },
      update: profileData,
    })
  }

  return getAccountProfile(userId)
}

export async function changeAccountUsername(userId: string, rawUsername: string) {
  const settings = await getUsernamePolicySettings()
  if (!settings.allowChange) {
    throw createError({ statusCode: 403, message: 'Alteração de nome de usuário desativada.' })
  }

  const username = normalizeUsername(rawUsername)
  if (!username) {
    throw createError({
      statusCode: 400,
      message: 'Informe um nome de usuário válido (letras, números, ponto ou underline; não começa com _).',
    })
  }

  const prisma = usePrisma()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  })
  if (!user) {
    throw createError({ statusCode: 404, message: 'Usuário não encontrado.' })
  }

  if (user.username?.toLowerCase() === username) {
    throw createError({ statusCode: 400, message: 'Este já é o seu nome de usuário.' })
  }

  const profile = await ensureAccountProfile(userId)
  const window = resolveUsernameWindow(profile, settings.intervalDays, settings.maxChanges)
  if (!window.canChange) {
    throw createError({
      statusCode: 429,
      message: window.nextAt
        ? `Você já atingiu o limite de alterações. Tente novamente em ${formatDateBr(window.nextAt)}.`
        : 'Você já atingiu o limite de alterações de nome de usuário.',
    })
  }

  const taken = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: 'insensitive' },
      NOT: { id: userId },
    },
    select: { id: true },
  })
  if (taken) {
    throw createError({ statusCode: 409, message: 'Este nome de usuário já está em uso.' })
  }

  const now = new Date()
  const nextCount = window.expired ? 1 : window.count + 1
  const nextWindowStart = window.expired ? now : (window.windowStart || now)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { username },
    }),
    prisma.accountProfile.update({
      where: { userId },
      data: {
        usernameChangeCount: nextCount,
        usernameWindowStartedAt: nextWindowStart,
      },
    }),
  ])

  return getAccountProfile(userId)
}

export async function changeAccountEmail(
  userId: string,
  nextEmail: string,
  currentPassword: string,
) {
  await assertCurrentPassword(userId, currentPassword)
  await changeUserEmail(userId, nextEmail)
  return getAccountProfile(userId)
}

export async function changeAccountPassword(
  userId: string,
  currentPassword: string,
  nextPassword: string,
) {
  await assertCurrentPassword(userId, currentPassword)

  if (currentPassword === nextPassword) {
    throw createError({ statusCode: 400, message: 'A nova senha deve ser diferente da atual.' })
  }

  const policy = await getPasswordPolicy()
  const passwordError = validatePasswordPolicy(nextPassword, policy)
  if (passwordError) {
    throw createError({ statusCode: 400, message: passwordError })
  }

  const prisma = usePrisma()
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(nextPassword) },
  })

  return { ok: true }
}

export async function deleteAccount(userId: string, currentPassword: string) {
  const settings = await getUsernamePolicySettings()
  if (!settings.allowAccountDeletion) {
    throw createError({ statusCode: 403, message: 'Exclusão de conta desativada.' })
  }

  await assertCurrentPassword(userId, currentPassword)
  await deleteUserAvatars(userId)

  const prisma = usePrisma()
  await prisma.accountProfile.deleteMany({ where: { userId } }).catch(() => {})
  await prisma.user.delete({ where: { id: userId } })

  return { ok: true }
}

async function assertCurrentPassword(userId: string, password: string) {
  if (!password) {
    throw createError({ statusCode: 400, message: 'Informe a senha atual.' })
  }

  const prisma = usePrisma()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  })
  if (!user?.passwordHash) {
    throw createError({ statusCode: 400, message: 'Esta conta não possui senha configurada.' })
  }

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) {
    throw createError({ statusCode: 401, message: 'Senha atual incorreta.' })
  }
}
