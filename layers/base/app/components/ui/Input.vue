<script setup lang="ts">
const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    id: string
    /** Se vazio, o label não é renderizado. */
    label?: string
    type?: string
    name?: string
    autocomplete?: string
    placeholder?: string
    required?: boolean
    disabled?: boolean
    readonly?: boolean
    error?: string
    /** Texto de ajuda abaixo do campo (ou acima do erro). */
    hint?: string
    inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
    min?: number | string
    max?: number | string
    step?: number | string
    maxlength?: number | string
    /**
     * Mostra o botão olho para revelar/ocultar.
     * Padrão: ativo automaticamente quando `type="password"`.
     */
    revealable?: boolean
    /** Classes extras aplicadas ao `<input>`. */
    inputClass?: string
  }>(),
  {
    label: '',
    type: 'text',
    name: undefined,
    autocomplete: undefined,
    placeholder: '',
    required: false,
    disabled: false,
    readonly: false,
    error: '',
    hint: '',
    inputmode: undefined,
    min: undefined,
    max: undefined,
    step: undefined,
    maxlength: undefined,
    revealable: undefined,
    inputClass: '',
  },
)

defineEmits<{
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
  keydown: [event: KeyboardEvent]
  keyup: [event: KeyboardEvent]
}>()

const slots = useSlots()
const showSecret = ref(false)

const isSecretType = computed(() => props.type === 'password')
const canReveal = computed(() => {
  if (!isSecretType.value) return false
  return props.revealable !== false
})
const hasTrailing = computed(() => Boolean(slots.trailing))

const resolvedType = computed(() => {
  if (canReveal.value && showSecret.value) return 'text'
  return props.type
})

const rightPaddingClass = computed(() => {
  if (canReveal.value && hasTrailing.value) return 'pr-20'
  if (canReveal.value || hasTrailing.value) return 'pr-10'
  return ''
})

const describedBy = computed(() => {
  const ids: string[] = []
  if (props.hint) ids.push(`${props.id}-hint`)
  if (props.error) ids.push(`${props.id}-error`)
  return ids.length ? ids.join(' ') : undefined
})
</script>

<template>
  <div
    class="block space-y-1.5"
    :class="{ 'opacity-60': disabled }"
  >
    <label
      v-if="label"
      :for="id"
      class="block text-sm font-medium text-[var(--color-ink-soft)]"
    >
      {{ label }}
      <span
        v-if="required"
        class="text-[var(--color-accent)]"
        aria-hidden="true"
      >*</span>
    </label>

    <div class="relative">
      <span
        v-if="$slots.leading"
        class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--color-muted)]"
      >
        <slot name="leading" />
      </span>

      <input
        :id="id"
        v-model="model"
        :name="name"
        :type="resolvedType"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :readonly="readonly"
        :inputmode="inputmode"
        :min="min"
        :max="max"
        :step="step"
        :maxlength="maxlength"
        class="w-full rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-3 py-2.5 text-[var(--color-ink)] shadow-[var(--shadow-soft)] outline-none ring-0 transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-0 focus-visible:outline-none disabled:cursor-not-allowed"
        :class="[
          rightPaddingClass,
          $slots.leading ? 'pl-10' : '',
          inputClass,
        ]"
        :aria-invalid="Boolean(error) || undefined"
        :aria-describedby="describedBy"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
        @keydown="$emit('keydown', $event)"
        @keyup="$emit('keyup', $event)"
      >

      <div
        v-if="canReveal || hasTrailing"
        class="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2"
      >
        <span
          v-if="hasTrailing"
          class="flex items-center text-[var(--color-muted)]"
        >
          <slot name="trailing" />
        </span>

        <button
          v-if="canReveal"
          type="button"
          class="flex items-center justify-center px-1.5 text-[var(--color-muted)] transition hover:text-[var(--color-ink)] disabled:cursor-not-allowed"
          :disabled="disabled"
          :aria-label="showSecret ? 'Ocultar senha' : 'Mostrar senha'"
          :tabindex="disabled ? -1 : 0"
          @click="showSecret = !showSecret"
        >
          <Icon
            :name="showSecret ? 'i-solar:eye-closed-bold' : 'i-solar:eye-bold'"
            class="text-lg"
          />
        </button>
      </div>
    </div>

    <p
      v-if="hint && !error"
      :id="`${id}-hint`"
      class="text-xs text-[var(--color-muted)]"
    >
      {{ hint }}
    </p>

    <p
      v-if="error"
      :id="`${id}-error`"
      class="text-sm text-[var(--color-accent)]"
    >
      {{ error }}
    </p>
  </div>
</template>
