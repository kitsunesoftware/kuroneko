<script setup lang="ts">
export type ColorSwatch = {
  label: string
  value: string
}

const model = defineModel<string>({ default: '#c45c26' })

const props = withDefaults(
  defineProps<{
    id?: string
    label?: string
    hint?: string
    disabled?: boolean
    /** Paleta pronta. Se vazio, usa a padrão do Kuroneko. */
    swatches?: ColorSwatch[]
  }>(),
  {
    id: 'color-picker',
    label: 'Cor primária',
    hint: 'Usada em botões, links e destaques da interface.',
    disabled: false,
    swatches: undefined,
  },
)

const emit = defineEmits<{
  change: [value: string]
}>()

const DEFAULT_SWATCHES: ColorSwatch[] = [
  { label: 'Terracota', value: '#c45c26' },
  { label: 'Âmbar', value: '#d97706' },
  { label: 'Verde', value: '#2f6b4f' },
  { label: 'Teal', value: '#0f766e' },
  { label: 'Azul', value: '#1d4ed8' },
  { label: 'Índigo', value: '#3730a3' },
  { label: 'Rosa', value: '#be185d' },
  { label: 'Carvão', value: '#1c223d' },
]

const palette = computed(() => props.swatches?.length ? props.swatches : DEFAULT_SWATCHES)

const customOpen = ref(false)
const customInput = ref('')

function normalizeHex(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  const withHash = raw.startsWith('#') ? raw : `#${raw}`
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(withHash)) return ''
  if (withHash.length === 4) {
    const [, r, g, b] = withHash
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return withHash.toLowerCase()
}

const normalizedModel = computed(() => normalizeHex(model.value) || '#c45c26')

const isPresetSelected = computed(() =>
  palette.value.some((swatch) => normalizeHex(swatch.value) === normalizedModel.value),
)

watch(
  normalizedModel,
  (value) => {
    customInput.value = value
    if (!isPresetSelected.value) customOpen.value = true
  },
  { immediate: true },
)

function applyColor(value: string) {
  const next = normalizeHex(value)
  if (!next || props.disabled) return
  model.value = next
  customInput.value = next
  emit('change', next)
}

function selectSwatch(value: string) {
  customOpen.value = false
  applyColor(value)
}

function openCustom() {
  if (props.disabled) return
  customOpen.value = true
  if (!isPresetSelected.value) applyColor(normalizedModel.value)
}

function onNativeColor(event: Event) {
  applyColor((event.target as HTMLInputElement).value)
  customOpen.value = true
}

function onHexBlur() {
  const next = normalizeHex(customInput.value)
  if (next) applyColor(next)
  else customInput.value = normalizedModel.value
}
</script>

<template>
  <div
    class="space-y-3"
    :class="{ 'pointer-events-none opacity-60': disabled }"
  >
    <div
      v-if="label || hint"
      class="space-y-1"
    >
      <p
        v-if="label"
        class="text-sm font-medium text-[var(--color-ink-soft)]"
      >
        {{ label }}
      </p>
      <p
        v-if="hint"
        class="text-xs text-[var(--color-muted)]"
      >
        {{ hint }}
      </p>
    </div>

    <!-- Prévia ao vivo -->
    <div
      class="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6] px-3 py-3"
    >
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Prévia
        </p>
        <p
          class="mt-1 truncate text-sm font-semibold"
          :style="{ color: normalizedModel }"
        >
          Link de exemplo
        </p>
      </div>
      <span
        class="inline-flex shrink-0 items-center rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition"
        :style="{ backgroundColor: normalizedModel }"
      >
        Botão
      </span>
    </div>

    <!-- Paleta -->
    <div
      class="flex flex-wrap gap-2.5"
      role="listbox"
      :aria-label="label || 'Paleta de cores'"
    >
      <button
        v-for="swatch in palette"
        :id="`${id}-${swatch.value.replace('#', '')}`"
        :key="swatch.value"
        type="button"
        role="option"
        class="group relative size-9 rounded-full border-2 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]/30"
        :class="
          normalizedModel === normalizeHex(swatch.value)
            ? 'border-[var(--color-ink)] scale-105 shadow-md'
            : 'border-white shadow-sm hover:scale-105 hover:shadow-md'
        "
        :style="{ backgroundColor: swatch.value }"
        :aria-selected="normalizedModel === normalizeHex(swatch.value)"
        :aria-label="swatch.label"
        :title="swatch.label"
        :disabled="disabled"
        @click="selectSwatch(swatch.value)"
      >
        <Icon
          v-if="normalizedModel === normalizeHex(swatch.value)"
          name="i-solar:check-bold"
          class="absolute inset-0 m-auto text-sm text-white drop-shadow"
        />
      </button>

      <!-- Personalizada -->
      <label
        class="relative flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition duration-200"
        :class="
          customOpen || !isPresetSelected
            ? 'border-[var(--color-ink)] bg-white shadow-md'
            : 'border-[var(--color-line)] bg-white hover:border-[var(--color-ink)]'
        "
        :title="'Cor personalizada'"
      >
        <input
          :id="`${id}-native`"
          type="color"
          class="absolute inset-0 cursor-pointer opacity-0"
          :value="normalizedModel"
          :disabled="disabled"
          @input="onNativeColor"
          @click="openCustom"
        >
        <span
          v-if="!isPresetSelected"
          class="size-5 rounded-full"
          :style="{ backgroundColor: normalizedModel }"
        />
        <Icon
          v-else
          name="i-solar:pallete-2-bold-duotone"
          class="text-base text-[var(--color-muted)]"
        />
      </label>
    </div>

    <!-- Hex custom (só quando personaliza) -->
    <div
      v-if="customOpen || !isPresetSelected"
      class="flex items-center gap-2"
    >
      <span
        class="size-8 shrink-0 rounded-md border border-[var(--color-line)]"
        :style="{ backgroundColor: normalizedModel }"
      />
      <input
        :id="`${id}-hex`"
        v-model="customInput"
        type="text"
        class="h-9 w-full max-w-[9rem] rounded-[var(--radius)] border border-[var(--color-line)] bg-white px-3 text-sm text-[var(--color-ink)] outline-none ring-0 focus:border-[var(--color-ink)] focus:outline-none focus:ring-0"
        placeholder="#c45c26"
        autocomplete="off"
        spellcheck="false"
        :disabled="disabled"
        @blur="onHexBlur"
        @keydown.enter.prevent="onHexBlur"
      >
      <span class="text-xs text-[var(--color-muted)]">hex</span>
    </div>
  </div>
</template>
