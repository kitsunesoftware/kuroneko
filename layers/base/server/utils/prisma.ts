import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#prisma/client'

const globalForPrisma = globalThis as typeof globalThis & {
  __kuronekoPrisma?: PrismaClient
}

export function createPrismaClient(connectionString?: string) {
  const url = (connectionString ?? process.env.DATABASE_URL ?? '').trim()
  if (!url) {
    throw new Error('DATABASE_URL ausente.')
  }
  const adapter = new PrismaPg({ connectionString: url })
  return new PrismaClient({ adapter })
}

export function usePrisma() {
  if (!globalForPrisma.__kuronekoPrisma) {
    globalForPrisma.__kuronekoPrisma = createPrismaClient()
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
