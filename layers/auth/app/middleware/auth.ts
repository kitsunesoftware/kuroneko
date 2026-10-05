export default defineNuxtRouteMiddleware(() => {
  const { token } = useAuth()

  if (!token.value) {
    const config = useRuntimeConfig()
    return navigateTo(config.public.auth.loginPath)
  }
})
