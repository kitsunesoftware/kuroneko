import { listLocalLayerModules } from '../../utils/module-store'

export default defineEventHandler(async () => {
  const modules = await listLocalLayerModules()
  return { modules }
})
