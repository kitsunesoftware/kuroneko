import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  modules: ['@nuxt/icon', '@nuxtjs/tailwindcss'],
  css: [join(currentDir, './app/assets/css/main.css')],
  app: {
    head: {
      title: 'Kuroneko',
      htmlAttrs: { lang: 'pt-BR' },
    },
  },
})
