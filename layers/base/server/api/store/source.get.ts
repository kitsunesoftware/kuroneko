import { getStoreSourceInfo } from '../../utils/module-store'

export default defineEventHandler(async () => {
  return getStoreSourceInfo()
})
