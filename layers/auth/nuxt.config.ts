import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { discoverChildModules } from '../base/shared/discover-layers'

const layerDir = dirname(fileURLToPath(import.meta.url))

/**
 * Módulo pai de autenticação.
 * Submódulos em ./modules/* são descobertos relativamente a esta layer.
 */
export default defineNuxtConfig({
  extends: discoverChildModules(layerDir),

  runtimeConfig: {
    authSecret: 'kuroneko-dev-secret',
    public: {
      auth: {
        loginPath: '/login',
        registerPath: '/register',
        recoverPath: '/recover',
        accountPath: '/account',
        homePath: '/',
        cookieName: 'kuroneko_auth',
      },
    },
  },
})
