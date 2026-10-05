<script setup lang="ts">
import {
  isPasswordRulesMet,
  policyFromAccountSettings,
} from '../../../../../shared/password-policy'
import {
  sanitizeUsernameInput,
  USERNAME_MAX,
} from '../../../../../shared/username-policy'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

const REGISTER_MODULE_ID = 'auth.register'
const ACCOUNT_MODULE_ID = 'auth.account'

const route = useRoute()
const config = useRuntimeConfig()
const { getValues } = useModuleSettings()

const token = computed(() => String(route.query.token ?? ''))

const registerSettings = computed(() => getValues(REGISTER_MODULE_ID))
const accountSettings = computed(() => getValues(ACCOUNT_MODULE_ID))

const showName = computed(() =>
  Boolean(registerSettings.value.requireName) || !Boolean(registerSettings.value.allowNameLater ?? true),
)
const nameRequired = computed(() =>
  Boolean(registerSettings.value.requireName) || !Boolean(registerSettings.value.allowNameLater ?? true),
)

const showUsername = computed(() =>
  Boolean(registerSettings.value.requireUsername) || !Boolean(registerSettings.value.allowUsernameLater ?? true),
)
const usernameRequired = computed(() =>
  Boolean(registerSettings.value.requireUsername) || !Boolean(registerSettings.value.allowUsernameLater ?? true),
)

const showBirthDate = computed(() =>
  Boolean(registerSettings.value.requireBirthDate) || !Boolean(registerSettings.value.allowBirthDateLater ?? true),
)
const birthDateRequired = computed(() =>
  Boolean(registerSettings.value.requireBirthDate) || !Boolean(registerSettings.value.allowBirthDateLater ?? true),
)

const birthDateMinAge = computed(() => Number(accountSettings.value.birthDateMinAge ?? 13))

const name = ref('')
const username = ref('')
const birthDate = ref('')
const password = ref('')
const passwordConfirm = ref('')
const email = ref('')
const nameAlreadySet = ref(false)
const error = ref('')
const loading = ref(false)
const bootError = ref('')

const usernameStatus = ref<{ valid: boolean, checking: boolean, available: boolean | null }>({
  valid: false,
  checking: false,
  available: null,
})

watch(username, (value) => {
  const next = sanitizeUsernameInput(value)
  if (next !== value) username.value = next
})

const { setSession } = useAuth()

const askNameNow = computed(() => showName.value && !nameAlreadySet.value)

const { data: pending, error: pendingError } = await useAsyncData(
  () => `register-pending-${token.value || 'missing'}`,
  async () => {
    if (!token.value) {
      throw new Error('Token ausente.')
    }
    return $fetch<{ email: string, name: string }>(`/api/auth/register/pending/${token.value}`)
  },
)

if (pending.value) {
  email.value = pending.value.email
  if (pending.value.name) {
    name.value = pending.value.name
    nameAlreadySet.value = true
  }
}

if (pendingError.value) {
  bootError.value = 'Link expirado ou inválido. Reinicie o cadastro.'
}

function ageFromBirthDate(value: string) {
  const raw = value.trim()
  let day = 0
  let month = 0
  let year = 0

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (iso) {
    year = Number(iso[1])
    month = Number(iso[2])
    day = Number(iso[3])
  }
  else {
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw)
    if (!br) return null
    day = Number(br[1])
    month = Number(br[2])
    year = Number(br[3])
  }

  const birth = new Date(year, month - 1, day)
  if (
    birth.getFullYear() !== year
    || birth.getMonth() !== month - 1
    || birth.getDate() !== day
  ) {
    return null
  }

  const today = new Date()
  let age = today.getFullYear() - year
  const beforeBirthday =
    today.getMonth() < month - 1
    || (today.getMonth() === month - 1 && today.getDate() < day)
  if (beforeBirthday) age -= 1
  return age
}

async function onSubmit() {
  error.value = ''

  if (askNameNow.value && nameRequired.value && !name.value.trim()) {
    error.value = 'Informe o nome.'
    return
  }

  if (showUsername.value && usernameRequired.value) {
    if (usernameStatus.value.checking) {
      error.value = 'Aguarde a verificação do nome de usuário.'
      return
    }
    if (!usernameStatus.value.valid) {
      error.value = 'Informe um nome de usuário válido e disponível.'
      return
    }
  }
  else if (showUsername.value && username.value.trim()) {
    if (usernameStatus.value.checking) {
      error.value = 'Aguarde a verificação do nome de usuário.'
      return
    }
    if (!usernameStatus.value.valid) {
      error.value = 'Informe um nome de usuário válido e disponível.'
      return
    }
  }

  if (showBirthDate.value && birthDateRequired.value) {
    const age = ageFromBirthDate(birthDate.value)
    if (age === null) {
      error.value = 'Informe uma data de nascimento válida.'
      return
    }
    if (age < birthDateMinAge.value) {
      error.value = `Idade mínima: ${birthDateMinAge.value} anos.`
      return
    }
  }

  if (!password.value) {
    error.value = 'Informe a senha.'
    return
  }

  if (!isPasswordRulesMet({
    password: password.value,
    policy: policyFromAccountSettings(accountSettings.value),
  })) {
    error.value = 'Atenda a todas as regras de senha antes de continuar.'
    return
  }

  if (password.value !== passwordConfirm.value) {
    error.value = 'A confirmação de senha não confere.'
    return
  }

  loading.value = true
  try {
    const data = await $fetch<{
      token: string
      user: { id: string, email: string, name: string, username?: string | null }
    }>('/api/auth/register/complete', {
      method: 'POST',
      body: {
        token: token.value,
        name: name.value.trim(),
        username: username.value.trim(),
        birthDate: birthDate.value.trim(),
        password: password.value,
      },
    })
    setSession(data)
    await navigateTo(config.public.auth.homePath)
  }
  catch (err: unknown) {
    const message =
      err
      && typeof err === 'object'
      && 'data' in err
      && err.data
      && typeof err.data === 'object'
      && 'message' in err.data
      && typeof err.data.message === 'string'
        ? err.data.message
        : 'Não foi possível concluir o cadastro.'
    error.value = message
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div
      v-if="bootError"
      class="space-y-4"
    >
      <p class="rounded-[var(--radius)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-sm text-[var(--color-accent)]">
        {{ bootError }}
      </p>
      <NuxtLink
        to="/register"
        class="text-sm text-[var(--color-accent)] underline underline-offset-2"
      >
        Voltar ao cadastro
      </NuxtLink>
    </div>

    <template v-else>
      <div class="space-y-1">
        <p class="text-sm text-[var(--color-muted)]">
          Etapa 2 de 2 — complete seus dados para
          <span class="font-medium text-[var(--color-ink)]">{{ email }}</span>
        </p>
      </div>

      <form
        class="space-y-5"
        @submit.prevent="onSubmit"
      >
        <UiInput
          v-if="askNameNow"
          id="register-continue-name"
          v-model="name"
          label="Nome"
          type="text"
          autocomplete="name"
          placeholder="Seu nome"
          :required="nameRequired"
        />

        <UiInput
          v-if="showUsername"
          id="register-continue-username"
          v-model="username"
          label="Nome de usuário"
          type="text"
          autocomplete="username"
          placeholder="ex.: maria.silva"
          :maxlength="USERNAME_MAX"
          :required="usernameRequired"
        >
          <template #trailing>
            <UsernameRules
              :username="username"
              @status="usernameStatus = $event"
            />
          </template>
        </UiInput>

        <UiInput
          v-if="showBirthDate"
          id="register-continue-birthdate"
          v-model="birthDate"
          label="Data de nascimento"
          type="date"
          autocomplete="bday"
          :max="new Date().toISOString().slice(0, 10)"
          :required="birthDateRequired"
        />

        <UiInput
          id="register-continue-password"
          v-model="password"
          label="Senha"
          type="password"
          autocomplete="new-password"
          placeholder="••••••••"
          required
        >
          <template #trailing>
            <PasswordRules :password="password" />
          </template>
        </UiInput>

        <UiInput
          id="register-continue-password-confirm"
          v-model="passwordConfirm"
          label="Confirmar senha"
          type="password"
          autocomplete="new-password"
          placeholder="••••••••"
          required
        >
          <template #trailing>
            <PasswordConfirmStatus
              :password="password"
              :confirm-password="passwordConfirm"
            />
          </template>
        </UiInput>

        <p
          v-if="error"
          class="rounded-[var(--radius)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-sm text-[var(--color-accent)]"
          role="alert"
        >
          {{ error }}
        </p>

        <UiButton
          type="submit"
          block
          :loading="loading"
        >
          Concluir cadastro
        </UiButton>
      </form>
    </template>
  </div>
</template>
