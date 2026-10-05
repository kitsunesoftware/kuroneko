import { getModuleSettings } from '../../../base/server/utils/module-settings'
import { usePrisma } from '../../../base/server/utils/prisma'
import {
  LOGIN_GLOBAL_BLOCK_HOURS,
  LOGIN_MODULE_ID,
  loginSettingsDefaults,
} from '../../modules/login/shared/login-settings'

export type LoginSettings = {
  allowUsernameLogin: boolean
  allowRememberAccount: boolean
  loginMaxAttempts: number
  loginRateLimitMinutes: number
  loginGlobalMaxAttempts: number
}

type RateState = {
  attemptCount: number
  globalCount: number
  windowEndsAt: Date | null
  blockedUntil: Date | null
}

export type LoginFailureResult = {
  remainingAttempts: number
  windowLocked?: boolean
  globalLocked?: boolean
  windowEndsAt?: Date | null
  blockedUntil?: Date | null
  loginMaxAttempts?: number
  loginRateLimitMinutes?: number
  loginGlobalMaxAttempts?: number
  globalCount?: number
}

function asBool(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value
  return fallback
}

function asPositiveInt(value: unknown, fallback: number, min = 1, max = 10_000) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export async function getLoginSettings(): Promise<LoginSettings> {
  const stored = await getModuleSettings(LOGIN_MODULE_ID)
  return {
    allowUsernameLogin: asBool(
      stored.allowUsernameLogin,
      loginSettingsDefaults.allowUsernameLogin,
    ),
    allowRememberAccount: asBool(
      stored.allowRememberAccount,
      loginSettingsDefaults.allowRememberAccount,
    ),
    loginMaxAttempts: asPositiveInt(
      stored.loginMaxAttempts,
      loginSettingsDefaults.loginMaxAttempts,
      1,
      50,
    ),
    loginRateLimitMinutes: asPositiveInt(
      stored.loginRateLimitMinutes,
      loginSettingsDefaults.loginRateLimitMinutes,
      1,
      1440,
    ),
    loginGlobalMaxAttempts: asPositiveInt(
      stored.loginGlobalMaxAttempts,
      loginSettingsDefaults.loginGlobalMaxAttempts,
      1,
      500,
    ),
  }
}

export function normalizeLoginRateKey(identifier: string) {
  return identifier.trim().toLowerCase()
}

function remainingMessage(until: Date, now = new Date()) {
  const ms = until.getTime() - now.getTime()
  if (ms <= 0) return 'alguns instantes'
  const minutes = Math.ceil(ms / 60_000)
  if (minutes >= 60) {
    const hours = Math.ceil(minutes / 60)
    return hours === 1 ? 'cerca de 1 hora' : `cerca de ${hours} horas`
  }
  return minutes === 1 ? 'cerca de 1 minuto' : `cerca de ${minutes} minutos`
}

export type LoginRateLimitCheck = {
  allowed: true
} | {
  allowed: false
  statusCode: 429
  message: string
  retryAfterSeconds: number
  kind: 'window' | 'global'
}

function evaluateLock(
  state: RateState,
  settings: LoginSettings,
  now: Date,
): LoginRateLimitCheck {
  if (state.blockedUntil && state.blockedUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((state.blockedUntil.getTime() - now.getTime()) / 1000))
    return {
      allowed: false,
      statusCode: 429,
      kind: 'global',
      retryAfterSeconds,
      message: `Muitas tentativas. Conta bloqueada por ${LOGIN_GLOBAL_BLOCK_HOURS} horas. Tente novamente em ${remainingMessage(state.blockedUntil, now)}.`,
    }
  }

  const windowActive = Boolean(state.windowEndsAt && state.windowEndsAt > now)
  if (windowActive && state.attemptCount >= settings.loginMaxAttempts) {
    const until = state.windowEndsAt!
    const retryAfterSeconds = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000))
    return {
      allowed: false,
      statusCode: 429,
      kind: 'window',
      retryAfterSeconds,
      message: `Muitas tentativas. Aguarde ${remainingMessage(until, now)} para tentar de novo.`,
    }
  }

  return { allowed: true }
}

function nextFailureState(existing: RateState | null, settings: LoginSettings, now: Date) {
  let attemptCount = existing?.attemptCount ?? 0
  let globalCount = existing?.globalCount ?? 0
  let windowEndsAt = existing?.windowEndsAt ?? null
  let blockedUntil = existing?.blockedUntil && existing.blockedUntil > now
    ? existing.blockedUntil
    : null

  // Só reinicia a janela quando o bloqueio temporário expirou.
  if (windowEndsAt && windowEndsAt <= now) {
    attemptCount = 0
    windowEndsAt = null
  }

  // Bloqueio global expirado → zera acumulado global.
  if (existing?.blockedUntil && existing.blockedUntil <= now) {
    globalCount = 0
    blockedUntil = null
  }

  attemptCount += 1
  globalCount += 1

  if (attemptCount >= settings.loginMaxAttempts) {
    windowEndsAt = new Date(now.getTime() + settings.loginRateLimitMinutes * 60_000)
  }

  if (globalCount >= settings.loginGlobalMaxAttempts) {
    blockedUntil = new Date(now.getTime() + LOGIN_GLOBAL_BLOCK_HOURS * 60 * 60_000)
    attemptCount = settings.loginMaxAttempts
    windowEndsAt = blockedUntil
  }

  return { attemptCount, globalCount, windowEndsAt, blockedUntil }
}

function failureResult(
  state: RateState,
  settings: LoginSettings,
  now: Date,
): LoginFailureResult {
  return {
    remainingAttempts: Math.max(0, settings.loginMaxAttempts - state.attemptCount),
    windowLocked: Boolean(
      state.windowEndsAt
      && state.windowEndsAt > now
      && state.attemptCount >= settings.loginMaxAttempts,
    ),
    globalLocked: Boolean(state.blockedUntil && state.blockedUntil > now),
    windowEndsAt: state.windowEndsAt,
    blockedUntil: state.blockedUntil,
    loginMaxAttempts: settings.loginMaxAttempts,
    loginRateLimitMinutes: settings.loginRateLimitMinutes,
    loginGlobalMaxAttempts: settings.loginGlobalMaxAttempts,
    globalCount: state.globalCount,
  }
}

/**
 * Localiza usuário pelo e-mail atual, e-mail antigo ou username.
 * Usado só para rate limit (não autentica com oldEmail).
 */
export async function findUserForLoginRateLimit(
  identifier: string,
  options: { allowUsername?: boolean } = {},
) {
  const prisma = usePrisma()
  const value = normalizeLoginRateKey(identifier)
  if (!value) return null

  if (value.includes('@')) {
    return prisma.user.findFirst({
      where: {
        OR: [
          { email: value },
          { oldEmail: value },
        ],
      },
      select: {
        id: true,
        email: true,
        oldEmail: true,
        loginAttemptCount: true,
        loginGlobalCount: true,
        loginWindowEndsAt: true,
        loginBlockedUntil: true,
      },
    }).catch(() => null)
  }

  if (!options.allowUsername) return null

  return prisma.user.findFirst({
    where: {
      username: {
        equals: value,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      email: true,
      oldEmail: true,
      loginAttemptCount: true,
      loginGlobalCount: true,
      loginWindowEndsAt: true,
      loginBlockedUntil: true,
    },
  }).catch(() => null)
}

/** Atualiza e-mail da conta guardando o anterior em oldEmail (rate limit continua na mesma row). */
export async function changeUserEmail(userId: string, nextEmail: string) {
  const prisma = usePrisma()
  const email = normalizeLoginRateKey(nextEmail)
  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, message: 'E-mail inválido.' })
  }

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, oldEmail: true },
  })
  if (!current) {
    throw createError({ statusCode: 404, message: 'Usuário não encontrado.' })
  }

  const previous = current.email?.trim().toLowerCase() || null
  if (previous === email) return current

  const taken = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { oldEmail: email }],
      NOT: { id: userId },
    },
    select: { id: true },
  })
  if (taken) {
    throw createError({ statusCode: 409, message: 'Este e-mail já está em uso.' })
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      email,
      oldEmail: previous || current.oldEmail,
    },
    select: { id: true, email: true, oldEmail: true },
  })
}

/** Verifica se o identificador pode tentar login agora (User ou fallback sem conta). */
export async function assertLoginRateLimit(
  identifier: string,
  options: { allowUsername?: boolean } = {},
): Promise<LoginRateLimitCheck> {
  const settings = await getLoginSettings()
  const key = normalizeLoginRateKey(identifier)
  if (!key) return { allowed: true }

  const now = new Date()
  const user = await findUserForLoginRateLimit(key, options)
  if (user) {
    return evaluateLock({
      attemptCount: user.loginAttemptCount,
      globalCount: user.loginGlobalCount,
      windowEndsAt: user.loginWindowEndsAt,
      blockedUntil: user.loginBlockedUntil,
    }, settings, now)
  }

  const prisma = usePrisma()
  const row = await prisma.loginRateLimit.findUnique({ where: { key } }).catch(() => null)
  if (!row) return { allowed: true }

  return evaluateLock({
    attemptCount: row.attemptCount,
    globalCount: row.globalCount,
    windowEndsAt: row.windowEndsAt,
    blockedUntil: row.blockedUntil,
  }, settings, now)
}

/** Registra falha de login no User (ou LoginRateLimit se a conta não existir). */
export async function recordLoginFailure(
  identifier: string,
  options: { allowUsername?: boolean } = {},
): Promise<LoginFailureResult> {
  const settings = await getLoginSettings()
  const key = normalizeLoginRateKey(identifier)
  if (!key) return { remainingAttempts: settings.loginMaxAttempts }

  const prisma = usePrisma()
  const now = new Date()

  try {
    const user = await findUserForLoginRateLimit(key, options)
    if (user) {
      const next = nextFailureState({
        attemptCount: user.loginAttemptCount,
        globalCount: user.loginGlobalCount,
        windowEndsAt: user.loginWindowEndsAt,
        blockedUntil: user.loginBlockedUntil,
      }, settings, now)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttemptCount: next.attemptCount,
          loginGlobalCount: next.globalCount,
          loginWindowEndsAt: next.windowEndsAt,
          loginBlockedUntil: next.blockedUntil,
          loginLastAttemptAt: now,
        },
      })

      return failureResult(next, settings, now)
    }

    const existing = await prisma.loginRateLimit.findUnique({ where: { key } })
    const next = nextFailureState(existing, settings, now)

    await prisma.loginRateLimit.upsert({
      where: { key },
      create: {
        key,
        attemptCount: next.attemptCount,
        globalCount: next.globalCount,
        windowEndsAt: next.windowEndsAt,
        blockedUntil: next.blockedUntil,
      },
      update: {
        attemptCount: next.attemptCount,
        globalCount: next.globalCount,
        windowEndsAt: next.windowEndsAt,
        blockedUntil: next.blockedUntil,
      },
    })

    return failureResult(next, settings, now)
  }
  catch {
    return { remainingAttempts: settings.loginMaxAttempts }
  }
}

/** Limpa contadores após login bem-sucedido. */
export async function clearLoginRateLimit(
  identifier: string,
  options: { allowUsername?: boolean, userId?: string } = {},
) {
  const prisma = usePrisma()
  const now = new Date()

  if (options.userId) {
    await prisma.user.update({
      where: { id: options.userId },
      data: {
        loginAttemptCount: 0,
        loginGlobalCount: 0,
        loginWindowEndsAt: null,
        loginBlockedUntil: null,
        loginLastAttemptAt: now,
      },
    }).catch(() => {})
  }
  else {
    const user = await findUserForLoginRateLimit(identifier, options)
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttemptCount: 0,
          loginGlobalCount: 0,
          loginWindowEndsAt: null,
          loginBlockedUntil: null,
          loginLastAttemptAt: now,
        },
      }).catch(() => {})
    }
  }

  const key = normalizeLoginRateKey(identifier)
  if (key) {
    await prisma.loginRateLimit.deleteMany({ where: { key } }).catch(() => {})
  }
}
