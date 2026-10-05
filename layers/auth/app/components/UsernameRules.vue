<script setup lang="ts">
import {
  isUsernameFormatMet,
  isUsernameRulesMet,
  usernameRuleChecks,
} from '../../shared/username-policy'

const props = defineProps<{
  username: string
}>()

const emit = defineEmits<{
  status: [payload: { valid: boolean, checking: boolean, available: boolean | null }]
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})
const available = ref<boolean | null>(null)
const checking = ref(false)
const { token } = useAuth()

let requestSeq = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const formatOk = computed(() => isUsernameFormatMet(props.username))

const rules = computed(() =>
  usernameRuleChecks(props.username, { available: available.value }),
)

const allMet = computed(() =>
  isUsernameRulesMet(props.username, { available: available.value }),
)

const statusIcon = computed(() =>
  allMet.value ? 'i-solar:check-circle-bold' : 'i-solar:danger-triangle-bold',
)

const statusClass = computed(() =>
  allMet.value
    ? 'text-emerald-600 hover:text-emerald-700'
    : 'text-[var(--color-accent)] hover:text-[var(--color-accent)]',
)

function emitStatus() {
  emit('status', {
    valid: allMet.value,
    checking: checking.value,
    available: available.value,
  })
}

async function checkAvailability(value: string) {
  const seq = ++requestSeq
  available.value = null
  emitStatus()

  if (!isUsernameFormatMet(value)) {
    checking.value = false
    emitStatus()
    return
  }

  checking.value = true
  emitStatus()

  try {
    const data = await $fetch<{ valid: boolean, available: boolean }>(
      '/api/auth/register/username-available',
      {
        query: { username: value },
        headers: token.value ? { Authorization: `Bearer ${token.value}` } : undefined,
      },
    )
    if (seq !== requestSeq) return
    available.value = Boolean(data.valid && data.available)
  }
  catch {
    if (seq !== requestSeq) return
    available.value = false
  }
  finally {
    if (seq === requestSeq) {
      checking.value = false
      emitStatus()
    }
  }
}

watch(
  () => props.username,
  (value) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    available.value = null
    checking.value = formatOk.value
    emitStatus()

    debounceTimer = setTimeout(() => {
      void checkAvailability(value)
    }, 400)
  },
  { immediate: true },
)

async function updatePanelPosition() {
  await nextTick()
  const trigger = root.value?.querySelector('button')
  if (!trigger || !panel.value) return

  const rect = trigger.getBoundingClientRect()
  const panelRect = panel.value.getBoundingClientRect()
  const gap = 6
  const width = panelRect.width || 256
  const height = panelRect.height || 180

  let top = rect.bottom + gap
  if (top + height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - height - gap)
  }

  let left = rect.right - width
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8))

  panelStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
  }
}

function toggle(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  open.value = !open.value
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!open.value) return
  const target = event.target as Node
  if (root.value?.contains(target) || panel.value?.contains(target)) return
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

function onScrollOrResize() {
  if (open.value) void updatePanelPosition()
}

watch(open, (value) => {
  if (value) void updatePanelPosition()
})

watch(rules, () => {
  if (open.value) void updatePanelPosition()
})

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onScrollOrResize)
  window.addEventListener('scroll', onScrollOrResize, true)
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  requestSeq += 1
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onScrollOrResize)
  window.removeEventListener('scroll', onScrollOrResize, true)
})
</script>

<template>
  <div
    ref="root"
    class="relative"
  >
    <button
      type="button"
      class="flex items-center justify-center transition"
      :class="statusClass"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-label="allMet ? 'Nome de usuário válido' : 'Regras do nome de usuário'"
      @click="toggle"
    >
      <Icon
        :name="statusIcon"
        class="text-lg"
      />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panel"
        role="dialog"
        aria-label="Regras do nome de usuário"
        class="fixed z-[120] w-64 rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-left shadow-[var(--shadow-soft)]"
        :style="panelStyle"
      >
        <p class="text-xs font-medium text-[var(--color-ink)]">
          Regras do nome de usuário
        </p>
        <ul class="mt-2 flex flex-col gap-1.5 text-xs">
          <li
            v-for="rule in rules"
            :key="rule.key"
            class="flex items-center gap-2 transition-colors"
            :class="rule.met ? 'text-emerald-600' : 'text-[var(--color-muted)]'"
          >
            <Icon
              :name="rule.met ? 'i-solar:check-circle-bold' : 'i-lucide:circle'"
              class="shrink-0 text-base"
            />
            <span>{{ rule.label }}</span>
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>
