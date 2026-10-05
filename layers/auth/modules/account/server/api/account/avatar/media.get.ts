import { send } from 'h3'
import { resolveAvatarBinary } from '../../../utils/avatar-storage'
import { requireAuthUser } from '../../../utils/require-auth-user'

/**
 * Entrega o avatar do usuário autenticado (local ou Seafile),
 * para uso same-origin (cookie ou Bearer).
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const binary = await resolveAvatarBinary(user.id)
  if (!binary) {
    throw createError({ statusCode: 404, message: 'Avatar não encontrado.' })
  }

  setHeader(event, 'Content-Type', binary.contentType)
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  setHeader(event, 'Content-Length', String(binary.buffer.byteLength))
  // send() evita serialização JSON de Buffer (que quebrava o <img>).
  return send(event, binary.buffer)
})
