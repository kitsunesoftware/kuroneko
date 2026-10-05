export type StoreModuleCard = {
  id: string
  name: string
  description: string
  version: string
  source: string
  ref: string
  parentId: string | null
  icon: string
  iconUrl?: string | null
  dependsOn: string[]
  downloaded: boolean
  installed: boolean
  target: string
  author?: string
  license?: string
  minKuroneko?: string | null
  platformCompatible: boolean
  platformEntry?: boolean
  localVersion?: string | null
  updateAvailable?: boolean
}

export type StoreRuntime = {
  mode: 'dev' | 'prod'
  pm2: boolean
  available: boolean
  appName: string
  label: string
  hint: string
}

export type StoreSource = {
  configured: boolean
  repo: string
  ref: string
  moduleCount: number
}

export type InstallJobState = {
  jobId: string
  moduleId: string
  phase: string
  progress: number
  message: string
  error?: string | null
  target?: string | null
  version?: string | null
}

export function useStoreLoja() {
  const toast = useToast()
  const {
    catalog,
    isInstalled,
    isSystem,
    refreshInstalled,
    refreshLayers,
    hasPendingRestart,
  } = useModules()
  const {
    restarting,
    setRuntime,
  } = useAppRestart()

  const modules = ref<StoreModuleCard[]>([])
  const loading = ref(true)
  const syncing = ref(false)
  const busyId = ref<string | null>(null)
  const loadError = ref('')
  const runtime = ref<StoreRuntime | null>(null)
  const storeSource = ref<StoreSource | null>(null)

  const installModalOpen = ref(false)
  const installTarget = ref<StoreModuleCard | null>(null)
  const installJob = ref<InstallJobState | null>(null)
  const installPolling = ref(false)

  const queueCount = ref(0)

  const storeConfigured = computed(() => Boolean(storeSource.value?.configured))
  const storeRepoLabel = computed(() => {
    if (!storeSource.value?.configured) return ''
    return `${storeSource.value.repo}@${storeSource.value.ref}`
  })

  const storeTree = computed(() => {
    const map = new Map<string, StoreModuleCard>()
    for (const mod of modules.value) {
      map.set(mod.id, { ...mod })
    }
    for (const mod of catalog.value) {
      if (map.has(mod.id)) continue
      if (!isSystem(mod.id) && !isInstalled(mod.id)) continue
      map.set(mod.id, {
        id: mod.id,
        name: mod.label,
        description: mod.description || '',
        version: '',
        source: 'sistema',
        ref: '',
        parentId: mod.parentId || null,
        icon: mod.icon || '',
        dependsOn: [],
        downloaded: true,
        installed: true,
        target: '',
        platformCompatible: true,
        platformEntry: true,
      })
    }
    return [...map.values()]
  })

  const rootModules = computed(() =>
    storeTree.value.filter((mod) => !mod.parentId).sort((a, b) => a.name.localeCompare(b.name)),
  )

  function childrenOf(parentId: string) {
    return storeTree.value
      .filter((mod) => mod.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  function findModule(id: string) {
    return storeTree.value.find((mod) => mod.id === id) || null
  }

  function canInstall(mod: StoreModuleCard) {
    if (mod.platformEntry) return false
    if (!mod.platformCompatible) return false
    // Já instalado e sem versão nova: esconde o botão.
    if (mod.installed && !mod.updateAvailable) return false
    return true
  }

  function installActionLabel(mod: StoreModuleCard) {
    if (mod.updateAvailable) return 'Atualizar'
    return 'Instalar'
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
    if (error instanceof Error && error.message) return error.message
    return fallback
  }

  function sleep(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  async function refreshQueue() {
    try {
      const data = await $fetch<{ count: number }>('/api/modules/queue')
      queueCount.value = data.count
    }
    catch {
      queueCount.value = 0
    }
  }

  async function refresh() {
    loading.value = true
    loadError.value = ''
    try {
      const [list, rt, src] = await Promise.all([
        $fetch<{ modules: StoreModuleCard[] }>('/api/store/modules'),
        $fetch<StoreRuntime>('/api/store/runtime'),
        $fetch<StoreSource>('/api/store/source').catch(() => null),
      ])
      modules.value = list.modules || []
      runtime.value = rt
      setRuntime(rt)
      storeSource.value = src
      await Promise.all([refreshQueue(), refreshInstalled(), refreshLayers()]).catch(() => {})
    }
    catch (error: unknown) {
      loadError.value = error instanceof Error ? error.message : 'Falha ao carregar a loja.'
    }
    finally {
      loading.value = false
    }
  }

  function openInstall(mod: StoreModuleCard) {
    if (mod.platformEntry) {
      toast.error('Indisponível', 'Este módulo já faz parte da plataforma.')
      return
    }
    if (!mod.platformCompatible) {
      toast.error(
        'Incompatível',
        mod.minKuroneko
          ? `Este módulo exige Kuroneko ${mod.minKuroneko} ou superior.`
          : 'Este módulo não é compatível com esta versão do Kuroneko.',
      )
      return
    }
    installTarget.value = mod
    installJob.value = null
    installModalOpen.value = true
  }

  function closeInstallModal() {
    if (installPolling.value) return
    installModalOpen.value = false
    installTarget.value = null
    installJob.value = null
  }

  async function fetchJob(jobId: string) {
    return $fetch<InstallJobState>(`/api/store/jobs/${encodeURIComponent(jobId)}`)
  }

  async function pollJob(jobId: string) {
    installPolling.value = true
    try {
      for (let i = 0; i < 180; i++) {
        try {
          const job = await fetchJob(jobId)
          installJob.value = job
          if (job.phase === 'done' || job.phase === 'error') {
            // refresh não pode mascarar sucesso do download/fila
            await refresh().catch(() => {})
            return job
          }
        }
        catch (error: unknown) {
          // Job acabou de ser criado — 404 transitório é ok nos primeiros polls.
          const status = error && typeof error === 'object' && 'statusCode' in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0
          const statusAlt = error && typeof error === 'object' && 'status' in error
            ? Number((error as { status?: number }).status)
            : 0
          if ((status === 404 || statusAlt === 404) && i < 10) {
            await sleep(300)
            continue
          }
          throw error
        }
        await sleep(400)
      }
      installJob.value = {
        jobId,
        moduleId: installTarget.value?.id || '',
        phase: 'error',
        progress: 100,
        message: 'Tempo esgotado aguardando a instalação.',
        error: 'timeout',
      }
      return installJob.value
    }
    finally {
      installPolling.value = false
    }
  }

  async function confirmInstall() {
    const mod = installTarget.value
    if (!mod) return

    busyId.value = mod.id
    installJob.value = {
      jobId: '',
      moduleId: mod.id,
      phase: 'queued-download',
      progress: 2,
      message: 'Iniciando…',
    }

    try {
      const started = await $fetch<{ jobId: string }>(
        `/api/store/modules/${encodeURIComponent(mod.id)}/queue-install`,
        { method: 'POST' },
      )
      if (!started?.jobId) {
        throw new Error('Servidor não retornou o job de instalação.')
      }
      installJob.value = {
        ...installJob.value!,
        jobId: started.jobId,
        message: 'Instalação em andamento…',
      }
      const job = await pollJob(started.jobId)
      if (job?.phase === 'error') {
        toast.error('Falha na instalação', job.error || job.message)
      }
    }
    catch (error: unknown) {
      // Se a fila já tem o módulo, o download pode ter concluído apesar do erro de UI.
      await refreshQueue().catch(() => {})
      const alreadyQueued = queueCount.value > 0
        && (await $fetch<{ items?: Array<{ moduleId: string, action: string }> }>('/api/modules/queue')
          .then((data) => (data.items || []).some((item) => item.moduleId === mod.id && item.action === 'install'))
          .catch(() => false))

      if (alreadyQueued) {
        installJob.value = {
          jobId: installJob.value?.jobId || '',
          moduleId: mod.id,
          phase: 'done',
          progress: 100,
          message: 'Instalação na fila. Reinicie a aplicação!',
          error: null,
        }
        await refresh().catch(() => {})
        return
      }

      const message = extractApiMessage(error, 'Não foi possível instalar o módulo.')
      installJob.value = {
        jobId: installJob.value?.jobId || '',
        moduleId: mod.id,
        phase: 'error',
        progress: 100,
        message,
        error: message,
      }
      toast.error('Falha na instalação', message)
    }
    finally {
      busyId.value = null
    }
  }

  async function syncStore() {
    if (!storeConfigured.value) {
      toast.error('Loja indisponível', 'Não foi possível ler a origem do monorepo.')
      return
    }
    syncing.value = true
    try {
      const result = await $fetch<{
        synced: number
        removed: number
        repo: string
        ref: string
        errors?: unknown[]
      }>('/api/store/sync', { method: 'POST' })
      await refresh()
      toast.success(
        'Catálogo sincronizado',
        `${result.synced} módulo(s) de ${result.repo}@${result.ref}`
          + (result.removed ? ` · ${result.removed} removido(s)` : ''),
      )
    }
    catch (error: unknown) {
      toast.error('Falha na sincronização', extractApiMessage(error, 'Não foi possível ler o monorepo.'))
    }
    finally {
      syncing.value = false
    }
  }

  onMounted(() => {
    void refresh()
  })

  return {
    modules,
    loading,
    syncing,
    busyId,
    loadError,
    runtime,
    storeSource,
    installModalOpen,
    installTarget,
    installJob,
    installPolling,
    restarting,
    storeConfigured,
    storeRepoLabel,
    hasPendingRestart,
    rootModules,
    childrenOf,
    findModule,
    canInstall,
    installActionLabel,
    openInstall,
    closeInstallModal,
    confirmInstall,
    syncStore,
    refresh,
  }
}
