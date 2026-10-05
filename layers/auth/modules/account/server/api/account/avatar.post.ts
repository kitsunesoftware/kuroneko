import { saveUserAvatar } from '../../utils/avatar-storage'
import { requireAuthUser } from '../../utils/require-auth-user'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody<{
    dataUrl?: string | null
    transform?: unknown
  }>(event)

  const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : null
  if (!dataUrl && body?.transform == null) {
    throw createError({
      statusCode: 400,
      message: 'Envie dataUrl da imagem e/ou transform do enquadramento.',
    })
  }

  const result = await saveUserAvatar(user.id, dataUrl, body?.transform)
  return {
    ok: true,
    ...result,
  }
})
