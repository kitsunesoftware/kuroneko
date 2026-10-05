<template>
  <ErrorState
    :status-code="error?.statusCode || 500"
    :message="errorMessage"
    :title="errorTitle"
    :description="errorDescription"
    @home="goHome"
    @retry="handleClear"
  />
</template>

<script lang="ts" setup>
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const { settings } = useSiteSettings()

const isNotFound = computed(() => props.error?.statusCode === 404)

const errorData = computed(() => {
  const raw = props.error?.data
  if (raw && typeof raw === 'object') {
    return raw as { title?: string, description?: string }
  }
  return {}
})

const errorMessage = computed(
  () => props.error?.statusMessage || props.error?.message || '',
)

const errorTitle = computed(() => errorData.value.title || '')
const errorDescription = computed(() => errorData.value.description || '')

const siteName = computed(() => settings.value.title || 'Kuroneko')

useSeoMeta({
  title: () =>
    isNotFound.value
      ? `${errorTitle.value || 'Página não encontrada'} — ${siteName.value}`
      : `Erro ${props.error?.statusCode || ''} — ${siteName.value}`,
  robots: 'noindex, nofollow',
})

function goHome() {
  clearError({ redirect: '/' })
}

function handleClear() {
  clearError()
}
</script>
