import { getAllModuleSettings } from '../../utils/module-settings'
import { usePrisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  try {
    usePrisma()
    const settings = await getAllModuleSettings()
    return { settings }
  }
  catch {
    return { settings: {} as Record<string, Record<string, unknown>> }
  }
})
