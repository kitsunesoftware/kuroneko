/**
 * Protege /panel: exige login + permissões (panel.access e a da rota).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/panel')) return

  const config = useRuntimeConfig()
  const { token } = useAuth()
  const {
    ensureLoaded,
    can,
    canAccessPanelPath,
    firstAllowedPanelPath,
  } = usePermissions()

  if (!token.value) {
    return navigateTo({
      path: config.public.auth.loginPath || '/login',
      query: { redirect: to.fullPath },
    })
  }

  const ok = await ensureLoaded()
  if (!ok) {
    return navigateTo({
      path: config.public.auth.loginPath || '/login',
      query: { redirect: to.fullPath },
    })
  }

  if (!can('panel.access')) {
    return navigateTo(config.public.auth.homePath || '/')
  }

  if (!canAccessPanelPath(to.path)) {
    const fallback = firstAllowedPanelPath()
    if (fallback && fallback !== to.path) {
      return navigateTo(fallback)
    }
    return navigateTo(config.public.auth.homePath || '/')
  }
})
