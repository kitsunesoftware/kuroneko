<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'ghost' | 'outline'
    block?: boolean
    loading?: boolean
    disabled?: boolean
  }>(),
  {
    type: 'button',
    variant: 'primary',
    block: false,
    loading: false,
    disabled: false,
  },
)
</script>

<template>
  <button
    :type="type"
    class="inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-55"
    :class="[
      block ? 'w-full' : '',
      variant === 'primary'
        && 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]',
      variant === 'ghost'
        && 'bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-paper-deep)]',
      variant === 'outline'
        && 'border border-[var(--color-line)] bg-transparent text-[var(--color-ink)] hover:border-[var(--color-ink)]',
    ]"
    :disabled="disabled || loading"
  >
    <Icon
      v-if="loading"
      name="svg-spinners:ring-resize"
      class="h-4 w-4"
    />
    <slot />
  </button>
</template>
