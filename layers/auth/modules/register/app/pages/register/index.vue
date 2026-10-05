<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

const config = useRuntimeConfig()

function onSuccess() {
  return navigateTo(config.public.auth.homePath)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="font-display text-3xl font-extrabold leading-tight text-[var(--color-ink)] sm:text-4xl md:text-5xl">
        Criar conta
      </h1>
      <p class="mt-3 max-w-md text-[var(--color-muted)]">
        Preencha os dados para começar a usar o Kuroneko.
      </p>
    </div>
    <AuthRegisterForm @success="onSuccess" />
    <p class="text-sm text-[var(--color-muted)]">
      Já tem conta?
      <NuxtLink
        to="/login"
        class="text-[var(--color-accent)] underline underline-offset-2"
      >
        Entrar
      </NuxtLink>
    </p>
  </div>
</template>
