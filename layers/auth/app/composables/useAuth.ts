import {
  PANEL_FALLBACK_ROUTES,
  resolvePanelPermission,
} from '../../modules/roles/shared/panel-routes'
import { SYSTEM_ROLE_KEYS } from '../../modules/roles/shared/permissions'

export type AuthUser = {
  id: string
  email: string
  name: string
  username?: string | null
  roleId?: string | null
  roleKey?: string | null
  permissions?: string[]
}

type LoginPayload = {
  email: string
  password: string
  allowUsername?: boolean
  turnstileToken?: string
}

type LoginResponse = {
  token: string
  user: AuthUser
}

export type TwoFactorChallengeResponse = {
  requiresTwoFactor: true
  challengeToken: string
  methods: Array<'totp' | 'webauthn'>
  webauthnOptions?: unknown
}

export type LoginResult = LoginResponse | TwoFactorChallengeResponse

export function isTwoFactorChallenge(
  data: LoginResult,
): data is TwoFactorChallengeResponse {
  return 'requiresTwoFactor' in data && data.requiresTwoFactor === true
}

export function useAuth() {
  const config = useRuntimeConfig()
  const cookieName = config.public.auth.cookieName

  const token = useCookie<string | null>(cookieName, {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  })

  const user = useState<AuthUser | null>('auth-user', () => null)

  const isAuthenticated = computed(() => Boolean(token.value && user.value))

  function setSession(data: LoginResponse) {
    token.value = data.token
    user.value = data.user
  }

  async function login(payload: LoginPayload): Promise<LoginResult> {
    const data = await $fetch<LoginResult>('/api/auth/login', {
      method: 'POST',
      body: {
        email: payload.email,
        password: payload.password,
        allowUsername: payload.allowUsername,
        turnstileToken: payload.turnstileToken,
      },
    })

    if (!isTwoFactorChallenge(data)) {
      setSession(data)
    }

    return data
  }

  async function completeTwoFactor(payload: {
    challengeToken: string
    code?: string
    webauthnResponse?: unknown
  }) {
    const data = await $fetch<LoginResponse>('/api/auth/login/2fa', {
      method: 'POST',
      body: payload,
    })
    setSession(data)
    return data.user
  }

  async function fetchUser() {
    if (!token.value) {
      user.value = null
      return null
    }

    try {
      const data = await $fetch<AuthUser>('/api/auth/me', {
        headers: { Authorization: `Bearer ${token.value}` },
      })
      user.value = data
      return data
    }
    catch {
      token.value = null
      user.value = null
      return null
    }
  }

  async function logout() {
    try {
      await $fetch('/api/auth/logout', {
        method: 'POST',
        headers: token.value ? { Authorization: `Bearer ${token.value}` } : undefined,
      })
    }
    catch {
      // ignore network errors on logout
    }

    token.value = null
    user.value = null

    return navigateTo(config.public.auth.loginPath)
  }

  return {
    user,
    token,
    isAuthenticated,
    login,
    completeTwoFactor,
    setSession,
    logout,
    fetchUser,
  }
}

export function usePermissions() {
  const { user, token, fetchUser } = useAuth()

  const permissions = computed(() => user.value?.permissions ?? [])
  const roleKey = computed(() => user.value?.roleKey ?? null)
  const isAdmin = computed(() => roleKey.value === SYSTEM_ROLE_KEYS.admin)

  function can(permissionKey: string) {
    if (!permissionKey) return true
    if (isAdmin.value) return true
    return permissions.value.includes(permissionKey)
  }

  function canAny(...keys: string[]) {
    return keys.some((key) => can(key))
  }

  async function ensureLoaded() {
    if (!token.value) return false
    if (!user.value || user.value.permissions == null) {
      await fetchUser()
    }
    return Boolean(user.value)
  }

  function canAccessPanelPath(path: string) {
    if (!can('panel.access')) return false
    return can(resolvePanelPermission(path))
  }

  function firstAllowedPanelPath() {
    if (!can('panel.access')) return null
    for (const route of PANEL_FALLBACK_ROUTES) {
      if (can(route.permission)) return route.path
    }
    return null
  }

  return {
    permissions,
    roleKey,
    isAdmin,
    can,
    canAny,
    ensureLoaded,
    canAccessPanelPath,
    firstAllowedPanelPath,
  }
}
