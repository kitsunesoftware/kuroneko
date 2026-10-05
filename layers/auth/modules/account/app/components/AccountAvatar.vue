<script setup lang="ts">
import {
  buildAvatarImageStyle,
  defaultAvatarTransform,
  type AvatarTransform,
} from '../../shared/avatar-transform'

const props = withDefaults(
  defineProps<{
    src?: string | null
    transform?: AvatarTransform | null
    initials?: string
    size?: number
    alt?: string
  }>(),
  {
    src: null,
    transform: null,
    initials: '?',
    size: 56,
    alt: 'Avatar',
  },
)

const { token } = useAuth()

const imgRef = ref<HTMLImageElement | null>(null)
const displaySrc = ref<string | null>(null)
const naturalWidth = ref(0)
const naturalHeight = ref(0)
const ready = ref(false)
const failed = ref(false)
const loading = ref(false)

let objectUrl: string | null = null
let resolveGeneration = 0

const resolvedTransform = computed(
  () => props.transform ?? defaultAvatarTransform(),
)

const imageStyle = computed(() => {
  if (!ready.value || !naturalWidth.value || !naturalHeight.value) {
    return {
      opacity: '0',
      position: 'absolute',
      width: '1px',
      height: '1px',
      pointerEvents: 'none',
    }
  }
  return buildAvatarImageStyle(
    naturalWidth.value,
    naturalHeight.value,
    resolvedTransform.value,
    props.size,
  )
})

const showImage = computed(() => Boolean(displaySrc.value) && !failed.value)
const showInitials = computed(() => !showImage.value || !ready.value)

function revokeObjectUrl() {
  if (!objectUrl) return
  URL.revokeObjectURL(objectUrl)
  objectUrl = null
}

function resetVisualState() {
  ready.value = false
  failed.value = false
  naturalWidth.value = 0
  naturalHeight.value = 0
}

function applyNaturalSize(img: HTMLImageElement) {
  if (!img.naturalWidth || !img.naturalHeight) return
  naturalWidth.value = img.naturalWidth
  naturalHeight.value = img.naturalHeight
  ready.value = true
  failed.value = false
}

function onLoad(event: Event) {
  applyNaturalSize(event.target as HTMLImageElement)
}

function onError() {
  failed.value = true
  ready.value = false
  naturalWidth.value = 0
  naturalHeight.value = 0
}

async function syncImageElement() {
  await nextTick()
  const img = imgRef.value
  if (!img || !displaySrc.value) return
  if (img.complete) {
    if (img.naturalWidth > 0) applyNaturalSize(img)
    else onError()
  }
}

function isLikelyImageBlob(blob: Blob) {
  if (!blob.size) return false
  if (!blob.type) return true
  return blob.type.startsWith('image/') || blob.type === 'application/octet-stream'
}

async function resolveDisplaySrc(src: string | null) {
  const generation = ++resolveGeneration
  revokeObjectUrl()
  displaySrc.value = null
  resetVisualState()

  if (!src) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    // Proxy autenticado: <img> não manda Bearer; buscamos o blob com o token.
    if (src.startsWith('/api/') && token.value) {
      const blob = await $fetch<Blob>(src, {
        headers: { Authorization: `Bearer ${token.value}` },
        responseType: 'blob',
      })
      if (generation !== resolveGeneration) return
      if (!isLikelyImageBlob(blob)) {
        failed.value = true
        return
      }
      objectUrl = URL.createObjectURL(blob)
      displaySrc.value = objectUrl
      return
    }

    if (generation !== resolveGeneration) return
    displaySrc.value = src
  }
  catch {
    if (generation !== resolveGeneration) return
    failed.value = true
  }
  finally {
    if (generation === resolveGeneration) loading.value = false
  }
}

watch(
  () => [props.src, token.value] as const,
  ([src]) => {
    void resolveDisplaySrc(src ?? null)
  },
  { immediate: true },
)

watch(displaySrc, () => {
  void syncImageElement()
})

onBeforeUnmount(() => {
  resolveGeneration += 1
  revokeObjectUrl()
})
</script>

<template>
  <div
    class="relative shrink-0 overflow-hidden rounded-full bg-[#1C223D] text-white"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <img
      v-if="showImage"
      ref="imgRef"
      :src="displaySrc!"
      :alt="alt"
      class="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
      :style="imageStyle"
      draggable="false"
      @load="onLoad"
      @error="onError"
    >
    <span
      v-if="showInitials"
      class="absolute inset-0 flex items-center justify-center text-sm font-semibold"
      :class="{ 'opacity-40': (showImage || loading) && !ready }"
    >
      {{ initials }}
    </span>
  </div>
</template>
