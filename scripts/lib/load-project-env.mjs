import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/** Mesma ordem de `prisma.config.ts`: arquivo do modo, depois `.env`. */
export function loadProjectEnv(root = process.cwd()) {
  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development'
  for (const file of [`.env.${mode}`, '.env']) {
    const path = resolve(root, file)
    if (existsSync(path)) config({ path })
  }
}
