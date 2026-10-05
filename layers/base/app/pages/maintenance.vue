<script setup lang="ts">
import underMaintenanceUrl from '../assets/images/under_maintenance.png'

definePageMeta({
  layout: false,
})

const { settings, logo } = useSiteSettings()
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-6 py-16">
    <div class="w-full max-w-lg space-y-6 text-center">
      <img
        v-if="logo"
        :src="logo"
        :alt="settings.title"
        class="mx-auto h-12 w-auto"
      >

      <img
        :src="underMaintenanceUrl"
        alt="Em manutenção"
        class="mx-auto w-full max-w-sm select-none pointer-events-none"
        draggable="false"
        @contextmenu.prevent
      >

      <div class="space-y-2">
        <p class="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Manutenção
        </p>
        <h1 class="font-display text-3xl font-extrabold text-[var(--color-ink)]">
          {{ settings.title }}
        </h1>
        <p class="text-[var(--color-muted)]">
          O site está temporariamente em manutenção. Voltamos em breve.
        </p>
      </div>

      <NuxtLink
        to="/panel/settings"
        class="inline-flex text-sm text-[var(--color-accent)] underline underline-offset-2"
      >
        Ir para o painel
      </NuxtLink>
    </div>
  </div>
</template>
