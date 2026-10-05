<script setup lang="ts">
import {
  AVATAR_VIEW_SIZE,
  defaultAvatarTransform,
  type AvatarApplyPayload,
  type AvatarTransform,
} from '../../shared/avatar-transform'

const open = defineModel<boolean>({ default: false })

const props = defineProps<{
  currentUrl?: string | null
  currentTransform?: AvatarTransform | null
  acceptExtensions?: string[]
  maxSizeMb?: number
}>()

const emit = defineEmits<{
  apply: [payload: AvatarApplyPayload]
}>()

const { token } = useAuth()

const VIEW = AVATAR_VIEW_SIZE

const acceptAttr = computed(() => {
  const extensions = props.acceptExtensions?.length
    ? props.acceptExtensions
    : ['jpg', 'jpeg', 'png', 'webp']
  return extensions.map((ext) => `.${ext.replace(/^\./, '')}`).join(',')
})

const maxBytes = computed(() => {
  const mb = props.maxSizeMb ?? 2
  return mb * 1024 * 1024
})

const allowedLabel = computed(() => {
  const extensions = props.acceptExtensions?.length
    ? props.acceptExtensions
    : ['jpg', 'jpeg', 'png', 'webp']
  return extensions.map((ext) => ext.toUpperCase()).join(', ')
})

const fileInput = ref<HTMLInputElement | null>(null)
const sourceUrl = ref<string | null>(null)
/** Arquivo novo escolhido pelo usuário (imagem original). */
const sourceFile = ref<File | null>(null)
const naturalWidth = ref(0)
const naturalHeight = ref(0)
const zoom = ref(1)
const rotation = ref(0)
const flipH = ref(false)
const flipV = ref(false)
const offset = ref({ x: 0, y: 0 })
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const offsetStart = ref({ x: 0, y: 0 })
const applying = ref(false)
const error = ref('')

const hasImage = computed(() => Boolean(sourceUrl.value))

const baseScale = computed(() => {
  if (!naturalWidth.value || !naturalHeight.value) return 1
  return Math.max(VIEW / naturalWidth.value, VIEW / naturalHeight.value)
})

const totalScale = computed(() => baseScale.value * zoom.value)

const scaleX = computed(() => totalScale.value * (flipH.value ? -1 : 1))
const scaleY = computed(() => totalScale.value * (flipV.value ? -1 : 1))

const imageStyle = computed(() => ({
  width: `${naturalWidth.value}px`,
  height: `${naturalHeight.value}px`,
  marginLeft: `${-naturalWidth.value / 2}px`,
  marginTop: `${-naturalHeight.value / 2}px`,
  transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scaleX.value}, ${scaleY.value}) rotate(${rotation.value}deg)`,
  transformOrigin: 'center center',
}))

function applyTransformState(transform: AvatarTransform) {
  zoom.value = transform.zoom
  rotation.value = transform.rotation
  flipH.value = transform.flipH
  flipV.value = transform.flipV
  offset.value = { x: transform.offsetX, y: transform.offsetY }
}

function resetTransform() {
  applyTransformState(defaultAvatarTransform(VIEW))
}

function currentTransformPayload(): AvatarTransform {
  return {
    viewSize: VIEW,
    zoom: zoom.value,
    rotation: rotation.value,
    flipH: flipH.value,
    flipV: flipV.value,
    offsetX: offset.value.x,
    offsetY: offset.value.y,
  }
}

function revokeSource() {
  if (sourceUrl.value?.startsWith('blob:')) {
    URL.revokeObjectURL(sourceUrl.value)
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) return

  if (!file.type.startsWith('image/')) {
    error.value = 'Selecione um arquivo de imagem válido.'
    return
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const allowed = (props.acceptExtensions?.length
    ? props.acceptExtensions
    : ['jpg', 'jpeg', 'png', 'webp']
  ).map((item) => item.toLowerCase().replace(/^\./, ''))

  if (extension && !allowed.includes(extension)) {
    error.value = `Extensão não permitida. Aceitos: ${allowedLabel.value}.`
    return
  }

  if (file.size > maxBytes.value) {
    error.value = `Arquivo muito grande. Limite: ${props.maxSizeMb ?? 2} MB.`
    return
  }

  error.value = ''
  revokeSource()
  resetTransform()
  sourceFile.value = file

  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    naturalWidth.value = img.naturalWidth
    naturalHeight.value = img.naturalHeight
    sourceUrl.value = url
  }
  img.onerror = () => {
    error.value = 'Não foi possível carregar a imagem.'
    URL.revokeObjectURL(url)
    sourceFile.value = null
  }
  img.src = url
}

function rotate(delta: number) {
  let next = rotation.value + delta
  if (next > 180) next -= 360
  if (next < -180) next += 360
  rotation.value = next
}

function toggleFlipH() {
  flipH.value = !flipH.value
}

function toggleFlipV() {
  flipV.value = !flipV.value
}

function onPointerDown(event: PointerEvent) {
  if (!hasImage.value) {
    openFilePicker()
    return
  }

  dragging.value = true
  dragStart.value = { x: event.clientX, y: event.clientY }
  offsetStart.value = { ...offset.value }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  offset.value = {
    x: offsetStart.value.x + (event.clientX - dragStart.value.x),
    y: offsetStart.value.y + (event.clientY - dragStart.value.y),
  }
}

function onPointerUp(event: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Leitura inválida'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo'))
    reader.readAsDataURL(file)
  })
}

async function applyCrop() {
  if (!sourceUrl.value || !naturalWidth.value) return

  applying.value = true
  error.value = ''

  try {
    const transform = currentTransformPayload()

    if (sourceFile.value) {
      const dataUrl = await readFileAsDataUrl(sourceFile.value)
      emit('apply', { dataUrl, transform })
    }
    else {
      // Imagem já salva: só persiste o enquadramento.
      emit('apply', { transform })
    }

    open.value = false
  }
  catch {
    error.value = 'Falha ao salvar a imagem.'
  }
  finally {
    applying.value = false
  }
}

function close() {
  open.value = false
}

watch(open, async (value) => {
  if (!value) {
    revokeSource()
    sourceUrl.value = null
    sourceFile.value = null
    naturalWidth.value = 0
    naturalHeight.value = 0
    resetTransform()
    error.value = ''
    return
  }

  sourceFile.value = null
  if (props.currentUrl) {
    revokeSource()
    applyTransformState(props.currentTransform ?? defaultAvatarTransform(VIEW))

    let url = props.currentUrl
    try {
      if (url.startsWith('/api/') && token.value) {
        const blob = await $fetch<Blob>(url, {
          headers: { Authorization: `Bearer ${token.value}` },
          responseType: 'blob',
        })
        url = URL.createObjectURL(blob)
      }
    }
    catch {
      error.value = 'Não foi possível carregar a imagem atual.'
      return
    }

    sourceUrl.value = url
    const img = new Image()
    img.onload = () => {
      naturalWidth.value = img.naturalWidth
      naturalHeight.value = img.naturalHeight
    }
    img.onerror = () => {
      error.value = 'Não foi possível carregar a imagem atual.'
    }
    img.src = url
  }
  else {
    resetTransform()
  }
})

onBeforeUnmount(() => {
  revokeSource()
})
</script>

<template>
  <UiModal
    v-model="open"
    title="Imagem da conta"
  >
    <div class="space-y-5">
      <p class="text-sm text-[var(--color-muted)]">
        A imagem original é salva intacta; o círculo só define o enquadramento
        (zoom, posição e rotação). Aceitos: {{ allowedLabel }} · até {{ maxSizeMb ?? 2 }} MB.
      </p>

      <div class="flex flex-col items-center gap-4">
        <div
          class="relative h-60 w-60 touch-none select-none overflow-hidden rounded-full border-2 border-dashed border-[var(--color-line)] bg-[var(--color-paper-deep)]"
          :class="hasImage ? 'cursor-grab border-solid active:cursor-grabbing' : 'cursor-pointer'"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <template v-if="hasImage">
            <img
              :src="sourceUrl!"
              alt="Pré-visualização"
              class="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
              :style="imageStyle"
              draggable="false"
            >
          </template>
          <div
            v-else
            class="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center"
          >
            <Icon
              name="i-solar:camera-bold-duotone"
              class="text-3xl text-[var(--color-muted)]"
            />
            <span class="text-sm text-[var(--color-muted)]">
              Clique para selecionar uma imagem
            </span>
          </div>
        </div>

        <input
          ref="fileInput"
          type="file"
          :accept="acceptAttr"
          class="hidden"
          @change="onFileChange"
        >

        <UiButton
          v-if="hasImage"
          variant="outline"
          type="button"
          @click="openFilePicker"
        >
          Trocar imagem
        </UiButton>
      </div>

      <div
        v-if="hasImage"
        class="space-y-4"
      >
        <label class="block space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span class="font-medium text-[var(--color-ink)]">Zoom</span>
            <span class="text-[var(--color-muted)]">{{ zoom.toFixed(1) }}x</span>
          </div>
          <input
            v-model.number="zoom"
            type="range"
            min="1"
            max="3"
            step="0.05"
            class="w-full accent-[var(--color-accent)]"
          >
        </label>

        <div class="space-y-2">
          <label class="block space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium text-[var(--color-ink)]">Rotação</span>
              <span class="text-[var(--color-muted)]">{{ Math.round(rotation) }}°</span>
            </div>
            <input
              v-model.number="rotation"
              type="range"
              min="-180"
              max="180"
              step="1"
              class="w-full accent-[var(--color-accent)]"
            >
          </label>

          <div class="flex flex-wrap items-center justify-center gap-2">
            <UiButton
              variant="outline"
              type="button"
              @click="rotate(-90)"
            >
              <Icon
                name="i-solar:refresh-bold-duotone"
                class="rotate-180 text-lg"
              />
              -90°
            </UiButton>
            <UiButton
              variant="outline"
              type="button"
              @click="rotate(90)"
            >
              <Icon
                name="i-solar:refresh-bold-duotone"
                class="text-lg"
              />
              +90°
            </UiButton>
            <UiButton
              :variant="flipH ? 'primary' : 'outline'"
              type="button"
              @click="toggleFlipH"
            >
              <Icon
                name="i-mdi:flip-horizontal"
                class="text-lg"
              />
              Flip H
            </UiButton>
            <UiButton
              :variant="flipV ? 'primary' : 'outline'"
              type="button"
              @click="toggleFlipV"
            >
              <Icon
                name="i-mdi:flip-vertical"
                class="text-lg"
              />
              Flip V
            </UiButton>
          </div>
        </div>
      </div>

      <p
        v-if="error"
        class="text-sm text-red-600"
        role="alert"
      >
        {{ error }}
      </p>
    </div>

    <template #footer>
      <UiButton
        variant="ghost"
        type="button"
        @click="close"
      >
        Cancelar
      </UiButton>
      <UiButton
        type="button"
        :disabled="!hasImage"
        :loading="applying"
        @click="applyCrop"
      >
        Aplicar
      </UiButton>
    </template>
  </UiModal>
</template>
