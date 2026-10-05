import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BrandSiteConfig, EmailTemplateConfig } from './site-settings'
import {
  BRAND_SITE_DEFAULTS,
  EMAIL_TEMPLATE_SITE_DEFAULTS,
} from './site-settings'

export type BrandedEmailAttachment = {
  filename: string
  content: Buffer
  contentType: string
  cid: string
}

export type BrandedEmailParts = {
  html: string
  text: string
  attachments: BrandedEmailAttachment[]
}

export const EMAIL_TEMPLATE_PLACEHOLDERS = [
  { key: 'subject', description: 'Assunto do e-mail' },
  { key: 'preheader', description: 'Pré-visualização oculta' },
  { key: 'title', description: 'Título da marca' },
  { key: 'tagline', description: 'Slogan da marca' },
  { key: 'primaryColor', description: 'Cor primária' },
  { key: 'backgroundColor', description: 'Cor de fundo' },
  { key: 'cardBackgroundColor', description: 'Cor do cartão' },
  { key: 'footerNote', description: 'Texto do rodapé' },
  { key: 'heading', description: 'Título do conteúdo' },
  { key: 'bodyHtml', description: 'Corpo HTML do e-mail' },
  { key: 'logoSrc', description: 'URL/CID da logo' },
  { key: 'logoBlock', description: 'Bloco HTML da logo (ou vazio)' },
  { key: 'taglineBlock', description: 'Bloco HTML do slogan (ou vazio)' },
  { key: 'accentBar', description: 'Barra de destaque (ou vazio)' },
] as const

const LOGO_CID = 'kuroneko-brand-logo'
const MAX_INLINE_LOGO_BYTES = 400_000
export const MAX_EMAIL_HTML_TEMPLATE_CHARS = 200_000

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function defaultLogoPath() {
  // layers/base/server/utils -> layers/base
  const baseLayerDir = join(dirname(fileURLToPath(import.meta.url)), '../..')
  return join(baseLayerDir, 'app', 'assets', 'images', 'logo.png')
}

function parseDataUrl(dataUrl: string): { content: Buffer, contentType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl.trim())
  if (!match) return null
  try {
    const content = Buffer.from(match[2]!, 'base64')
    if (!content.length || content.length > MAX_INLINE_LOGO_BYTES) return null
    return {
      contentType: match[1] || 'image/png',
      content,
    }
  }
  catch {
    return null
  }
}

function resolveLogoSource(logo?: string | null): {
  attachment: BrandedEmailAttachment | null
  dataUrl: string | null
} {
  if (logo) {
    const parsed = parseDataUrl(logo)
    if (parsed) {
      const ext = parsed.contentType.includes('svg')
        ? 'svg'
        : parsed.contentType.includes('jpeg') || parsed.contentType.includes('jpg')
          ? 'jpg'
          : parsed.contentType.includes('webp')
            ? 'webp'
            : 'png'
      return {
        dataUrl: `data:${parsed.contentType};base64,${parsed.content.toString('base64')}`,
        attachment: {
          filename: `logo.${ext}`,
          content: parsed.content,
          contentType: parsed.contentType,
          cid: LOGO_CID,
        },
      }
    }
  }

  const path = defaultLogoPath()
  if (!existsSync(path)) return { attachment: null, dataUrl: null }
  try {
    const content = readFileSync(path)
    if (!content.length || content.length > MAX_INLINE_LOGO_BYTES) {
      return { attachment: null, dataUrl: null }
    }
    return {
      dataUrl: `data:image/png;base64,${content.toString('base64')}`,
      attachment: {
        filename: 'logo.png',
        content,
        contentType: 'image/png',
        cid: LOGO_CID,
      },
    }
  }
  catch {
    return { attachment: null, dataUrl: null }
  }
}

/** Template HTML padrão com placeholders editáveis. */
export function getDefaultEmailHtmlTemplate() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background:{{backgroundColor}};color:#1C223D;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{preheader}}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{{backgroundColor}};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:{{cardBackgroundColor}};border:1px solid #e6e2da;border-radius:16px;overflow:hidden;">
          {{accentBar}}
          <tr>
            <td style="padding:36px 32px 28px;text-align:center;">
              {{logoBlock}}
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;line-height:1.2;color:#1C223D;">
                {{title}}
              </h1>
              {{taglineBlock}}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:#ece8e1;font-size:0;line-height:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 32px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1C223D;text-align:left;">
              <h2 style="margin:0 0 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:18px;font-weight:650;line-height:1.3;color:#1C223D;">
                {{heading}}
              </h2>
              {{bodyHtml}}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <div style="height:1px;background:#ece8e1;font-size:0;line-height:0;">&nbsp;</div>
              <p style="margin:18px 0 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:12px;line-height:1.5;color:#8b8680;text-align:center;">
                {{footerNote}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function applyPlaceholders(source: string, vars: Record<string, string>) {
  return source.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : ''
  })
}

/**
 * Layout HTML de e-mail com marca (logo + título + slogan).
 * Usa o HTML customizado (placeholders) ou o template padrão.
 */
export function renderBrandedEmail(options: {
  brand?: Partial<BrandSiteConfig> | null
  template?: Partial<EmailTemplateConfig> | null
  subject?: string
  preheader?: string
  heading: string
  bodyHtml: string
  bodyText: string
  /** cid = envio real; data = preview no navegador */
  logoMode?: 'cid' | 'data'
}): BrandedEmailParts {
  const title = (options.brand?.title || BRAND_SITE_DEFAULTS.title).trim() || BRAND_SITE_DEFAULTS.title
  const tagline = (options.brand?.tagline ?? BRAND_SITE_DEFAULTS.tagline).trim()
  const primary = (options.brand?.primaryColor || BRAND_SITE_DEFAULTS.primaryColor).trim()
    || BRAND_SITE_DEFAULTS.primaryColor
  const template = {
    ...EMAIL_TEMPLATE_SITE_DEFAULTS,
    ...options.template,
  }
  const logoSource = template.showLogo
    ? resolveLogoSource(options.brand?.logo)
    : { attachment: null, dataUrl: null }
  const preheader = (options.preheader || options.heading).trim()
  const footerNote = (template.footerNote || `${title}${tagline ? ` · ${tagline}` : ''}`).trim()
  const logoMode = options.logoMode || 'cid'
  const logoSrc = logoMode === 'data'
    ? (logoSource.dataUrl || '')
    : (logoSource.attachment ? `cid:${LOGO_CID}` : '')

  const logoBlock = logoSrc
    ? `<img src="${logoSrc}" width="56" height="56" alt="${escapeHtml(title)}" style="display:block;width:56px;height:56px;object-fit:contain;border:0;margin:0 auto 16px;" />`
    : ''

  const taglineBlock = template.showTagline && tagline
    ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.45;color:#6b7280;">${escapeHtml(tagline)}</p>`
    : ''

  const accentBar = template.showAccentBar
    ? `<tr>
            <td style="height:4px;background:${escapeHtml(primary)};font-size:0;line-height:0;">&nbsp;</td>
          </tr>`
    : ''

  const source = (template.htmlTemplate || '').trim() || getDefaultEmailHtmlTemplate()
  const html = applyPlaceholders(source, {
    subject: escapeHtml(options.subject || options.heading),
    preheader: escapeHtml(preheader),
    title: escapeHtml(title),
    tagline: escapeHtml(tagline),
    primaryColor: escapeHtml(primary),
    backgroundColor: escapeHtml(template.backgroundColor),
    cardBackgroundColor: escapeHtml(template.cardBackgroundColor),
    footerNote: escapeHtml(footerNote),
    heading: escapeHtml(options.heading),
    bodyHtml: options.bodyHtml,
    logoSrc,
    logoBlock,
    taglineBlock,
    accentBar,
  })

  const text = [
    title,
    template.showTagline ? tagline : '',
    '',
    options.heading,
    '',
    options.bodyText,
    '',
    footerNote,
  ].filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n')

  return {
    html,
    text,
    attachments: logoMode === 'cid' && logoSource.attachment ? [logoSource.attachment] : [],
  }
}

export function sampleEmailBody() {
  return {
    heading: 'Seu SMTP está funcionando',
    bodyHtml: `
      <p style="margin:0 0 12px;">Olá!</p>
      <p style="margin:0 0 12px;">
        Este é um e-mail de exemplo para pré-visualizar o template.
        A aparência abaixo reflete logo, slogan e o HTML editado.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;background:#F8F8F6;border:1px solid #ece8e1;border-radius:12px;">
        <tr>
          <td style="padding:14px 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:13px;line-height:1.55;color:#5c5852;">
            Use esta página para ajustar o visual e o código dos e-mails do sistema.
          </td>
        </tr>
      </table>
    `,
    bodyText: [
      'Olá!',
      '',
      'Este é um e-mail de exemplo para pré-visualizar o template.',
      'A aparência abaixo reflete logo, slogan e o HTML editado.',
    ].join('\n'),
  }
}
