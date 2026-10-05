<script setup lang="ts">
const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    id?: string
    label?: string
    length?: number
    disabled?: boolean
    autofocus?: boolean
    hint?: string
  }>(),
  {
    id: 'otp',
    label: '',
    length: 6,
    disabled: false,
    autofocus: false,
    hint: '',
  },
)

const emit = defineEmits<{
  complete: [code: string]
}>()

const inputRefs = ref<Array<HTMLInputElement | null>>([])

const digits = computed({
  get() {
    const chars = model.value.replace(/\D/g, '').slice(0, props.length).split('')
    while (chars.length < props.length) chars.push('')
    return chars
  },
  set(next: string[]) {
    const value = next.join('').replace(/\D/g, '').slice(0, props.length)
    model.value = value
    if (value.length === props.length) emit('complete', value)
  },
})

function setDigit(index: number, raw: string) {
  const digit = raw.replace(/\D/g, '').slice(-1)
  const next = [...digits.value]
  next[index] = digit
  digits.value = next
  if (digit && index < props.length - 1) {
    inputRefs.value[index + 1]?.focus()
  }
}

function onInput(index: number, event: Event) {
  const target = event.target as HTMLInputElement
  setDigit(index, target.value)
  // Mantém o input sincronizado com um único dígito.
  target.value = digits.value[index] || ''
}

function onKeydown(index: number, event: KeyboardEvent) {
  const key = event.key

  if (key === 'Backspace') {
    event.preventDefault()
    const next = [...digits.value]
    if (next[index]) {
      next[index] = ''
      digits.value = next
      return
    }
    if (index > 0) {
      next[index - 1] = ''
      digits.value = next
      inputRefs.value[index - 1]?.focus()
    }
    return
  }

  if (key === 'ArrowLeft' && index > 0) {
    event.preventDefault()
    inputRefs.value[index - 1]?.focus()
    return
  }

  if (key === 'ArrowRight' && index < props.length - 1) {
    event.preventDefault()
    inputRefs.value[index + 1]?.focus()
  }
}

function onPaste(event: ClipboardEvent) {
  event.preventDefault()
  const pasted = (event.clipboardData?.getData('text') || '')
    .replace(/\D/g, '')
    .slice(0, props.length)
  if (!pasted) return

  const next = Array.from({ length: props.length }, (_, i) => pasted[i] || '')
  digits.value = next
  const focusIndex = Math.min(pasted.length, props.length - 1)
  inputRefs.value[focusIndex]?.focus()
}

function setInputRef(index: number, el: Element | ComponentPublicInstance | null) {
  inputRefs.value[index] = el as HTMLInputElement | null
}

onMounted(() => {
  if (props.autofocus && !props.disabled) {
    inputRefs.value[0]?.focus()
  }
})

watch(
  () => props.disabled,
  (disabled) => {
    if (!disabled && props.autofocus) {
      nextTick(() => inputRefs.value[0]?.focus())
    }
  },
)
</script>

<template>
  <div class="block space-y-1.5">
    <p
      v-if="label"
      :id="`${id}-label`"
      class="block text-sm font-medium text-[var(--color-ink-soft)]"
    >
      {{ label }}
    </p>

    <div
      class="flex justify-between gap-2 overflow-visible p-0.5 sm:gap-2.5"
      role="group"
      :aria-labelledby="label ? `${id}-label` : undefined"
      @paste="onPaste"
    >
      <input
        v-for="(_, index) in length"
        :id="index === 0 ? id : `${id}-${index}`"
        :key="index"
        :ref="(el) => setInputRef(index, el)"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="1"
        autocomplete="one-time-code"
        :disabled="disabled"
        :value="digits[index]"
        class="h-12 w-10 shrink-0 rounded-[var(--radius)] border border-[var(--color-line)] bg-white text-center text-lg font-semibold text-[var(--color-ink)] shadow-[var(--shadow-soft)] outline-none ring-0 transition focus:border-[var(--color-ink)] focus:outline-none focus:ring-0 focus-visible:border-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:w-12 sm:text-xl"
        :aria-label="`Dígito ${index + 1} de ${length}`"
        @input="onInput(index, $event)"
        @keydown="onKeydown(index, $event)"
        @focus="($event.target as HTMLInputElement).select()"
      >
    </div>

    <p
      v-if="hint"
      class="text-xs text-[var(--color-muted)]"
    >
      {{ hint }}
    </p>
  </div>
</template>
