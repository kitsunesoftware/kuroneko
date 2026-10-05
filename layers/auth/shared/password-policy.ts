import { accountSettingsDefaults } from '../modules/account/shared/account-settings'

export type PasswordPolicy = {
  minLength: number
  maxLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumber: boolean
  requireSpecial: boolean
}

export type PasswordRuleKey =
  | 'length'
  | 'uppercase'
  | 'lowercase'
  | 'number'
  | 'special'
  | 'confirm'

export type PasswordRule = {
  key: PasswordRuleKey
  label: string
  met: boolean
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: accountSettingsDefaults.passwordMinLength,
  maxLength: accountSettingsDefaults.passwordMaxLength,
  requireUppercase: accountSettingsDefaults.passwordRequireUppercase,
  requireLowercase: accountSettingsDefaults.passwordRequireLowercase,
  requireNumber: accountSettingsDefaults.passwordRequireNumber,
  requireSpecial: accountSettingsDefaults.passwordRequireSpecial,
}

function asNumber(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

/** Monta a política a partir das settings do módulo auth.account. */
export function policyFromAccountSettings(
  settings: Record<string, unknown> | null | undefined,
): PasswordPolicy {
  const stored = settings || {}
  return {
    minLength: asNumber(stored.passwordMinLength, DEFAULT_PASSWORD_POLICY.minLength),
    maxLength: asNumber(stored.passwordMaxLength, DEFAULT_PASSWORD_POLICY.maxLength),
    requireUppercase: asBoolean(stored.passwordRequireUppercase, DEFAULT_PASSWORD_POLICY.requireUppercase),
    requireLowercase: asBoolean(stored.passwordRequireLowercase, DEFAULT_PASSWORD_POLICY.requireLowercase),
    requireNumber: asBoolean(stored.passwordRequireNumber, DEFAULT_PASSWORD_POLICY.requireNumber),
    requireSpecial: asBoolean(stored.passwordRequireSpecial, DEFAULT_PASSWORD_POLICY.requireSpecial),
  }
}

export function evaluatePasswordRules(options: {
  password: string
  confirmPassword?: string | null
  showConfirm?: boolean
  policy?: Partial<PasswordPolicy> | null
}): PasswordRule[] {
  const policy: PasswordPolicy = {
    ...DEFAULT_PASSWORD_POLICY,
    ...options.policy,
  }
  const password = options.password || ''
  const rules: PasswordRule[] = [
    {
      key: 'length',
      label: `Entre ${policy.minLength} e ${policy.maxLength} caracteres`,
      met: password.length >= policy.minLength && password.length <= policy.maxLength,
    },
  ]

  if (policy.requireUppercase) {
    rules.push({
      key: 'uppercase',
      label: '1 letra maiúscula',
      met: /[A-Z]/.test(password),
    })
  }
  if (policy.requireLowercase) {
    rules.push({
      key: 'lowercase',
      label: '1 letra minúscula',
      met: /[a-z]/.test(password),
    })
  }
  if (policy.requireNumber) {
    rules.push({
      key: 'number',
      label: '1 número',
      met: /\d/.test(password),
    })
  }
  if (policy.requireSpecial) {
    rules.push({
      key: 'special',
      label: '1 caractere especial',
      met: /[^A-Za-z0-9]/.test(password),
    })
  }

  const showConfirm = options.showConfirm ?? (options.confirmPassword !== undefined && options.confirmPassword !== null)
  if (showConfirm) {
    const confirm = options.confirmPassword ?? ''
    rules.push({
      key: 'confirm',
      label: 'Senhas coincidem',
      met: password.length > 0 && password === confirm,
    })
  }

  return rules
}

export function isPasswordRulesMet(options: {
  password: string
  confirmPassword?: string | null
  showConfirm?: boolean
  policy?: Partial<PasswordPolicy> | null
}) {
  return evaluatePasswordRules(options).every((rule) => rule.met)
}

export function validatePasswordPolicy(password: string, policy: PasswordPolicy) {
  if (password.length < policy.minLength || password.length > policy.maxLength) {
    return `A senha deve ter entre ${policy.minLength} e ${policy.maxLength} caracteres.`
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return 'A senha deve conter ao menos uma letra maiúscula.'
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    return 'A senha deve conter ao menos uma letra minúscula.'
  }
  if (policy.requireNumber && !/\d/.test(password)) {
    return 'A senha deve conter ao menos um número.'
  }
  if (policy.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    return 'A senha deve conter ao menos um caractere especial.'
  }
  return null
}
