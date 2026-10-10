import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, env } from 'prisma/config'

/**
 * O CLI do Prisma 7 não carrega .env sozinho.
 * O arquivo do modo entra primeiro; `.env` só preenche o que faltou.
 */
const root = process.cwd()
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development'
for (const file of [`.env.${mode}`, '.env']) {
  const path = resolve(root, file)
  if (existsSync(path)) loadEnv({ path })
}

export default defineConfig({
  schema: 'prisma/schema',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
