import { listModuleQueue } from '../../utils/module-queue'
import { usePrisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  let queueItems: Awaited<ReturnType<typeof listModuleQueue>> = []
  try {
    queueItems = await listModuleQueue()
  }
  catch {
    queueItems = []
  }

  const queueById = Object.fromEntries(queueItems.map((item) => [item.moduleId, item]))
  const pendingModuleIds = queueItems.map((item) => item.moduleId)

  if (!process.env.DATABASE_URL) {
    return {
      installed: [] as Array<{
        moduleId: string
        enabled: boolean
        needsRestart: boolean
        queuedAction: string | null
        pendingUninstall: boolean
      }>,
      pendingModuleIds,
      queue: queueItems,
    }
  }

  try {
    const prisma = usePrisma()
    const rows = await prisma.installedModule.findMany({
      select: { moduleId: true, enabled: true },
      orderBy: { moduleId: 'asc' },
    })

    return {
      installed: rows.map((row) => {
        const queued = queueById[row.moduleId]
        return {
          ...row,
          needsRestart: Boolean(queued),
          queuedAction: queued?.action ?? null,
          pendingUninstall: queued?.action === 'uninstall',
          pendingReason: queued?.action ?? null,
        }
      }),
      pendingModuleIds,
      queue: queueItems,
    }
  }
  catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code)
      : ''
    if (code === 'P2021' || code === 'P2022' || code === 'P1001') {
      return {
        installed: [],
        pendingModuleIds,
        queue: queueItems,
      }
    }
    throw error
  }
})
