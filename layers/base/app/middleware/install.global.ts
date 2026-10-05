export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith('/api')) return

  const { status, loaded, refresh } = useInstallStatus()
  const { token } = useAuth()
  const config = useRuntimeConfig()

  if (!loaded.value || to.path === '/install' || !status.value) {
    await refresh()
  }

  const current = status.value
  if (!current) return

  if (!current.installed && to.path !== '/install') {
    return navigateTo({
      path: '/install',
      query: { step: '1' },
    })
  }

  if (current.installed && to.path === '/install') {
    return navigateTo(
      token.value
        ? (config.public.auth?.homePath || '/')
        : (config.public.auth?.loginPath || '/login'),
    )
  }
})
