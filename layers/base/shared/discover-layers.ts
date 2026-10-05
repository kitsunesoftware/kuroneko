import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Descobre layers Nuxt em um diretório (pastas com nuxt.config.ts|js|mjs).
 * Retorna paths relativos ao `relativePrefix` (ex.: `./layers/auth`).
 */
export function discoverNuxtLayers(
  absoluteDir: string,
  relativePrefix: string,
): string[] {
  if (!existsSync(absoluteDir)) return []

  return readdirSync(absoluteDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      const base = join(absoluteDir, entry.name)
      return (
        existsSync(join(base, 'nuxt.config.ts'))
        || existsSync(join(base, 'nuxt.config.js'))
        || existsSync(join(base, 'nuxt.config.mjs'))
      )
    })
    .map((entry) => `${relativePrefix}/${entry.name}`.replace(/\\/g, '/'))
    .sort((a, b) => a.localeCompare(b))
}

/**
 * Layers raiz em `<packageRoot>/layers` (base sempre por último).
 * `packageRoot` deve ser a raiz do pacote Kuroneko (não o cwd do consumidor).
 */
export function discoverRootLayers(packageRoot: string): string[] {
  const layersDir = join(packageRoot, 'layers')
  const found = discoverNuxtLayers(layersDir, './layers')
    .filter((path) => path !== './layers/base')
  return [...found, './layers/base']
}

/**
 * Submódulos em `<parentLayerDir>/modules`.
 * `parentLayerDir` = pasta da layer pai (ex.: .../layers/auth).
 */
export function discoverChildModules(parentLayerDir: string): string[] {
  const dir = join(parentLayerDir, 'modules')
  return discoverNuxtLayers(dir, './modules')
}
