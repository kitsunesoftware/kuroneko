import { requirePermission } from '../../../../../auth/modules/roles/server/utils/require-permission'
import { sendSmtpTestEmail } from '../../../utils/mail'
import {
  getBrandSiteConfig,
  getEmailTemplateConfig,
  getSmtpSiteConfig,
  type SmtpEncryption,
} from '../../../utils/site-settings'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'panel.settings')

  const body = await readBody<{
    to?: string
    enabled?: boolean
    host?: string
    port?: number | string
    user?: string
    password?: string
    encryption?: SmtpEncryption
    fromEmail?: string
    fromName?: string
  }>(event)

  const selfEmail = String(user.email || '').trim()
  const requestedTo = typeof body?.to === 'string' ? body.to.trim() : ''
  const to = requestedTo || selfEmail

  if (!to || !to.includes('@')) {
    throw createError({
      statusCode: 400,
      message: requestedTo
        ? 'Informe um e-mail de destino válido.'
        : 'Sua conta não tem um e-mail válido para receber o teste.',
    })
  }

  const saved = await getSmtpSiteConfig()
  const brand = await getBrandSiteConfig()
  const template = await getEmailTemplateConfig()

  const result = await sendSmtpTestEmail({
    config: {
      enabled: body?.enabled ?? saved.enabled,
      host: body?.host ?? saved.host,
      port: body?.port !== undefined ? Number(body.port) : saved.port,
      user: body?.user ?? saved.user,
      password: body?.password ?? saved.password,
      encryption: body?.encryption ?? saved.encryption,
      fromEmail: body?.fromEmail ?? saved.fromEmail,
      fromName: body?.fromName ?? saved.fromName,
    },
    to,
    brand,
    template,
  })

  return {
    ok: true,
    ...result,
    message: `E-mail de teste enviado para ${result.to}.`,
  }
})
