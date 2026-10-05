import { createError } from 'h3'
import { usePrisma } from './prisma'

export type ModuleQueueAction = 'install' | 'uninstall'

export type ModuleQueueItem = {
  id: string
  moduleId: string
  action: ModuleQueueAction
  label: string | null
  version: string | null
  target: string | null
  hasSchema: boolean
  createdAt: Date
  updatedAt: Date
}

function assertAction(action: string): ModuleQueueAction {
  if (action === 'install' || action === 'uninstall') return action
  throw createError({ statusCode: 400, message: 'Ação de fila inválida.' })
}

/** Upsert: a última ação para o moduleId prevalece. */
export async function enqueueModuleChange(input: {
  moduleId: string
  action: ModuleQueueAction
  label?: string | null
  version?: string | null
  target?: string | null
  hasSchema?: boolean
}) {
  const moduleId = String(input.moduleId || '').trim()
  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Módulo inválido.' })
  }
  const action = assertAction(input.action)
  const prisma = usePrisma()

  return prisma.moduleChangeQueue.upsert({
    where: { moduleId },
    create: {
      moduleId,
      action,
      label: input.label ?? null,
      version: input.version ?? null,
      target: input.target ?? null,
      hasSchema: Boolean(input.hasSchema),
    },
    update: {
      action,
      label: input.label ?? null,
      version: input.version ?? null,
      target: input.target ?? null,
      hasSchema: Boolean(input.hasSchema),
    },
  })
}

export async function listModuleQueue(): Promise<ModuleQueueItem[]> {
  const prisma = usePrisma()
  const rows = await prisma.moduleChangeQueue.findMany({
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((row) => ({
    ...row,
    action: assertAction(row.action),
  }))
}

export async function countModuleQueue() {
  const prisma = usePrisma()
  return prisma.moduleChangeQueue.count()
}

export async function clearModuleQueue() {
  const prisma = usePrisma()
  await prisma.moduleChangeQueue.deleteMany({})
}

export async function removeFromModuleQueue(moduleId: string) {
  const prisma = usePrisma()
  await prisma.moduleChangeQueue.deleteMany({ where: { moduleId } })
}
