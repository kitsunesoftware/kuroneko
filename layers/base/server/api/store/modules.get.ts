import { listStoreModules } from '../../utils/module-store'

export default defineEventHandler(async () => {
  const modules = await listStoreModules()
  return { modules }
})
