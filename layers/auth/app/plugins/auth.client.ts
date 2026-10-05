export default defineNuxtPlugin(async () => {
  const { token, user, fetchUser } = useAuth()

  if (token.value && !user.value) {
    await fetchUser()
  }
})
