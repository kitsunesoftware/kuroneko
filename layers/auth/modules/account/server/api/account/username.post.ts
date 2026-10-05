import { changeAccountUsername } from '../../utils/account-profile'
import { requireAuthUser } from '../../utils/require-auth-user'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody<{ username?: string }>(event)
  const username = typeof body?.username === 'string' ? body.username : ''
  return await changeAccountUsername(user.id, username)
})
