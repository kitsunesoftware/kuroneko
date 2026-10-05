<script setup lang="ts">
/**
 * Catch-all para rotas inexistentes.
 * Define HTTP 404 sem throw (evita ERROR fatal no SSR).
 */
definePageMeta({
  layout: false,
})

const { settings } = useSiteSettings()

setResponseStatus(404)

useSeoMeta({
  title: () => `Página não encontrada — ${settings.value.title || 'Kuroneko'}`,
  robots: 'noindex, nofollow',
})

function goHome() {
  void navigateTo('/')
}
</script>

<template>
  <ErrorState
    :status-code="404"
    @home="goHome"
  />
</template>
