/**
 * Comparação semver simplificada (MAJOR.MINOR.PATCH[+prerelease ignorado]).
 * Sufixos como `-beta` são ignorados na comparação numérica.
 */
export function parseSemver(raw: string): [number, number, number] | null {
  const cleaned = String(raw || '').trim().replace(/^v/i, '')
  const core = cleaned.split(/[-+]/)[0] || ''
  const parts = core.split('.')
  if (!parts.length || parts.some((part) => part === '' || !/^\d+$/.test(part))) {
    return null
  }
  return [
    Number(parts[0] || 0),
    Number(parts[1] || 0),
    Number(parts[2] || 0),
  ]
}

/** Negativo se a < b, 0 se iguais, positivo se a > b. */
export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a)
  const right = parseSemver(b)
  if (!left || !right) return Number.NaN
  for (let i = 0; i < 3; i += 1) {
    const diff = left[i]! - right[i]!
    if (diff !== 0) return diff
  }
  return 0
}

/** True se `current` atende ao mínimo exigido (`current >= min`). */
export function satisfiesMinVersion(current: string, min: string): boolean {
  const result = compareSemver(current, min)
  if (Number.isNaN(result)) return false
  return result >= 0
}
