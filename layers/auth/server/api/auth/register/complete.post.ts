import { createAuthSessionFromEvent } from '../../../utils/sessions'
import {
  consumePendingRegistration,
  createUserAccount,
} from '../../../utils/register'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    token?: string
    name?: string
    username?: string
    birthDate?: string
    password?: string
  }>(event)

  const token = body?.token?.trim() ?? ''
  const password = body?.password ?? ''

  if (!token || !password) {
    throw createError({
      statusCode: 400,
      message: 'Dados incompletos para concluir o cadastro.',
    })
  }

  const pending = await consumePendingRegistration(token)
  if (!pending) {
    throw createError({
      statusCode: 404,
      message: 'Link expirado ou inválido. Reinicie o cadastro.',
    })
  }

  const user = await createUserAccount({
    email: pending.email,
    password,
    name: body?.name?.trim() || pending.name || undefined,
    username: body?.username?.trim() || null,
    birthDate: body?.birthDate?.trim() || null,
  })

  const session = await createAuthSessionFromEvent(event, user.id)

  return {
    ok: true,
    token: session.token,
    user,
  }
})
