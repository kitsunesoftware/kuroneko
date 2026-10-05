<script setup lang="ts">
import { LOGIN_GLOBAL_BLOCK_HOURS } from '../../../auth/modules/login/shared/login-settings'

definePageMeta({
  layout: 'auth',
})

const route = useRoute()
const nowTick = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | null = null

const untilMs = computed(() => {
  const raw = Array.isArray(route.query.until) ? route.query.until[0] : route.query.until
  const parsed = Number(raw)
  if (Number.isFinite(parsed) && parsed > 0) return parsed

  const retryRaw = Array.isArray(route.query.retryAfter)
    ? route.query.retryAfter[0]
    : route.query.retryAfter
  const retryAfter = Number(retryRaw)
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Date.now() + retryAfter * 1000
  }

  return Date.now() + LOGIN_GLOBAL_BLOCK_HOURS * 60 * 60_000
})

const remainingSeconds = computed(() =>
  Math.max(0, Math.ceil((untilMs.value - nowTick.value) / 1000)),
)

const isStillBlocked = computed(() => remainingSeconds.value > 0)

const remainingLabel = computed(() => {
  const total = remainingSeconds.value
  if (total <= 0) return 'agora'

  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }
  return `${seconds}s`
})

const unlockAtLabel = computed(() => {
  const date = new Date(untilMs.value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
})

onMounted(() => {
  tickTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer)
})
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <p class="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-accent)]">
        Acesso restrito
      </p>
      <h1 class="font-display text-3xl font-extrabold leading-tight text-[var(--color-ink)] sm:text-4xl md:text-5xl">
        Conta bloqueada
      </h1>
      <p class="max-w-md text-[var(--color-muted)]">
        Detectamos muitas tentativas de acesso. Por segurança, o uso da plataforma
        ficou bloqueado por {{ LOGIN_GLOBAL_BLOCK_HOURS }} horas.
      </p>
    </div>

    <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-white/70 px-4 py-5 shadow-[var(--shadow-soft)]">
      <div class="flex items-start gap-3">
        <Icon
          name="i-solar:danger-triangle-bold-duotone"
          class="mt-0.5 shrink-0 text-2xl text-[var(--color-accent)]"
        />
        <div class="min-w-0 space-y-1">
          <p class="text-sm font-medium text-[var(--color-ink)]">
            {{ isStillBlocked ? 'Tempo restante' : 'Bloqueio encerrado' }}
          </p>
          <p class="font-display text-2xl font-extrabold text-[var(--color-ink)]">
            {{ isStillBlocked ? remainingLabel : 'Você já pode tentar de novo' }}
          </p>
          <p
            v-if="isStillBlocked && unlockAtLabel"
            class="text-sm text-[var(--color-muted)]"
          >
            Liberação prevista: {{ unlockAtLabel }}
          </p>
        </div>
      </div>
    </div>

    <p class="text-sm text-[var(--color-muted)]">
      Se não reconhece essas tentativas, altere a senha assim que o acesso for
      liberado ou fale com um administrador.
    </p>

    <div class="flex flex-col gap-3">
      <UiButton
        type="button"
        block
        :disabled="isStillBlocked"
        @click="navigateTo('/login')"
      >
        {{ isStillBlocked ? 'Aguarde a liberação' : 'Voltar ao login' }}
      </UiButton>
      <NuxtLink
        to="/"
        class="text-center text-sm text-[var(--color-accent)] underline underline-offset-2"
      >
        Ir para o início
      </NuxtLink>
    </div>
  </div>
</template>
