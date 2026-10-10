import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join, normalize, resolve, sep } from 'node:path'
import type { Prisma } from '#prisma/client'
import { getModuleSettings } from '../../../../../base/server/utils/module-settings'
import { usePrisma } from '../../../../../base/server/utils/prisma'
import {
  getSeafileApi,
  requireSeafileApi,
  type SeafileConnection,
} from '../../../../../base/server/utils/seafile-bridge'
import { ACCOUNT_MODULE_ID, accountSettingsDefaults } from '../../shared/account-settings'
import {
  defaultAvatarTransform,
  normalizeAvatarTransform,
} from '../../shared/avatar-transform'

const AVATAR_FILE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const

export type AvatarStorageBackend = 'local' | 'seafile'

export type AvatarStorageConfig = {
  backend: AvatarStorageBackend
  localPath: string
  /** Pasta de avatares na library (conexão vem de panel.seafile). */
  seafilePath: string
  maxSizeMb: number
  extensions: string[]
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function asNumber(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  return value.map((item) => String(item).toLowerCase().replace(/^\./, ''))
}

export async function getAvatarStorageConfig(): Promise<AvatarStorageConfig> {
  const stored = await getModuleSettings(ACCOUNT_MODULE_ID)
  const backendRaw = asString(stored.imageStorageBackend, accountSettingsDefaults.imageStorageBackend)
  const backend: AvatarStorageBackend = backendRaw === 'seafile' ? 'seafile' : 'local'

  return {
    backend,
    localPath: asString(stored.imageLocalPath, accountSettingsDefaults.imageLocalPath) || 'storage/avatars',
    seafilePath: asString(stored.imageSeafilePath, accountSettingsDefaults.imageSeafilePath) || '/avatars',
    maxSizeMb: asNumber(stored.imageMaxSizeMb, accountSettingsDefaults.imageMaxSizeMb),
    extensions: asStringArray(stored.imageExtensions, [...accountSettingsDefaults.imageExtensions]),
  }
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl.trim())
  if (!match) {
    throw createError({ statusCode: 400, message: 'Imagem inválida (esperado data URL).' })
  }
  const mime = match[1]!.toLowerCase()
  const buffer = Buffer.from(match[2]!, 'base64')
  return { mime, buffer }
}

function extensionFromMime(mime: string) {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  return map[mime] || 'png'
}

function assertSafeRelativeDir(relativePath: string) {
  const normalized = normalize(relativePath).replace(/^([/\\])+/, '').replace(/\\/g, '/')
  if (!normalized || normalized.includes('..')) {
    throw createError({ statusCode: 400, message: 'Pasta local inválida.' })
  }
  return normalized
}

function resolveLocalDir(relativePath: string) {
  const safe = assertSafeRelativeDir(relativePath)
  const absolute = resolve(process.cwd(), safe)
  const root = resolve(process.cwd())
  if (absolute !== root && !absolute.startsWith(root + sep)) {
    throw createError({ statusCode: 400, message: 'Pasta local fora do projeto.' })
  }
  return { absolute, relative: safe }
}

async function saveLocalAvatar(userId: string, buffer: Buffer, ext: string, config: AvatarStorageConfig) {
  const { absolute } = resolveLocalDir(config.localPath)
  await mkdir(absolute, { recursive: true })
  const filename = `${userId}.${ext}`
  await writeFile(join(absolute, filename), buffer)
  return `/api/account/avatar/file/${encodeURIComponent(filename)}?v=${Date.now()}`
}

function isAvatarFilenameForUser(filename: string, userId: string) {
  if (filename === userId) return true
  if (!filename.startsWith(`${userId}.`)) return false
  const ext = filename.slice(userId.length + 1).toLowerCase()
  return (AVATAR_FILE_EXTENSIONS as readonly string[]).includes(ext)
}

/** Remove avatares locais do usuário, opcionalmente preservando o arquivo atual. */
async function deleteLocalAvatarFiles(
  userId: string,
  keepFilename: string | null,
  localPath: string,
) {
  const { absolute } = resolveLocalDir(localPath)
  let entries: string[] = []
  try {
    entries = await readdir(absolute)
  }
  catch {
    return
  }

  await Promise.all(
    entries.map(async (name) => {
      if (keepFilename && name === keepFilename) return
      if (!isAvatarFilenameForUser(name, userId)) return
      await unlink(join(absolute, name)).catch(() => {})
    }),
  )
}

/** Remove avatares do usuário no Seafile, preservando o arquivo atual se indicado. */
async function deleteSeafileAvatarFiles(
  userId: string,
  keepFilename: string | null,
  parentDir: string,
  conn: SeafileConnection,
) {
  const api = requireSeafileApi()
  const dir = api.normalizeSeafileDir(parentDir)

  await Promise.all(
    AVATAR_FILE_EXTENSIONS.map(async (ext) => {
      const filename = `${userId}.${ext}`
      if (keepFilename && filename === keepFilename) return
      const filePath = `${dir === '/' ? '' : dir}/${filename}`.replace(/\/+/g, '/')
      await api.seafileDeleteFile(conn, filePath).catch(() => {})
    }),
  )
}

/**
 * Após salvar o novo avatar, remove arquivos anteriores do mesmo usuário
 * (outras extensões e/ou backend anterior).
 */
async function cleanupPreviousAvatars(
  userId: string,
  keep: { backend: AvatarStorageBackend, filename: string },
  config: AvatarStorageConfig,
  seafile: SeafileConnection | null,
) {
  await deleteLocalAvatarFiles(
    userId,
    keep.backend === 'local' ? keep.filename : null,
    config.localPath,
  ).catch(() => {})

  const api = getSeafileApi()
  if (seafile && api?.isSeafileReady(seafile)) {
    await deleteSeafileAvatarFiles(
      userId,
      keep.backend === 'seafile' ? keep.filename : null,
      config.seafilePath,
      seafile,
    ).catch(() => {})
  }
}

async function saveSeafileAvatar(
  userId: string,
  buffer: Buffer,
  ext: string,
  config: AvatarStorageConfig,
  conn: SeafileConnection,
) {
  const api = requireSeafileApi()
  const filename = `${userId}.${ext}`
  await api.seafileUploadFile(conn, {
    parentDir: config.seafilePath,
    filename,
    buffer,
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  })
  // Guarda caminho estável (links de download do Seafile expiram).
  const dir = api.normalizeSeafileDir(config.seafilePath)
  const filePath = `${dir === '/' ? '' : dir}/${filename}`.replace(/\/+/g, '/')
  return `seafile:${filePath}`
}

function contentTypeFromExt(ext: string) {
  const normalized = ext.toLowerCase().replace(/^\./, '')
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg'
  if (normalized === 'webp') return 'image/webp'
  if (normalized === 'gif') return 'image/gif'
  return 'image/png'
}

async function readLocalAvatarByFilename(filename: string, localPath: string) {
  const absolute = resolveLocalAvatarAbsolute(filename, localPath)
  const buffer = await readFile(absolute)
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : 'png'
  return { buffer, contentType: contentTypeFromExt(ext) }
}

async function fetchSeafileAvatarBinary(
  userId: string,
  stored: string,
  config: AvatarStorageConfig,
): Promise<{ buffer: Buffer, contentType: string } | null> {
  const api = getSeafileApi()
  if (!api) return null

  const conn = await api.getSeafileConnection()
  if (!api.isSeafileReady(conn)) return null

  const authHeaders = api.seafileAuthHeaders(conn.token)
  const candidates: string[] = []

  if (stored.startsWith('seafile:')) {
    candidates.push(stored.slice('seafile:'.length))
  }

  const dir = api.normalizeSeafileDir(config.seafilePath)
  for (const ext of AVATAR_FILE_EXTENSIONS) {
    const filePath = `${dir === '/' ? '' : dir}/${userId}.${ext}`.replace(/\/+/g, '/')
    if (!candidates.includes(filePath)) candidates.push(filePath)
  }

  for (const filePath of candidates) {
    try {
      const url = await api.seafileGetDownloadUrl(conn, filePath, authHeaders)
      const res = await fetch(url)
      if (!res.ok) continue
      const contentType = res.headers.get('content-type') || contentTypeFromExt(filePath.split('.').pop() || 'png')
      if (contentType.includes('text/html')) continue
      const buffer = Buffer.from(await res.arrayBuffer())
      if (!buffer.byteLength) continue
      return { buffer, contentType: contentType.startsWith('image/') ? contentType : contentTypeFromExt(filePath.split('.').pop() || 'png') }
    }
    catch {
      // tenta próximo caminho
    }
  }

  // URL HTTP legada armazenada no perfil
  if (/^https?:\/\//i.test(stored)) {
    try {
      const res = await fetch(stored)
      if (!res.ok) return null
      const contentType = res.headers.get('content-type') || 'image/png'
      if (contentType.includes('text/html')) return null
      const buffer = Buffer.from(await res.arrayBuffer())
      if (!buffer.byteLength) return null
      return { buffer, contentType: contentType.startsWith('image/') ? contentType : 'image/png' }
    }
    catch {
      return null
    }
  }

  return null
}

export async function saveUserAvatar(
  userId: string,
  dataUrl: string | null | undefined,
  transformRaw?: unknown,
) {
  const transform = normalizeAvatarTransform(transformRaw) ?? defaultAvatarTransform()
  const prisma = usePrisma()
  const transformJson = transform as unknown as Prisma.InputJsonValue

  // Só atualiza o enquadramento (imagem já salva).
  if (!dataUrl) {
    const existing = await prisma.accountProfile.findUnique({
      where: { userId },
      select: { avatarUrl: true },
    })
    if (!existing?.avatarUrl) {
      throw createError({
        statusCode: 400,
        message: 'Envie dataUrl da imagem ou um avatar já existente.',
      })
    }

    await prisma.accountProfile.update({
      where: { userId },
      data: { avatarTransform: transformJson },
    })

    return {
      avatarUrl: toClientAvatarUrl(existing.avatarUrl),
      avatarTransform: transform,
      backend: null as AvatarStorageBackend | null,
      checksum: null as string | null,
    }
  }

  const config = await getAvatarStorageConfig()
  const { mime, buffer } = parseDataUrl(dataUrl)

  const maxBytes = config.maxSizeMb * 1024 * 1024
  if (buffer.byteLength > maxBytes) {
    throw createError({
      statusCode: 400,
      message: `Arquivo muito grande. Limite: ${config.maxSizeMb} MB.`,
    })
  }

  const ext = extensionFromMime(mime)
  if (config.extensions.length && !config.extensions.includes(ext) && !(ext === 'jpg' && config.extensions.includes('jpeg'))) {
    throw createError({
      statusCode: 400,
      message: `Extensão .${ext} não permitida.`,
    })
  }

  const filename = `${userId}.${ext}`
  let seafile: SeafileConnection | null = null

  let avatarUrl: string
  if (config.backend === 'seafile') {
    const api = requireSeafileApi()
    seafile = await api.getSeafileConnection()
    if (!api.isSeafileReady(seafile)) {
      throw createError({
        statusCode: 400,
        message: 'Configure o módulo Seafile do painel (URL, biblioteca e autenticação) antes de usar este armazenamento.',
      })
    }
    avatarUrl = await saveSeafileAvatar(userId, buffer, ext, config, seafile)
  }
  else {
    avatarUrl = await saveLocalAvatar(userId, buffer, ext, config)
    // Para limpeza cruzada se o usuário já teve avatar no Seafile.
    const api = getSeafileApi()
    seafile = api ? await api.getSeafileConnection().catch(() => null) : null
  }

  await prisma.accountProfile.upsert({
    where: { userId },
    create: { userId, avatarUrl, avatarTransform: transformJson },
    update: { avatarUrl, avatarTransform: transformJson },
  })

  await cleanupPreviousAvatars(
    userId,
    { backend: config.backend, filename },
    config,
    seafile,
  )

  return {
    avatarUrl: toClientAvatarUrl(avatarUrl)!,
    avatarTransform: transform,
    backend: config.backend,
    checksum: createHash('sha256').update(buffer).digest('hex').slice(0, 16),
  }
}

/** URL estável same-origin para o cliente (evita links Seafile expirados). */
export function toClientAvatarUrl(storedUrl: string | null | undefined) {
  if (!storedUrl) return null
  const version = createHash('sha256').update(storedUrl).digest('hex').slice(0, 10)
  // Sempre via proxy autenticado — <img> não envia Bearer; cookie + media cobre local e Seafile.
  return `/api/account/avatar/media?v=${version}`
}

export async function getUserAvatar(userId: string) {
  const prisma = usePrisma()
  try {
    const profile = await prisma.accountProfile.findUnique({
      where: { userId },
      select: { avatarUrl: true, avatarTransform: true },
    })
    return {
      avatarUrl: toClientAvatarUrl(profile?.avatarUrl ?? null),
      avatarTransform: normalizeAvatarTransform(profile?.avatarTransform) ?? defaultAvatarTransform(),
    }
  }
  catch {
    return {
      avatarUrl: null,
      avatarTransform: defaultAvatarTransform(),
    }
  }
}

/** Lê o avatar real do storage para streaming (local ou Seafile). */
export async function resolveAvatarBinary(userId: string): Promise<{
  buffer: Buffer
  contentType: string
} | null> {
  const prisma = usePrisma()
  const profile = await prisma.accountProfile.findUnique({
    where: { userId },
    select: { avatarUrl: true },
  }).catch(() => null)

  const stored = profile?.avatarUrl
  if (!stored) return null

  const config = await getAvatarStorageConfig()

  // Local file API path
  if (stored.startsWith('/api/account/avatar/file/')) {
    const raw = stored.split('/api/account/avatar/file/')[1] || ''
    const filename = decodeURIComponent(raw.split('?')[0] || '')
    if (filename) {
      try {
        return await readLocalAvatarByFilename(filename, config.localPath)
      }
      catch {
        // continua para fallback por userId / Seafile
      }
    }
  }

  // Referência Seafile estável ou URL HTTP legada
  if (stored.startsWith('seafile:') || /^https?:\/\//i.test(stored)) {
    const fromSeafile = await fetchSeafileAvatarBinary(userId, stored, config).catch(() => null)
    if (fromSeafile) return fromSeafile
  }

  // Fallback local por userId.* (caminho customizado ou backend trocado)
  for (const ext of AVATAR_FILE_EXTENSIONS) {
    try {
      return await readLocalAvatarByFilename(`${userId}.${ext}`, config.localPath)
    }
    catch {
      // tenta próxima extensão
    }
  }

  // Última tentativa: Seafile por userId, mesmo com URL local quebrada
  const fromSeafile = await fetchSeafileAvatarBinary(userId, stored, config).catch(() => null)
  if (fromSeafile) return fromSeafile

  // Path local relativo legado
  try {
    const filename = stored.replace(/^.*\//, '').split('?')[0] || ''
    if (filename) return await readLocalAvatarByFilename(filename, config.localPath)
  }
  catch {
    return null
  }

  return null
}

/** Remove todos os avatares do usuário (local e Seafile). */
export async function deleteUserAvatars(userId: string) {
  const config = await getAvatarStorageConfig()
  const api = getSeafileApi()
  const seafile = api ? await api.getSeafileConnection().catch(() => null) : null
  // filename que nunca existe → remove todas as cópias do usuário.
  await cleanupPreviousAvatars(
    userId,
    { backend: 'local', filename: '__purge__' },
    config,
    seafile && api?.isSeafileReady(seafile) ? seafile : null,
  ).catch(() => {})
}

export function resolveLocalAvatarAbsolute(filename: string, localPath: string) {
  const safeName = filename.replace(/[/\\]/g, '')
  if (!safeName || safeName.includes('..')) {
    throw createError({ statusCode: 400, message: 'Arquivo inválido.' })
  }
  const { absolute } = resolveLocalDir(localPath)
  const full = join(absolute, safeName)
  if (!full.startsWith(absolute + sep) && full !== absolute) {
    throw createError({ statusCode: 400, message: 'Arquivo inválido.' })
  }
  return full
}
