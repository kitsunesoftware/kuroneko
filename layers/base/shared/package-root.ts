import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_NAME = '@kitsunesoftware/kuroneko'

function readPkgNameVersion(path: string): { name?: string, version?: string } | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as { name?: string, version?: string }
  }
  catch {
    return null
  }
}

function isKuronekoRoot(dir: string) {
  const pkg = readPkgNameVersion(join(dir, 'package.json'))
  if (pkg?.name === PACKAGE_NAME) return true
  // Monorepo / checkout sem name batendo: marker de plataforma
  return existsSync(join(dir, 'layers/base/prisma/schema.prisma'))
}

/**
 * Raiz do pacote Kuroneko (onde está o package.json da plataforma).
 * Não depende só de import.meta.url — no Nitro o arquivo é empacotado em `.nuxt`
 * e o walk relativo apontaria para o lugar errado.
 */
export function getKuronekoPackageRoot() {
  // 1) Pacote instalado no consumidor (node_modules)
  try {
    const require = createRequire(join(process.cwd(), 'package.json'))
    const pkgPath = require.resolve(`${PACKAGE_NAME}/package.json`)
    return dirname(pkgPath)
  }
  catch {
    // não instalado como dependência
  }

  // 2) Fonte não empacotada: layers/base/shared -> raiz do pacote
  const fromSource = join(dirname(fileURLToPath(import.meta.url)), '../../..')
  if (isKuronekoRoot(fromSource)) return fromSource

  // 3) Rodando o monorepo direto (cwd = kuroneko)
  if (isKuronekoRoot(process.cwd())) return process.cwd()

  return fromSource
}

export function readKuronekoPackageJson(): { name?: string, version?: string } {
  const path = join(getKuronekoPackageRoot(), 'package.json')
  return readPkgNameVersion(path) || {}
}
