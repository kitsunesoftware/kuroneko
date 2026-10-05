export type SmtpEncryption = 'none' | 'tls' | 'ssl'

export type SiteSettings = {
  title: string
  tagline: string
  primaryColor: string
  maintenance: boolean
  smtpEnabled: boolean
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassword: string
  smtpEncryption: SmtpEncryption
  smtpFromEmail: string
  smtpFromName: string
}

export const SITE_SETTINGS_DEFAULTS: SiteSettings = {
  title: 'Kuroneko',
  tagline: 'Template modular Nuxt',
  primaryColor: '#c45c26',
  maintenance: false,
  smtpEnabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  smtpEncryption: 'tls',
  smtpFromEmail: '',
  smtpFromName: '',
}

const LOGO_STORAGE_KEY = 'kuroneko_site_logo'

function darkenHex(hex: string, amount = 0.18): string {
  const raw = hex.replace('#', '').trim()
  const full = raw.length === 3
    ? raw.split('').map((char) => `${char}${char}`).join('')
    : raw

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return SITE_SETTINGS_DEFAULTS.primaryColor
  }

  const value = Number.parseInt(full, 16)
  const channels = [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255,
  ].map((channel) => Math.max(0, Math.round(channel * (1 - amount))))

  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

export function useSiteSettings() {
  const stored = useCookie<SiteSettings>('kuroneko_site_settings', {
    default: () => ({ ...SITE_SETTINGS_DEFAULTS }),
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })

  const logo = useState<string | null>('kuroneko-site-logo', () => null)
  const logoReady = useState('kuroneko-site-logo-ready', () => false)

  const settings = computed({
    get: () => ({
      ...SITE_SETTINGS_DEFAULTS,
      ...stored.value,
    }),
    set: (value: SiteSettings) => {
      stored.value = { ...value }
    },
  })

  function loadLogo() {
    if (!import.meta.client || logoReady.value) return
    try {
      logo.value = localStorage.getItem(LOGO_STORAGE_KEY)
    }
    catch {
      logo.value = null
    }
    logoReady.value = true
  }

  function setLogo(dataUrl: string | null) {
    logo.value = dataUrl
    if (!import.meta.client) return
    try {
      if (dataUrl) localStorage.setItem(LOGO_STORAGE_KEY, dataUrl)
      else localStorage.removeItem(LOGO_STORAGE_KEY)
    }
    catch {
      // quota / private mode
    }
  }

  function update(partial: Partial<SiteSettings>) {
    stored.value = {
      ...settings.value,
      ...partial,
    }
    applyTheme()
  }

  function reset() {
    stored.value = { ...SITE_SETTINGS_DEFAULTS }
    setLogo(null)
    applyTheme()
  }

  function applyTheme() {
    if (!import.meta.client) return
    const root = document.documentElement
    const primary = settings.value.primaryColor || SITE_SETTINGS_DEFAULTS.primaryColor
    root.style.setProperty('--color-accent', primary)
    root.style.setProperty('--color-accent-hover', darkenHex(primary))
  }

  if (import.meta.client) {
    loadLogo()
    applyTheme()
  }

  return {
    settings,
    logo,
    logoReady,
    loadLogo,
    setLogo,
    update,
    reset,
    applyTheme,
    defaults: SITE_SETTINGS_DEFAULTS,
  }
}
