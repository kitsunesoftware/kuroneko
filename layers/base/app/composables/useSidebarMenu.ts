import type {
  SidebarChildConfig,
  SidebarChildren,
  SidebarEntries,
  SidebarEntryConfig,
  SidebarGroupConfig,
  SidebarItemConfig,
} from '../../shared/types/sidebar'

function isItem(entry: SidebarEntryConfig): entry is SidebarItemConfig {
  return (
    entry.type === 'item'
    && typeof (entry as SidebarItemConfig).to === 'string'
  )
}

function isGroup(entry: SidebarEntryConfig): entry is SidebarGroupConfig {
  return entry.type === 'group'
}

function matchesAudience(
  when: SidebarChildConfig['when'],
  isAuthenticated: boolean,
) {
  const audience = when ?? 'always'
  if (audience === 'auth') return isAuthenticated
  if (audience === 'guest') return !isAuthenticated
  return true
}

function normalizeChildren(
  children: SidebarChildren | SidebarChildConfig[] | undefined,
): Array<SidebarChildConfig & { id: string }> {
  if (!children) return []

  if (Array.isArray(children)) {
    return children.map((child, index) => ({
      id: String(index),
      ...child,
    }))
  }

  return Object.entries(children)
    .filter(([, child]) => Boolean(child))
    .map(([id, child]) => ({
      id,
      ...child,
    }))
}

export function useSidebarMenu() {
  const appConfig = useAppConfig()
  const runtimeConfig = useRuntimeConfig()
  const { registry } = useSidebarRegistry()
  const { isEnabled } = useModules()
  const { can } = usePermissions()

  const cookieName = (
    runtimeConfig.public as { auth?: { cookieName?: string } }
  ).auth?.cookieName

  const token = cookieName
    ? useCookie<string | null>(cookieName)
    : ref<string | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value))

  function allowedByPermission(permission?: string) {
    if (!permission) return true
    return can(permission)
  }

  const entries = computed(() => {
    const raw = (appConfig.sidebar?.entries ?? {}) as SidebarEntries

    return Object.entries(raw)
      .filter(([, entry]) => entry && entry.enabled !== false)
      .map(([id, entry]) => ({ id, entry }))
      .filter(({ entry }) => isItem(entry) || isGroup(entry))
      .map(({ id, entry }) => {
        const entryModuleId = entry.moduleId ?? id

        if (isItem(entry)) {
          const moduleOk = isEnabled(entryModuleId)
          return {
            id,
            type: 'item' as const,
            label: entry.label,
            icon: entry.icon,
            to: entry.to,
            order: entry.order ?? 100,
            visible:
              moduleOk
              && matchesAudience(entry.when, isAuthenticated.value)
              && allowedByPermission(entry.permission),
          }
        }

        if (!isEnabled(entryModuleId)) {
          return {
            id,
            type: 'group' as const,
            label: entry.label!,
            icon: entry.icon!,
            order: entry.order ?? 100,
            defaultOpen: entry.defaultOpen ?? false,
            children: [],
            visible: false,
          }
        }

        const fromConfig = normalizeChildren(entry.children)
        const fromRegistry = normalizeChildren(registry.value[id])

        const mergedById = new Map<string, SidebarChildConfig & { id: string }>()
        for (const child of fromRegistry) mergedById.set(child.id, child)
        for (const child of fromConfig) {
          const current = mergedById.get(child.id)
          mergedById.set(child.id, current ? { ...current, ...child } : child)
        }

        const children = [...mergedById.values()]
          .filter((child) => child.enabled !== false)
          .filter((child) => {
            const childModuleId = child.moduleId ?? `${entryModuleId}.${child.id}`
            return isEnabled(childModuleId)
          })
          .filter((child) =>
            matchesAudience(child.when, isAuthenticated.value),
          )
          .filter((child) => allowedByPermission(child.permission))
          .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))

        return {
          id,
          type: 'group' as const,
          label: entry.label!,
          icon: entry.icon!,
          order: entry.order ?? 100,
          defaultOpen: entry.defaultOpen ?? false,
          children,
          visible: children.length > 0,
        }
      })
      .filter((entry) => entry.visible)
      .sort((a, b) => a.order - b.order)
  })

  return {
    entries,
    isAuthenticated,
  }
}
