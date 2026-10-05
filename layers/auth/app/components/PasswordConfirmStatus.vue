<script setup lang="ts">
const props = defineProps<{
  password: string
  confirmPassword: string
}>()

const matched = computed(() => {
  const confirm = props.confirmPassword || ''
  if (!confirm) return false
  return confirm === (props.password || '')
})

const statusIcon = computed(() =>
  matched.value ? 'i-solar:check-circle-bold' : 'i-solar:danger-triangle-bold',
)

const statusClass = computed(() =>
  matched.value
    ? 'text-emerald-600'
    : 'text-[var(--color-accent)]',
)
</script>

<template>
  <span
    class="flex items-center justify-center"
    :class="statusClass"
    :aria-label="matched ? 'Senhas conferem' : 'Senhas não conferem'"
    role="img"
  >
    <Icon
      :name="statusIcon"
      class="text-lg"
    />
  </span>
</template>
