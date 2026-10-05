export default defineNuxtRouteMiddleware(() => {
  const { token } = useAuth()
  const config = useRuntimeConfig()

  if (token.value) {
    return navigateTo(config.public.auth.homePath)
  }
})
