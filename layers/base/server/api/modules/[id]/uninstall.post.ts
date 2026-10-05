import { SYSTEM_MODULE_IDS } from '../../../../shared/module-schemas'
import { enqueueModuleChange } from '../../../utils/module-queue'
import { listLocalLayerModules } from '../../../utils/module-store'
import { usePrisma } from '../../../utils/prisma'
import { resolveSchemaMeta } from '../../../utils/schema-meta'

async function resolveLayerTarget(moduleId: string): Promise<string | null> {
  try {
    const layers = await listLocalLayerModules()
    return layers.find((row) => row.id === moduleId)?.target ?? null
  }
  catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const moduleId = getRouterParam(event, 'id')
  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Módulo inválido.' })
  }

  if ((SYSTEM_MODULE_IDS as readonly string[]).includes(moduleId)) {
    throw createError({ statusCode: 400, message: 'Este módulo do sistema não pode ser desinstalado.' })
  }

  const prisma = usePrisma()
  const existing = await prisma.installedModule.findUnique({ where: { moduleId } })
  const layerTarget = await resolveLayerTarget(moduleId)

  // Já saiu do banco (ex.: fila processada) mas ainda aparece no build antigo.
  if (!existing) {
    if (layerTarget) {
      await enqueueModuleChange({
        moduleId,
        action: 'uninstall',
        label: moduleId,
        target: layerTarget,
        hasSchema: false,
      })
      return {
        ok: true,
        moduleId,
        installed: false,
        enabled: false,
        queued: true,
        action: 'uninstall',
        needsRestart: true,
        hint: 'Pacote ainda em layers/. Reinicie a aplicação para remover a pasta e atualizar o catálogo.',
      }
    }

    throw createError({
      statusCode: 400,
      message: 'Este módulo já não está instalado. Reinicie a aplicação Kuroneko para atualizar a lista (build antigo ainda pode mostrá-lo).',
    })
  }

  // Desativa na hora; remoção real na fila no reinício PM2.
  await prisma.installedModule.update({
    where: { moduleId },
    data: { enabled: false },
  })

  const meta = await resolveSchemaMeta(moduleId)
  await enqueueModuleChange({
    moduleId,
    action: 'uninstall',
    label: moduleId,
    target: layerTarget,
    hasSchema: Boolean(meta?.tables?.length),
  })

  const children = await prisma.installedModule.findMany({
    where: { moduleId: { startsWith: `${moduleId}.` } },
  })
  for (const child of children) {
    if ((SYSTEM_MODULE_IDS as readonly string[]).includes(child.moduleId)) continue
    await prisma.installedModule.update({
      where: { id: child.id },
      data: { enabled: false },
    })
    const childMeta = await resolveSchemaMeta(child.moduleId)
    const childTarget = await resolveLayerTarget(child.moduleId)
    await enqueueModuleChange({
      moduleId: child.moduleId,
      action: 'uninstall',
      label: child.moduleId,
      target: childTarget,
      hasSchema: Boolean(childMeta?.tables?.length),
    })
  }

  return {
    ok: true,
    moduleId,
    installed: true,
    enabled: false,
    queued: true,
    action: 'uninstall',
    needsRestart: true,
    hint: 'Desinstalação na fila. Reinicie a aplicação Kuroneko para remover o módulo da lista.',
  }
})
