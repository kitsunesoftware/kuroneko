import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as typeof globalThis & {
  __kuronekoPrisma?: PrismaClient
}

export function usePrisma() {
  if (!globalForPrisma.__kuronekoPrisma) {
    globalForPrisma.__kuronekoPrisma = new PrismaClient()
  }
  return globalForPrisma.__kuronekoPrisma
}

/** Reconecta o client após mudar DATABASE_URL em runtime. */
export async function resetPrismaClient() {
  if (globalForPrisma.__kuronekoPrisma) {
    await globalForPrisma.__kuronekoPrisma.$disconnect().catch(() => {})
    globalForPrisma.__kuronekoPrisma = undefined
  }
}
