<script setup lang="ts">
useSeoMeta({
  title: 'Template de e-mail',
})

type EmailTemplateForm = {
  showLogo: boolean
  showTagline: boolean
  showAccentBar: boolean
  footerNote: string
  backgroundColor: string
  cardBackgroundColor: string
  htmlTemplate: string
}

type PlaceholderInfo = {
  key: string
  description: string
}

const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const previewHtml = ref('')
const previewLoading = ref(false)
const previewError = ref('')
const placeholders = ref<PlaceholderInfo[]>([])
const editorTab = ref<'options' | 'code'>('code')

const defaults = ref<EmailTemplateForm>({
  showLogo: true,
  showTagline: true,
  showAccentBar: true,
  footerNote: '',
  backgroundColor: '#F3F1EC',
  cardBackgroundColor: '#ffffff',
  htmlTemplate: '',
})

const form = reactive<EmailTemplateForm>({
  showLogo: true,
  showTagline: true,
  showAccentBar: true,
  footerNote: '',
  backgroundColor: '#F3F1EC',
  cardBackgroundColor: '#ffffff',
  htmlTemplate: '',
})

function extractError(error: unknown, fallback: string) {
  if (
    error
    && typeof error === 'object'
    && 'data' in error
    && error.data
    && typeof error.data === 'object'
    && 'message' in error.data
    && typeof error.data.message === 'string'
  ) {
    return error.data.message
  }
  return error instanceof Error ? error.message : fallback
}

function applyTemplate(value: EmailTemplateForm) {
  form.showLogo = value.showLogo
  form.showTagline = value.showTagline
  form.showAccentBar = value.showAccentBar
  form.footerNote = value.footerNote
  form.backgroundColor = value.backgroundColor
  form.cardBackgroundColor = value.cardBackgroundColor
  form.htmlTemplate = value.htmlTemplate
}

async function refreshPreview() {
  previewLoading.value = true
  previewError.value = ''
  try {
    const result = await $fetch<{ html: string }>('/api/site/email-template/preview', {
      method: 'POST',
      body: { ...form },
    })
    previewHtml.value = result.html
  }
  catch (error: unknown) {
    previewError.value = extractError(error, 'Não foi possível gerar a prévia.')
  }
  finally {
    previewLoading.value = false
  }
}

let previewTimer: ReturnType<typeof setTimeout> | null = null

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    void refreshPreview()
  }, 320)
}

onBeforeUnmount(() => {
  if (previewTimer) clearTimeout(previewTimer)
})

async function loadTemplate() {
  loading.value = true
  loadError.value = ''
  try {
    const result = await $fetch<{
      template: EmailTemplateForm
      defaults: EmailTemplateForm
      placeholders: PlaceholderInfo[]
    }>('/api/site/email-template')
    defaults.value = { ...result.defaults }
    placeholders.value = result.placeholders || []
    applyTemplate(result.template)
    await refreshPreview()
  }
  catch (error: unknown) {
    loadError.value = extractError(error, 'Não foi possível carregar o template.')
  }
  finally {
    loading.value = false
  }
}

async function saveTemplate() {
  saving.value = true
  try {
    const result = await $fetch<{ template: EmailTemplateForm }>('/api/site/email-template', {
      method: 'PUT',
      body: { ...form },
    })
    applyTemplate(result.template)
    await refreshPreview()
    toast.success('Template salvo', 'O visual e o HTML dos e-mails do sistema foram atualizados.')
  }
  catch (error: unknown) {
    toast.error('Falha ao salvar', extractError(error, 'Não foi possível salvar o template.'))
  }
  finally {
    saving.value = false
  }
}

function resetToDefaults() {
  applyTemplate(defaults.value)
  schedulePreview()
}

function token(key: string) {
  return `{{${key}}}`
}

function insertPlaceholder(key: string) {
  const value = token(key)
  const el = document.getElementById('email-html-template') as HTMLTextAreaElement | null
  if (!el) {
    form.htmlTemplate += value
    schedulePreview()
    return
  }

  const start = el.selectionStart ?? form.htmlTemplate.length
  const end = el.selectionEnd ?? start
  const next = `${form.htmlTemplate.slice(0, start)}${value}${form.htmlTemplate.slice(end)}`
  form.htmlTemplate = next

  nextTick(() => {
    el.focus()
    const caret = start + value.length
    el.setSelectionRange(caret, caret)
  })
  schedulePreview()
}

watch(
  form,
  () => {
    if (!loading.value) schedulePreview()
  },
  { deep: true },
)

onMounted(() => {
  void loadTemplate()
})
</script>

<template>
  <div class="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
    <div class="mx-auto w-full max-w-[1200px] space-y-8">
      <header class="max-w-3xl space-y-3">
        <NuxtLink
          to="/panel/settings"
          class="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
        >
          <Icon
            name="i-solar:alt-arrow-left-bold-duotone"
            class="text-base"
          />
          Voltar para configurações
        </NuxtLink>
        <p class="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
          E-mail
        </p>
        <h1 class="font-display text-2xl font-extrabold text-[var(--color-ink)] sm:text-3xl">
          Template de e-mail
        </h1>
        <p class="text-[var(--color-muted)]">
          Edite o HTML do e-mail com placeholders da marca e do conteúdo. A prévia atualiza ao vivo.
        </p>
      </header>

      <div
        v-if="loading"
        class="rounded-xl border border-[var(--color-line)] bg-white px-5 py-10 text-center text-sm text-[var(--color-muted)]"
      >
        Carregando template…
      </div>

      <div
        v-else-if="loadError"
        class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
      >
        {{ loadError }}
      </div>

      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="inline-flex rounded-lg border border-[var(--color-line)] bg-white p-1">
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-sm font-medium transition"
              :class="editorTab === 'code'
                ? 'bg-[var(--color-ink)] text-white'
                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'"
              @click="editorTab = 'code'"
            >
              Código HTML
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-sm font-medium transition"
              :class="editorTab === 'options'
                ? 'bg-[var(--color-ink)] text-white'
                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'"
              @click="editorTab = 'options'"
            >
              Opções
            </button>
          </div>

          <div class="flex flex-wrap gap-2">
            <UiButton
              type="button"
              :loading="saving"
              :disabled="saving"
              @click="saveTemplate"
            >
              Salvar template
            </UiButton>
            <UiButton
              type="button"
              variant="outline"
              :disabled="saving"
              @click="resetToDefaults"
            >
              Restaurar padrão
            </UiButton>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <section class="space-y-4 rounded-xl border border-[var(--color-line)] bg-white p-5">
            <template v-if="editorTab === 'code'">
              <div>
                <h2 class="text-lg font-semibold text-[var(--color-ink)]">
                  Código HTML
                </h2>
                <p class="mt-1 text-sm text-[var(--color-muted)]">
                  Use placeholders como
                  <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5 text-[var(--color-ink)]">{{ token('bodyHtml') }}</code>
                  e
                  <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5 text-[var(--color-ink)]">{{ token('title') }}</code>.
                </p>
              </div>

              <div
                v-if="placeholders.length"
                class="flex flex-wrap gap-1.5"
              >
                <button
                  v-for="item in placeholders"
                  :key="item.key"
                  type="button"
                  class="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1 font-mono text-[11px] text-[var(--color-ink-soft)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                  :title="item.description"
                  @click="insertPlaceholder(item.key)"
                >
                  {{ token(item.key) }}
                </button>
              </div>

              <label class="block space-y-1.5">
                <span class="sr-only">HTML do template</span>
                <textarea
                  id="email-html-template"
                  v-model="form.htmlTemplate"
                  rows="24"
                  spellcheck="false"
                  class="w-full resize-y rounded-[var(--radius)] border border-[var(--color-line)] bg-[#1C223D] px-3 py-3 font-mono text-[12px] leading-5 text-[#F3F1EC] shadow-[var(--shadow-soft)] outline-none transition focus:border-[var(--color-accent)]"
                  placeholder="Cole ou edite o HTML do e-mail…"
                />
              </label>
            </template>

            <template v-else>
              <div>
                <h2 class="text-lg font-semibold text-[var(--color-ink)]">
                  Opções
                </h2>
                <p class="mt-1 text-sm text-[var(--color-muted)]">
                  Controlam blocos opcionais do template (
                  <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5">{{ token('logoBlock') }}</code>,
                  <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5">{{ token('taglineBlock') }}</code>,
                  <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5">{{ token('accentBar') }}</code>).
                </p>
              </div>

              <div class="space-y-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium text-[var(--color-ink-soft)]">
                      Mostrar logo
                    </p>
                    <p class="text-xs text-[var(--color-muted)]">
                      Preenche {{ token('logoBlock') }} com a logo do site.
                    </p>
                  </div>
                  <UiToggle v-model="form.showLogo" />
                </div>

                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium text-[var(--color-ink-soft)]">
                      Mostrar slogan
                    </p>
                    <p class="text-xs text-[var(--color-muted)]">
                      Preenche {{ token('taglineBlock') }}.
                    </p>
                  </div>
                  <UiToggle v-model="form.showTagline" />
                </div>

                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium text-[var(--color-ink-soft)]">
                      Barra de destaque
                    </p>
                    <p class="text-xs text-[var(--color-muted)]">
                      Preenche {{ token('accentBar') }} com a cor primária.
                    </p>
                  </div>
                  <UiToggle v-model="form.showAccentBar" />
                </div>
              </div>

              <UiInput
                id="email-footer-note"
                v-model="form.footerNote"
                label="Nota do rodapé"
                type="text"
                placeholder="Deixe vazio para usar título · slogan"
              />

              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block space-y-1.5">
                  <span class="text-sm font-medium text-[var(--color-ink-soft)]">
                    Fundo
                  </span>
                  <div class="flex items-center gap-2">
                    <input
                      v-model="form.backgroundColor"
                      type="color"
                      class="h-10 w-12 cursor-pointer rounded border border-[var(--color-line)] bg-white p-1"
                    >
                    <input
                      v-model="form.backgroundColor"
                      type="text"
                      class="min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                    >
                  </div>
                </label>

                <label class="block space-y-1.5">
                  <span class="text-sm font-medium text-[var(--color-ink-soft)]">
                    Cartão
                  </span>
                  <div class="flex items-center gap-2">
                    <input
                      v-model="form.cardBackgroundColor"
                      type="color"
                      class="h-10 w-12 cursor-pointer rounded border border-[var(--color-line)] bg-white p-1"
                    >
                    <input
                      v-model="form.cardBackgroundColor"
                      type="text"
                      class="min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                    >
                  </div>
                </label>
              </div>
            </template>
          </section>

          <section class="space-y-3 rounded-xl border border-[var(--color-line)] bg-white p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold text-[var(--color-ink)]">
                  Prévia
                </h2>
                <p class="mt-1 text-sm text-[var(--color-muted)]">
                  Renderiza o HTML com a marca e um conteúdo de exemplo.
                </p>
              </div>
              <span
                v-if="previewLoading"
                class="text-xs text-[var(--color-muted)]"
              >
                Atualizando…
              </span>
            </div>

            <p
              v-if="previewError"
              class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {{ previewError }}
            </p>

            <div class="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[#eceae4]">
              <iframe
                v-if="previewHtml"
                title="Prévia do e-mail"
                class="block h-[720px] w-full bg-transparent"
                sandbox=""
                :srcdoc="previewHtml"
              />
              <div
                v-else
                class="flex h-[320px] items-center justify-center text-sm text-[var(--color-muted)]"
              >
                Sem prévia disponível.
              </div>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>
