<script setup lang="ts">
const { user, logout, isAuthenticated } = useAuth()
</script>

<template>
  <div class="flex items-center gap-3">
    <template v-if="isAuthenticated">
      <span class="hidden text-[var(--color-muted)] sm:inline">
        {{ user?.email }}
      </span>
      <UiButton variant="ghost" @click="logout()">
        Sair
      </UiButton>
    </template>
    <NuxtLink
      v-else
      to="/login"
      class="text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
    >
      Login
    </NuxtLink>
  </div>
</template>
