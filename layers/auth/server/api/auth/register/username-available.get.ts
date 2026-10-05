import { normalizeUsername } from '../../../../shared/username-policy'
import { parseToken } from '../../../../server/utils/auth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const raw = typeof query.username === 'string' ? query.username : ''
  const username = normalizeUsername(raw)

  if (!username) {
    return {
      valid: false,
      available: false,
    }
  }

  const header = getHeader(event, 'authorization')
  const bearer = header?.startsWith('Bearer ')
    ? header.slice(7)
    : undefined
  const config = useRuntimeConfig()
  const cookieName = String(config.public?.auth?.cookieName || 'kuroneko_auth')
  const cookieToken = getCookie(event, cookieName) || undefined
  const currentUser = await parseToken(bearer || cookieToken)

  const prisma = usePrisma()
  const existing = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: 'insensitive',
      },
      ...(currentUser ? { NOT: { id: currentUser.id } } : {}),
    },
    select: { id: true },
  })

  return {
    valid: true,
    available: !existing,
  }
})
