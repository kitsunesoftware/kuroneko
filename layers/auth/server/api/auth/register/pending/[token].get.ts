import { getPendingRegistration } from '../../../../utils/register'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')?.trim() ?? ''
  if (!token) {
    throw createError({
      statusCode: 400,
      message: 'Token inválido.',
    })
  }

  const pending = await getPendingRegistration(token)
  if (!pending) {
    throw createError({
      statusCode: 404,
      message: 'Link expirado ou inválido. Reinicie o cadastro.',
    })
  }

  return {
    email: pending.email,
    name: pending.name,
    expiresAt: pending.expiresAt,
  }
})
