export type ParsedModuleIcon =
  | {
    kind: 'icon'
    /** Nome Iconify, ex.: i-solar:box-bold-duotone */
    name: string
  }
  | {
    kind: 'image'
    source: 'local' | 'external'
    /** Caminho relativo ao pacote (local) ou URL absoluta (external) */
    src: string
  }

const DEFAULT_ICON = 'i-solar:box-bold-duotone'

/**
 * Normaliza o campo `icon` do kuroneko.module.json.
 *
 * Formatos aceitos:
 * - `i-solar:…` / `icon:i-solar:…` → ícone Iconify
 * - `https://…` / `http://…` → imagem externa
 * - `./assets/x.png` / `assets/x.png` → imagem local (relativa ao pacote)
 * - legado: `icon+i-solar:…`, `image:local+…`, `image:external+…`
 */
export function parseModuleIcon(raw: unknown, fallback = DEFAULT_ICON): ParsedModuleIcon {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    if (obj.type === 'icon' && typeof obj.name === 'string' && obj.name.trim()) {
      return { kind: 'icon', name: normalizeIconName(obj.name) }
    }
    if (obj.type === 'image' && typeof obj.src === 'string' && obj.src.trim()) {
      return parseImageSrc(obj.src.trim())
    }
    if (typeof obj.image === 'string' && obj.image.trim()) {
      return parseImageSrc(obj.image.trim())
    }
  }

  if (typeof raw !== 'string' || !raw.trim()) {
    return { kind: 'icon', name: fallback }
  }

  const value = raw.trim()

  // Legado: icon+i-solar:…
  if (value.startsWith('icon+')) {
    return { kind: 'icon', name: normalizeIconName(value.slice(5)) }
  }

  // Legado: image:local+path / image:external+url
  if (value.startsWith('image:local+')) {
    return { kind: 'image', source: 'local', src: normalizeLocalPath(value.slice('image:local+'.length)) }
  }
  if (value.startsWith('image:external+')) {
    return { kind: 'image', source: 'external', src: value.slice('image:external+'.length).trim() }
  }

  // Explícito: icon:i-solar:…
  if (value.startsWith('icon:')) {
    return { kind: 'icon', name: normalizeIconName(value.slice(5)) }
  }

  // Explícito: image:… (detecta URL vs path)
  if (value.startsWith('image:')) {
    return parseImageSrc(value.slice(6).trim())
  }

  if (/^https?:\/\//i.test(value)) {
    return { kind: 'image', source: 'external', src: value }
  }

  // Iconify clássico (i-collection:name)
  if (/^i-[\w-]+:[\w-]+/.test(value) || value.includes(':')) {
    // Heurística: se parece path de arquivo (tem extensão), trata como local
    if (/\.(png|jpe?g|gif|webp|svg|ico|avif)(\?.*)?$/i.test(value)) {
      return { kind: 'image', source: 'local', src: normalizeLocalPath(value) }
    }
    return { kind: 'icon', name: normalizeIconName(value) }
  }

  // Relativo / arquivo
  if (
    value.startsWith('./')
    || value.startsWith('../')
    || value.startsWith('/')
    || /\.(png|jpe?g|gif|webp|svg|ico|avif)(\?.*)?$/i.test(value)
  ) {
    return { kind: 'image', source: 'local', src: normalizeLocalPath(value) }
  }

  return { kind: 'icon', name: normalizeIconName(value || fallback) }
}

function parseImageSrc(src: string): ParsedModuleIcon {
  if (/^https?:\/\//i.test(src)) {
    return { kind: 'image', source: 'external', src }
  }
  return { kind: 'image', source: 'local', src: normalizeLocalPath(src) }
}

function normalizeIconName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return DEFAULT_ICON
  return trimmed.startsWith('i-') ? trimmed : trimmed.includes(':') ? `i-${trimmed}` : trimmed
}

/** Remove `./` e barras iniciais; bloqueia `..` no resolve do servidor. */
export function normalizeLocalPath(path: string) {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
}

export function isSafeModuleAssetPath(relativePath: string) {
  const normalized = normalizeLocalPath(relativePath)
  if (!normalized || normalized.includes('\0')) return false
  const parts = normalized.split('/')
  return parts.every((part) => part !== '..' && part !== '')
}

export { DEFAULT_ICON as DEFAULT_MODULE_ICON }
