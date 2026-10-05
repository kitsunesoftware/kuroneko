import type { ModuleDefinition } from '../../shared/types/module'
import { SYSTEM_MODULE_IDS } from '../../shared/module-schemas'

type QueuedAction = 'install' | 'uninstall'

type InstallState = {
  moduleId: string
  enabled: boolean
  needsRestart?: boolean
  queuedAction?: QueuedAction | null
  pendingReason?: QueuedAction | null
  pendingUninstall?: boolean
}

type LayerMeta = {
  target: string
  label: string
  description: string
  parentId: string | null
  icon: string
  iconUrl: string | null
}

export function useModules() {
  const catalog = useState<ModuleDefinition[]>('kuroneko-module-catalog', () => [])
  const installedMap = useState<Record<string, InstallState>>(
    'kuroneko-modules-installed',
    () => ({}),
  )
  const pendingModuleIds = useState<string[]>('kuroneko-modules-pending-restart', () => [])
  const pendingById = useState<Record<string, QueuedAction>>(
    'kuroneko-modules-pending-reasons',
    () => ({}),
  )
  const pendingLabels = useState<Record<string, string>>(
    'kuroneko-modules-pending-labels',
    () => ({}),
  )
  const layerIds = useState<Record<string, string>>(
    'kuroneko-modules-layer-targets',
    () => ({}),
  )
  const layerIcons = useState<Record<string, { icon: string, iconUrl: string | null }>>(
    'kuroneko-modules-layer-icons',
    () => ({}),
  )
  const layerMeta = useState<Record<string, LayerMeta>>(
    'kuroneko-modules-layer-meta',
    () => ({}),
  )
  const loaded = useState('kuroneko-modules-installed-loaded', () => false)

  function register(module: ModuleDefinition) {
    const exists = catalog.value.some((item) => item.id === module.id)
    if (exists) {
      catalog.value = catalog.value.map((item) =>
        item.id === module.id ? { ...item, ...module } : item,
      )
      return
    }

    catalog.value = [...catalog.value, module].sort(
      (a, b) => (a.order ?? 100) - (b.order ?? 100),
    )
  }

  /** Entrada provisória até o contributeModule rodar após o reinício. */
  function ensureCatalogEntry(module: ModuleDefinition, opts?: { applyParentId?: boolean }) {
    const existing = catalog.value.find((item) => item.id === module.id)
    if (existing) {
      // Atualiza parentId/label quando o manifesto em layers/ chega depois do registro no banco.
      catalog.value = catalog.value.map((item) => {
        if (item.id !== module.id) return item
        return {
          ...item,
          label: module.label || item.label,
          description: module.description || item.description,
          icon: module.icon || item.icon,
          parentId: opts?.applyParentId ? module.parentId : item.parentId,
          order: module.order ?? item.order,
        }
      })
      return
    }
    register(module)
  }

  function syncCatalogFromInstalled() {
    // Remove stubs fantasma (ex.: "demo" criado pelo prefixo de demo.hello).
    catalog.value = catalog.value.filter((item) => {
      if (isSystem(item.id) || item.installable === false) return true
      if (layerMeta.value[item.id] || pendingById.value[item.id]) return true
      if (installedMap.value[item.id] && !layerMeta.value[item.id]) return false
      return true
    })

    const ids = new Set<string>([
      ...Object.keys(installedMap.value),
      ...Object.keys(pendingById.value),
    ])

    const ordered = [...ids].sort(
      (a, b) => a.split('.').length - b.split('.').length || a.localeCompare(b),
    )

    for (const moduleId of ordered) {
      if (isSystem(moduleId)) continue

      const installed = Boolean(installedMap.value[moduleId])
      const queued = Boolean(pendingById.value[moduleId])
      if (!installed && !queued) continue

      const meta = layerMeta.value[moduleId]
      // Stub fantasma no banco sem layer/fila → não listar.
      if (!meta && !queued) continue

      const parentId = meta?.parentId || undefined

      if (
        parentId
        && !isSystem(parentId)
        && !catalog.value.some((item) => item.id === parentId)
        && layerMeta.value[parentId]
      ) {
        const parentMeta = layerMeta.value[parentId]!
        ensureCatalogEntry({
          id: parentId,
          label: parentMeta.label || pendingLabels.value[parentId] || parentId,
          description: parentMeta.description || '',
          icon: parentMeta.icon || 'i-solar:box-bold-duotone',
          installable: true,
          defaultEnabled: false,
          order: 90,
        }, { applyParentId: true })
      }

      ensureCatalogEntry({
        id: moduleId,
        label: meta?.label || pendingLabels.value[moduleId] || moduleId,
        description: meta?.description || '',
        icon: meta?.icon || 'i-solar:box-bold-duotone',
        parentId,
        installable: true,
        defaultEnabled: false,
        order: 100,
      }, { applyParentId: Boolean(meta) })
    }
  }

  async function refreshInstalled() {
    try {
      const data = await $fetch<{
        installed: InstallState[]
        pendingModuleIds?: string[]
        queue?: Array<{ moduleId: string, action: QueuedAction, label?: string | null }>
      }>('/api/modules/installed')
      const next: Record<string, InstallState> = {}
      for (const row of data.installed) {
        next[row.moduleId] = row
      }
      // Sistema sempre presente
      for (const id of SYSTEM_MODULE_IDS) {
        next[id] = next[id] ?? { moduleId: id, enabled: true }
      }
      installedMap.value = next
      pendingModuleIds.value = data.pendingModuleIds ?? []
      const reasons: Record<string, QueuedAction> = {}
      const labels: Record<string, string> = {}
      for (const item of data.queue || []) {
        if (item?.moduleId && (item.action === 'install' || item.action === 'uninstall')) {
          reasons[item.moduleId] = item.action
          if (item.label) labels[item.moduleId] = item.label
        }
      }
      for (const row of data.installed) {
        const action = row.queuedAction || row.pendingReason
        if (action === 'install' || action === 'uninstall') {
          reasons[row.moduleId] = action
        }
      }
      pendingById.value = reasons
      pendingLabels.value = labels
      syncCatalogFromInstalled()
    }
    catch {
      for (const id of SYSTEM_MODULE_IDS) {
        installedMap.value = {
          ...installedMap.value,
          [id]: { moduleId: id, enabled: true },
        }
      }
    }
    finally {
      loaded.value = true
    }
  }

  async function refreshLayers() {
    try {
      const data = await $fetch<{
        modules: Array<{
          id: string
          target: string
          name?: string
          description?: string
          parentId?: string | null
          icon?: string
          iconUrl?: string | null
        }>
      }>('/api/modules/layers')
      const nextTargets: Record<string, string> = {}
      const nextIcons: Record<string, { icon: string, iconUrl: string | null }> = {}
      const nextMeta: Record<string, LayerMeta> = {}
      for (const row of data.modules) {
        nextTargets[row.id] = row.target
        const icon = row.icon || 'i-solar:box-bold-duotone'
        const iconUrl = row.iconUrl ?? null
        nextIcons[row.id] = { icon, iconUrl }
        nextMeta[row.id] = {
          target: row.target,
          label: row.name || row.id,
          description: row.description || '',
          parentId: row.parentId ?? null,
          icon,
          iconUrl,
        }
      }
      layerIds.value = nextTargets
      layerIcons.value = nextIcons
      layerMeta.value = nextMeta
      syncCatalogFromInstalled()
    }
    catch {
      layerIds.value = {}
      layerIcons.value = {}
      layerMeta.value = {}
    }
  }

  if (import.meta.client && !loaded.value) {
    void Promise.all([refreshInstalled(), refreshLayers()])
  }

  function isSystem(id: string) {
    return (SYSTEM_MODULE_IDS as readonly string[]).includes(id)
  }

  function isInstallable(id: string) {
    const mod = catalog.value.find((item) => item.id === id)
    if (!mod) return true
    if (mod.installable === false) return false
    return true
  }

  function isInstalled(id: string): boolean {
    if (isSystem(id) || !isInstallable(id)) return true
    return Boolean(installedMap.value[id])
  }

  function isEnabled(id: string): boolean {
    const mod = catalog.value.find((item) => item.id === id)
    if (!mod) return true
    if (mod.canDisable === false) return true

    if (mod.parentId && !isEnabled(mod.parentId)) {
      return false
    }

    if (!isInstalled(id)) return false

    const state = installedMap.value[id]
    if (state) return state.enabled

    return mod.defaultEnabled === true
  }

  function isLayerPresent(id: string) {
    return Boolean(layerIds.value[id])
  }

  function needsRestart(id: string) {
    if (pendingModuleIds.value.includes(id)) return true
    return Boolean(installedMap.value[id]?.needsRestart)
  }

  function pendingReason(id: string): QueuedAction | null {
    return pendingById.value[id]
      || installedMap.value[id]?.queuedAction
      || installedMap.value[id]?.pendingReason
      || null
  }

  function isPendingUninstall(id: string) {
    return pendingReason(id) === 'uninstall'
      || Boolean(installedMap.value[id]?.pendingUninstall)
  }

  const hasPendingRestart = computed(() => pendingModuleIds.value.length > 0)

  /** Pacote da loja em layers/, ainda não instalado → pode apagar a pasta. */
  function canRemoveLayer(id: string) {
    if (isSystem(id) || !isInstallable(id)) return false
    return isLayerPresent(id) && !isInstalled(id)
  }

  async function removeLayer(id: string) {
    const result = await $fetch<{
      target: string
      needsRebuild?: boolean
      needsRestart?: boolean
    }>(`/api/store/modules/${encodeURIComponent(id)}/remove`, {
      method: 'POST',
    })
    await refreshInstalled()
    await refreshLayers()
    return result
  }

  async function install(id: string) {
    const { getDefaults, hasSettings, refreshSettings } = useModuleSettings()
    const defaults = hasSettings(id) ? getDefaults(id) : undefined

    const result = await $fetch<{
      ok: boolean
      enabled?: boolean
      needsRestart?: boolean
      hint?: string | null
    }>(`/api/modules/${encodeURIComponent(id)}/install`, {
      method: 'POST',
      body: defaults && Object.keys(defaults).length ? { defaults } : undefined,
    })
    await Promise.all([refreshInstalled(), refreshLayers()])
    if (defaults) await refreshSettings()
    return result
  }

  async function uninstall(id: string) {
    const { refreshSettings } = useModuleSettings()
    const result = await $fetch<{
      ok: boolean
      needsRestart?: boolean
      pendingUninstall?: boolean
      hint?: string | null
    }>(`/api/modules/${encodeURIComponent(id)}/uninstall`, { method: 'POST' })
    await refreshInstalled()
    await refreshSettings()
    return result
  }

  async function backup(id: string) {
    const data = await $fetch<Record<string, unknown>>(
      `/api/modules/${encodeURIComponent(id)}/backup`,
    )
    return data
  }

  async function restore(id: string, payload: Record<string, unknown>) {
    const { refreshSettings } = useModuleSettings()
    await $fetch(`/api/modules/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: payload,
    })
    await refreshSettings()
  }

  async function setEnabled(id: string, enabled: boolean) {
    const mod = catalog.value.find((item) => item.id === id)
    if (!mod || mod.canDisable === false) return
    if (!isInstalled(id)) return

    await $fetch(`/api/modules/${encodeURIComponent(id)}/enabled`, {
      method: 'PATCH',
      body: { enabled },
    })
    await refreshInstalled()
  }

  function toggle(id: string) {
    return setEnabled(id, !isEnabled(id))
  }

  function mapNode(item: ModuleDefinition) {
    const layerIcon = layerIcons.value[item.id]
    const meta = layerMeta.value[item.id]
    const pending = needsRestart(item.id)
    const reason = pendingReason(item.id)
    const pendingUninstall = reason === 'uninstall'
    const pendingInstall = reason === 'install'
    return {
      ...item,
      label: meta?.label || item.label,
      description: meta?.description || item.description,
      // Preferir ícone do kuroneko.module.json (loja) ao do contributeModule
      icon: layerIcon?.icon || item.icon,
      iconUrl: layerIcon?.iconUrl ?? null,
      installed: isInstalled(item.id),
      enabled: isEnabled(item.id),
      needsRestart: pending,
      pendingReason: reason,
      pendingUninstall,
      pendingInstall,
      installable: isInstallable(item.id),
      canDisable: item.canDisable !== false && !pending,
      canRemoveLayer: canRemoveLayer(item.id),
      layerTarget: layerIds.value[item.id] || null,
    }
  }

  type ModuleTreeNode = ReturnType<typeof mapNode> & {
    children: ModuleTreeNode[]
  }

  function buildTree(parentId?: string): ModuleTreeNode[] {
    return catalog.value
      .filter((item) => (parentId ? item.parentId === parentId : !item.parentId))
      .map((item) => ({
        ...mapNode(item),
        children: buildTree(item.id),
      }))
  }

  const modules = computed(() => buildTree())

  const flat = computed(() => catalog.value.map((item) => mapNode(item)))

  function isRouteAllowed(path: string): boolean {
    const match = catalog.value.find((mod) =>
      (mod.routes ?? []).some(
        (route) => path === route || path.startsWith(`${route}/`),
      ),
    )

    if (!match) return true
    return isEnabled(match.id)
  }

  return {
    catalog,
    modules,
    flat,
    loaded,
    pendingModuleIds,
    pendingById,
    hasPendingRestart,
    pendingReason,
    isPendingUninstall,
    register,
    refreshInstalled,
    refreshLayers,
    isSystem,
    isInstalled,
    isEnabled,
    isInstallable,
    isLayerPresent,
    needsRestart,
    canRemoveLayer,
    install,
    uninstall,
    removeLayer,
    backup,
    restore,
    setEnabled,
    toggle,
    isRouteAllowed,
  }
}

export function contributeModule(module: ModuleDefinition) {
  useModules().register(module)
}
