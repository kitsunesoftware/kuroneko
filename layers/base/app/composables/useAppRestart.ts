export type AppRestartRuntime = {
  available?: boolean
  label?: string
  hint?: string
} | null

/**
 * Estado global do overlay de reinício (layout) + health check.
 * Compartilhado entre loja e Meus módulos via useState.
 */
export function useAppRestart() {
  const toast = useToast()

  const restarting = useState('kuroneko-app-restarting', () => false)
  const restartPhase = useState('kuroneko-app-restart-phase', () => '')
  const restartError = useState<string | null>('kuroneko-app-restart-error', () => null)
  const runtime = useState<AppRestartRuntime>('kuroneko-app-restart-runtime', () => null)

  const canRebuildPm2 = computed(() => Boolean(runtime.value?.available))
  const restartLabel = computed(() => runtime.value?.label || 'Reiniciar aplicação')
  const restartHint = computed(() =>
    runtime.value?.hint
    || 'Processa a fila, aplica schema, build e sobe no PM2.',
  )

  function setRuntime(value: AppRestartRuntime) {
    runtime.value = value
  }

  function dismissRestartOverlay() {
    restarting.value = false
    restartPhase.value = ''
    restartError.value = null
  }

  function sleep(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  async function probeHealth() {
    const urls = ['/api/health', '/api/store/runtime']
    for (const url of urls) {
      try {
        await $fetch(url, { timeout: 4000 })
        return true
      }
      catch {
        // tenta próximo
      }
    }
    return false
  }

  async function waitForServerCycle() {
    restartPhase.value = 'Aguardando o PM2 parar o app…'
    let sawDown = false
    for (let i = 0; i < 60; i++) {
      await sleep(500)
      const up = await probeHealth()
      if (!up) {
        sawDown = true
        restartPhase.value = 'Aplicação offline — processando fila e build…'
        break
      }
      restartPhase.value = 'Aguardando o PM2 parar o app…'
    }

    let consecutiveOk = 0
    for (let i = 0; i < 180; i++) {
      await sleep(2000)
      const up = await probeHealth()
      if (up) {
        consecutiveOk++
        restartPhase.value = consecutiveOk >= 2
          ? 'Aplicação online'
          : 'Servidor respondeu — confirmando…'
        if (consecutiveOk >= 2) return true
      }
      else {
        consecutiveOk = 0
        restartPhase.value = sawDown
          ? 'Fila / build / restart em andamento…'
          : 'Aguardando a aplicação…'
      }
    }
    return false
  }

  function extractApiMessage(error: unknown, fallback: string) {
    if (
      error
      && typeof error === 'object'
      && 'data' in error
      && error.data
      && typeof error.data === 'object'
      && 'message' in error.data
      && typeof error.data.message === 'string'
    ) {
      return error.data.message
    }
    return fallback
  }

  /**
   * Abre o overlay imediatamente e dispara o job PM2 + health check.
   */
  async function requestAppRestart(options?: {
    onSuccess?: () => void | Promise<void>
    closeInstallModal?: () => void
  }) {
    // Garante overlay no frame atual (antes de qualquer await).
    options?.closeInstallModal?.()
    restartError.value = null
    restartPhase.value = 'Preparando reinício…'
    restarting.value = true

    // Cede ao browser para pintar o overlay antes do fetch/health check.
    await new Promise<void>((resolve) => {
      if (!import.meta.client) {
        resolve()
        return
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve())
      })
    })

    if (!canRebuildPm2.value) {
      restartError.value = restartHint.value
        || 'Reinício automático só está disponível sob PM2 em produção.'
      return
    }

    restartPhase.value = 'Disparando job PM2…'

    try {
      await $fetch('/api/store/restart', { method: 'POST', timeout: 15_000 })
    }
    catch (error: unknown) {
      const message = extractApiMessage(error, '')
      const softFail = !message
        || /fetch|network|Failed|ECONNRESET|aborted|terminated|timeout/i.test(message)
      if (!softFail) {
        restartError.value = message || 'Falha ao agendar o reinício.'
        return
      }
    }

    const ok = await waitForServerCycle()
    if (ok) {
      dismissRestartOverlay()
      toast.success('Aplicação online', 'A fila de módulos foi processada.')
      await options?.onSuccess?.()
      return
    }

    restartError.value = 'Demorou demais. Confira pm2 logs e .kuroneko/restart.log.'
  }

  return {
    restarting,
    restartPhase,
    restartError,
    runtime,
    canRebuildPm2,
    restartLabel,
    restartHint,
    setRuntime,
    dismissRestartOverlay,
    requestAppRestart,
  }
}
