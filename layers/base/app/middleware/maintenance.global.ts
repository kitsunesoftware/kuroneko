export default defineNuxtRouteMiddleware((to) => {
  const { settings } = useSiteSettings()

  if (!settings.value.maintenance) return
  if (to.path.startsWith('/panel')) return
  if (to.path === '/maintenance') return
  if (to.path === '/install') return

  return navigateTo('/maintenance')
})
