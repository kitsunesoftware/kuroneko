import { createError } from 'h3'

export type TurnstileLoginApi = {
  /** true se o módulo está ativo e as chaves estão configuradas. */
  isRequired: () => Promise<boolean>
  /** Site key pública (widget), ou null se não aplicável. */
  getSiteKey: () => Promise<string | null>
  /** Valida o token do widget junto à Cloudflare. */
  verifyToken: (token: string, ip?: string | null) => Promise<void>
}

let registered: TurnstileLoginApi | null = null

/** Chamado pelo plugin Nitro do módulo auth.login.turnstile no boot. */
export function registerTurnstileLoginApi(api: TurnstileLoginApi) {
  registered = api
}

export function getTurnstileLoginApi(): TurnstileLoginApi | null {
  return registered
}

export function requireTurnstileLoginApi(): TurnstileLoginApi {
  if (!registered) {
    throw createError({
      statusCode: 400,
      message:
        'Módulo Turnstile não está disponível. Instale auth.login.turnstile pela loja.',
    })
  }
  return registered
}
