<script setup lang="ts">
import {
  evaluatePasswordRules,
  isPasswordRulesMet,
  policyFromAccountSettings,
  type PasswordPolicy,
} from '../../shared/password-policy'

const props = withDefaults(
  defineProps<{
    password: string
    confirmPassword?: string | null
    /** Força exibir a regra de confirmação. */
    showConfirm?: boolean
    /** Sobrescreve a política (senão usa auth.account). */
    policy?: Partial<PasswordPolicy> | null
  }>(),
  {
    confirmPassword: undefined,
    showConfirm: undefined,
    policy: null,
  },
)

const ACCOUNT_MODULE_ID = 'auth.account'
const { getValues } = useModuleSettings()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const resolvedPolicy = computed<PasswordPolicy>(() => {
  const fromSettings = policyFromAccountSettings(getValues(ACCOUNT_MODULE_ID))
  return {
    ...fromSettings,
    ...props.policy,
  }
})

const rules = computed(() =>
  evaluatePasswordRules({
    password: props.password,
    confirmPassword: props.confirmPassword,
    showConfirm: props.showConfirm,
    policy: resolvedPolicy.value,
  }),
)

const allMet = computed(() =>
  isPasswordRulesMet({
    password: props.password,
    confirmPassword: props.confirmPassword,
    showConfirm: props.showConfirm,
    policy: resolvedPolicy.value,
  }),
)

const statusIcon = computed(() =>
  allMet.value ? 'i-solar:check-circle-bold' : 'i-solar:danger-triangle-bold',
)

const statusClass = computed(() =>
  allMet.value
    ? 'text-emerald-600 hover:text-emerald-700'
    : 'text-[var(--color-accent)] hover:text-[var(--color-accent)]',
)

async function updatePanelPosition() {
  await nextTick()
  const trigger = root.value?.querySelector('button')
  if (!trigger || !panel.value) return

  const rect = trigger.getBoundingClientRect()
  const panelRect = panel.value.getBoundingClientRect()
  const gap = 6
  const width = panelRect.width || 288
  const height = panelRect.height || 200

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
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onScrollOrResize)
  window.removeEventListener('scroll', onScrollOrResize, true)
})

defineExpose({
  allMet,
  rules,
  policy: resolvedPolicy,
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
      :aria-label="allMet ? 'Senha válida' : 'Regras da senha'"
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
        aria-label="Regras da senha"
        class="fixed z-[120] w-72 rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-left shadow-[var(--shadow-soft)]"
        :style="panelStyle"
      >
        <p class="text-xs font-medium text-[var(--color-ink)]">
          Regras da senha
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
