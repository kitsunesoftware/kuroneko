export default defineNuxtRouteMiddleware((to) => {
  const { isRouteAllowed } = useModules()

  if (!isRouteAllowed(to.path)) {
    return navigateTo('/panel/modules')
  }
})
