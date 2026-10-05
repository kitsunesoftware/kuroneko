<script setup lang="ts">
const { displayCollapsed } = useSidebar()
const { isAuthenticated, logout, user } = useAuth()

async function onLogout() {
  await logout()
}
</script>

<template>
  <div
    v-if="isAuthenticated"
    :class="displayCollapsed ? 'flex flex-col items-center px-2' : 'px-1'"
  >
    <p
      v-if="!displayCollapsed && user?.email"
      class="mb-2 truncate px-3 text-xs text-white/40"
      :title="user.email"
    >
      {{ user.email }}
    </p>
    <button
      type="button"
      class="flex w-full items-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
      :class="displayCollapsed ? 'h-11 justify-center' : 'gap-3 px-3 py-2.5'"
      :title="displayCollapsed ? 'Desconectar' : undefined"
      @click="onLogout"
    >
      <Icon
        name="i-solar:logout-2-bold-duotone"
        class="shrink-0 text-xl"
      />
      <span
        v-show="!displayCollapsed"
        class="truncate text-sm font-medium"
      >
        Desconectar
      </span>
    </button>
  </div>
</template>
