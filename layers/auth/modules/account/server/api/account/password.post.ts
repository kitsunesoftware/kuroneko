import { changeAccountPassword } from '../../utils/account-profile'
import { requireAuthUser } from '../../utils/require-auth-user'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody<{
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }>(event)

  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
  const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : ''

  if (!newPassword || newPassword !== confirmPassword) {
    throw createError({ statusCode: 400, message: 'A confirmação da nova senha não confere.' })
  }

  return await changeAccountPassword(user.id, currentPassword, newPassword)
})
