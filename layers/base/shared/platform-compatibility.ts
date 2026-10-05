import { createError } from 'h3'
import type { KuronekoModuleManifest } from './types/store'
import { readKuronekoPackageJson } from './package-root'
import { parseSemver, satisfiesMinVersion } from './semver'

let cachedVersion: string | null = null

/** Versão da plataforma Kuroneko (package.json do pacote, não do consumidor). */
export function getKuronekoPlatformVersion(): string {
  if (cachedVersion) return cachedVersion

  // Preferência: runtimeConfig da layer (definido em nuxt.config a partir do package.json).
  // Funciona mesmo quando o Nitro empacota o shared e o walk de import.meta.url falha.
  try {
    const fromConfig = String(useRuntimeConfig().public?.kuronekoVersion || '').trim()
    if (fromConfig && fromConfig !== '0.0.0') {
      cachedVersion = fromConfig
      return cachedVersion
    }
  }
  catch {
    // fora do contexto Nuxt/Nitro
  }

  const pkg = readKuronekoPackageJson()
  cachedVersion = String(pkg.version || '0.0.0').trim() || '0.0.0'
  return cachedVersion
}

export type PlatformCompatibility = {
  platformVersion: string
  minKuroneko: string | null
  compatible: boolean
  /** Mensagem amigável quando incompatível; null se ok. */
  reason: string | null
}

export function checkModulePlatformCompatibility(
  manifest: Pick<KuronekoModuleManifest, 'id' | 'name' | 'minKuroneko'>,
  platformVersion = getKuronekoPlatformVersion(),
): PlatformCompatibility {
  const min = typeof manifest.minKuroneko === 'string'
    ? manifest.minKuroneko.trim()
    : ''

  if (!min) {
    return {
      platformVersion,
      minKuroneko: null,
      compatible: true,
      reason: null,
    }
  }

  if (!parseSemver(min)) {
    return {
      platformVersion,
      minKuroneko: min,
      compatible: false,
      reason: `O módulo "${manifest.name || manifest.id}" declara minKuroneko inválido ("${min}"). Use semver (ex.: 1.0.0).`,
    }
  }

  if (!satisfiesMinVersion(platformVersion, min)) {
    return {
      platformVersion,
      minKuroneko: min,
      compatible: false,
      reason: `O módulo "${manifest.name || manifest.id}" exige Kuroneko ${min} ou superior. Esta instalação está em ${platformVersion}.`,
    }
  }

  return {
    platformVersion,
    minKuroneko: min,
    compatible: true,
    reason: null,
  }
}

/** Lança 400 se o manifesto for incompatível com a plataforma atual. */
export function assertModulePlatformCompatible(
  manifest: Pick<KuronekoModuleManifest, 'id' | 'name' | 'minKuroneko'>,
) {
  const check = checkModulePlatformCompatibility(manifest)
  if (!check.compatible) {
    throw createError({
      statusCode: 400,
      message: check.reason || 'Módulo incompatível com esta versão do Kuroneko.',
      data: {
        kind: 'platform_incompatible',
        platformVersion: check.platformVersion,
        minKuroneko: check.minKuroneko,
      },
    })
  }
  return check
}
