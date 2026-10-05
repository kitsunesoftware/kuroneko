<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

const LOGIN_MODULE_ID = 'auth.login'
const config = useRuntimeConfig()
const route = useRoute()
const { getValues } = useModuleSettings()

const allowUsername = computed(() =>
  Boolean(getValues(LOGIN_MODULE_ID).allowUsernameLogin),
)

const loginView = useState<'form' | 'picker'>('kuroneko-login-view', () => 'form')

const pageTitle = computed(() => 'Bem-vindo')

const pageSubtitle = computed(() => {
  if (loginView.value === 'picker') {
    return 'Selecione uma conta para continuar.'
  }
  return allowUsername.value
    ? 'Acesse com e-mail ou usuário para continuar.'
    : 'Acesse sua conta para continuar.'
})

function resolveRedirect() {
  const raw = route.query.redirect
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
    return value
  }
  return config.public.auth.homePath
}

function onSuccess() {
  return navigateTo(resolveRedirect())
}
</script>

<template>
  <div>
    <h1 class="font-display text-3xl font-extrabold leading-tight text-[var(--color-ink)] sm:text-4xl md:text-5xl">
      {{ pageTitle }}
    </h1>
    <p class="mt-3 max-w-md text-[var(--color-muted)]">
      {{ pageSubtitle }}
    </p>

    <div class="mt-8">
      <AuthLoginForm @success="onSuccess" />
    </div>

    <p class="mt-6 text-sm text-[var(--color-muted)]">
      Ainda não tem conta?
      <NuxtLink
        to="/register"
        class="text-[var(--color-accent)] underline underline-offset-2"
      >
        Criar conta
      </NuxtLink>
    </p>
  </div>
</template>
