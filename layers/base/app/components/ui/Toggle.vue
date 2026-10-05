<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    disabled?: boolean
    label?: string
    title?: string
  }>(),
  {
    disabled: false,
    label: undefined,
    title: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <button
    type="button"
    role="switch"
    class="inline-flex items-center gap-3 disabled:cursor-not-allowed disabled:opacity-50"
    :aria-checked="props.modelValue"
    :aria-label="props.label || props.title"
    :title="props.title"
    :disabled="props.disabled"
    @click="emit('update:modelValue', !props.modelValue)"
  >
    <span
      class="relative h-6 w-11 shrink-0 rounded-full transition"
      :class="props.modelValue ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'"
    >
      <span
        class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition"
        :class="props.modelValue ? 'translate-x-5' : 'translate-x-0'"
      />
    </span>
    <span
      v-if="props.label"
      class="text-sm text-[var(--color-ink-soft)]"
    >
      {{ props.label }}
    </span>
  </button>
</template>
