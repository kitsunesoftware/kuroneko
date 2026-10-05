import { usePrisma } from './prisma'
import { STORE_MONOREPO } from '../../shared/store-monorepo'

export type StoreSiteConfig = {
  /** Sempre o monorepo oficial (hardcoded). */
  repo: string
  /** Sempre a ref oficial (hardcoded). */
  ref: string
  /** Token opcional para rate limit / acesso privado. */
  githubToken: string
}

export type BrandSiteConfig = {
  title: string
  tagline: string
  primaryColor: string
  /** Data URL da logo (opcional). Usada em e-mails e marca persistida. */
  logo: string | null
}

export type SmtpEncryption = 'none' | 'tls' | 'ssl'

export type SmtpSiteConfig = {
  enabled: boolean
  host: string
  port: number
  user: string
  password: string
  encryption: SmtpEncryption
  fromEmail: string
  fromName: string
}

/** Aparência do layout HTML dos e-mails do sistema. */
export type EmailTemplateConfig = {
  showLogo: boolean
  showTagline: boolean
  showAccentBar: boolean
  /** Vazio = título · slogan automaticamente. */
  footerNote: string
  backgroundColor: string
  cardBackgroundColor: string
  /**
   * HTML completo do e-mail com placeholders (`{{title}}`, `{{bodyHtml}}`, …).
   * Vazio = template padrão do sistema.
   */
  htmlTemplate: string
}

export const STORE_SITE_SETTING_KEY = 'store'
export const BRAND_SITE_SETTING_KEY = 'site'
export const SMTP_SITE_SETTING_KEY = 'smtp'
export const EMAIL_TEMPLATE_SITE_SETTING_KEY = 'emailTemplate'

export const STORE_SITE_DEFAULTS: StoreSiteConfig = {
  repo: STORE_MONOREPO.repo,
  ref: STORE_MONOREPO.ref,
  githubToken: '',
}

export const BRAND_SITE_DEFAULTS: BrandSiteConfig = {
  title: 'Kuroneko',
  tagline: 'Template modular Nuxt',
  primaryColor: '#c45c26',
  logo: null,
}

export const SMTP_SITE_DEFAULTS: SmtpSiteConfig = {
  enabled: false,
  host: '',
  port: 587,
  user: '',
  password: '',
  encryption: 'tls',
  fromEmail: '',
  fromName: '',
}

export const EMAIL_TEMPLATE_SITE_DEFAULTS: EmailTemplateConfig = {
  showLogo: true,
  showTagline: true,
  showAccentBar: true,
  footerNote: '',
  backgroundColor: '#F3F1EC',
  cardBackgroundColor: '#ffffff',
  htmlTemplate: '',
}

const MAX_EMAIL_HTML_TEMPLATE_CHARS = 200_000

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function coerceStoreConfig(raw: unknown): StoreSiteConfig {
  const githubToken = isPlainObject(raw) && typeof raw.githubToken === 'string'
    ? raw.githubToken.trim()
    : ''
  return {
    repo: STORE_MONOREPO.repo,
    ref: STORE_MONOREPO.ref,
    githubToken,
  }
}

function coerceBrandConfig(raw: unknown): BrandSiteConfig {
  if (!isPlainObject(raw)) return { ...BRAND_SITE_DEFAULTS }
  const colorRaw = typeof raw.primaryColor === 'string' ? raw.primaryColor.trim() : ''
  const primaryColor = /^#?[0-9a-fA-F]{3,8}$/.test(colorRaw)
    ? (colorRaw.startsWith('#') ? colorRaw : `#${colorRaw}`)
    : BRAND_SITE_DEFAULTS.primaryColor

  const logoRaw = typeof raw.logo === 'string' ? raw.logo.trim() : ''
  const logo = logoRaw.startsWith('data:image/') && logoRaw.length < 2_000_000
    ? logoRaw
    : null

  return {
    title: typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : BRAND_SITE_DEFAULTS.title,
    tagline: typeof raw.tagline === 'string'
      ? raw.tagline.trim()
      : BRAND_SITE_DEFAULTS.tagline,
    primaryColor,
    logo,
  }
}

function coerceSmtpEncryption(value: unknown): SmtpEncryption {
  if (value === 'none' || value === 'tls' || value === 'ssl') return value
  return SMTP_SITE_DEFAULTS.encryption
}

export function coerceSmtpConfig(raw: unknown): SmtpSiteConfig {
  if (!isPlainObject(raw)) return { ...SMTP_SITE_DEFAULTS }
  const portRaw = Number(raw.port)
  return {
    enabled: Boolean(raw.enabled),
    host: typeof raw.host === 'string' ? raw.host.trim() : '',
    port: Number.isFinite(portRaw) && portRaw > 0 ? Math.round(portRaw) : SMTP_SITE_DEFAULTS.port,
    user: typeof raw.user === 'string' ? raw.user.trim() : '',
    password: typeof raw.password === 'string' ? raw.password : '',
    encryption: coerceSmtpEncryption(raw.encryption),
    fromEmail: typeof raw.fromEmail === 'string' ? raw.fromEmail.trim() : '',
    fromName: typeof raw.fromName === 'string' ? raw.fromName.trim() : '',
  }
}

function coerceHexColor(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const raw = value.trim()
  if (!/^#?[0-9a-fA-F]{3,8}$/.test(raw)) return fallback
  return raw.startsWith('#') ? raw : `#${raw}`
}

export function coerceEmailTemplateConfig(raw: unknown): EmailTemplateConfig {
  if (!isPlainObject(raw)) return { ...EMAIL_TEMPLATE_SITE_DEFAULTS }
  const htmlRaw = typeof raw.htmlTemplate === 'string' ? raw.htmlTemplate : ''
  const htmlTemplate = htmlRaw.length > MAX_EMAIL_HTML_TEMPLATE_CHARS
    ? htmlRaw.slice(0, MAX_EMAIL_HTML_TEMPLATE_CHARS)
    : htmlRaw
  return {
    showLogo: raw.showLogo !== false,
    showTagline: raw.showTagline !== false,
    showAccentBar: raw.showAccentBar !== false,
    footerNote: typeof raw.footerNote === 'string' ? raw.footerNote.trim() : '',
    backgroundColor: coerceHexColor(raw.backgroundColor, EMAIL_TEMPLATE_SITE_DEFAULTS.backgroundColor),
    cardBackgroundColor: coerceHexColor(
      raw.cardBackgroundColor,
      EMAIL_TEMPLATE_SITE_DEFAULTS.cardBackgroundColor,
    ),
    htmlTemplate,
  }
}

export async function getStoreSiteConfig(): Promise<StoreSiteConfig> {
  const prisma = usePrisma()
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: STORE_SITE_SETTING_KEY },
    })
    if (!row) return { ...STORE_SITE_DEFAULTS }
    return coerceStoreConfig(row.value)
  }
  catch {
    return { ...STORE_SITE_DEFAULTS }
  }
}

export async function setStoreSiteConfig(
  input: Partial<Pick<StoreSiteConfig, 'githubToken'>>,
): Promise<StoreSiteConfig> {
  const current = await getStoreSiteConfig()
  const next: StoreSiteConfig = {
    repo: STORE_MONOREPO.repo,
    ref: STORE_MONOREPO.ref,
    githubToken: input.githubToken !== undefined
      ? String(input.githubToken).trim()
      : current.githubToken,
  }

  const prisma = usePrisma()
  await prisma.siteSetting.upsert({
    where: { key: STORE_SITE_SETTING_KEY },
    create: {
      key: STORE_SITE_SETTING_KEY,
      value: next,
    },
    update: {
      value: next,
    },
  })

  return next
}

export async function getBrandSiteConfig(): Promise<BrandSiteConfig> {
  const prisma = usePrisma()
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: BRAND_SITE_SETTING_KEY },
    })
    if (!row) return { ...BRAND_SITE_DEFAULTS }
    return coerceBrandConfig(row.value)
  }
  catch {
    return { ...BRAND_SITE_DEFAULTS }
  }
}

export async function setBrandSiteConfig(
  input: Partial<BrandSiteConfig>,
): Promise<BrandSiteConfig> {
  const current = await getBrandSiteConfig()
  const next = coerceBrandConfig({
    ...current,
    ...input,
    // Permitir limpar logo com null explícito.
    logo: input.logo === undefined ? current.logo : input.logo,
  })

  const prisma = usePrisma()
  await prisma.siteSetting.upsert({
    where: { key: BRAND_SITE_SETTING_KEY },
    create: {
      key: BRAND_SITE_SETTING_KEY,
      value: next,
    },
    update: {
      value: next,
    },
  })

  return next
}

export async function getSmtpSiteConfig(): Promise<SmtpSiteConfig> {
  const prisma = usePrisma()
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SMTP_SITE_SETTING_KEY },
    })
    if (!row) return { ...SMTP_SITE_DEFAULTS }
    return coerceSmtpConfig(row.value)
  }
  catch {
    return { ...SMTP_SITE_DEFAULTS }
  }
}

export async function setSmtpSiteConfig(
  input: Partial<SmtpSiteConfig>,
): Promise<SmtpSiteConfig> {
  const current = await getSmtpSiteConfig()
  const next = coerceSmtpConfig({
    ...current,
    ...input,
  })

  const prisma = usePrisma()
  await prisma.siteSetting.upsert({
    where: { key: SMTP_SITE_SETTING_KEY },
    create: {
      key: SMTP_SITE_SETTING_KEY,
      value: next,
    },
    update: {
      value: next,
    },
  })

  return next
}

export async function getEmailTemplateConfig(): Promise<EmailTemplateConfig> {
  const prisma = usePrisma()
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: EMAIL_TEMPLATE_SITE_SETTING_KEY },
    })
    if (!row) return { ...EMAIL_TEMPLATE_SITE_DEFAULTS }
    return coerceEmailTemplateConfig(row.value)
  }
  catch {
    return { ...EMAIL_TEMPLATE_SITE_DEFAULTS }
  }
}

export async function setEmailTemplateConfig(
  input: Partial<EmailTemplateConfig>,
): Promise<EmailTemplateConfig> {
  const current = await getEmailTemplateConfig()
  const next = coerceEmailTemplateConfig({
    ...current,
    ...input,
  })

  const prisma = usePrisma()
  await prisma.siteSetting.upsert({
    where: { key: EMAIL_TEMPLATE_SITE_SETTING_KEY },
    create: {
      key: EMAIL_TEMPLATE_SITE_SETTING_KEY,
      value: next,
    },
    update: {
      value: next,
    },
  })

  return next
}
