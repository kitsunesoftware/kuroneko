/**
 * Nitro no Windows às vezes deixa `.output/server/node_modules/.prisma/client`
 * só com um stub (`#main-entry-point`). Copia o client gerado da raiz.
 */
import { cpSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const srcPrisma = join(root, 'node_modules', '.prisma')
const srcClient = join(root, 'node_modules', '@prisma')
const destRoot = join(root, '.output', 'server', 'node_modules')
const destPrisma = join(destRoot, '.prisma')
const destClient = join(destRoot, '@prisma')

if (!existsSync(join(root, '.output', 'server'))) {
  console.warn('[fix-prisma-output] .output/server ausente — ignore.')
  process.exit(0)
}

if (!existsSync(join(srcPrisma, 'client', 'index.js'))) {
  console.error('[fix-prisma-output] node_modules/.prisma/client incompleto. Rode npm run db:generate.')
  process.exit(1)
}

rmSync(destPrisma, { recursive: true, force: true })
rmSync(destClient, { recursive: true, force: true })
cpSync(srcPrisma, destPrisma, { recursive: true })
cpSync(srcClient, destClient, { recursive: true })
console.info('[fix-prisma-output] Prisma client copiado para .output/server/node_modules')
