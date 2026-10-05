import { getInstallStatus } from '../../utils/install'

export default defineEventHandler(async () => {
  return await getInstallStatus()
})
