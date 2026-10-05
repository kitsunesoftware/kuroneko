<script setup lang="ts">
import { parseModuleIcon } from '../../shared/module-icon'

const props = withDefaults(defineProps<{
  /** Valor bruto do manifesto / definição (`i-solar:…`, path ou URL). */
  icon?: string | null
  /** URL já resolvida (local via API ou externa) — preferida para imagens. */
  iconUrl?: string | null
  /** Usado para montar `/api/store/modules/:id/icon` se `iconUrl` não vier. */
  moduleId?: string | null
  /** Classes no elemento visual (Icon ou img). */
  iconClass?: string
}>(), {
  icon: null,
  iconUrl: null,
  moduleId: null,
  iconClass: 'text-xl',
})

const parsed = computed(() => parseModuleIcon(props.icon))

const imageSrc = computed(() => {
  if (props.iconUrl) return props.iconUrl
  if (parsed.value.kind !== 'image') return null
  if (parsed.value.source === 'external') return parsed.value.src
  if (props.moduleId) {
    return `/api/store/modules/${encodeURIComponent(props.moduleId)}/icon`
  }
  return null
})

const iconName = computed(() =>
  parsed.value.kind === 'icon' ? parsed.value.name : 'i-solar:box-bold-duotone',
)

const showImage = computed(() => Boolean(imageSrc.value))
</script>

<template>
  <img
    v-if="showImage"
    :src="imageSrc!"
    alt=""
    class="h-auto w-full object-contain"
    :class="iconClass"
  >
  <Icon
    v-else
    :name="iconName"
    mode="svg"
    class="h-auto w-full [&_svg]:h-auto [&_svg]:w-full"
    :class="iconClass"
  />
</template>
