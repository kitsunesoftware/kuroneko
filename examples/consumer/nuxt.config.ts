/**
 * Fixture: projeto consumidor do Kuroneko.
 *
 * - Layer própria: ./layers/hello-site
 * - Plataforma: extends do monorepo (local) ou tag git
 *
 * Nunca adicione layers/base|auth|panel aqui.
 */
export default defineNuxtConfig({
  extends: [
    './layers/hello-site',
    // Local (este monorepo):
    '../..',
    // Produção:
    // 'github:kitsunesoftware/kuroneko#v1.0.0',
  ],
})
