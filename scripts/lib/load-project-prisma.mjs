/**
 * Prisma Client gerado na raiz do projeto (Prisma 7 + adapter pg).
 * O client fica em `<projeto>/generated/prisma`, não em `@prisma/client`.
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

function resolveGeneratedEntry(projectRoot) {
  const candidates = [
    join(projectRoot, 'generated', 'prisma', 'client.js'),
    join(projectRoot, 'generated', 'prisma', 'client.ts'),
  ]
  const found = candidates.find((path) => existsSync(path))
  if (!found) {
    throw new Error(
      `[kuroneko] Client Prisma não gerado em ${join(projectRoot, 'generated/prisma')}. `
      + 'Rode npm run db:generate.',
    )
  }
  return found
}

async function importGenerated(projectRoot) {
  const entry = resolveGeneratedEntry(projectRoot)
  if (entry.endsWith('.js')) return import(pathToFileURL(entry).href)

  try {
    return await import(pathToFileURL(entry).href)
  }
  catch {
    const require = createRequire(join(projectRoot, 'package.json'))
    const jitiMod = require('jiti')
    const createJiti = jitiMod.createJiti || jitiMod.default?.createJiti
    if (!createJiti) {
      throw new Error('[kuroneko] Não foi possível carregar o client gerado. Instale jiti.')
    }
    const jiti = createJiti(import.meta.url)
    return jiti.import(entry)
  }
}

async function loadPrismaPg(projectRoot) {
  const require = createRequire(join(projectRoot, 'package.json'))
  const entry = require.resolve('@prisma/adapter-pg')
  const mod = await import(pathToFileURL(entry).href)
  const PrismaPg = mod.PrismaPg || mod.default?.PrismaPg
  if (!PrismaPg) {
    throw new Error('[kuroneko] PrismaPg ausente. Rode npm i @prisma/adapter-pg no projeto.')
  }
  return PrismaPg
}

export async function createProjectPrismaClient(projectRoot, connectionString) {
  const url = String(connectionString ?? process.env.DATABASE_URL ?? '').trim()
  if (!url) throw new Error('[kuroneko] DATABASE_URL ausente.')

  const mod = await importGenerated(projectRoot)
  const PrismaClient = mod.PrismaClient || mod.default?.PrismaClient
  if (!PrismaClient) {
    throw new Error('[kuroneko] PrismaClient ausente no client gerado. Rode npm run db:generate.')
  }

  const PrismaPg = await loadPrismaPg(projectRoot)
  const adapter = new PrismaPg({ connectionString: url })
  return new PrismaClient({ adapter })
}
