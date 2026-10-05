<script setup lang="ts">
import {
  defaultAvatarTransform,
  type AvatarApplyPayload,
  type AvatarTransform,
} from '../../shared/avatar-transform'
import type { AccountModal } from '../components/AccountEditModals.vue'

definePageMeta({
  middleware: 'auth',
})

const ACCOUNT_MODULE_ID = 'auth.account'
const REGISTER_MODULE_ID = 'auth.register'

const { user, fetchUser, token } = useAuth()
const { sections } = useAccountSections()
const { getValues } = useModuleSettings()
const toast = useToast()

const accountSettings = computed(() => getValues(ACCOUNT_MODULE_ID))
const registerSettings = computed(() => getValues(REGISTER_MODULE_ID))

const showUsernameOnAccount = computed(() => Boolean(registerSettings.value.allowUsernameLater ?? true))
const showNameOnAccount = computed(() => Boolean(registerSettings.value.allowNameLater ?? true))
const showBirthDateOnAccount = computed(() => Boolean(registerSettings.value.allowBirthDateLater ?? true))

const showBirthDate = ref(true)
const hideBirthYear = ref(false)
const passwordAlerts = ref(true)
const birthDateIso = ref<string | null>(null)
const birthDateDisplayRaw = ref<string | null>(null)
const recoveryEmail = ref<string | null>(null)
const avatarUrl = ref<string | null>(null)
const avatarTransform = ref<AvatarTransform>(defaultAvatarTransform())
const avatarModalOpen = ref(false)
const editModal = ref<AccountModal>(null)

const usernameCanChange = ref(true)
const usernameAlreadyChanged = ref(false)
const nextUsernameChangeDate = ref<string | null>(null)
const allowAccountDeletionFlag = ref(true)

const loadingProfile = ref(true)
const privacySaving = ref(false)
const privacyReady = ref(false)

const avatarExtensions = computed(() => {
  const value = accountSettings.value.imageExtensions
  return Array.isArray(value) ? (value as string[]) : ['jpg', 'jpeg', 'png', 'webp']
})

const avatarMaxSizeMb = computed(() => Number(accountSettings.value.imageMaxSizeMb ?? 2))

const allowAccountDeletion = computed(() =>
  allowAccountDeletionFlag.value && Boolean(accountSettings.value.allowAccountDeletion ?? true),
)

const usernameAllowChange = computed(() =>
  usernameCanChange.value && Boolean(accountSettings.value.usernameAllowChange ?? true),
)

const usernameLimitsHint = computed(() => {
  const min = Number(accountSettings.value.usernameMinLength ?? 3)
  const max = Number(accountSettings.value.usernameMaxLength ?? 32)
  return `${min}–${max} caracteres`
})

const usernamePolicyHint = computed(() => {
  if (!usernameAllowChange.value && !usernameAlreadyChanged.value) return 'Alteração desativada'
  const maxChanges = Number(accountSettings.value.usernameMaxChanges ?? 1)
  const days = Number(accountSettings.value.usernameChangeIntervalDays ?? 365)
  const changeLabel = maxChanges === 1 ? '1 alteração' : `${maxChanges} alterações`
  return `${changeLabel} a cada ${days} dias`
})

const birthDateMinAge = computed(() => Number(accountSettings.value.birthDateMinAge ?? 13))

const passwordRulesHint = computed(() => {
  const min = Number(accountSettings.value.passwordMinLength ?? 8)
  const max = Number(accountSettings.value.passwordMaxLength ?? 64)
  const rules: string[] = [`${min}–${max} caracteres`]
  if (accountSettings.value.passwordRequireUppercase) rules.push('maiúscula')
  if (accountSettings.value.passwordRequireLowercase) rules.push('minúscula')
  if (accountSettings.value.passwordRequireNumber) rules.push('número')
  if (accountSettings.value.passwordRequireSpecial) rules.push('caractere especial')
  return rules.join(' · ')
})

const avatarInitials = computed(() => {
  const name = displayName.value
  if (!name || name === '—') return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
})

const avatarActionLabel = computed(() => (avatarUrl.value ? 'Alterar' : 'Adicionar'))
const avatarSaving = ref(false)
const avatarError = ref('')

const username = computed(() => user.value?.username || '—')
const displayName = computed(() => user.value?.name ?? '—')
const primaryEmail = computed(() => user.value?.email ?? '—')

const birthDateDisplay = computed(() => {
  if (!birthDateDisplayRaw.value) return 'Não definida'
  if (!showBirthDate.value) return 'Oculta'
  if (!hideBirthYear.value) return birthDateDisplayRaw.value
  const parts = birthDateDisplayRaw.value.split('/')
  if (parts.length === 3) return `${parts[0]}/${parts[1]}`
  return birthDateDisplayRaw.value
})

const recoveryEmailDisplay = computed(() =>
  recoveryEmail.value || 'Nenhum e-mail de recuperação definido',
)

function authHeaders() {
  return token.value ? { Authorization: `Bearer ${token.value}` } : undefined
}

function extractError(err: unknown, fallback: string) {
  if (
    err
    && typeof err === 'object'
    && 'data' in err
    && err.data
    && typeof err.data === 'object'
    && 'message' in err.data
    && typeof err.data.message === 'string'
  ) {
    return err.data.message
  }
  return fallback
}

function openAvatarModal() {
  avatarModalOpen.value = true
  avatarError.value = ''
}

function openEdit(modal: AccountModal) {
  editModal.value = modal
}

async function onAvatarApply(payload: AvatarApplyPayload) {
  avatarError.value = ''
  avatarSaving.value = true
  try {
    const result = await $fetch<{
      avatarUrl: string
      avatarTransform: AvatarTransform
    }>('/api/account/avatar', {
      method: 'POST',
      headers: authHeaders(),
      body: {
        dataUrl: payload.dataUrl,
        transform: payload.transform,
      },
    })
    avatarUrl.value = result.avatarUrl
    avatarTransform.value = result.avatarTransform
  }
  catch (error: unknown) {
    avatarError.value = extractError(error, 'Não foi possível salvar a imagem.')
    avatarTransform.value = payload.transform
    if (payload.dataUrl) avatarUrl.value = payload.dataUrl
  }
  finally {
    avatarSaving.value = false
  }
}

type ProfileResponse = {
  user: {
    birthDate: string | null
    birthDateDisplay: string | null
  }
  profile: {
    recoveryEmail: string | null
    showBirthDate: boolean
    hideBirthYear: boolean
    passwordAlerts: boolean
    avatarUrl: string | null
    avatarTransform: AvatarTransform
  }
  usernameStatus: {
    allowChange: boolean
    canChange: boolean
    alreadyChanged: boolean
    nextChangeDate: string | null
  }
  settings: {
    allowAccountDeletion: boolean
  }
}

function applyProfile(data: ProfileResponse) {
  birthDateIso.value = data.user.birthDate
  birthDateDisplayRaw.value = data.user.birthDateDisplay
  recoveryEmail.value = data.profile.recoveryEmail
  showBirthDate.value = data.profile.showBirthDate
  hideBirthYear.value = data.profile.hideBirthYear
  passwordAlerts.value = data.profile.passwordAlerts
  avatarUrl.value = data.profile.avatarUrl
  avatarTransform.value = data.profile.avatarTransform ?? defaultAvatarTransform()
  usernameCanChange.value = data.usernameStatus.canChange && data.usernameStatus.allowChange
  usernameAlreadyChanged.value = data.usernameStatus.alreadyChanged
  nextUsernameChangeDate.value = data.usernameStatus.nextChangeDate
  allowAccountDeletionFlag.value = data.settings.allowAccountDeletion
}

async function loadProfile() {
  if (!token.value) return
  loadingProfile.value = true
  privacyReady.value = false
  try {
    const data = await $fetch<ProfileResponse>('/api/account/profile', {
      headers: authHeaders(),
    })
    applyProfile(data)
  }
  catch {
    // perfil ainda inexistente / falha silenciosa
  }
  finally {
    loadingProfile.value = false
    await nextTick()
    privacyReady.value = true
  }
}

async function patchPrivacy(payload: {
  showBirthDate?: boolean
  hideBirthYear?: boolean
  passwordAlerts?: boolean
}) {
  if (!token.value || privacySaving.value || !privacyReady.value) return
  privacySaving.value = true
  try {
    const data = await $fetch<ProfileResponse>('/api/account/profile', {
      method: 'PATCH',
      headers: authHeaders(),
      body: payload,
    })
    applyProfile(data)
  }
  catch (error: unknown) {
    toast.error('Falha ao salvar', extractError(error, 'Não foi possível salvar a preferência.'))
    await loadProfile()
  }
  finally {
    privacySaving.value = false
  }
}

watch(showBirthDate, (value, previous) => {
  if (!privacyReady.value || value === previous) return
  void patchPrivacy({ showBirthDate: value })
})

watch(hideBirthYear, (value, previous) => {
  if (!privacyReady.value || value === previous) return
  void patchPrivacy({ hideBirthYear: value })
})

watch(passwordAlerts, (value, previous) => {
  if (!privacyReady.value || value === previous) return
  void patchPrivacy({ passwordAlerts: value })
})

onMounted(async () => {
  if (!user.value) await fetchUser()
  await loadProfile()
})
</script>

<template>
  <div class="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
    <div class="w-full max-w-[700px] space-y-10">
      <header>
        <h1 class="font-display text-2xl font-extrabold text-[var(--color-ink)] sm:text-3xl">
          Conta e senha
        </h1>
      </header>

      <section class="space-y-3">
        <div>
          <h2 class="text-xl font-semibold text-[var(--color-ink)]">
            Perfil de usuário
          </h2>
          <p class="mt-1 text-sm text-[var(--color-muted)]">
            Seu perfil e as alterações feitas nele ficarão visíveis para outros usuários do sistema.
          </p>
        </div>

        <div class="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white">
          <div class="flex items-center gap-3 px-4 py-4">
            <AccountAvatar
              :src="avatarUrl"
              :transform="avatarTransform"
              :initials="avatarInitials"
              :size="56"
              alt="Imagem da conta"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-[var(--color-ink)]">
                Imagem da conta
              </p>
              <p class="mt-0.5 text-sm text-[var(--color-muted)]">
                {{ avatarUrl ? 'Foto atual do perfil.' : 'Nenhuma imagem definida.' }}
              </p>
            </div>
            <UiButton
              variant="outline"
              type="button"
              :disabled="avatarSaving"
              @click="openAvatarModal"
            >
              {{ avatarSaving ? 'Salvando…' : avatarActionLabel }}
            </UiButton>
          </div>
          <p
            v-if="avatarError"
            class="border-t border-[var(--color-line)] px-4 py-2 text-xs text-[var(--color-accent)]"
          >
            {{ avatarError }}
          </p>

          <template v-if="showUsernameOnAccount">
            <div class="border-t border-[var(--color-line)]" />

            <div class="px-4 py-4">
              <div class="flex items-center gap-3">
                <Icon
                  name="i-solar:user-bold-duotone"
                  class="shrink-0 text-xl text-[var(--color-muted)]"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-[var(--color-ink)]">
                    Nome de usuário
                  </p>
                  <p class="truncate text-sm text-[var(--color-muted)]">
                    {{ username }}
                  </p>
                  <p class="mt-0.5 text-xs text-[var(--color-muted)]">
                    {{ usernameLimitsHint }} · {{ usernamePolicyHint }}
                  </p>
                </div>
                <UiButton
                  v-if="usernameAllowChange || usernameAlreadyChanged"
                  variant="outline"
                  type="button"
                  :disabled="!usernameAllowChange"
                  @click="openEdit('username')"
                >
                  Alterar
                </UiButton>
              </div>

              <div
                v-if="usernameAlreadyChanged && nextUsernameChangeDate"
                class="mt-3 ml-8 flex flex-col items-start gap-1 rounded-lg border border-amber-500/25 bg-amber-50 px-3 py-2.5 md:flex-row md:items-center md:gap-3"
              >
                <Icon
                  name="i-solar:danger-triangle-bold-duotone"
                  class="shrink-0 text-3xl text-amber-600"
                />
                <div class="text-sm text-amber-900/80">
                  <p>Você já alterou o nome de usuário recentemente.</p>
                  <small>
                    A próxima alteração será permitida em
                    <strong>{{ nextUsernameChangeDate }}</strong>.
                  </small>
                </div>
              </div>
            </div>
          </template>

          <template v-if="showNameOnAccount">
            <div class="border-t border-[var(--color-line)]" />

            <div class="flex items-center gap-3 px-4 py-4">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-[var(--color-ink)]">
                  Nome de exibição
                </p>
                <p class="truncate text-sm text-[var(--color-muted)]">
                  {{ displayName }}
                </p>
              </div>
              <UiButton
                variant="outline"
                type="button"
                @click="openEdit('name')"
              >
                Alterar
              </UiButton>
            </div>
          </template>

          <template v-if="showBirthDateOnAccount">
            <div class="border-t border-[var(--color-line)]" />

            <div class="px-4 py-4">
              <div class="flex items-center gap-3">
                <Icon
                  name="i-solar:calendar-bold-duotone"
                  class="shrink-0 text-xl text-[var(--color-muted)]"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-[var(--color-ink)]">
                    Data de nascimento
                  </p>
                  <p class="truncate text-sm text-[var(--color-muted)]">
                    {{ birthDateDisplay }}
                  </p>
                  <p class="mt-0.5 text-xs text-[var(--color-muted)]">
                    Idade mínima: {{ birthDateMinAge }} anos
                  </p>
                </div>
                <UiButton
                  variant="outline"
                  type="button"
                  @click="openEdit('birthDate')"
                >
                  Alterar
                </UiButton>
              </div>

              <div class="mt-4 ml-8 space-y-3 border-l border-[var(--color-line)] pl-4">
                <div class="flex items-start gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-[var(--color-ink)]">
                      Exibir data
                    </p>
                    <p class="mt-0.5 text-sm text-[var(--color-muted)]">
                      Permite que outros usuários vejam sua data de nascimento no perfil.
                    </p>
                  </div>
                  <UiToggle
                    v-model="showBirthDate"
                    :disabled="privacySaving"
                  />
                </div>

                <div class="flex items-start gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-[var(--color-ink)]">
                      Ocultar ano de nascimento
                    </p>
                    <p class="mt-0.5 text-sm text-[var(--color-muted)]">
                      Mostra apenas dia e mês, sem revelar o ano.
                    </p>
                  </div>
                  <UiToggle
                    v-model="hideBirthYear"
                    :disabled="!showBirthDate || privacySaving"
                  />
                </div>
              </div>
            </div>
          </template>
        </div>
      </section>

      <section class="space-y-3">
        <div>
          <h2 class="text-xl font-semibold text-[var(--color-ink)]">
            E-mails
          </h2>
          <p class="mt-1 text-sm text-[var(--color-muted)]">
            Gerencie o e-mail principal da conta e um endereço de recuperação.
          </p>
        </div>

        <div class="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white">
          <div class="flex items-center gap-3 px-4 py-4">
            <Icon
              name="i-solar:letter-bold-duotone"
              class="shrink-0 text-xl text-[var(--color-muted)]"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-[var(--color-ink)]">
                E-mail atual
              </p>
              <p class="truncate text-sm text-[var(--color-muted)]">
                {{ primaryEmail }}
              </p>
            </div>
            <UiButton
              variant="outline"
              type="button"
              @click="openEdit('email')"
            >
              Alterar
            </UiButton>
          </div>

          <div class="border-t border-[var(--color-line)]" />

          <div class="flex items-center gap-3 px-4 py-4">
            <Icon
              name="i-solar:mailbox-bold-duotone"
              class="shrink-0 text-xl text-[var(--color-muted)]"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-[var(--color-ink)]">
                E-mail de recuperação
              </p>
              <p class="truncate text-sm text-[var(--color-muted)]">
                {{ recoveryEmailDisplay }}
              </p>
            </div>
            <UiButton
              variant="outline"
              type="button"
              @click="openEdit('recoveryEmail')"
            >
              {{ recoveryEmail ? 'Alterar' : 'Definir' }}
            </UiButton>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div>
          <h2 class="text-xl font-semibold text-[var(--color-ink)]">
            Senha
          </h2>
          <p class="mt-1 text-sm text-[var(--color-muted)]">
            Escolha uma senha forte e não a reutilize em outras contas.
          </p>
        </div>

        <div class="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white">
          <div class="flex items-center gap-3 px-4 py-4">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-[var(--color-ink)]">
                Senha
              </p>
              <p class="text-sm tracking-widest text-[var(--color-muted)]">
                ••••••••
              </p>
              <p class="mt-0.5 text-xs text-[var(--color-muted)]">
                {{ passwordRulesHint }}
              </p>
            </div>
            <UiButton
              variant="outline"
              type="button"
              @click="openEdit('password')"
            >
              Alterar
            </UiButton>
          </div>

          <div class="border-t border-[var(--color-line)]" />

          <div class="flex items-start gap-3 px-4 py-4">
            <Icon
              name="i-solar:bell-bold-duotone"
              class="mt-0.5 shrink-0 text-xl text-[var(--color-muted)]"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-[var(--color-ink)]">
                Verificações de senha
              </p>
              <p class="mt-0.5 text-sm text-[var(--color-muted)]">
                Receba alertas quando a senha for usada em um dispositivo novo ou incomum.
              </p>
            </div>
            <UiToggle
              v-model="passwordAlerts"
              :disabled="privacySaving"
            />
          </div>
        </div>
      </section>

      <component
        :is="section.component"
        v-for="section in sections"
        :key="section.id"
      />

      <section
        v-if="allowAccountDeletion"
        class="space-y-3 pb-8"
      >
        <div>
          <h2 class="text-xl font-semibold text-[var(--color-ink)]">
            Excluir conta
          </h2>
          <p class="mt-1 text-sm text-[var(--color-muted)]">
            Esta ação é permanente. Todos os dados associados à sua conta serão removidos e não poderão ser
            recuperados.
          </p>
        </div>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-[var(--radius)] border border-red-500/40 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          @click="openEdit('delete')"
        >
          <Icon
            name="i-solar:trash-bin-trash-bold-duotone"
            class="text-lg"
          />
          Excluir sua conta
        </button>
      </section>
    </div>
  </div>

  <AccountAvatarCropModal
    v-model="avatarModalOpen"
    :current-url="avatarUrl"
    :current-transform="avatarTransform"
    :accept-extensions="avatarExtensions"
    :max-size-mb="avatarMaxSizeMb"
    @apply="onAvatarApply"
  />

  <AccountEditModals
    v-model="editModal"
    :username="user?.username"
    :name="user?.name"
    :birth-date="birthDateIso"
    :email="user?.email"
    :recovery-email="recoveryEmail"
    :birth-date-min-age="birthDateMinAge"
    :can-change-username="usernameAllowChange"
    :username-hint="`${usernameLimitsHint} · ${usernamePolicyHint}`"
    @saved="loadProfile"
  />
</template>
