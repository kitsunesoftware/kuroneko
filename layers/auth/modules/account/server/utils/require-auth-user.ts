import type { H3Event } from 'h3'
import { parseToken } from '../../../../server/utils/auth'

export async function requireAuthUser(event: H3Event) {
  const header = getHeader(event, 'authorization')
  const bearer = header?.startsWith('Bearer ')
    ? header.slice(7)
    : undefined

  const config = useRuntimeConfig()
  const cookieName = String(config.public?.auth?.cookieName || 'kuroneko_auth')
  const cookieToken = getCookie(event, cookieName) || undefined

  const user = await parseToken(bearer || cookieToken)
  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Sessão inválida.',
    })
  }
  return user
}
