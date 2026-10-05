import type { Component } from 'vue'

export type AccountSectionDefinition = {
  id: string
  moduleId: string
  order?: number
  component: Component
}

type AccountSectionMeta = {
  id: string
  moduleId: string
  order: number
}

/** Componentes ficam fora do useState — o payload SSR do Nuxt não serializa funções. */
const componentMap = new Map<string, Component>()

export function useAccountSections() {
  const registry = useState<AccountSectionMeta[]>(
    'kuroneko-account-sections',
    () => [],
  )

  const { isEnabled } = useModules()

  function contribute(section: AccountSectionDefinition) {
    componentMap.set(section.id, markRaw(section.component))

    const meta: AccountSectionMeta = {
      id: section.id,
      moduleId: section.moduleId,
      order: section.order ?? 100,
    }

    const exists = registry.value.some((item) => item.id === section.id)

    if (exists) {
      registry.value = registry.value.map((item) =>
        item.id === section.id ? meta : item,
      )
    }
    else {
      registry.value = [...registry.value, meta]
    }

    registry.value = [...registry.value].sort((a, b) => a.order - b.order)
  }

  const sections = computed(() =>
    registry.value
      .filter((section) => isEnabled(section.moduleId))
      .map((section) => ({
        ...section,
        component: componentMap.get(section.id),
      }))
      .filter((section) => Boolean(section.component)),
  )

  return {
    registry,
    sections,
    contribute,
  }
}

export function contributeAccountSection(section: AccountSectionDefinition) {
  useAccountSections().contribute(section)
}
