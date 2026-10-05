<script setup lang="ts">
import { LOGIN_MODULE_ID } from '../../../shared/login-settings'
import type { SavedAccount } from '../../../../../app/composables/useSavedAccounts'

const emit = defineEmits<{
  success: []
}>()

const { login, completeTwoFactor, token } = useAuth()
const { getValues } = useModuleSettings()
const { slots: loginSlots } = useLoginSlots()
const toast = useToast()
const { savedAccounts, load, upsert, remove } = useSavedAccounts()

const settings = computed(() => getValues(LOGIN_MODULE_ID))
const allowUsername = computed(() => Boolean(settings.value.allowUsernameLogin))
const allowRememberAccount = computed(() => Boolean(settings.value.allowRememberAccount ?? true))

const identifier = ref('')
const password = ref('')
const rememberAccount = ref(false)
const loading = ref(false)
const slotTokens = reactive<Record<string, string>>({})
const addingAccount = ref(false)
const removing = ref(false)
const selectedEmail = ref('')

const twoFactorStep = ref(false)
const challengeToken = ref('')
const twoFactorMethods = ref<Array<'totp' | 'webauthn'>>([])
const webauthnOptions = ref<unknown>(null)
const totpCode = ref('')
const useRecoveryCode = ref(false)
const pendingLoginUser = ref<{ name: string, email: string, username?: string | null } | null>(null)

const nowTick = ref(Date.now())
const serverLockUntil = ref(0)
let tickTimer: ReturnType<typeof setInterval> | null = null

const showAccountPicker = computed(
  () => allowRememberAccount.value
    && savedAccounts.value.length > 0
    && !addingAccount.value,
)

const loginView = useState<'form' | 'picker'>('kuroneko-login-view', () => 'form')

watch(
  showAccountPicker,
  (picker) => {
    loginView.value = picker ? 'picker' : 'form'
  },
  { immediate: true },
)

onMounted(() => {
  load()
  tickTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer)
})

watch(allowRememberAccount, (enabled) => {
  if (!enabled) {
    rememberAccount.value = false
    addingAccount.value = false
    removing.value = false
    selectedEmail.value = ''
  }
})

const isLocked = computed(() => serverLockUntil.value > nowTick.value)

const lockRemainingSeconds = computed(() => {
  if (!isLocked.value) return 0
  return Math.max(0, Math.ceil((serverLockUntil.value - nowTick.value) / 1000))
})

const identifierLabel = computed(() =>
  allowUsername.value ? 'E-mail ou nome de usuário' : 'E-mail',
)

const identifierPlaceholder = computed(() =>
  allowUsername.value ? 'voce@empresa.com ou usuario' : 'voce@empresa.com',
)

function applyServerLock(retryAfterSeconds?: number) {
  if (!retryAfterSeconds || retryAfterSeconds <= 0) return
  serverLockUntil.value = Date.now() + retryAfterSeconds * 1000
}

function clearClientLock() {
  serverLockUntil.value = 0
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

function formatLastLogin(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function onSelectSavedAccount(saved: SavedAccount) {
  if (removing.value) {
    remove(saved.email)
    if (selectedEmail.value === saved.email) {
      selectedEmail.value = ''
      password.value = ''
    }
    if (savedAccounts.value.length === 0) removing.value = false
    return
  }

  if (selectedEmail.value === saved.email) {
    selectedEmail.value = ''
    password.value = ''
    return
  }

  selectedEmail.value = saved.email
  identifier.value = saved.email
  password.value = ''
}

function startAddAccount() {
  addingAccount.value = true
  removing.value = false
  selectedEmail.value = ''
  identifier.value = ''
  password.value = ''
  rememberAccount.value = true
}

function backToPicker() {
  addingAccount.value = false
  selectedEmail.value = ''
  password.value = ''
}

function toggleRemoving() {
  removing.value = !removing.value
  selectedEmail.value = ''
  password.value = ''
}

function readFetchError(err: unknown): {
  status?: number
  message: string
  kind?: 'window' | 'global'
  remainingAttempts?: number
  retryAfterSeconds?: number
} {
  if (!err || typeof err !== 'object') {
    return { message: 'Não foi possível entrar. Verifique os dados.' }
  }

  const fetchErr = err as {
    statusCode?: number
    status?: number
    data?: {
      message?: string
      data?: {
        kind?: 'window' | 'global'
        remainingAttempts?: number
        retryAfterSeconds?: number
      }
      kind?: 'window' | 'global'
      remainingAttempts?: number
      retryAfterSeconds?: number
    }
  }

  const nested = fetchErr.data?.data
  const kind = nested?.kind ?? fetchErr.data?.kind

  return {
    status: fetchErr.statusCode ?? fetchErr.status,
    message: typeof fetchErr.data?.message === 'string'
      ? fetchErr.data.message
      : 'Não foi possível entrar. Verifique os dados.',
    kind: kind === 'global' || kind === 'window' ? kind : undefined,
    remainingAttempts: nested?.remainingAttempts ?? fetchErr.data?.remainingAttempts,
    retryAfterSeconds: nested?.retryAfterSeconds ?? fetchErr.data?.retryAfterSeconds,
  }
}

async function resolveProfileImage() {
  if (!token.value) return null
  try {
    const data = await $fetch<{ avatarUrl?: string | null }>('/api/account/avatar', {
      headers: { Authorization: `Bearer ${token.value}` },
    })
    const url = data.avatarUrl ?? null
    if (!url) return null

    // Converte proxy autenticado em data URL para o seletor de contas salvas.
    if (url.startsWith('/api/account/avatar/media')) {
      const blob = await $fetch<Blob>(url, {
        headers: { Authorization: `Bearer ${token.value}` },
        responseType: 'blob',
      })
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    }

    return url
  }
  catch {
    return null
  }
}

async function persistSavedAccount(user: {
  name: string
  email: string
  username?: string | null
}) {
  if (!allowRememberAccount.value) return
  const shouldSave = showAccountPicker.value || rememberAccount.value
  if (!shouldSave) return

  const profileImage = await resolveProfileImage()
  upsert({
    name: user.name || user.email,
    email: user.email,
    username: user.username ?? null,
    profileImage,
    lastLoginAt: new Date().toISOString(),
  })
}

async function onSubmit() {
  if (isLocked.value) {
    const minutes = Math.ceil(lockRemainingSeconds.value / 60)
    const description = minutes >= 60
      ? `Tente novamente em cerca de ${Math.ceil(minutes / 60)} h.`
      : `Tente novamente em cerca de ${minutes} min.`
    toast.error('Muitas tentativas', description)
    return
  }

  const loginId = showAccountPicker.value
    ? selectedEmail.value.trim()
    : identifier.value.trim()

  if (!loginId || !password.value) {
    toast.error('Campos incompletos', 'Informe e-mail e senha para continuar.')
    return
  }

  loading.value = true

  try {
    const result = await login({
      email: loginId,
      password: password.value,
      allowUsername: allowUsername.value && !showAccountPicker.value,
      turnstileToken: slotTokens.turnstile || undefined,
    })
    clearClientLock()

    if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
      challengeToken.value = result.challengeToken
      twoFactorMethods.value = result.methods
      webauthnOptions.value = result.webauthnOptions ?? null
      totpCode.value = ''
      useRecoveryCode.value = false
      twoFactorStep.value = true
      pendingLoginUser.value = {
        name: showAccountPicker.value
          ? (savedAccounts.value.find((item) => item.email === selectedEmail.value)?.name || loginId)
          : loginId,
        email: showAccountPicker.value ? selectedEmail.value : (loginId.includes('@') ? loginId : ''),
        username: null,
      }
      return
    }

    await persistSavedAccount(result.user)
    emit('success')
  }
  catch (err: unknown) {
    // Token Turnstile é single-use — limpar força reset do widget.
    if (slotTokens.turnstile) slotTokens.turnstile = ''

    const parsed = readFetchError(err)

    if (parsed.status === 429) {
      if (parsed.kind === 'global') {
        const retryAfterSeconds = parsed.retryAfterSeconds && parsed.retryAfterSeconds > 0
          ? parsed.retryAfterSeconds
          : 24 * 60 * 60
        const until = Date.now() + retryAfterSeconds * 1000
        await navigateTo({
          path: '/blocked',
          query: { until: String(until) },
        })
        return
      }

      applyServerLock(parsed.retryAfterSeconds)
      toast.error('Acesso temporariamente bloqueado', parsed.message)
      return
    }

    const remaining = typeof parsed.remainingAttempts === 'number'
      ? parsed.remainingAttempts
      : null

    if (remaining != null && remaining > 0) {
      toast.error(
        'Falha no login',
        `${parsed.message} (${remaining} tentativa${remaining === 1 ? '' : 's'} restante${remaining === 1 ? '' : 's'})`,
      )
    }
    else {
      toast.error('Falha no login', parsed.message)
    }
  }
  finally {
    loading.value = false
  }
}

function cancelTwoFactor() {
  twoFactorStep.value = false
  challengeToken.value = ''
  twoFactorMethods.value = []
  webauthnOptions.value = null
  totpCode.value = ''
  useRecoveryCode.value = false
  pendingLoginUser.value = null
  password.value = ''
}

async function submitTotpCode() {
  if (!challengeToken.value || !totpCode.value.trim()) {
    toast.error('Código necessário', 'Informe o código do autenticador ou de recuperação.')
    return
  }

  loading.value = true
  try {
    const user = await completeTwoFactor({
      challengeToken: challengeToken.value,
      code: totpCode.value.trim(),
    })
    clearClientLock()
    await persistSavedAccount(user)
    cancelTwoFactor()
    emit('success')
  }
  catch (err: unknown) {
    const parsed = readFetchError(err)
    toast.error('Código inválido', parsed.message)
  }
  finally {
    loading.value = false
  }
}

async function submitWebAuthn() {
  if (!challengeToken.value || !webauthnOptions.value) {
    toast.error('Chave indisponível', 'Use o código do aplicativo autenticador.')
    return
  }

  loading.value = true
  try {
    const { startAuthentication } = await import('@simplewebauthn/browser')
    const assertion = await startAuthentication({
      optionsJSON: webauthnOptions.value as never,
    })
    const user = await completeTwoFactor({
      challengeToken: challengeToken.value,
      webauthnResponse: assertion,
    })
    clearClientLock()
    await persistSavedAccount(user)
    cancelTwoFactor()
    emit('success')
  }
  catch (err: unknown) {
    const parsed = readFetchError(err)
    toast.error(
      'Falha na chave',
      parsed.message || 'Não foi possível autenticar com a chave de segurança.',
    )
  }
  finally {
    loading.value = false
  }
}

const canUseWebAuthn = computed(() => twoFactorMethods.value.includes('webauthn'))
const canUseTotp = computed(() => true)

function onRecoveryCodeInput(value: string) {
  totpCode.value = value.replace(/[^\d-]/g, '').slice(0, 11)
}

function toggleRecoveryMode() {
  useRecoveryCode.value = !useRecoveryCode.value
  totpCode.value = ''
}

const canSubmitTwoFactorCode = computed(() => {
  if (useRecoveryCode.value) return totpCode.value.replace(/\D/g, '').length >= 8
  return totpCode.value.length === 6
})

</script>

<template>
  <div class="space-y-5">
    <!-- Desafio 2FA -->
    <div
      v-if="twoFactorStep"
      class="space-y-5"
    >
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-[var(--color-ink)]">
          Verificação em duas etapas
        </h2>
        <p class="text-sm text-[var(--color-muted)]">
          Confirme sua identidade com o autenticador ou uma chave de segurança.
        </p>
      </div>

      <form
        v-if="canUseTotp"
        class="space-y-4"
        @submit.prevent="submitTotpCode"
      >
        <OtpDigitsInput
          v-if="!useRecoveryCode"
          id="auth-2fa-code"
          v-model="totpCode"
          label="Código do autenticador"
          :disabled="loading"
          autofocus
          hint="Digite os 6 dígitos do aplicativo."
          @complete="submitTotpCode"
        />
        <UiInput
          v-else
          id="auth-2fa-recovery"
          :model-value="totpCode"
          label="Código de recuperação"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="0000-0000"
          maxlength="11"
          :disabled="loading"
          @update:model-value="onRecoveryCodeInput"
        />

        <button
          type="button"
          class="text-sm text-[var(--color-accent)] underline-offset-2 hover:underline"
          :disabled="loading"
          @click="toggleRecoveryMode"
        >
          {{ useRecoveryCode ? 'Usar código do autenticador' : 'Usar código de recuperação' }}
        </button>

        <UiButton
          type="submit"
          block
          :loading="loading"
          :disabled="!canSubmitTwoFactorCode"
        >
          Confirmar
        </UiButton>
      </form>

      <UiButton
        v-if="canUseWebAuthn"
        type="button"
        variant="outline"
        block
        :loading="loading"
        @click="submitWebAuthn"
      >
        Usar chave de segurança
      </UiButton>

      <UiButton
        type="button"
        variant="ghost"
        block
        :disabled="loading"
        @click="cancelTwoFactor"
      >
        Voltar
      </UiButton>
    </div>

    <!-- Seletor de contas salvas -->
    <div
      v-else-if="showAccountPicker"
      class="space-y-4"
    >
      <div class="space-y-3">
        <div
          v-for="saved in savedAccounts"
          :key="saved.email"
          class="flex flex-col gap-3 rounded-[var(--radius)] border p-3 text-left transition-colors"
          :class="
            selectedEmail === saved.email && !removing
              ? 'border-[var(--color-ink)] bg-[var(--color-paper-deep)]'
              : 'border-[var(--color-line)] bg-white/70 hover:border-[var(--color-ink)]/40'
          "
        >
          <button
            type="button"
            class="flex w-full flex-row items-center gap-3 text-left disabled:opacity-55"
            :disabled="loading"
            @click="onSelectSavedAccount(saved)"
          >
            <div class="flex w-full flex-row items-center justify-between gap-3">
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <div class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-paper-deep)] text-[var(--color-ink)]">
                  <img
                    v-if="saved.profileImage"
                    :src="saved.profileImage"
                    :alt="saved.name"
                    class="h-full w-full object-cover"
                  >
                  <span
                    v-else
                    class="text-sm font-bold"
                  >{{ initials(saved.name) }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-base font-semibold text-[var(--color-ink)]">
                    {{ saved.name }}
                  </p>
                  <p class="truncate text-xs text-[var(--color-muted)]">
                    {{ saved.email }}
                  </p>
                  <p class="text-xs text-[var(--color-muted)]/80">
                    {{
                      saved.lastLoginAt
                        ? `Último login: ${formatLastLogin(saved.lastLoginAt)}`
                        : 'Nunca logou neste dispositivo'
                    }}
                  </p>
                </div>
              </div>
              <Icon
                :name="removing ? 'solar:trash-bin-minimalistic-bold-duotone' : 'solar:alt-arrow-right-bold-duotone'"
                class="h-5 w-5 shrink-0 text-[var(--color-muted)]"
              />
            </div>
          </button>

          <form
            v-if="selectedEmail === saved.email && !removing"
            class="space-y-3"
            @submit.prevent="onSubmit"
          >
            <UiInput
              :id="`auth-password-${saved.email}`"
              v-model="password"
              label="Senha"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              required
            />
            <component
              :is="slot.component"
              v-for="slot in loginSlots"
              :key="`picker-${slot.id}`"
              v-model="slotTokens[slot.id]"
              :disabled="loading || isLocked"
            />
            <UiButton
              type="submit"
              block
              :loading="loading"
              :disabled="isLocked || !password.trim()"
            >
              Entrar
            </UiButton>
          </form>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <UiButton
          variant="outline"
          block
          :disabled="loading"
          @click="startAddAccount"
        >
          Adicionar nova conta
        </UiButton>
        <UiButton
          variant="outline"
          block
          :disabled="loading || savedAccounts.length === 0"
          @click="toggleRemoving"
        >
          {{ removing ? 'Cancelar remoção' : 'Remover conta' }}
        </UiButton>
      </div>
    </div>

    <!-- Formulário completo -->
    <form
      v-else
      class="space-y-5"
      @submit.prevent="onSubmit"
    >
      <UiInput
        id="auth-identifier"
        v-model="identifier"
        :label="identifierLabel"
        :type="allowUsername ? 'text' : 'email'"
        :autocomplete="allowUsername ? 'username' : 'email'"
        :placeholder="identifierPlaceholder"
        required
      />

      <UiInput
        id="auth-password"
        v-model="password"
        label="Senha"
        type="password"
        autocomplete="current-password"
        placeholder="••••••••"
        required
      />

      <div
        v-if="allowRememberAccount"
        class="flex items-center justify-between gap-3"
      >
        <div>
          <p class="text-sm font-medium text-[var(--color-ink)]">
            Salvar conta
          </p>
          <p class="mt-0.5 text-xs text-[var(--color-muted)]">
            Guarda nome e e-mail neste navegador para trocar de conta rápido.
          </p>
        </div>
        <UiToggle v-model="rememberAccount" />
      </div>

      <component
        :is="slot.component"
        v-for="slot in loginSlots"
        :key="slot.id"
        v-model="slotTokens[slot.id]"
        :disabled="loading || isLocked"
      />

      <UiButton
        type="submit"
        block
        :loading="loading"
        :disabled="isLocked"
      >
        Entrar
      </UiButton>

      <UiButton
        v-if="allowRememberAccount && savedAccounts.length > 0"
        type="button"
        variant="outline"
        block
        :disabled="loading"
        @click="backToPicker"
      >
        Voltar às contas salvas
      </UiButton>
    </form>
  </div>
</template>
