export type ModuleBusyAction =
  | 'install'
  | 'uninstall'
  | 'removeLayer'
  | 'backup'
  | 'restore'
  | 'toggle'

const REMOVE_LAYER_NOTICE_KEY = 'kuroneko:remove-layer-notice'
const TRANSFER_MIN_MS = 3000

type RemoveLayerNotice = {
  target: string
  label: string
}

function errorMessage(error: unknown, fallback: string) {
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

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function withMinimumDelay<T>(task: Promise<T>, ms = TRANSFER_MIN_MS): Promise<T> {
  const [result] = await Promise.all([task, delay(ms)])
  return result
}

function peekRemoveLayerNotice(): RemoveLayerNotice | null {
  if (!import.meta.client) return null
  try {
    const raw = sessionStorage.getItem(REMOVE_LAYER_NOTICE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RemoveLayerNotice
    if (!parsed?.target) return null
    return parsed
  }
  catch {
    return null
  }
}

function persistRemoveLayerNotice(notice: RemoveLayerNotice) {
  if (!import.meta.client) return
  sessionStorage.setItem(REMOVE_LAYER_NOTICE_KEY, JSON.stringify(notice))
}

function clearRemoveLayerNotice() {
  if (!import.meta.client) return
  sessionStorage.removeItem(REMOVE_LAYER_NOTICE_KEY)
}

/**
 * Ações e modais compartilhados entre a lista e a página de detalhe de módulos.
 */
export function usePanelModulesWorkspace() {
  const {
    setEnabled,
    install,
    uninstall,
    removeLayer,
    backup,
    restore,
    refreshInstalled,
    refreshLayers,
    hasPendingRestart,
    pendingModuleIds,
  } = useModules()
  const { refreshSettings, hasSettings } = useModuleSettings()
  const toast = useToast()
  const {
    restarting,
    restartPhase,
    restartError,
    canRebuildPm2,
    restartLabel,
    restartHint,
    setRuntime,
    dismissRestartOverlay,
    requestAppRestart: runAppRestart,
  } = useAppRestart()

  async function refreshRuntime() {
    try {
      const rt = await $fetch<{
        available: boolean
        label: string
        hint: string
      }>('/api/store/runtime')
      setRuntime(rt)
    }
    catch {
      setRuntime(null)
    }
  }

  const settingsOpen = ref(false)
  const settingsModuleId = ref<string | null>(null)
  const settingsTitle = ref('Configurar módulo')
  const settingsFormRef = ref<{ reset: () => Promise<void> } | null>(null)
  const settingsSaveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
  let settingsSavedTimer: ReturnType<typeof setTimeout> | null = null

  const uninstallOpen = ref(false)
  const uninstallTarget = ref<{ id: string, label: string } | null>(null)
  const removeLayerOpen = ref(false)
  const removeLayerTarget = ref<{ id: string, label: string, target: string | null } | null>(null)
  const removeLayerNoticeOpen = ref(false)
  const lastRemovedLayerTarget = ref('')
  const lastRemovedLayerLabel = ref('')
  const restoreOpen = ref(false)
  const restoreTarget = ref<{ id: string, label: string } | null>(null)
  const restorePayload = ref<Record<string, unknown> | null>(null)
  const pendingRestore = ref<{ id: string, label: string } | null>(null)
  const restoreFileInput = ref<HTMLInputElement | null>(null)

  const busyId = ref<string | null>(null)
  const busyAction = ref<ModuleBusyAction | null>(null)
  const transferLoading = ref(false)
  const transferTitle = ref('')
  const transferMessage = ref('')

  function openTransferLoading(title: string, message: string) {
    transferTitle.value = title
    transferMessage.value = message
    transferLoading.value = true
  }

  function closeTransferLoading() {
    transferLoading.value = false
    transferTitle.value = ''
    transferMessage.value = ''
  }

  function openRemoveLayerNotice(target: string, label: string) {
    lastRemovedLayerTarget.value = target
    lastRemovedLayerLabel.value = label
    removeLayerNoticeOpen.value = true
  }

  function closeRemoveLayerNotice() {
    removeLayerNoticeOpen.value = false
    clearRemoveLayerNotice()
  }

  async function hydrateWorkspace() {
    const pendingNotice = peekRemoveLayerNotice()
    await Promise.all([refreshInstalled(), refreshLayers(), refreshRuntime()]).catch(() => {})
    if (pendingNotice) {
      openRemoveLayerNotice(pendingNotice.target, pendingNotice.label)
      toast.success(
        `${pendingNotice.label} removido de layers/`,
        'Reinicie a aplicação Kuroneko (PM2) para a layer deixar de carregar.',
      )
    }
  }

  async function requestAppRestart() {
    await runAppRestart({
      onSuccess: async () => {
        await Promise.all([refreshInstalled(), refreshLayers(), refreshRuntime()]).catch(() => {})
      },
    })
  }

  async function onToggle(id: string, value: boolean) {
    busyId.value = id
    busyAction.value = 'toggle'
    try {
      await setEnabled(id, value)
    }
    catch (error: unknown) {
      toast.error('Não foi possível alterar o módulo.', errorMessage(error, 'Tente novamente em alguns instantes.'))
    }
    finally {
      busyId.value = null
      busyAction.value = null
    }
  }

  async function onInstall(id: string) {
    busyId.value = id
    busyAction.value = 'install'
    try {
      const result = await install(id)
      toast.success(
        'Módulo instalado.',
        result?.hint
          || 'Reinicie a aplicação Kuroneko (PM2) para ativar o módulo.',
      )
    }
    catch (error: unknown) {
      toast.error('Falha ao instalar o módulo.', errorMessage(error, 'Verifique a conexão com o banco e tente novamente.'))
    }
    finally {
      busyId.value = null
      busyAction.value = null
    }
  }

  function requestUninstall(id: string, label: string) {
    uninstallTarget.value = { id, label }
    uninstallOpen.value = true
  }

  function cancelUninstall() {
    if (busyId.value) return
    uninstallOpen.value = false
    uninstallTarget.value = null
  }

  async function confirmUninstall() {
    const target = uninstallTarget.value
    if (!target) return

    busyId.value = target.id
    busyAction.value = 'uninstall'
    try {
      const result = await uninstall(target.id)
      uninstallOpen.value = false
      uninstallTarget.value = null
      await Promise.all([refreshInstalled(), refreshLayers()]).catch(() => {})
      toast.success(
        `${target.label} agendado para desinstalação.`,
        result?.hint
          || 'Clique em Reiniciar aplicação para concluir (PM2).',
      )
    }
    catch (error: unknown) {
      const message = errorMessage(error, 'Tente novamente em alguns instantes.')
      // Fantasma do build antigo: já saiu do DB mas ainda aparece na UI.
      if (/já não está instalado|não está instalado/i.test(message)) {
        uninstallOpen.value = false
        uninstallTarget.value = null
        toast.error(
          `${target.label} já foi removido do banco.`,
          'Reinicie a aplicação para atualizar a lista (o build atual ainda pode mostrar o módulo).',
        )
        return
      }
      toast.error('Falha ao desinstalar o módulo.', message)
    }
    finally {
      busyId.value = null
      busyAction.value = null
    }
  }

  function requestRemoveLayer(id: string, label: string, target: string | null) {
    removeLayerTarget.value = { id, label, target }
    removeLayerOpen.value = true
  }

  function cancelRemoveLayer() {
    if (busyId.value) return
    removeLayerOpen.value = false
    removeLayerTarget.value = null
  }

  async function confirmRemoveLayer() {
    const target = removeLayerTarget.value
    if (!target) return

    busyId.value = target.id
    busyAction.value = 'removeLayer'
    persistRemoveLayerNotice({
      target: target.target || 'layers/',
      label: target.label,
    })

    try {
      const result = await removeLayer(target.id)
      removeLayerOpen.value = false
      removeLayerTarget.value = null
      persistRemoveLayerNotice({
        target: result.target,
        label: target.label,
      })
      openRemoveLayerNotice(result.target, target.label)
      toast.success(
        `${target.label} removido de layers/`,
        'Reinicie a aplicação Kuroneko (PM2) para a layer deixar de carregar.',
      )
    }
    catch (error: unknown) {
      const message = errorMessage(error, '')
      const softFail = !message
        || /fetch|network|Failed|ECONNRESET|aborted|terminated|timeout|503|502/i.test(message)
      if (softFail) {
        removeLayerOpen.value = false
        removeLayerTarget.value = null
        openRemoveLayerNotice(target.target || 'layers/', target.label)
        return
      }
      clearRemoveLayerNotice()
      toast.error('Falha ao remover o pacote.', message || 'Tente novamente em alguns instantes.')
    }
    finally {
      busyId.value = null
      busyAction.value = null
    }
  }

  async function onBackup(id: string) {
    busyId.value = id
    busyAction.value = 'backup'
    openTransferLoading(
      'Gerando backup',
      'A plataforma está preparando e gerando o arquivo JSON. Isso pode levar alguns instantes em módulos com muitos dados.',
    )
    try {
      const data = await withMinimumDelay(backup(id))
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const date = typeof data.exportedAt === 'string'
        ? data.exportedAt.slice(0, 10)
        : new Date().toISOString().slice(0, 10)
      link.href = url
      link.download = `kuroneko-${id.replace(/[^\w.-]+/g, '_')}-${date}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Backup baixado com sucesso.', 'O arquivo JSON foi gerado e o download foi iniciado.')
    }
    catch (error: unknown) {
      toast.error('Falha ao gerar o backup.', errorMessage(error, 'Tente novamente em alguns instantes.'))
    }
    finally {
      closeTransferLoading()
      busyId.value = null
      busyAction.value = null
    }
  }

  function requestRestore(id: string, label: string) {
    pendingRestore.value = { id, label }
    restoreFileInput.value?.click()
  }

  async function onRestoreFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    const target = pendingRestore.value
    input.value = ''
    pendingRestore.value = null

    if (!file || !target) return

    try {
      const text = await file.text()
      const payload = JSON.parse(text) as Record<string, unknown>
      if (typeof payload.moduleId === 'string' && payload.moduleId !== target.id) {
        toast.error(
          'Arquivo incompatível.',
          `Este arquivo é do módulo "${payload.moduleId}", não de "${target.id}".`,
        )
        return
      }
      restorePayload.value = payload
      restoreTarget.value = target
      restoreOpen.value = true
    }
    catch {
      toast.error('Arquivo inválido.', 'Não foi possível ler o arquivo JSON selecionado.')
    }
  }

  function cancelRestore() {
    if (busyId.value || transferLoading.value) return
    restoreOpen.value = false
    restoreTarget.value = null
    restorePayload.value = null
  }

  async function confirmRestore() {
    const target = restoreTarget.value
    const payload = restorePayload.value
    if (!target || !payload) return

    busyId.value = target.id
    busyAction.value = 'restore'
    restoreOpen.value = false
    openTransferLoading(
      'Restaurando backup',
      'A plataforma está preparando e aplicando os dados do arquivo. Isso pode levar alguns instantes em backups grandes.',
    )
    try {
      await withMinimumDelay(restore(target.id, payload))
      await refreshSettings()
      restoreTarget.value = null
      restorePayload.value = null
      toast.success(`Dados de ${target.label} restaurados.`, 'Tabelas e configurações foram substituídas pelo conteúdo do backup.')
    }
    catch (error: unknown) {
      toast.error('Falha ao restaurar o backup.', errorMessage(error, 'Tente novamente em alguns instantes.'))
      restoreOpen.value = true
    }
    finally {
      closeTransferLoading()
      busyId.value = null
      busyAction.value = null
    }
  }

  function openSettings(id: string, label: string) {
    settingsModuleId.value = id
    settingsTitle.value = `Configurar · ${label}`
    settingsSaveStatus.value = 'idle'
    settingsOpen.value = true
  }

  function onSettingsStatus(status: 'idle' | 'saving' | 'saved') {
    if (settingsSavedTimer) {
      clearTimeout(settingsSavedTimer)
      settingsSavedTimer = null
    }

    settingsSaveStatus.value = status

    if (status === 'saved') {
      settingsSavedTimer = setTimeout(() => {
        settingsSaveStatus.value = 'idle'
        settingsSavedTimer = null
      }, 2500)
    }
  }

  async function onSettingsReset() {
    await settingsFormRef.value?.reset()
  }

  watch(settingsOpen, (open) => {
    if (!open) {
      settingsModuleId.value = null
      settingsSaveStatus.value = 'idle'
      if (settingsSavedTimer) {
        clearTimeout(settingsSavedTimer)
        settingsSavedTimer = null
      }
    }
  })

  watch(uninstallOpen, (open) => {
    if (!open && !busyId.value) uninstallTarget.value = null
  })

  watch(removeLayerOpen, (open) => {
    if (!open && !busyId.value) removeLayerTarget.value = null
  })

  watch(restoreOpen, (open) => {
    if (!open && !busyId.value) {
      restoreTarget.value = null
      restorePayload.value = null
    }
  })

  return {
    hasSettings,
    busyId,
    busyAction,
    settingsOpen,
    settingsModuleId,
    settingsTitle,
    settingsFormRef,
    settingsSaveStatus,
    uninstallOpen,
    uninstallTarget,
    removeLayerOpen,
    removeLayerTarget,
    removeLayerNoticeOpen,
    lastRemovedLayerTarget,
    lastRemovedLayerLabel,
    restoreOpen,
    restoreTarget,
    restoreFileInput,
    transferLoading,
    transferTitle,
    transferMessage,
    hasPendingRestart,
    pendingModuleIds,
    canRebuildPm2,
    restartLabel,
    restartHint,
    restarting,
    restartPhase,
    restartError,
    dismissRestartOverlay,
    hydrateWorkspace,
    onToggle,
    onInstall,
    requestUninstall,
    cancelUninstall,
    confirmUninstall,
    requestRemoveLayer,
    cancelRemoveLayer,
    confirmRemoveLayer,
    onBackup,
    requestRestore,
    onRestoreFileChange,
    cancelRestore,
    confirmRestore,
    openSettings,
    onSettingsStatus,
    closeRemoveLayerNotice,
    clearRemoveLayerNotice,
    requestAppRestart,
  }
}
