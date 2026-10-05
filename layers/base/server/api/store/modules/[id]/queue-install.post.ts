import {
  createInstallJob,
  updateInstallJob,
} from '../../../../utils/module-install-job'
import { downloadStoreModule } from '../../../../utils/module-store'

export default defineEventHandler(async (event) => {
  const moduleId = getRouterParam(event, 'id')
  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Módulo inválido.' })
  }

  const job = createInstallJob(moduleId)

  // Processa em background para o client poder fazer poll do progresso.
  setTimeout(() => {
    void (async () => {
      try {
        const result = await downloadStoreModule(moduleId, {
          enqueueInstall: true,
          onProgress: (phase, progress, message) => {
            updateInstallJob(job.jobId, {
              phase: phase as 'downloading' | 'extracting' | 'saving' | 'enqueue' | 'done',
              progress,
              message,
            })
          },
        })
        updateInstallJob(job.jobId, {
          phase: 'done',
          progress: 100,
          message: 'Instalação na fila. Reinicie a aplicação!',
          target: result.target,
          version: result.version,
          error: null,
        })
      }
      catch (error: unknown) {
        const message = error instanceof Error
          ? error.message
          : (error && typeof error === 'object' && 'message' in error
              ? String((error as { message?: string }).message)
              : 'Falha na instalação')
        updateInstallJob(job.jobId, {
          phase: 'error',
          progress: 100,
          message: 'Falha ao preparar o módulo.',
          error: message,
        })
      }
    })()
  }, 50)

  return {
    ok: true,
    jobId: job.jobId,
    moduleId,
  }
})
