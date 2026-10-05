import { getRequestIP } from 'h3'
import { validateCredentials } from '../../utils/auth'
import { createAuthSessionFromEvent } from '../../utils/sessions'
import {
  assertLoginRateLimit,
  clearLoginRateLimit,
  getLoginSettings,
  recordLoginFailure,
} from '../../utils/login-rate-limit'
import { getUserPermissionKeys } from '../../../modules/roles/server/utils/roles'
import { LOGIN_GLOBAL_BLOCK_HOURS } from '../../../modules/login/shared/login-settings'
import { getTwoFactorLoginApi } from '../../utils/two-factor-bridge'
import { getTurnstileLoginApi } from '../../utils/turnstile-bridge'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    email?: string
    password?: string
    remember?: boolean
    turnstileToken?: string
  }>(event)

  const settings = await getLoginSettings()
  const email = body?.email?.trim() ?? ''
  const password = body?.password ?? ''
  const remember = Boolean(body?.remember)
  const allowUsername = settings.allowUsernameLogin

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: allowUsername
        ? 'Informe e-mail ou nome de usuário e senha.'
        : 'Informe e-mail e senha.',
    })
  }

  if (!allowUsername && !email.includes('@')) {
    throw createError({
      statusCode: 400,
      message: 'Informe um e-mail válido.',
    })
  }

  const turnstile = getTurnstileLoginApi()
  if (turnstile && await turnstile.isRequired()) {
    const ip = getRequestIP(event, { xForwardedFor: true })
    await turnstile.verifyToken(body?.turnstileToken?.trim() ?? '', ip)
  }

  const rate = await assertLoginRateLimit(email, { allowUsername })
  if (!rate.allowed) {
    setHeader(event, 'Retry-After', String(rate.retryAfterSeconds))
    throw createError({
      statusCode: rate.statusCode,
      message: rate.message,
      data: {
        kind: rate.kind,
        retryAfterSeconds: rate.retryAfterSeconds,
      },
    })
  }

  const user = await validateCredentials(email, password, { allowUsername })

  if (!user) {
    const failure = await recordLoginFailure(email, { allowUsername })

    if (failure.globalLocked && failure.blockedUntil) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((failure.blockedUntil.getTime() - Date.now()) / 1000),
      )
      setHeader(event, 'Retry-After', String(retryAfterSeconds))
      throw createError({
        statusCode: 429,
        message: `Muitas tentativas. Conta bloqueada por ${LOGIN_GLOBAL_BLOCK_HOURS} horas.`,
        data: {
          kind: 'global',
          retryAfterSeconds,
          globalCount: failure.globalCount,
          loginGlobalMaxAttempts: failure.loginGlobalMaxAttempts,
        },
      })
    }

    if (failure.windowLocked && failure.windowEndsAt) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((failure.windowEndsAt.getTime() - Date.now()) / 1000),
      )
      setHeader(event, 'Retry-After', String(retryAfterSeconds))
      throw createError({
        statusCode: 429,
        message: `Muitas tentativas. Aguarde ${failure.loginRateLimitMinutes} min para tentar de novo.`,
        data: {
          kind: 'window',
          retryAfterSeconds,
          remainingAttempts: 0,
        },
      })
    }

    throw createError({
      statusCode: 401,
      message: allowUsername
        ? 'Credenciais inválidas.'
        : 'E-mail ou senha inválidos.',
      data: {
        remainingAttempts: failure.remainingAttempts,
      },
    })
  }

  await clearLoginRateLimit(email, { allowUsername, userId: user.id })

  const twoFactor = getTwoFactorLoginApi()
  if (twoFactor && await twoFactor.userHasTwoFactor(user.id)) {
    return await twoFactor.createLoginChallenge(event, user.id)
  }

  const access = await getUserPermissionKeys(user.id)
  const { token } = await createAuthSessionFromEvent(event, user.id, { remember })

  return {
    token,
    user: {
      ...user,
      roleKey: access.roleKey ?? user.roleKey ?? null,
      permissions: access.permissions,
    },
  }
})
