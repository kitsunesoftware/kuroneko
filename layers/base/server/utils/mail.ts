import nodemailer from 'nodemailer'
import { renderBrandedEmail } from './mail-template'
import type { BrandSiteConfig, EmailTemplateConfig, SmtpSiteConfig } from './site-settings'
import { BRAND_SITE_DEFAULTS, coerceSmtpConfig } from './site-settings'

export function assertSmtpReady(config: SmtpSiteConfig) {
  if (!config.enabled) {
    throw createError({
      statusCode: 400,
      message: 'Ative o SMTP antes de enviar e-mails.',
    })
  }
  if (!config.host) {
    throw createError({
      statusCode: 400,
      message: 'Informe o host SMTP.',
    })
  }
  if (!config.fromEmail || !config.fromEmail.includes('@')) {
    throw createError({
      statusCode: 400,
      message: 'Informe um e-mail remetente válido.',
    })
  }
}

export function createSmtpTransport(input: Partial<SmtpSiteConfig> | SmtpSiteConfig) {
  const config = coerceSmtpConfig(input)
  assertSmtpReady(config)

  const secure = config.encryption === 'ssl'
  const requireTLS = config.encryption === 'tls'

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure,
    requireTLS: requireTLS || undefined,
    auth: config.user
      ? {
          user: config.user,
          pass: config.password,
        }
      : undefined,
  })
}

export async function sendSmtpTestEmail(options: {
  config: Partial<SmtpSiteConfig> | SmtpSiteConfig
  to: string
  brand?: Partial<BrandSiteConfig> | null
  template?: Partial<EmailTemplateConfig> | null
}) {
  const config = coerceSmtpConfig(options.config)
  assertSmtpReady(config)

  const to = options.to.trim().toLowerCase()
  if (!to || !to.includes('@')) {
    throw createError({
      statusCode: 400,
      message: 'Informe um e-mail de destino válido para o teste.',
    })
  }

  const brand = {
    ...BRAND_SITE_DEFAULTS,
    ...options.brand,
  }
  const title = brand.title || BRAND_SITE_DEFAULTS.title
  const fromName = config.fromName || title
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const safeHost = config.host
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const encryptionLabel = config.encryption === 'none'
    ? 'Nenhuma'
    : config.encryption === 'ssl'
      ? 'SSL'
      : 'TLS (STARTTLS)'

  const mail = renderBrandedEmail({
    brand,
    template: options.template,
    subject: `[${title}] Teste de SMTP`,
    preheader: `Confirmação de SMTP — ${title}`,
    heading: 'Seu SMTP está funcionando',
    bodyHtml: `
      <p style="margin:0 0 12px;">Olá!</p>
      <p style="margin:0 0 12px;">
        Este é um e-mail de teste do <strong>${safeTitle}</strong>.
        Se você recebeu esta mensagem, a configuração SMTP está correta.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;background:#F8F8F6;border:1px solid #ece8e1;border-radius:12px;">
        <tr>
          <td style="padding:14px 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:13px;line-height:1.55;color:#5c5852;">
            <strong style="color:#1C223D;">Host:</strong> ${safeHost}<br />
            <strong style="color:#1C223D;">Porta:</strong> ${config.port}<br />
            <strong style="color:#1C223D;">Criptografia:</strong> ${encryptionLabel}
          </td>
        </tr>
      </table>
    `,
    bodyText: [
      'Olá!',
      '',
      `Este é um e-mail de teste do ${title}.`,
      'Se você recebeu esta mensagem, a configuração SMTP está correta.',
      '',
      `Host: ${config.host}`,
      `Porta: ${config.port}`,
      `Criptografia: ${encryptionLabel}`,
    ].join('\n'),
  })

  const transport = createSmtpTransport(config)

  try {
    await transport.sendMail({
      from: `"${fromName.replace(/"/g, '')}" <${config.fromEmail}>`,
      to,
      subject: `[${title}] Teste de SMTP`,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments.map((item) => ({
        filename: item.filename,
        content: item.content,
        contentType: item.contentType,
        cid: item.cid,
      })),
    })
  }
  catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha ao enviar o e-mail de teste.'
    throw createError({
      statusCode: 400,
      message,
    })
  }
  finally {
    transport.close()
  }

  return { ok: true as const, to }
}
