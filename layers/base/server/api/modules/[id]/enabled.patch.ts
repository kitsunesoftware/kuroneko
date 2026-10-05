import { assertDownloadedModulePlatformCompatible } from '../../../utils/module-store'
import { listModuleQueue } from '../../../utils/module-queue'
import { usePrisma } from '../../../utils/prisma'

/** Módulos que nunca podem ser desativados. */
const NON_TOGGLEABLE_MODULE_IDS = ['panel', 'auth', 'auth.login', 'auth.roles'] as const

export default defineEventHandler(async (event) => {
  const moduleId = getRouterParam(event, 'id')
  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Módulo inválido.' })
  }

  if ((NON_TOGGLEABLE_MODULE_IDS as readonly string[]).includes(moduleId)) {
    throw createError({ statusCode: 400, message: 'Este módulo do sistema não pode ser desativado.' })
  }

  const body = await readBody<{ enabled?: boolean }>(event)
  if (typeof body?.enabled !== 'boolean') {
    throw createError({ statusCode: 400, message: 'Informe enabled: boolean.' })
  }

  const queue = await listModuleQueue()
  const queued = queue.find((item) => item.moduleId === moduleId)
  if (body.enabled && queued) {
    throw createError({
      statusCode: 409,
      message: queued.action === 'uninstall'
        ? 'Este módulo está na fila de desinstalação. Reinicie a aplicação para concluir.'
        : 'Este módulo está na fila de instalação. Reinicie a aplicação Kuroneko para ativar.',
    })
  }

  if (body.enabled) {
    await assertDownloadedModulePlatformCompatible(moduleId)
  }

  const prisma = usePrisma()
  const existing = await prisma.installedModule.findUnique({ where: { moduleId } })
  if (!existing) {
    throw createError({ statusCode: 400, message: 'Instale o módulo antes de ativar/desativar.' })
  }

  const updated = await prisma.installedModule.update({
    where: { moduleId },
    data: { enabled: body.enabled },
  })

  return { ok: true, moduleId, enabled: updated.enabled }
})
