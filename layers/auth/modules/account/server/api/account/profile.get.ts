import { getAccountProfile } from '../../utils/account-profile'
import { requireAuthUser } from '../../utils/require-auth-user'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  return await getAccountProfile(user.id)
})
