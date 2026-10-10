import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, env } from 'prisma/config'

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
