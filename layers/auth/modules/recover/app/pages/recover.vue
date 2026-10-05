<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})
</script>

<template>
  <div class="space-y-4">
    <h2 class="font-display text-2xl font-bold text-[var(--color-ink)]">
      Recuperar conta
    </h2>
    <p class="text-sm text-[var(--color-muted)]">
      Submódulo <code class="text-[var(--color-ink)]">auth/modules/recover</code>.
      Implemente o fluxo de recuperação aqui.
    </p>
    <NuxtLink
      to="/login"
      class="text-sm text-[var(--color-accent)] underline"
    >
      Voltar ao login
    </NuxtLink>
  </div>
</template>
