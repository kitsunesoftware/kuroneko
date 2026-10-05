import { access } from 'node:fs/promises'
import { join } from 'node:path'

const BASE_SCHEMA = 'layers/base/prisma/schema.prisma'

async function exists(path: string) {
  try {
    await access(path)
    return true
  }
  catch {
    return false
  }
}

/**
 * Raiz do app consumidor (nuxt.config.ts / prisma/schema).
 */
export async function resolveProjectRoot() {
  const candidates = [
    process.cwd(),
    process.env.INIT_CWD,
    process.env.NUXT_ROOT_DIR,
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    if (await exists(join(candidate, 'nuxt.config.ts'))) {
      return candidate
    }
  }

  return process.cwd()
}

/**
 * Raiz do pacote Kuroneko (layers da plataforma).
 * - Monorepo: igual ao projectRoot
 * - Consumidor npm: node_modules/@kitsunesoftware/kuroneko
 */
export async function resolvePlatformRoot(projectRoot?: string) {
  const root = projectRoot || await resolveProjectRoot()
  if (await exists(join(root, BASE_SCHEMA))) return root

  const candidates = [
    join(root, 'node_modules', '@kitsunesoftware', 'kuroneko'),
    join(root, 'node_modules', 'kuroneko'),
  ]
  for (const candidate of candidates) {
    if (await exists(join(candidate, BASE_SCHEMA))) {
      return candidate
    }
  }

  throw createError({
    statusCode: 500,
    message:
      'Plataforma Kuroneko não encontrada. Instale @kitsunesoftware/kuroneko ou rode na raiz do monorepo.',
  })
}

/** Resolve um schema relativo: projeto consumidor primeiro, depois plataforma. */
export async function resolveSchemaAbsolute(
  schemaPath: string,
  projectRoot?: string,
  platformRoot?: string,
) {
  const project = projectRoot || await resolveProjectRoot()
  const platform = platformRoot || await resolvePlatformRoot(project)
  const candidates = [
    join(project, schemaPath),
    join(platform, schemaPath),
  ]
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate
  }
  return null
}
