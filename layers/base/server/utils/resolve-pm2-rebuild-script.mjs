/**
 * Localiza scripts/pm2-rebuild.mjs sem depender de import.meta.url
 * (no Nitro o utilitário do servidor é empacotado).
 *
 * Default: arquivo do pacote. scripts/pm2-rebuild.mjs no consumer só vale
 * se for outro arquivo (override). No monorepo os dois paths são o mesmo.
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'

const SCRIPT = join('scripts', 'pm2-rebuild.mjs')

function samePath(a, b) {
  return resolve(a).toLowerCase() === resolve(b).toLowerCase()
}

function findPackaged(projectRoot) {
  const candidates = []

  try {
    const require = createRequire(join(projectRoot, 'package.json'))
    const pkgJson = require.resolve('@kitsunesoftware/kuroneko/package.json')
    candidates.push(join(dirname(pkgJson), SCRIPT))
  }
  catch {
    // pacote não resolvível por nome
  }

  if (existsSync(join(projectRoot, 'layers/base/prisma/schema.prisma'))) {
    candidates.push(join(projectRoot, SCRIPT))
  }

  candidates.push(
    join(projectRoot, 'node_modules', '@kitsunesoftware', 'kuroneko', SCRIPT),
    join(projectRoot, 'node_modules', 'kuroneko', SCRIPT),
  )

  return candidates.find((path) => existsSync(path)) || null
}

export function resolvePm2RebuildScriptPath(projectRoot = process.cwd()) {
  const packaged = findPackaged(projectRoot)
  const override = join(projectRoot, SCRIPT)
  const hasOverride = existsSync(override) && (!packaged || !samePath(override, packaged))

  if (hasOverride) return override
  if (packaged) return packaged

  throw new Error(
    'Não encontrei o script de rebuild do Kuroneko (scripts/pm2-rebuild.mjs no pacote). '
    + 'Atualize @kitsunesoftware/kuroneko. Não é preciso copiar scripts para o projeto.',
  )
}
