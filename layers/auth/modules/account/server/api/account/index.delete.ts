import { deleteAccount } from '../../utils/account-profile'
import { requireAuthUser } from '../../utils/require-auth-user'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody<{ currentPassword?: string, confirmText?: string }>(event)
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const confirmText = typeof body?.confirmText === 'string' ? body.confirmText.trim().toUpperCase() : ''

  if (confirmText !== 'EXCLUIR') {
    throw createError({
      statusCode: 400,
      message: 'Digite EXCLUIR para confirmar a exclusão da conta.',
    })
  }

  return await deleteAccount(user.id, currentPassword)
})
