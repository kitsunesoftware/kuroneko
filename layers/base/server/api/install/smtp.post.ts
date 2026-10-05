import { assertInstallAllowed, getInstallStatus } from '../../utils/install'
import { setSmtpSiteConfig, type SmtpEncryption } from '../../utils/site-settings'

export default defineEventHandler(async (event) => {
  await assertInstallAllowed()

  const status = await getInstallStatus()
  if (!status.schemaReady) {
    throw createError({
      statusCode: 400,
      message: 'Aplique o schema do banco antes de salvar o SMTP.',
    })
  }

  const body = await readBody<{
    enabled?: boolean
    host?: string
    port?: number | string
    user?: string
    password?: string
    encryption?: SmtpEncryption
    fromEmail?: string
    fromName?: string
  }>(event)

  const enabled = Boolean(body?.enabled)
  if (enabled) {
    const host = typeof body?.host === 'string' ? body.host.trim() : ''
    const fromEmail = typeof body?.fromEmail === 'string' ? body.fromEmail.trim() : ''
    if (!host) {
      throw createError({ statusCode: 400, message: 'Informe o host SMTP.' })
    }
    if (!fromEmail || !fromEmail.includes('@')) {
      throw createError({ statusCode: 400, message: 'Informe um e-mail remetente válido.' })
    }
  }

  const smtp = await setSmtpSiteConfig({
    enabled,
    host: body?.host,
    port: body?.port !== undefined ? Number(body.port) : undefined,
    user: body?.user,
    password: body?.password,
    encryption: body?.encryption,
    fromEmail: body?.fromEmail,
    fromName: body?.fromName,
  })

  return {
    ok: true,
    smtp: {
      ...smtp,
      password: smtp.password ? '••••••••' : '',
    },
  }
})
