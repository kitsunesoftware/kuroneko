import { scryptSync, timingSafeEqual } from 'node:crypto'
import argon2 from 'argon2'

export {
  validatePasswordPolicy,
  type PasswordPolicy,
} from '../../shared/password-policy'

/** Gera hash Argon2id (string PHC, ex.: `$argon2id$...`). */
export async function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 1,
  })
}

/**
 * Verifica senha contra hash armazenado.
 * Aceita Argon2id (atual) e scrypt legado (`scrypt:salt:hash`).
 */
export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false

  if (stored.startsWith('$argon2')) {
    try {
      return await argon2.verify(stored, password)
    }
    catch {
      return false
    }
  }

  // Legado scrypt (migração automática no login).
  const [algo, salt, hash] = stored.split(':')
  if (algo !== 'scrypt' || !salt || !hash) return false

  const next = scryptSync(password, salt, 64)
  const prev = Buffer.from(hash, 'hex')
  if (prev.length !== next.length) return false
  return timingSafeEqual(prev, next)
}

/** Indica se o hash deve ser regenerado no próximo login bem-sucedido. */
export function passwordNeedsRehash(stored: string | null | undefined) {
  if (!stored) return true
  return !stored.startsWith('$argon2id$')
}
