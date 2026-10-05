export const LOGIN_MODULE_ID = 'auth.login'

/** Bloqueio longo após esgotar o rate limit global (horas). */
export const LOGIN_GLOBAL_BLOCK_HOURS = 24

export const loginSettingsDefaults = {
  allowUsernameLogin: false,
  allowRememberAccount: true,
  /** Tentativas na janela antes do bloqueio temporário. */
  loginMaxAttempts: 3,
  /** Duração do bloqueio temporário após esgotar a janela. */
  loginRateLimitMinutes: 15,
  /** Total de falhas acumuladas antes do bloqueio longo (24h). */
  loginGlobalMaxAttempts: 9,
} as const
