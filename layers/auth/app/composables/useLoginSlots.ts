import type { Component } from 'vue'

export type LoginSlotDefinition = {
  id: string
  moduleId: string
  order?: number
  component: Component
}

type LoginSlotMeta = {
  id: string
  moduleId: string
  order: number
}

/** Componentes ficam fora do useState — o payload SSR do Nuxt não serializa funções. */
const componentMap = new Map<string, Component>()

export function useLoginSlots() {
  const registry = useState<LoginSlotMeta[]>(
    'kuroneko-login-slots',
    () => [],
  )

  const { isEnabled } = useModules()

  function contribute(slot: LoginSlotDefinition) {
    componentMap.set(slot.id, markRaw(slot.component))

    const meta: LoginSlotMeta = {
      id: slot.id,
      moduleId: slot.moduleId,
      order: slot.order ?? 100,
    }

    const exists = registry.value.some((item) => item.id === slot.id)

    if (exists) {
      registry.value = registry.value.map((item) =>
        item.id === slot.id ? meta : item,
      )
    }
    else {
      registry.value = [...registry.value, meta]
    }

    registry.value = [...registry.value].sort((a, b) => a.order - b.order)
  }

  const slots = computed(() =>
    registry.value
      .filter((slot) => isEnabled(slot.moduleId))
      .map((slot) => ({
        ...slot,
        component: componentMap.get(slot.id),
      }))
      .filter((slot) => Boolean(slot.component)),
  )

  return {
    registry,
    slots,
    contribute,
  }
}

export function contributeLoginSlot(slot: LoginSlotDefinition) {
  useLoginSlots().contribute(slot)
}
