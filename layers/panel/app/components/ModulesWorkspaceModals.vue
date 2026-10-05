<script setup lang="ts">
const props = defineProps<{
  settingsOpen: boolean
  settingsModuleId: string | null
  settingsTitle: string
  settingsSaveStatus: 'idle' | 'saving' | 'saved'
  uninstallOpen: boolean
  uninstallTarget: { id: string, label: string } | null
  removeLayerOpen: boolean
  removeLayerTarget: { id: string, label: string, target: string | null } | null
  removeLayerNoticeOpen: boolean
  lastRemovedLayerTarget: string
  lastRemovedLayerLabel: string
  restoreOpen: boolean
  restoreTarget: { id: string, label: string } | null
  busyId: string | null
  transferLoading: boolean
  transferTitle: string
  transferMessage: string
}>()

const emit = defineEmits<{
  'update:settingsOpen': [value: boolean]
  'update:uninstallOpen': [value: boolean]
  'update:removeLayerOpen': [value: boolean]
  'update:removeLayerNoticeOpen': [value: boolean]
  'update:restoreOpen': [value: boolean]
  'settings-status': [status: 'idle' | 'saving' | 'saved']
  'cancel-uninstall': []
  'confirm-uninstall': []
  'cancel-remove-layer': []
  'confirm-remove-layer': []
  'close-remove-layer-notice': []
  'clear-remove-layer-notice': []
  'cancel-restore': []
  'confirm-restore': []
}>()

const { flat } = useModules()

const uninstallModule = computed(() => {
  const id = props.uninstallTarget?.id
  if (!id) return null
  return flat.value.find((item) => item.id === id) ?? null
})

const settingsFormRef = ref<{ reset: () => Promise<void> } | null>(null)

defineExpose({
  settingsFormRef,
  async resetSettings() {
    await settingsFormRef.value?.reset()
  },
})
</script>

<template>
  <div>
    <UiModal
      :model-value="settingsOpen"
      :title="settingsTitle"
      size="lg"
      @update:model-value="emit('update:settingsOpen', $event)"
    >
      <ModulesSettingsForm
        v-if="settingsModuleId"
        ref="settingsFormRef"
        :module-id="settingsModuleId"
        @status="emit('settings-status', $event)"
      />

      <template #footer>
        <div class="flex w-full items-center justify-between gap-3">
          <div class="min-h-5 min-w-0">
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 translate-y-0.5"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition duration-120 ease-in"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <p
                v-if="settingsSaveStatus === 'saving'"
                class="flex items-center gap-1.5 text-xs text-[var(--color-muted)]"
              >
                <Icon
                  name="svg-spinners:ring-resize"
                  class="h-3.5 w-3.5"
                />
                Salvando…
              </p>
              <p
                v-else-if="settingsSaveStatus === 'saved'"
                class="flex items-center gap-1.5 text-xs font-medium text-[var(--color-success)]"
              >
                <Icon
                  name="i-solar:check-circle-bold"
                  class="text-sm"
                />
                Alterações salvas
              </p>
            </Transition>
          </div>

          <UiButton
            variant="ghost"
            type="button"
            @click="settingsFormRef?.reset()"
          >
            Restaurar padrões
          </UiButton>
        </div>
      </template>
    </UiModal>

    <UiModal
      :model-value="uninstallOpen"
      title="Desinstalar módulo"
      @update:model-value="emit('update:uninstallOpen', $event)"
    >
      <div
        v-if="uninstallTarget"
        class="space-y-5"
      >
        <div class="flex items-start gap-3">
          <span class="flex h-12 w-12 shrink-0 items-center justify-center text-[var(--color-ink)]">
            <ModuleIcon
              :icon="uninstallModule?.icon"
              :icon-url="uninstallModule?.iconUrl"
              :module-id="uninstallTarget.id"
              icon-class="w-full text-[2.75rem]"
            />
          </span>
          <div class="min-w-0 space-y-1">
            <p class="font-display text-lg font-bold text-[var(--color-ink)]">
              {{ uninstallTarget.label }}
            </p>
            <p class="break-all font-mono text-xs text-[var(--color-muted)]">
              {{ uninstallTarget.id }}
            </p>
          </div>
        </div>

        <p class="text-sm leading-relaxed text-[var(--color-ink)]">
          Desinstalar adiciona o módulo à fila de remoção. Tabelas, dados e submódulos serão apagados no reinício.
        </p>

        <p class="flex items-start gap-2.5 rounded-lg border border-[#1C223D]/10 bg-[#1C223D]/[0.04] px-3.5 py-3 text-sm text-[var(--color-ink)]">
          <Icon
            name="i-solar:restart-circle-bold-duotone"
            class="mt-0.5 shrink-0 text-base text-[#1C223D]/70"
          />
          <span class="min-w-0">
            Ele permanece na lista até você usar
            <strong class="font-semibold">Reiniciar aplicação</strong>.
          </span>
        </p>
      </div>

      <template #footer>
        <UiButton
          variant="ghost"
          type="button"
          :disabled="Boolean(busyId)"
          @click="emit('cancel-uninstall')"
        >
          Cancelar
        </UiButton>
        <UiButton
          type="button"
          :loading="busyId === uninstallTarget?.id"
          @click="emit('confirm-uninstall')"
        >
          <Icon
            name="i-solar:trash-bin-trash-bold-duotone"
            class="text-lg"
          />
          Desinstalar
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      :model-value="removeLayerOpen"
      title="Remover módulo"
      @update:model-value="emit('update:removeLayerOpen', $event)"
    >
      <div
        v-if="removeLayerTarget"
        class="space-y-3"
      >
        <p class="text-sm text-[var(--color-ink)]">
          Remover
          <strong>{{ removeLayerTarget.label }}</strong>
          apaga o pacote em
          <code class="rounded bg-[var(--color-paper-deep)] px-1 py-0.5 text-xs">{{ removeLayerTarget.target || 'layers/' }}</code>.
        </p>
        <p class="rounded-lg border border-[var(--color-line)] bg-[#F8F8F6] px-3 py-2 text-sm text-[var(--color-muted)]">
          Será necessário rebuildar a aplicação para a layer deixar de carregar no Kuroneko.
        </p>
      </div>

      <template #footer>
        <UiButton
          variant="ghost"
          type="button"
          :disabled="Boolean(busyId)"
          @click="emit('cancel-remove-layer')"
        >
          Cancelar
        </UiButton>
        <UiButton
          type="button"
          :loading="busyId === removeLayerTarget?.id"
          @click="emit('confirm-remove-layer')"
        >
          Remover
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      :model-value="removeLayerNoticeOpen"
      title="Rebuild após remoção"
      @update:model-value="(open: boolean) => {
        emit('update:removeLayerNoticeOpen', open)
        if (!open) emit('clear-remove-layer-notice')
      }"
    >
      <div class="space-y-3">
        <p class="text-sm text-[var(--color-ink)]">
          O pacote
          <template v-if="lastRemovedLayerLabel">
            <strong>{{ lastRemovedLayerLabel }}</strong>
          </template>
          foi removido
          <template v-if="lastRemovedLayerTarget">
            de
            <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5 text-xs">{{ lastRemovedLayerTarget }}</code>
          </template>
          .
        </p>
        <p class="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-sm text-[var(--color-accent)]">
          Rebuildar (ou reiniciar o
          <code class="text-[var(--color-ink)]">npm run dev</code>
          ) para a layer sumir da lista do Kuroneko.
        </p>
      </div>

      <template #footer>
        <UiButton
          variant="ghost"
          type="button"
          @click="emit('close-remove-layer-notice')"
        >
          Entendi
        </UiButton>
        <NuxtLink
          to="/panel/modules/store"
          class="inline-flex"
          @click="emit('clear-remove-layer-notice')"
        >
          <UiButton type="button">
            Ir para a loja
          </UiButton>
        </NuxtLink>
      </template>
    </UiModal>

    <UiModal
      :model-value="restoreOpen"
      title="Restaurar backup"
      @update:model-value="emit('update:restoreOpen', $event)"
    >
      <div
        v-if="restoreTarget"
        class="space-y-3"
      >
        <p class="text-sm text-[var(--color-ink)]">
          Restaurar dados em
          <strong>{{ restoreTarget.label }}</strong>
          a partir do arquivo selecionado?
        </p>
        <p class="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-sm text-[var(--color-accent)]">
          Os dados atuais das tabelas e configurações deste módulo — e dos submódulos incluídos no backup — serão substituídos. Submódulos ainda não instalados serão ignorados.
        </p>
      </div>

      <template #footer>
        <UiButton
          variant="ghost"
          type="button"
          :disabled="Boolean(busyId) || transferLoading"
          @click="emit('cancel-restore')"
        >
          Cancelar
        </UiButton>
        <UiButton
          type="button"
          :loading="busyId === restoreTarget?.id"
          :disabled="transferLoading"
          @click="emit('confirm-restore')"
        >
          Restaurar
        </UiButton>
      </template>
    </UiModal>

    <Teleport to="body">
      <div
        v-if="transferLoading"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
        role="alertdialog"
        aria-modal="true"
        aria-busy="true"
        :aria-label="transferTitle"
      >
        <div class="w-full max-w-sm rounded-xl border border-[var(--color-line)] bg-white px-6 py-8 text-center shadow-[var(--shadow-soft)]">
          <Icon
            name="svg-spinners:ring-resize"
            class="mx-auto h-10 w-10 text-[var(--color-accent)]"
          />
          <h2 class="mt-4 text-lg font-semibold text-[var(--color-ink)]">
            {{ transferTitle }}
          </h2>
          <p class="mt-2 text-sm text-[var(--color-muted)]">
            {{ transferMessage }}
          </p>
          <p class="mt-4 text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Aguarde…
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>
