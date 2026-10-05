import { assertInstallAllowed, getInstallStatus } from '../../../utils/install'
import { sendSmtpTestEmail } from '../../../utils/mail'
import {
  getBrandSiteConfig,
  getEmailTemplateConfig,
  type SmtpEncryption,
} from '../../../utils/site-settings'

export default defineEventHandler(async (event) => {
  await assertInstallAllowed()

  const status = await getInstallStatus()
  if (!status.schemaReady) {
    throw createError({
      statusCode: 400,
      message: 'Aplique o schema do banco antes de testar o SMTP.',
    })
  }

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

  const brand = await getBrandSiteConfig()
  const template = await getEmailTemplateConfig()
  const result = await sendSmtpTestEmail({
    config: {
      enabled: body?.enabled ?? true,
      host: body?.host,
      port: body?.port !== undefined ? Number(body.port) : undefined,
      user: body?.user,
      password: body?.password,
      encryption: body?.encryption,
      fromEmail: body?.fromEmail,
      fromName: body?.fromName,
    },
    to: typeof body?.to === 'string' ? body.to : '',
    brand,
    template,
  })

  return {
    ok: true,
    ...result,
    message: `E-mail de teste enviado para ${result.to}.`,
  }
})
