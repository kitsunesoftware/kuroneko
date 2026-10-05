<script setup lang="ts">
import type { InstallJobState, StoreModuleCard } from '../composables/useStoreLoja'

const props = defineProps<{
  installModalOpen: boolean
  installTarget: StoreModuleCard | null
  installJob: InstallJobState | null
  installPolling: boolean
}>()

const emit = defineEmits<{
  'update:installModalOpen': [value: boolean]
  closeInstall: []
  confirmInstall: []
}>()

const isUpdate = computed(() => Boolean(props.installTarget?.updateAvailable))
const jobDone = computed(() => props.installJob?.phase === 'done')
const jobError = computed(() => props.installJob?.phase === 'error')
const jobRunning = computed(() => Boolean(props.installJob) && !jobDone.value && !jobError.value)

const modalTitle = computed(() => {
  if (jobDone.value) return isUpdate.value ? 'Atualização na fila' : 'Instalação na fila'
  if (jobError.value) return isUpdate.value ? 'Falha na atualização' : 'Falha na instalação'
  if (jobRunning.value) return isUpdate.value ? 'Atualizando…' : 'Instalando…'
  return isUpdate.value ? 'Atualizar módulo' : 'Instalar módulo'
})

const statusIcon = computed(() => {
  if (jobDone.value) return 'i-solar:check-circle-bold-duotone'
  if (jobError.value) return 'i-solar:danger-triangle-bold-duotone'
  if (jobRunning.value) return 'i-solar:refresh-circle-bold-duotone'
  return isUpdate.value
    ? 'i-solar:refresh-circle-bold-duotone'
    : 'i-solar:download-minimalistic-bold-duotone'
})

function onOpenChange(open: boolean) {
  if (!open && props.installPolling) return
  emit('update:installModalOpen', open)
  if (!open) emit('closeInstall')
}
</script>

<template>
  <UiModal
    :model-value="installModalOpen"
    :title="modalTitle"
    @update:model-value="onOpenChange"
  >
    <div
      v-if="installTarget"
      class="space-y-5"
    >
      <div class="flex items-start gap-3">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center text-[var(--color-ink)]">
          <ModuleIcon
            :icon="installTarget.icon"
            :icon-url="installTarget.iconUrl"
            :module-id="installTarget.id"
            icon-class="w-full text-[2.75rem]"
          />
        </span>
        <div class="min-w-0 space-y-1">
          <p class="font-display text-lg font-bold text-[var(--color-ink)]">
            {{ installTarget.name }}
          </p>
          <p class="break-all font-mono text-xs text-[var(--color-muted)]">
            {{ installTarget.id }}
            <template v-if="installTarget.version">
              · v{{ installTarget.localVersion || installTarget.version }}
              <template v-if="isUpdate && installTarget.localVersion">
                → v{{ installTarget.version }}
              </template>
            </template>
          </p>
        </div>
      </div>

      <template v-if="!installJob">
        <p class="text-sm leading-relaxed text-[var(--color-ink)]">
          {{ isUpdate ? 'Atualizar' : 'Instalar' }} este módulo adiciona o pacote à fila.
          A aplicação precisa reiniciar para aplicar schema, build e ativação.
        </p>
        <p class="flex items-start gap-2.5 rounded-lg border border-[#1C223D]/10 bg-[#1C223D]/[0.04] px-3.5 py-3 text-sm text-[var(--color-ink)]">
          <Icon
            name="i-solar:restart-circle-bold-duotone"
            class="mt-0.5 shrink-0 text-base text-[#1C223D]/70"
          />
          <span class="min-w-0">
            Depois, use
            <strong class="font-semibold">Reiniciar aplicação</strong>
            em Meus módulos.
          </span>
        </p>
      </template>

      <template v-else>
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <span
              class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              :class="
                jobDone
                  ? 'bg-emerald-500/10 text-[var(--color-success)]'
                  : jobError
                    ? 'bg-rose-500/10 text-rose-700'
                    : 'bg-[#1C223D]/[0.06] text-[#1C223D]'
              "
            >
              <Icon
                :name="statusIcon"
                class="text-xl"
                :class="{ 'animate-spin': jobRunning }"
              />
            </span>
            <div class="min-w-0 flex-1 space-y-1">
              <p class="text-sm font-medium text-[var(--color-ink)]">
                {{ installJob.message }}
              </p>
              <p
                v-if="jobRunning"
                class="font-mono text-xs text-[var(--color-muted)]"
              >
                {{ installJob.progress }}%
              </p>
            </div>
          </div>

          <div
            v-if="jobRunning || jobDone || jobError"
            class="h-1.5 overflow-hidden rounded-full bg-[var(--color-paper-deep)]"
          >
            <div
              class="h-full rounded-full transition-all duration-500 ease-out"
              :class="
                jobError
                  ? 'bg-rose-600'
                  : jobDone
                    ? 'bg-emerald-600'
                    : 'bg-[#1C223D]'
              "
              :style="{ width: `${Math.max(jobRunning ? 6 : 0, installJob.progress)}%` }"
            />
          </div>

          <p
            v-if="jobError"
            class="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3.5 py-3 text-sm text-rose-800"
          >
            {{ installJob.error || installJob.message }}
          </p>
        </div>
      </template>
    </div>

    <template #footer>
      <UiButton
        variant="ghost"
        type="button"
        :disabled="installPolling"
        @click="emit('closeInstall')"
      >
        {{ jobDone || jobError ? 'Fechar' : 'Cancelar' }}
      </UiButton>
      <UiButton
        v-if="!installJob"
        type="button"
        :disabled="installPolling"
        @click="emit('confirmInstall')"
      >
        <Icon
          :name="isUpdate ? 'i-solar:refresh-circle-bold-duotone' : 'i-solar:download-minimalistic-bold-duotone'"
          class="text-lg"
        />
        {{ isUpdate ? 'Atualizar' : 'Instalar' }}
      </UiButton>
      <NuxtLink
        v-else-if="jobDone"
        to="/panel/modules"
        class="inline-flex w-full sm:w-auto"
      >
        <UiButton
          type="button"
          class="w-full sm:w-auto"
        >
          Ir para Meus módulos
        </UiButton>
      </NuxtLink>
    </template>
  </UiModal>
</template>
