export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

const USERNAME_RE = /^(?!_)[a-z0-9._]{3,20}$/

export type UsernameRuleKey = 'length' | 'chars' | 'start' | 'available'

export type UsernameRule = {
  key: UsernameRuleKey
  label: string
  met: boolean
}

/** `null` = ainda verificando / formato inválido. */
export type UsernameAvailability = boolean | null

/** Normaliza e valida; retorna null se inválido. */
export function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim().toLowerCase()
  if (!USERNAME_RE.test(value)) return null
  return value
}

/** Remove caracteres inválidos enquanto digita (a-z, 0-9, . _). */
export function sanitizeUsernameInput(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, USERNAME_MAX)
}

export function usernameRuleChecks(
  raw: string,
  options?: { available?: UsernameAvailability },
): UsernameRule[] {
  const value = String(raw || '').trim().toLowerCase()
  const rules: UsernameRule[] = [
    {
      key: 'length',
      label: `Entre ${USERNAME_MIN} e ${USERNAME_MAX} caracteres`,
      met: value.length >= USERNAME_MIN && value.length <= USERNAME_MAX,
    },
    {
      key: 'chars',
      label: 'Apenas letras, números, ponto e underline',
      met: value.length > 0 && /^[a-z0-9._]+$/.test(value),
    },
    {
      key: 'start',
      label: 'Não pode começar com underline',
      met: value.length > 0 && !value.startsWith('_'),
    },
  ]

  if (options && 'available' in options) {
    rules.push({
      key: 'available',
      label: 'Disponível para uso',
      met: options.available === true,
    })
  }

  return rules
}

export function isUsernameFormatMet(raw: string) {
  return Boolean(normalizeUsername(raw))
}

/** Formato válido; se `available` for informado, também exige disponibilidade. */
export function isUsernameRulesMet(
  raw: string,
  options?: { available?: UsernameAvailability },
) {
  if (!isUsernameFormatMet(raw)) return false
  if (options && 'available' in options) {
    return options.available === true
  }
  return true
}
