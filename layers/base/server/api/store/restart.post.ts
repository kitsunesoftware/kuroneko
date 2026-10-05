import { schedulePm2Rebuild } from '../../utils/app-restart'

export default defineEventHandler(() => {
  return schedulePm2Rebuild()
})
