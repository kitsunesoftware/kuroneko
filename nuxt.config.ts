import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { discoverRootLayers } from './layers/base/shared/discover-layers'

const packageRoot = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pkg = require('./package.json') as { version?: string }

/** Client gerado na raiz de quem rodou o Nuxt (monorepo ou consumer). */
const prismaClientEntry = resolve(process.cwd(), 'generated/prisma/client')

/**
 * Kuroneko como layer Nuxt publicável.
 * Consumidores: `extends: ['@kitsunesoftware/kuroneko']`
 * ou `extends: ['github:kitsunesoftware/kuroneko#v1.0.0']`
 *
 * Layers resolvidas a partir da raiz deste pacote (não do cwd).
 */
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // Evita erro Vite: Failed to resolve import "#app-manifest"
  experimental: {
    appManifest: false,
  },

  alias: {
    '#prisma/client': prismaClientEntry,
  },

  nitro: {
    alias: {
      '#prisma/client': prismaClientEntry,
    },
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    /** Nome do app no ecosystem.config.cjs (pm2 restart <nome>). */
    pm2AppName: process.env.NUXT_PM2_APP_NAME || process.env.PM2_APP_NAME || 'kuroneko',
    public: {
      /** Versão da plataforma (package.json deste pacote). */
      kuronekoVersion: pkg.version || '0.0.0',
    },
  },

  extends: discoverRootLayers(packageRoot),
})
