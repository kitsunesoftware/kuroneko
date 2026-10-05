/** Tamanho do viewport circular no editor de avatar (px). */
export const AVATAR_VIEW_SIZE = 240

export type AvatarTransform = {
  viewSize: number
  zoom: number
  rotation: number
  flipH: boolean
  flipV: boolean
  offsetX: number
  offsetY: number
}

export type AvatarApplyPayload = {
  /** Imagem original (omitido se só o enquadramento mudou). */
  dataUrl?: string
  transform: AvatarTransform
}

export function defaultAvatarTransform(viewSize = AVATAR_VIEW_SIZE): AvatarTransform {
  return {
    viewSize,
    zoom: 1,
    rotation: 0,
    flipH: false,
    flipV: false,
    offsetX: 0,
    offsetY: 0,
  }
}

export function normalizeAvatarTransform(raw: unknown): AvatarTransform | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const zoom = Number(value.zoom)
  const rotation = Number(value.rotation)
  const offsetX = Number(value.offsetX)
  const offsetY = Number(value.offsetY)
  const viewSize = Number(value.viewSize)

  if (![zoom, rotation, offsetX, offsetY].every(Number.isFinite)) return null

  return {
    viewSize: Number.isFinite(viewSize) && viewSize > 0 ? viewSize : AVATAR_VIEW_SIZE,
    zoom: Math.min(3, Math.max(1, zoom || 1)),
    rotation: Math.min(180, Math.max(-180, rotation || 0)),
    flipH: Boolean(value.flipH),
    flipV: Boolean(value.flipV),
    offsetX,
    offsetY,
  }
}

/** Estilo CSS para replicar o enquadramento do editor em qualquer tamanho. */
export function buildAvatarImageStyle(
  naturalWidth: number,
  naturalHeight: number,
  transform: AvatarTransform,
  displaySize: number,
): Record<string, string> {
  if (!naturalWidth || !naturalHeight || !displaySize) {
    return { display: 'none' }
  }

  const view = transform.viewSize > 0 ? transform.viewSize : AVATAR_VIEW_SIZE
  const ratio = displaySize / view
  const baseScale = Math.max(view / naturalWidth, view / naturalHeight)
  const totalScale = baseScale * (transform.zoom || 1)
  const scaleX = totalScale * ratio * (transform.flipH ? -1 : 1)
  const scaleY = totalScale * ratio * (transform.flipV ? -1 : 1)

  return {
    width: `${naturalWidth}px`,
    height: `${naturalHeight}px`,
    marginLeft: `${-naturalWidth / 2}px`,
    marginTop: `${-naturalHeight / 2}px`,
    transform: `translate(${transform.offsetX * ratio}px, ${transform.offsetY * ratio}px) scale(${scaleX}, ${scaleY}) rotate(${transform.rotation}deg)`,
    transformOrigin: 'center center',
  }
}
