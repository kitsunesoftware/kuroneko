import { createAuthSessionFromEvent } from '../../utils/sessions'
import { createUserAccount } from '../../utils/register'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    email?: string
    password?: string
    name?: string
    username?: string
    birthDate?: string
  }>(event)

  const email = body?.email?.trim() ?? ''
  const password = body?.password ?? ''

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Informe e-mail e senha para criar a conta.',
    })
  }

  const user = await createUserAccount({
    email,
    password,
    name: body?.name?.trim() || undefined,
    username: body?.username?.trim() || null,
    birthDate: body?.birthDate?.trim() || null,
  })

  const { token } = await createAuthSessionFromEvent(event, user.id)

  return {
    ok: true,
    token,
    user,
  }
})
