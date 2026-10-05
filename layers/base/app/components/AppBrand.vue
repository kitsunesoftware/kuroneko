<script setup lang="ts">
import defaultLogoUrl from '../assets/images/logo.png'

const props = withDefaults(defineProps<{
  collapsed?: boolean
  variant?: 'dark' | 'light'
}>(), {
  collapsed: false,
  variant: 'dark',
})

const { settings, logo, loadLogo } = useSiteSettings()

onMounted(() => {
  loadLogo()
})

const logoSrc = computed(() => logo.value || defaultLogoUrl)
const isLight = computed(() => props.variant === 'light')
</script>

<template>
  <NuxtLink
    to="/"
    class="flex min-w-0 items-center gap-3"
    :class="collapsed ? 'justify-center' : 'flex-row'"
  >
    <img
      :src="logoSrc"
      :alt="settings.title"
      class="w-11 shrink-0"
    >
    <div
      v-show="!collapsed"
      class="flex min-w-0 flex-col overflow-hidden"
    >
      <span
        class="truncate text-xl font-black tracking-tight"
        :class="isLight ? 'text-[var(--color-ink)]' : 'text-white'"
      >
        {{ settings.title }}
      </span>
      <span
        class="truncate text-xs"
        :class="isLight ? 'text-[var(--color-muted)]' : 'text-white/50'"
      >
        {{ settings.tagline }}
      </span>
    </div>
  </NuxtLink>
</template>
