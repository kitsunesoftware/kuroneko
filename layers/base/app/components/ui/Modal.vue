<script setup lang="ts">
const open = defineModel<boolean>({ default: false })

withDefaults(defineProps<{
  title?: string
  size?: 'md' | 'lg'
}>(), {
  size: 'md',
})

const stackCount = useState('kuroneko-modal-stack', () => 0)
const zIndex = ref(50)

function close() {
  open.value = false
}

function onBackdrop(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    close()
  }
}

watch(open, (value, wasOpen) => {
  if (!import.meta.client) return

  if (value) {
    stackCount.value += 1
    zIndex.value = 50 + stackCount.value * 10
    document.body.style.overflow = 'hidden'
    return
  }

  // Evita decrementar no mount (immediate) quando já inicia fechada.
  if (!wasOpen) return

  stackCount.value = Math.max(0, stackCount.value - 1)
  if (stackCount.value === 0) {
    document.body.style.overflow = ''
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (!import.meta.client) return
  if (open.value) {
    stackCount.value = Math.max(0, stackCount.value - 1)
  }
  if (stackCount.value === 0) {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      :style="{ zIndex }"
      @mousedown="onBackdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        class="flex max-h-[min(92dvh,720px)] w-full flex-col overflow-hidden rounded-t-xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)] sm:rounded-xl"
        :class="size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'"
        @mousedown.stop
      >
        <div class="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-4 sm:px-5">
          <h2 class="min-w-0 text-base font-semibold text-[var(--color-ink)] sm:text-lg">
            {{ title }}
          </h2>
          <button
            type="button"
            class="shrink-0 rounded-md p-1.5 text-[var(--color-muted)] transition hover:bg-[var(--color-paper-deep)] hover:text-[var(--color-ink)]"
            aria-label="Fechar"
            @click="close"
          >
            <Icon
              name="i-solar:close-circle-bold-duotone"
              class="text-xl"
            />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          <slot />
        </div>

        <div
          v-if="$slots.footer"
          class="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--color-line)] px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-5 [&_button]:w-full sm:[&_button]:w-auto"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
