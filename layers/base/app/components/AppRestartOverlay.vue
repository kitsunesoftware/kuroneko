<script setup lang="ts">
/**
 * Overlay global: lê o estado de useAppRestart (useState).
 * Montado no layout — não depende de props das páginas.
 */
const {
  restarting,
  restartPhase,
  restartError,
  dismissRestartOverlay,
} = useAppRestart()
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <div
        v-if="restarting"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-[#1C223D]/70 px-4 backdrop-blur-sm sm:px-6"
        role="alertdialog"
        aria-modal="true"
        aria-live="assertive"
      >
        <div class="w-full max-w-sm space-y-3 rounded-xl bg-white p-5 text-center shadow-lg sm:p-6">
          <Icon
            v-if="!restartError"
            name="svg-spinners:ring-resize"
            class="mx-auto h-8 w-8 text-[var(--color-ink)]"
          />
          <Icon
            v-else
            name="i-solar:danger-triangle-bold-duotone"
            class="mx-auto h-8 w-8 text-rose-600"
          />
          <p class="font-display text-lg font-bold text-[var(--color-ink)]">
            {{ restartError ? 'Não foi possível reiniciar' : 'Reiniciando aplicação…' }}
          </p>
          <p class="text-sm text-[var(--color-muted)]">
            {{ restartError || restartPhase || 'Aguarde o health check…' }}
          </p>
          <UiButton
            v-if="restartError"
            type="button"
            class="mt-2"
            @click="dismissRestartOverlay"
          >
            Fechar
          </UiButton>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>
