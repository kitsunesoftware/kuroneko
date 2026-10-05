import { getUserAvatar } from '../../utils/avatar-storage'
import { requireAuthUser } from '../../utils/require-auth-user'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  return await getUserAvatar(user.id)
})
