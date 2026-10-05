<script setup lang="ts">
import type { ToastItem, ToastTone } from '../../composables/useToast'

const props = defineProps<{
  toast: ToastItem
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const toneMeta: Record<ToastTone, {
  titleClass: string
  iconBg: string
  barClass: string
  icon: string
  glow: string
}> = {
  success: {
    titleClass: 'text-[var(--color-success)]',
    iconBg: 'bg-[var(--color-success)]',
    barClass: 'bg-[var(--color-success)]',
    icon: 'i-solar:check-bold',
    glow: 'rgb(45 125 95 / 0.28)',
  },
  error: {
    titleClass: 'text-[var(--color-accent)]',
    iconBg: 'bg-[var(--color-accent)]',
    barClass: 'bg-[var(--color-accent)]',
    icon: 'i-solar:close-bold',
    glow: 'rgb(196 92 38 / 0.32)',
  },
  info: {
    titleClass: 'text-white/90',
    iconBg: 'bg-[var(--color-ink-soft)]',
    barClass: 'bg-white/70',
    icon: 'i-solar:info-circle-bold',
    glow: 'rgb(255 255 255 / 0.1)',
  },
}

const meta = computed(() => toneMeta[props.toast.tone])
const progress = ref(100)
const paused = ref(false)

let remainingMs = props.toast.durationMs
let lastTick = 0
let frameId = 0

function tick(now: number) {
  if (!lastTick) lastTick = now

  if (!paused.value) {
    remainingMs -= now - lastTick
    progress.value = Math.max(0, (remainingMs / props.toast.durationMs) * 100)

    if (remainingMs <= 0) {
      emit('dismiss')
      return
    }
  }

  lastTick = now
  frameId = requestAnimationFrame(tick)
}

function onEnter() {
  paused.value = true
}

function onLeave() {
  paused.value = false
  lastTick = 0
}

onMounted(() => {
  if (props.toast.durationMs > 0) {
    frameId = requestAnimationFrame(tick)
  }
})

onBeforeUnmount(() => {
  if (frameId) cancelAnimationFrame(frameId)
})
</script>

<template>
  <div
    class="pointer-events-auto relative w-full max-w-[380px] overflow-hidden rounded-xl border border-white/5 shadow-[0_18px_40px_-18px_rgb(0_0_0_/_0.55)]"
    :style="{
      background: `linear-gradient(90deg, ${meta.glow} 0%, transparent 42%), #1C223D`,
    }"
    role="status"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @click="emit('dismiss')"
  >
    <div class="flex items-center gap-4 px-5 py-4 text-left">
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
        :class="meta.iconBg"
      >
        <Icon
          :name="meta.icon"
          class="text-xl"
        />
      </span>

      <div class="min-w-0 flex-1 space-y-0.5">
        <p
          class="text-[15px] font-semibold leading-snug"
          :class="meta.titleClass"
        >
          {{ toast.title }}
        </p>
        <p class="text-sm leading-snug text-white/55">
          {{ toast.description }}
        </p>
      </div>
    </div>

    <div
      v-if="toast.durationMs > 0"
      class="absolute inset-x-0 bottom-0 h-[3px] bg-white/10"
      aria-hidden="true"
    >
      <div
        class="h-full origin-left transition-none"
        :class="meta.barClass"
        :style="{
          width: `${progress}%`,
          opacity: paused ? 0.45 : 0.9,
        }"
      />
    </div>
  </div>
</template>
