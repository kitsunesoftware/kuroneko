import { countModuleQueue, listModuleQueue } from '../../utils/module-queue'
import { getStoreRuntimeInfo } from '../../utils/app-restart'

export default defineEventHandler(async () => {
  const items = await listModuleQueue()
  const count = await countModuleQueue()
  return {
    count,
    items,
    runtime: getStoreRuntimeInfo(),
  }
})
