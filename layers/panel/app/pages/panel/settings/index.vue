<script setup lang="ts">
const { settings, logo, setLogo, update, reset, defaults } = useSiteSettings()
const { user } = useAuth()
const toast = useToast()

const title = ref(settings.value.title)
const tagline = ref(settings.value.tagline)
const primaryColor = ref(settings.value.primaryColor)
const maintenance = ref(settings.value.maintenance)
const smtpEnabled = ref(settings.value.smtpEnabled)
const smtpHost = ref(settings.value.smtpHost)
const smtpPort = ref(String(settings.value.smtpPort))
const smtpUser = ref(settings.value.smtpUser)
const smtpPassword = ref(settings.value.smtpPassword)
const smtpEncryption = ref(settings.value.smtpEncryption)
const smtpFromEmail = ref(settings.value.smtpFromEmail)
const smtpFromName = ref(settings.value.smtpFromName)
const logoError = ref('')

const storeGithubToken = ref('')
const storeRepo = ref('kitsunesoftware/kuroneko-modules')
const storeRef = ref('main')
const storeUrl = ref('https://github.com/kitsunesoftware/kuroneko-modules')
const storeLoading = ref(true)
const storeSaving = ref(false)
const storeError = ref('')

const smtpTesting = ref(false)
const smtpTestModalOpen = ref(false)
const smtpTestTarget = ref<'self' | 'custom'>('self')
const smtpTestCustomEmail = ref('')

const selfEmail = computed(() => String(user.value?.email || '').trim())

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

function openSmtpTestModal() {
  if (!smtpEnabled.value) {
    toast.info('SMTP desativado', 'Ative o SMTP para enviar um e-mail de teste.')
    return
  }
  if (!smtpHost.value.trim()) {
    toast.error('Host obrigatório', 'Informe o host SMTP.')
    return
  }
  if (!smtpFromEmail.value.trim() || !smtpFromEmail.value.includes('@')) {
    toast.error('Remetente inválido', 'Informe um e-mail remetente válido.')
    return
  }

  smtpTestTarget.value = selfEmail.value ? 'self' : 'custom'
  smtpTestCustomEmail.value = ''
  smtpTestModalOpen.value = true
}

async function confirmSmtpTest() {
  const to = smtpTestTarget.value === 'self'
    ? selfEmail.value
    : smtpTestCustomEmail.value.trim()

  if (smtpTestTarget.value === 'self' && (!to || !to.includes('@'))) {
    toast.error('E-mail indisponível', 'Sua conta não tem um e-mail válido.')
    return
  }
  if (smtpTestTarget.value === 'custom' && (!to || !to.includes('@'))) {
    toast.error('Destinatário inválido', 'Informe um e-mail de destino válido.')
    return
  }

  smtpTesting.value = true
  try {
    await persistBrandSettings()
    const result = await $fetch<{ to: string }>('/api/site/smtp/test', {
      method: 'POST',
      body: {
        to,
        enabled: true,
        host: smtpHost.value.trim(),
        port: Number(smtpPort.value) || defaults.smtpPort,
        user: smtpUser.value.trim(),
        password: smtpPassword.value,
        encryption: smtpEncryption.value,
        fromEmail: smtpFromEmail.value.trim(),
        fromName: smtpFromName.value.trim(),
      },
    })
    smtpTestModalOpen.value = false
    toast.success('Teste enviado', `Verifique a caixa de entrada de ${result.to}.`)
  }
  catch (error: unknown) {
    toast.error('Falha no teste', extractError(error, 'Não foi possível enviar o e-mail de teste.'))
  }
  finally {
    smtpTesting.value = false
  }
}

watch(
  settings,
  (value) => {
    title.value = value.title
    tagline.value = value.tagline
    primaryColor.value = value.primaryColor
    maintenance.value = value.maintenance
    smtpEnabled.value = value.smtpEnabled
    smtpHost.value = value.smtpHost
    smtpPort.value = String(value.smtpPort)
    smtpUser.value = value.smtpUser
    smtpPassword.value = value.smtpPassword
    smtpEncryption.value = value.smtpEncryption
    smtpFromEmail.value = value.smtpFromEmail
    smtpFromName.value = value.smtpFromName
  },
  { deep: true },
)

async function loadStoreSettings() {
  storeLoading.value = true
  storeError.value = ''
  try {
    const data = await $fetch<{
      githubToken: string
      repo?: string
      ref?: string
      url?: string
    }>('/api/site/store')
    storeGithubToken.value = data.githubToken || ''
    if (data.repo) storeRepo.value = data.repo
    if (data.ref) storeRef.value = data.ref
    if (data.url) storeUrl.value = data.url
  }
  catch (error: unknown) {
    storeError.value = error instanceof Error ? error.message : 'Falha ao carregar a loja.'
  }
  finally {
    storeLoading.value = false
  }
}

async function loadBrandSettings() {
  try {
    const data = await $fetch<{
      title: string
      tagline: string
      primaryColor: string
      logo: string | null
    }>('/api/site/brand')
    if (data.title) title.value = data.title
    if (typeof data.tagline === 'string') tagline.value = data.tagline
    if (data.primaryColor) primaryColor.value = data.primaryColor
    if (data.logo) setLogo(data.logo)
    update({
      title: data.title || defaults.title,
      tagline: data.tagline || '',
      primaryColor: data.primaryColor || defaults.primaryColor,
    })
  }
  catch {
    // cookie/localStorage já cobrem o painel
  }
}

async function persistBrandSettings() {
  try {
    await $fetch('/api/site/brand', {
      method: 'PUT',
      body: {
        title: title.value.trim() || defaults.title,
        tagline: tagline.value.trim(),
        primaryColor: primaryColor.value,
        logo: logo.value,
      },
    })
  }
  catch {
    // e-mails usam o que já estiver salvo no servidor
  }
}

async function persistStoreSettings() {
  storeSaving.value = true
  storeError.value = ''
  try {
    await $fetch('/api/site/store', {
      method: 'PUT',
      body: {
        githubToken: storeGithubToken.value.trim(),
      },
    })
    toast.success('Loja salva', 'Token GitHub atualizado.')
  }
  catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Não foi possível salvar.'
    storeError.value = message
    toast.error('Falha ao salvar', message)
  }
  finally {
    storeSaving.value = false
  }
}

function persistText() {
  update({
    title: title.value.trim() || defaults.title,
    tagline: tagline.value.trim(),
    primaryColor: primaryColor.value,
    maintenance: maintenance.value,
    smtpEnabled: smtpEnabled.value,
    smtpHost: smtpHost.value.trim(),
    smtpPort: Number(smtpPort.value) || defaults.smtpPort,
    smtpUser: smtpUser.value.trim(),
    smtpPassword: smtpPassword.value,
    smtpEncryption: smtpEncryption.value,
    smtpFromEmail: smtpFromEmail.value.trim(),
    smtpFromName: smtpFromName.value.trim(),
  })
  void persistBrandSettings()
}

function onMaintenanceToggle(value: boolean) {
  maintenance.value = value
  update({ maintenance: value })
}

function onSmtpEnabledToggle(value: boolean) {
  smtpEnabled.value = value
  update({ smtpEnabled: value })
}

function onLogoChange(event: Event) {
  logoError.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!file.type.startsWith('image/')) {
    logoError.value = 'Selecione um arquivo de imagem.'
    return
  }

  if (file.size > 15 * 1024 * 1024) {
    logoError.value = 'Logo muito grande. Use até 15 MB.'
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      setLogo(reader.result)
      void persistBrandSettings()
    }
  }
  reader.onerror = () => {
    logoError.value = 'Falha ao ler a imagem.'
  }
  reader.readAsDataURL(file)
}

function clearLogo() {
  setLogo(null)
  void persistBrandSettings()
}

function onReset() {
  reset()
  title.value = defaults.title
  tagline.value = defaults.tagline
  primaryColor.value = defaults.primaryColor
  maintenance.value = defaults.maintenance
  smtpEnabled.value = defaults.smtpEnabled
  smtpHost.value = defaults.smtpHost
  smtpPort.value = String(defaults.smtpPort)
  smtpUser.value = defaults.smtpUser
  smtpPassword.value = defaults.smtpPassword
  smtpEncryption.value = defaults.smtpEncryption
  smtpFromEmail.value = defaults.smtpFromEmail
  smtpFromName.value = defaults.smtpFromName
  logoError.value = ''
}

onMounted(() => {
  void loadStoreSettings()
  void loadBrandSettings()
})
</script>

<template>
  <div class="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
    <div class="w-full max-w-[700px] space-y-8">
      <header class="space-y-2">
        <p class="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Painel
        </p>
        <h1 class="font-display text-2xl font-extrabold text-[var(--color-ink)] sm:text-3xl">
          Configurações
        </h1>
        <p class="text-[var(--color-muted)]">
          Identidade do site, loja de módulos, e-mail SMTP e modo de manutenção.
        </p>
      </header>

      <section class="space-y-4 rounded-xl border border-[var(--color-line)] bg-white p-5">
        <div>
          <h2 class="text-lg font-semibold text-[var(--color-ink)]">
            Logo
          </h2>
          <p class="mt-1 text-sm text-[var(--color-muted)]">
            Imagem exibida na marca do site (sidebar e páginas de autenticação).
          </p>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 p-2">
            <img
              v-if="logo"
              :src="logo"
              alt="Logo"
              class="max-h-full max-w-full object-contain"
            >
            <Icon
              v-else
              name="i-solar:gallery-bold-duotone"
              class="text-2xl text-gray-400"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <label class="inline-flex cursor-pointer">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                class="hidden"
                @change="onLogoChange"
              >
              <span class="inline-flex items-center rounded-[var(--radius)] border border-[var(--color-line)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-ink)]">
                {{ logo ? 'Trocar logo' : 'Enviar logo' }}
              </span>
            </label>
            <UiButton
              v-if="logo"
              variant="ghost"
              type="button"
              @click="clearLogo"
            >
              Remover
            </UiButton>
          </div>
        </div>

        <p
          v-if="logoError"
          class="text-sm text-[var(--color-accent)]"
        >
          {{ logoError }}
        </p>
      </section>

      <section class="space-y-4 rounded-xl border border-[var(--color-line)] bg-white p-5">
        <div>
          <h2 class="text-lg font-semibold text-[var(--color-ink)]">
            Identidade
          </h2>
          <p class="mt-1 text-sm text-[var(--color-muted)]">
            Título e tagline usados na marca e no título da aba.
          </p>
        </div>

        <UiInput
          id="site-title"
          v-model="title"
          label="Título"
          type="text"
          placeholder="Kuroneko"
          @blur="persistText"
        />

        <UiInput
          id="site-tagline"
          v-model="tagline"
          label="Tagline"
          type="text"
          placeholder="Template modular Nuxt"
          @blur="persistText"
        />
      </section>

      <section class="space-y-4 rounded-xl border border-[var(--color-line)] bg-white p-5">
        <UiColorPicker
          id="site-primary"
          v-model="primaryColor"
          @change="(value) => {
            update({ primaryColor: value })
            void persistBrandSettings()
          }"
        />
      </section>

      <section class="space-y-4 rounded-xl border border-[var(--color-line)] bg-white p-5">
        <div>
          <h2 class="text-lg font-semibold text-[var(--color-ink)]">
            Loja de módulos
          </h2>
          <p class="mt-1 text-sm text-[var(--color-muted)]">
            A loja sincroniza o monorepo oficial
            <a
              :href="storeUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
            >{{ storeRepo }}</a>
            (<code class="rounded bg-[var(--color-paper-deep)] px-1 py-0.5 text-[var(--color-ink)]">{{ storeRef }}</code>).
            O token é opcional e serve para rate limit da API do GitHub.
          </p>
        </div>

        <p
          v-if="storeLoading"
          class="text-sm text-[var(--color-muted)]"
        >
          Carregando…
        </p>

        <div
          v-else
          class="space-y-4"
        >
          <UiInput
            id="store-token"
            v-model="storeGithubToken"
            label="Token GitHub (opcional)"
            type="password"
            autocomplete="new-password"
            placeholder="ghp_…"
            hint="Usado só para aumentar o rate limit ao sincronizar a loja."
          />

          <p
            v-if="storeError"
            class="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-sm text-[var(--color-accent)]"
          >
            {{ storeError }}
          </p>

          <div class="flex flex-wrap items-center gap-2">
            <UiButton
              type="button"
              :loading="storeSaving"
              @click="persistStoreSettings"
            >
              Salvar token
            </UiButton>
            <NuxtLink
              to="/panel/modules/store"
              class="inline-flex"
            >
              <UiButton variant="outline">
                Abrir loja
              </UiButton>
            </NuxtLink>
          </div>
        </div>
      </section>

      <section class="space-y-4 rounded-xl border border-[var(--color-line)] bg-white p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-[var(--color-ink)]">
              SMTP
            </h2>
            <p class="mt-1 text-sm text-[var(--color-muted)]">
              Servidor de e-mail para notificações, recuperação de conta e avisos do sistema.
            </p>
          </div>
          <UiToggle
            :model-value="smtpEnabled"
            @update:model-value="onSmtpEnabledToggle"
          />
        </div>

        <div
          class="space-y-4"
          :class="{ 'pointer-events-none opacity-45': !smtpEnabled }"
        >
          <div class="flex flex-col gap-4 sm:flex-row">
            <div class="min-w-0 flex-1 sm:flex-[2]">
              <UiInput
                id="smtp-host"
                v-model="smtpHost"
                label="Host"
                type="text"
                placeholder="smtp.exemplo.com"
                :disabled="!smtpEnabled"
                @blur="persistText"
              />
            </div>
            <div class="w-full shrink-0 sm:w-28">
              <UiInput
                id="smtp-port"
                v-model="smtpPort"
                label="Porta"
                type="number"
                placeholder="587"
                :disabled="!smtpEnabled"
                @blur="persistText"
              />
            </div>
          </div>

          <label class="block space-y-1.5">
            <span class="text-sm font-medium text-[var(--color-ink-soft)]">
              Criptografia
            </span>
            <select
              v-model="smtpEncryption"
              class="w-full rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-3 py-2.5 text-[var(--color-ink)] shadow-[var(--shadow-soft)] outline-none transition focus:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!smtpEnabled"
              @change="persistText"
            >
              <option value="none">
                Nenhuma
              </option>
              <option value="tls">
                TLS (STARTTLS)
              </option>
              <option value="ssl">
                SSL
              </option>
            </select>
          </label>

          <UiInput
            id="smtp-user"
            v-model="smtpUser"
            label="Usuário"
            type="text"
            autocomplete="off"
            placeholder="usuario@exemplo.com"
            :disabled="!smtpEnabled"
            @blur="persistText"
          />

          <UiInput
            id="smtp-password"
            v-model="smtpPassword"
            label="Senha"
            type="password"
            autocomplete="new-password"
            placeholder="••••••••"
            :disabled="!smtpEnabled"
            @blur="persistText"
          />

          <div class="flex flex-col gap-4 sm:flex-row">
            <div class="min-w-0 flex-1">
              <UiInput
                id="smtp-from-email"
                v-model="smtpFromEmail"
                label="E-mail remetente"
                type="email"
                placeholder="noreply@exemplo.com"
                :disabled="!smtpEnabled"
                @blur="persistText"
              />
            </div>
            <div class="min-w-0 flex-1">
              <UiInput
                id="smtp-from-name"
                v-model="smtpFromName"
                label="Nome remetente"
                type="text"
                placeholder="Kuroneko"
                :disabled="!smtpEnabled"
                @blur="persistText"
              />
            </div>
          </div>

        </div>

        <div class="flex flex-wrap gap-2 pt-1">
          <UiButton
            type="button"
            variant="outline"
            :disabled="!smtpEnabled || smtpTesting"
            @click="openSmtpTestModal"
          >
            <Icon
              name="i-solar:letter-bold-duotone"
              class="text-lg"
            />
            Enviar e-mail de teste
          </UiButton>
          <NuxtLink
            to="/panel/settings/email-template"
            class="inline-flex"
          >
            <UiButton
              type="button"
              variant="outline"
            >
              <Icon
                name="i-solar:document-add-bold-duotone"
                class="text-lg"
              />
              Configurar template
            </UiButton>
          </NuxtLink>
        </div>
      </section>

      <UiModal
        v-model="smtpTestModalOpen"
        title="Enviar e-mail de teste"
      >
        <div class="space-y-4">
          <p class="text-sm text-[var(--color-muted)]">
            Escolha para quem enviar o e-mail de teste do SMTP.
          </p>

          <div class="space-y-2">
            <label
              class="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-line)] px-3 py-3 transition"
              :class="smtpTestTarget === 'self'
                ? 'border-[var(--color-ink)] bg-[var(--color-paper)]'
                : 'hover:border-[var(--color-ink-soft)]'"
            >
              <input
                v-model="smtpTestTarget"
                type="radio"
                value="self"
                class="mt-1"
                :disabled="!selfEmail"
              >
              <span class="min-w-0">
                <span class="block text-sm font-medium text-[var(--color-ink)]">
                  Para mim
                </span>
                <span class="mt-0.5 block text-xs text-[var(--color-muted)]">
                  {{ selfEmail || 'Sua conta não tem e-mail cadastrado.' }}
                </span>
              </span>
            </label>

            <label
              class="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-line)] px-3 py-3 transition"
              :class="smtpTestTarget === 'custom'
                ? 'border-[var(--color-ink)] bg-[var(--color-paper)]'
                : 'hover:border-[var(--color-ink-soft)]'"
            >
              <input
                v-model="smtpTestTarget"
                type="radio"
                value="custom"
                class="mt-1"
              >
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-[var(--color-ink)]">
                  Para outro destinatário
                </span>
                <span class="mt-0.5 block text-xs text-[var(--color-muted)]">
                  Informe o e-mail que deve receber o teste.
                </span>
              </span>
            </label>
          </div>

          <UiInput
            v-if="smtpTestTarget === 'custom'"
            id="smtp-test-custom-email"
            v-model="smtpTestCustomEmail"
            label="E-mail de destino"
            type="email"
            autocomplete="email"
            placeholder="destino@exemplo.com"
          />
        </div>

        <template #footer>
          <UiButton
            type="button"
            variant="ghost"
            :disabled="smtpTesting"
            @click="smtpTestModalOpen = false"
          >
            Cancelar
          </UiButton>
          <UiButton
            type="button"
            :loading="smtpTesting"
            :disabled="smtpTesting"
            @click="confirmSmtpTest"
          >
            Enviar teste
          </UiButton>
        </template>
      </UiModal>

      <section class="rounded-xl border border-[var(--color-line)] bg-white p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-[var(--color-ink)]">
              Modo manutenção
            </h2>
            <p class="mt-1 text-sm text-[var(--color-muted)]">
              Quando ativo, visitantes são redirecionados para a página de manutenção. O painel continua acessível.
            </p>
          </div>
          <UiToggle
            :model-value="maintenance"
            @update:model-value="onMaintenanceToggle"
          />
        </div>
      </section>

      <div class="flex justify-end pb-4">
        <UiButton
          variant="ghost"
          type="button"
          @click="onReset"
        >
          Restaurar padrões
        </UiButton>
      </div>
    </div>
  </div>
</template>
