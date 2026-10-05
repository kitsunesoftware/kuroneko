export default defineNuxtPlugin(async () => {
  const { refreshInstalled, refreshLayers } = useModules()
  await Promise.all([refreshInstalled(), refreshLayers()])
})
