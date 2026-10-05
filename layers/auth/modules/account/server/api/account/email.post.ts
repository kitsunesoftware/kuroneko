import { changeAccountEmail } from '../../utils/account-profile'
import { requireAuthUser } from '../../utils/require-auth-user'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody<{ email?: string, currentPassword?: string }>(event)
  const email = typeof body?.email === 'string' ? body.email : ''
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  return await changeAccountEmail(user.id, email, currentPassword)
})
