import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import { extname } from 'node:path'
import { getAvatarStorageConfig, resolveLocalAvatarAbsolute } from '../../../../utils/avatar-storage'

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')
  if (!name) {
    throw createError({ statusCode: 400, message: 'Arquivo inválido.' })
  }

  const config = await getAvatarStorageConfig()
  const absolute = resolveLocalAvatarAbsolute(decodeURIComponent(name), config.localPath)
  try {
    await access(absolute)
  }
  catch {
    throw createError({ statusCode: 404, message: 'Avatar não encontrado.' })
  }

  const ext = extname(absolute).toLowerCase()
  setHeader(event, 'Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  return sendStream(event, createReadStream(absolute))
})
