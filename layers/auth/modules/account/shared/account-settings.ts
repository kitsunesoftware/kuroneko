export const ACCOUNT_MODULE_ID = 'auth.account'

export const accountSettingsDefaults = {
  imageExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  imageMaxSizeMb: 2,
  imageStorageBackend: 'local' as 'local' | 'seafile',
  imageLocalPath: 'storage/avatars',
  /** Pasta na library Seafile (conexão vem de panel.seafile). */
  imageSeafilePath: '/avatars',
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
} as const
