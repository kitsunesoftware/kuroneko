import { revokeSessionByToken } from '../../utils/sessions'

export default defineEventHandler(async (event) => {
  const header = getHeader(event, 'authorization')
  const bearer = header?.startsWith('Bearer ')
    ? header.slice(7)
    : undefined

  const config = useRuntimeConfig()
  const cookieName = String(config.public?.auth?.cookieName || 'kuroneko_auth')
  const cookieToken = getCookie(event, cookieName) || undefined

  await revokeSessionByToken(bearer || cookieToken)
  return { ok: true }
})
