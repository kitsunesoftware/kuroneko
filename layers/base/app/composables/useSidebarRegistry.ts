import type { SidebarChildConfig, SidebarChildren } from '../../shared/types/sidebar'

type SidebarChildRegistry = Record<string, SidebarChildren>

export function useSidebarRegistry() {
  const registry = useState<SidebarChildRegistry>(
    'kuroneko-sidebar-children',
    () => ({}),
  )

  function contribute(
    groupId: string,
    childId: string,
    child: SidebarChildConfig,
  ) {
    if (!registry.value[groupId]) {
      registry.value[groupId] = {}
    }

    registry.value[groupId] = {
      ...registry.value[groupId],
      [childId]: child,
    }
  }

  function childrenOf(groupId: string): SidebarChildren {
    return registry.value[groupId] ?? {}
  }

  return {
    registry,
    contribute,
    childrenOf,
  }
}

/** Atalho para submódulos registrarem um item no grupo do sidebar */
export function contributeSidebarChild(
  groupId: string,
  childId: string,
  child: SidebarChildConfig,
) {
  useSidebarRegistry().contribute(groupId, childId, child)
}
