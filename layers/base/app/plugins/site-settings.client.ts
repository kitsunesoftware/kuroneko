export default defineNuxtPlugin(() => {
  const { settings, loadLogo, applyTheme } = useSiteSettings()

  loadLogo()
  applyTheme()

  useHead(() => ({
    title: settings.value.title,
    titleTemplate: (title) =>
      title && title !== settings.value.title
        ? `${title} · ${settings.value.title}`
        : settings.value.title,
  }))

  watch(
    () => settings.value.primaryColor,
    () => applyTheme(),
  )
})
