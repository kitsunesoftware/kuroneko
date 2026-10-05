import { updateAccountProfile } from '../../utils/account-profile'
import { requireAuthUser } from '../../utils/require-auth-user'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody<{
    name?: string
    birthDate?: string | null
    showBirthDate?: boolean
    hideBirthYear?: boolean
    passwordAlerts?: boolean
    recoveryEmail?: string | null
  }>(event)

  return await updateAccountProfile(user.id, {
    name: typeof body?.name === 'string' ? body.name : undefined,
    birthDate: body?.birthDate === undefined
      ? undefined
      : (body.birthDate === null || body.birthDate === '' ? null : String(body.birthDate)),
    showBirthDate: typeof body?.showBirthDate === 'boolean' ? body.showBirthDate : undefined,
    hideBirthYear: typeof body?.hideBirthYear === 'boolean' ? body.hideBirthYear : undefined,
    passwordAlerts: typeof body?.passwordAlerts === 'boolean' ? body.passwordAlerts : undefined,
    recoveryEmail: body?.recoveryEmail === undefined
      ? undefined
      : (body.recoveryEmail === null || body.recoveryEmail === '' ? null : String(body.recoveryEmail)),
  })
})
