import type { H3Event } from 'h3'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { createError } from 'h3'

export type TwoFactorLoginApi = {
  userHasTwoFactor: (userId: string) => Promise<boolean>
  createLoginChallenge: (event: H3Event, userId: string) => Promise<unknown>
  completeLoginWithTotp: (
    event: H3Event,
    challengeToken: string,
    code: string,
  ) => Promise<unknown>
  completeLoginWithWebAuthn: (
    event: H3Event,
    challengeToken: string,
    response: AuthenticationResponseJSON,
  ) => Promise<unknown>
}

let registered: TwoFactorLoginApi | null = null

/** Chamado pelo plugin Nitro do módulo auth.two-factor no boot. */
export function registerTwoFactorLoginApi(api: TwoFactorLoginApi) {
  registered = api
}

export function getTwoFactorLoginApi(): TwoFactorLoginApi | null {
  return registered
}

export function requireTwoFactorLoginApi(): TwoFactorLoginApi {
  if (!registered) {
    throw createError({
      statusCode: 400,
      message:
        'Módulo de autenticação de dois fatores não está disponível. Instale auth.two-factor pela loja.',
    })
  }
  return registered
}
