<template>
  <div
    class="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[var(--color-paper)] px-6 py-16"
  >
    <div
      class="pointer-events-none absolute inset-0 z-0"
      aria-hidden="true"
      :style="{
        backgroundImage:
          `radial-gradient(circle at 50% 35%, ${glowColor} 0%, transparent 52%)`,
      }"
    />

    <div class="relative z-10 flex max-w-xl flex-col items-center gap-6 text-center">
      <p class="text-xs font-bold uppercase tracking-[0.28em] text-[var(--color-accent)]">
        {{ eyebrow }}
      </p>

      <ClientOnly>
        <FuzzyText
          :text="fuzzyLabel"
          font-size="clamp(4.5rem, 18vw, 9rem)"
          :font-weight="900"
          :color="fuzzyColor"
          :base-intensity="0.22"
          :hover-intensity="0.55"
          :fuzz-range="30"
          :fps="60"
          direction="horizontal"
          :enable-hover="true"
          :glitch-mode="isNotFound"
          :glitch-interval="2800"
          :glitch-duration="180"
          class-name="max-w-full"
        />
        <template #fallback>
          <span
            class="select-none text-[clamp(4.5rem,18vw,9rem)] font-black leading-none text-[var(--color-ink)]"
          >
            {{ fuzzyLabel }}
          </span>
        </template>
      </ClientOnly>

      <h1 class="font-display text-2xl font-bold text-[var(--color-ink)] sm:text-3xl">
        {{ title }}
      </h1>
      <p class="max-w-md text-sm leading-relaxed text-[var(--color-muted)] sm:text-base">
        {{ description }}
      </p>

      <div class="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          class="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--color-accent)] px-6 text-sm font-extrabold text-white transition hover:bg-[var(--color-accent-hover)]"
          @click="emit('home')"
        >
          Voltar ao início
          <Icon
            name="i-solar:home-2-bold"
            class="text-xl"
          />
        </button>
        <button
          v-if="showRetry"
          type="button"
          class="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--color-line)] bg-white/70 px-6 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-ink)]"
          @click="emit('retry')"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    statusCode?: number
    message?: string
    title?: string
    description?: string
  }>(),
  {
    statusCode: 404,
    message: '',
    title: '',
    description: '',
  },
)

const emit = defineEmits<{
  home: []
  retry: []
}>()

const { settings } = useSiteSettings()

const isNotFound = computed(() => props.statusCode === 404)

const fuzzyLabel = computed(() =>
  isNotFound.value ? '404' : String(props.statusCode || 'Erro'),
)

const fuzzyColor = computed(
  () => settings.value.primaryColor || '#c45c26',
)

const glowColor = computed(() => {
  const hex = fuzzyColor.value.replace('#', '')
  if (hex.length !== 6) return 'rgb(196 92 38 / 0.18)'
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  return `rgb(${r} ${g} ${b} / 0.18)`
})

const eyebrow = computed(() =>
  isNotFound.value ? 'Página não encontrada' : 'Algo deu errado',
)

const title = computed(() => {
  if (props.title) return props.title
  return isNotFound.value
    ? 'Essa página não existe por aqui'
    : 'Não foi possível carregar esta página'
})

const description = computed(() => {
  if (props.description) return props.description
  if (isNotFound.value) {
    return (
      props.message
      || 'O link pode estar quebrado ou o conteúdo foi movido. Volte para a página inicial e continue de lá.'
    )
  }
  return (
    props.message
    || 'Ocorreu um erro inesperado. Tente novamente em instantes.'
  )
})

const showRetry = computed(() => !isNotFound.value)
</script>
