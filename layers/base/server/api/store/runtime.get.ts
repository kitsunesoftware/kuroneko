import { getStoreRuntimeInfo } from '../../utils/app-restart'

export default defineEventHandler(() => {
  return getStoreRuntimeInfo()
})
