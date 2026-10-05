import { send } from 'h3'
import { resolveAvatarBinary } from '../../../../../account/server/utils/avatar-storage'
import { requirePermission } from '../../../utils/require-permission'

/**
 * Entrega o avatar de qualquer usuário (painel), com permissão users.view.
 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'users.view')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Usuário inválido.' })
  }

  const binary = await resolveAvatarBinary(id)
  if (!binary) {
    throw createError({ statusCode: 404, message: 'Avatar não encontrado.' })
  }

  setHeader(event, 'Content-Type', binary.contentType)
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  setHeader(event, 'Content-Length', String(binary.buffer.byteLength))
  return send(event, binary.buffer)
})
