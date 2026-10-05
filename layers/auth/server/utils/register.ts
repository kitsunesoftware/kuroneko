import { randomBytes } from 'node:crypto'
import { usePrisma } from '../../../base/server/utils/prisma'
import { getModuleSettings } from '../../../base/server/utils/module-settings'
import { ACCOUNT_MODULE_ID, accountSettingsDefaults } from '../../modules/account/shared/account-settings'
import { getDefaultUserRoleId } from '../../modules/roles/server/utils/roles'
import { toAuthUser, type AuthUser } from './sessions'
import {
  hashPassword,
  validatePasswordPolicy,
  type PasswordPolicy,
} from './password'
import { normalizeUsername as normalizeUsernamePolicy } from '../../shared/username-policy'

const PENDING_TTL_MS = 1000 * 60 * 60 * 24

export type CreateUserInput = {
  email: string
  password: string
  name?: string
  username?: string | null
  birthDate?: string | null
}

function asNumber(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  const stored = await getModuleSettings(ACCOUNT_MODULE_ID)
  return {
    minLength: asNumber(stored.passwordMinLength, accountSettingsDefaults.passwordMinLength),
    maxLength: asNumber(stored.passwordMaxLength, accountSettingsDefaults.passwordMaxLength),
    requireUppercase: typeof stored.passwordRequireUppercase === 'boolean'
      ? stored.passwordRequireUppercase
      : accountSettingsDefaults.passwordRequireUppercase,
    requireLowercase: typeof stored.passwordRequireLowercase === 'boolean'
      ? stored.passwordRequireLowercase
      : accountSettingsDefaults.passwordRequireLowercase,
    requireNumber: typeof stored.passwordRequireNumber === 'boolean'
      ? stored.passwordRequireNumber
      : accountSettingsDefaults.passwordRequireNumber,
    requireSpecial: typeof stored.passwordRequireSpecial === 'boolean'
      ? stored.passwordRequireSpecial
      : accountSettingsDefaults.passwordRequireSpecial,
  }
}

export function parseBirthDate(value: string) {
  const raw = value.trim()
  if (!raw) return null

  // input type="date" → YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    const birth = new Date(Date.UTC(year, month - 1, day))
    if (
      birth.getUTCFullYear() !== year
      || birth.getUTCMonth() !== month - 1
      || birth.getUTCDate() !== day
    ) {
      return null
    }
    return birth
  }

  // legado DD/MM/AAAA
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw)
  if (!br) return null

  const day = Number(br[1])
  const month = Number(br[2])
  const year = Number(br[3])
  const birth = new Date(Date.UTC(year, month - 1, day))
  if (
    birth.getUTCFullYear() !== year
    || birth.getUTCMonth() !== month - 1
    || birth.getUTCDate() !== day
  ) {
    return null
  }
  return birth
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeUsername(username?: string | null) {
  const raw = username?.trim() ?? ''
  if (!raw) return null
  const normalized = normalizeUsernamePolicy(raw)
  if (!normalized) {
    throw createError({
      statusCode: 400,
      message: 'Informe um nome de usuário válido (3–20 caracteres; letras, números, ponto ou underline; não pode começar com _).',
    })
  }
  return normalized
}

export async function assertEmailAvailable(email: string) {
  const prisma = usePrisma()
  const existing = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true },
  })
  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'Já existe uma conta com este e-mail.',
    })
  }
}

export async function assertUsernameAvailable(username: string) {
  const prisma = usePrisma()
  const existing = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  })
  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'Este nome de usuário já está em uso.',
    })
  }
}

export async function createPendingRegistration(input: { email: string, name?: string }) {
  const prisma = usePrisma()
  const email = normalizeEmail(input.email)
  await assertEmailAvailable(email)

  await prisma.pendingRegistration.deleteMany({
    where: {
      OR: [
        { email },
        { expiresAt: { lte: new Date() } },
      ],
    },
  })

  const token = randomBytes(24).toString('base64url')
  return prisma.pendingRegistration.create({
    data: {
      token,
      email,
      name: input.name?.trim() ?? '',
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
    },
  })
}

export async function getPendingRegistration(token: string) {
  const prisma = usePrisma()
  const pending = await prisma.pendingRegistration.findUnique({ where: { token } })
  if (!pending) return null
  if (pending.expiresAt.getTime() <= Date.now()) {
    await prisma.pendingRegistration.delete({ where: { id: pending.id } }).catch(() => {})
    return null
  }
  return pending
}

export async function consumePendingRegistration(token: string) {
  const pending = await getPendingRegistration(token)
  if (!pending) return null
  const prisma = usePrisma()
  await prisma.pendingRegistration.delete({ where: { id: pending.id } }).catch(() => {})
  return pending
}

export async function createUserAccount(input: CreateUserInput): Promise<AuthUser> {
  const email = normalizeEmail(input.email)
  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, message: 'Informe um e-mail válido.' })
  }

  const policy = await getPasswordPolicy()
  const passwordError = validatePasswordPolicy(input.password, policy)
  if (passwordError) {
    throw createError({ statusCode: 400, message: passwordError })
  }

  await assertEmailAvailable(email)

  const username = normalizeUsername(input.username)
  if (username) {
    await assertUsernameAvailable(username)
  }

  let birthDate: Date | null = null
  if (input.birthDate?.trim()) {
    birthDate = parseBirthDate(input.birthDate)
    if (!birthDate) {
      throw createError({
        statusCode: 400,
        message: 'Informe uma data de nascimento válida.',
      })
    }
  }

  const prisma = usePrisma()
  const roleId = await getDefaultUserRoleId()
  const user = await prisma.user.create({
    data: {
      email,
      username,
      name: input.name?.trim() || email.split('@')[0] || 'Usuário',
      passwordHash: await hashPassword(input.password),
      birthDate,
      roleId,
    },
    include: { role: { select: { key: true } } },
  })

  return toAuthUser(user)
}
