<script setup lang="ts">
export type ModuleBusyAction =
  | 'install'
  | 'uninstall'
  | 'removeLayer'
  | 'backup'
  | 'restore'
  | 'toggle'

const props = defineProps<{
  installed: boolean
  enabled: boolean
  installable?: boolean
  canDisable?: boolean
  canInstall?: boolean
  canRemoveLayer?: boolean
  needsRestart?: boolean
  busy: boolean
  busyAction?: ModuleBusyAction | null
  hasSettings: boolean
}>()

const emit = defineEmits<{
  install: []
  uninstall: []
  removeLayer: []
  backup: []
  restore: []
  settings: []
  toggle: [value: boolean]
}>()

const showInstallControls = computed(() => props.installable !== false)
const toggleLocked = computed(() => props.canDisable === false || props.needsRestart === true)
const toggleTitle = computed(() => {
  if (props.needsRestart) {
    return 'Reinicie a aplicação Kuroneko (PM2) para ativar este módulo'
  }
  if (props.canDisable === false) {
    return 'Este módulo do sistema não pode ser desativado'
  }
  return undefined
})

function isActionBusy(action: ModuleBusyAction) {
  return props.busy && props.busyAction === action
}
</script>

<template>
  <div class="flex w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3">
    <template v-if="installed">
      <button
        type="button"
        class="inline-flex items-center justify-center text-[var(--color-muted)] transition hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Fazer backup"
        title="Fazer backup (JSON)"
        :disabled="busy"
        @click="emit('backup')"
      >
        <Icon
          :name="isActionBusy('backup') ? 'i-solar:refresh-bold-duotone' : 'i-solar:archive-down-bold-duotone'"
          class="text-2xl"
          :class="{ 'animate-spin': isActionBusy('backup') }"
        />
      </button>

      <button
        type="button"
        class="inline-flex items-center justify-center text-[var(--color-muted)] transition hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Restaurar backup"
        title="Restaurar backup (JSON)"
        :disabled="busy"
        @click="emit('restore')"
      >
        <Icon
          :name="isActionBusy('restore') ? 'i-solar:refresh-bold-duotone' : 'i-solar:archive-up-bold-duotone'"
          class="text-2xl"
          :class="{ 'animate-spin': isActionBusy('restore') }"
        />
      </button>

      <button
        v-if="hasSettings"
        type="button"
        class="inline-flex items-center justify-center text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
        aria-label="Configurar"
        title="Configurar"
        @click="emit('settings')"
      >
        <Icon
          name="i-solar:settings-bold-duotone"
          class="text-2xl"
        />
      </button>
    </template>

    <template v-if="showInstallControls">
      <button
        v-if="!installed"
        type="button"
        class="inline-flex items-center justify-center text-[var(--color-muted)] transition hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Instalar"
        title="Instalar"
        :disabled="!canInstall || busy"
        @click="emit('install')"
      >
        <Icon
          :name="isActionBusy('install') ? 'i-solar:refresh-bold-duotone' : 'i-solar:download-minimalistic-bold-duotone'"
          class="text-2xl"
          :class="{ 'animate-spin': isActionBusy('install') }"
        />
      </button>

      <button
        v-if="!installed && canRemoveLayer"
        type="button"
        class="inline-flex items-center justify-center text-[var(--color-muted)] transition hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Remover módulo"
        title="Remover módulo (apaga de layers/)"
        :disabled="busy"
        @click="emit('removeLayer')"
      >
        <Icon
          :name="isActionBusy('removeLayer') ? 'i-solar:refresh-bold-duotone' : 'i-solar:trash-bin-trash-bold-duotone'"
          class="text-2xl"
          :class="{ 'animate-spin': isActionBusy('removeLayer') }"
        />
      </button>

      <template v-if="installed">
        <button
          type="button"
          class="inline-flex items-center justify-center text-[var(--color-muted)] transition hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Desinstalar"
          title="Desinstalar"
          :disabled="busy"
          @click="emit('uninstall')"
        >
          <Icon
            :name="isActionBusy('uninstall') ? 'i-solar:refresh-bold-duotone' : 'i-solar:trash-bin-trash-bold-duotone'"
            class="text-2xl"
            :class="{ 'animate-spin': isActionBusy('uninstall') }"
          />
        </button>
        <UiToggle
          :model-value="enabled"
          :disabled="toggleLocked || !canInstall || busy"
          :title="toggleTitle"
          @update:model-value="emit('toggle', $event)"
        />
      </template>
    </template>
    <UiToggle
      v-else
      :model-value="enabled"
      :disabled="toggleLocked || !canInstall || busy"
      :title="toggleTitle"
      @update:model-value="emit('toggle', $event)"
    />
  </div>
</template>
