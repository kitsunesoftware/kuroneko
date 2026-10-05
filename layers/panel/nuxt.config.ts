import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { discoverChildModules } from '../base/shared/discover-layers'

const layerDir = dirname(fileURLToPath(import.meta.url))

/**
 * Módulo pai do painel administrativo.
 * Submódulos em ./modules/* são descobertos relativamente a esta layer.
 */
export default defineNuxtConfig({
  extends: discoverChildModules(layerDir),
})
