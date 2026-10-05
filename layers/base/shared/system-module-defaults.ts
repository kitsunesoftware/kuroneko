import type { ModuleSettingsValues } from './types/module-settings'

/**
 * Defaults de settings dos módulos de sistema (seed no boot).
 * Mantido alinhado aos defaults dos plugins de cada módulo.
 */
export const SYSTEM_MODULE_SETTINGS_DEFAULTS: Record<string, ModuleSettingsValues> = {
  'auth.login': {
    allowUsernameLogin: false,
    allowRememberAccount: true,
    loginMaxAttempts: 3,
    loginRateLimitMinutes: 15,
    loginGlobalMaxAttempts: 9,
  },
  'auth.register': {
    enableEmailRegistration: true,
    requireEmailConfirmation: false,
    requireName: true,
    allowNameLater: true,
    requireUsername: true,
    allowUsernameLater: true,
    requireBirthDate: true,
    allowBirthDateLater: true,
  },
  'auth.account': {
    imageExtensions: ['jpg', 'jpeg', 'png', 'webp'],
    imageMaxSizeMb: 2,
    usernameAllowChange: true,
    usernameMinLength: 3,
    usernameMaxLength: 20,
    usernameMaxChanges: 1,
    usernameChangeIntervalDays: 365,
    birthDateMinAge: 13,
    passwordMinLength: 8,
    passwordMaxLength: 64,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecial: false,
    allowAccountDeletion: true,
  },
}
