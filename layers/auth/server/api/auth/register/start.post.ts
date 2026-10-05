import { createPendingRegistration } from '../../../utils/register'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string, name?: string }>(event)
  const email = body?.email?.trim() ?? ''
  const name = body?.name?.trim() ?? ''

  if (!email || !email.includes('@')) {
    throw createError({
      statusCode: 400,
      message: 'Informe um e-mail válido.',
    })
  }

  const pending = await createPendingRegistration({ email, name })
  const origin = getRequestURL(event).origin
  const continueUrl = `${origin}/register/continue?token=${pending.token}`

  // Sem SMTP real por enquanto: o link volta na resposta para testes.
  return {
    ok: true,
    message: 'Enviamos um link de confirmação para o seu e-mail.',
    email: pending.email,
    continueUrl,
  }
})
