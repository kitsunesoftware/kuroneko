<script setup lang="ts">
const { toasts, dismiss } = useToast()
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-end gap-3 p-4 sm:p-6"
      aria-live="polite"
      aria-relevant="additions"
    >
      <TransitionGroup name="toast">
        <UiToastCard
          v-for="toast in toasts"
          :key="toast.id"
          :toast="toast"
          @dismiss="dismiss(toast.id)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.toast-move {
  transition: transform 0.22s ease;
}
</style>
