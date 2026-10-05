<script setup lang="ts">
import {
  isPasswordRulesMet,
  policyFromAccountSettings,
} from '../../../../../shared/password-policy'
import {
  sanitizeUsernameInput,
  USERNAME_MAX,
} from '../../../../../shared/username-policy'

const REGISTER_MODULE_ID = 'auth.register'
const ACCOUNT_MODULE_ID = 'auth.account'

const emit = defineEmits<{
  success: []
}>()

const { getValues } = useModuleSettings()
const toast = useToast()

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

const enableEmailRegistration = computed(() =>
  Boolean(registerSettings.value.enableEmailRegistration ?? true),
)

const requireEmailConfirmation = computed(() =>
  enableEmailRegistration.value
  && Boolean(registerSettings.value.requireEmailConfirmation),
)

const birthDateMinAge = computed(() => Number(accountSettings.value.birthDateMinAge ?? 13))

type Phase = 'step1' | 'step2' | 'check-email'

const phase = ref<Phase>('step1')
const name = ref('')
const username = ref('')
const birthDate = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)
const sentEmail = ref('')
const demoContinueUrl = ref('')

const usernameStatus = ref<{ valid: boolean, checking: boolean, available: boolean | null }>({
  valid: false,
  checking: false,
  available: null,
})

watch(username, (value) => {
  const next = sanitizeUsernameInput(value)
  if (next !== value) username.value = next
})
const demoContinuePath = computed(() => {
  if (!demoContinueUrl.value) return ''
  try {
    return new URL(demoContinueUrl.value).pathname + new URL(demoContinueUrl.value).search
  }
  catch {
    return demoContinueUrl.value
  }
})

const { setSession } = useAuth()

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

function validateStep1() {
  if (showName.value && nameRequired.value && !name.value.trim()) {
    return 'Informe o nome.'
  }
  if (enableEmailRegistration.value && (!email.value.trim() || !email.value.includes('@'))) {
    return 'Informe um e-mail válido.'
  }
  return ''
}

function validateStep2() {
  if (showUsername.value && usernameRequired.value) {
    if (usernameStatus.value.checking) {
      return 'Aguarde a verificação do nome de usuário.'
    }
    if (!usernameStatus.value.valid) {
      return 'Informe um nome de usuário válido e disponível.'
    }
  }
  else if (showUsername.value && username.value.trim()) {
    if (usernameStatus.value.checking) {
      return 'Aguarde a verificação do nome de usuário.'
    }
    if (!usernameStatus.value.valid) {
      return 'Informe um nome de usuário válido e disponível.'
    }
  }

  if (showBirthDate.value && birthDateRequired.value) {
    const age = ageFromBirthDate(birthDate.value)
    if (age === null) {
      return 'Informe uma data de nascimento válida.'
    }
    if (age < birthDateMinAge.value) {
      return `Idade mínima: ${birthDateMinAge.value} anos.`
    }
  }

  if (!password.value) {
    return 'Informe a senha.'
  }

  if (!isPasswordRulesMet({
    password: password.value,
    policy: policyFromAccountSettings(accountSettings.value),
  })) {
    return 'Atenda a todas as regras de senha antes de continuar.'
  }

  if (password.value !== passwordConfirm.value) {
    return 'A confirmação de senha não confere.'
  }

  return ''
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

async function startEmailConfirmation() {
  loading.value = true
  try {
    const data = await $fetch<{
      message: string
      email: string
      continueUrl: string
    }>('/api/auth/register/start', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        name: name.value.trim(),
      },
    })

    sentEmail.value = data.email
    demoContinueUrl.value = data.continueUrl
    phase.value = 'check-email'
  }
  catch (err: unknown) {
    toast.error('Falha no cadastro', extractError(err, 'Não foi possível enviar o e-mail de confirmação.'))
  }
  finally {
    loading.value = false
  }
}

async function completeRegistration() {
  loading.value = true
  try {
    const data = await $fetch<{
      token: string
      user: { id: string, email: string, name: string, username?: string | null }
    }>('/api/auth/register', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        password: password.value,
        name: name.value.trim(),
        username: username.value.trim(),
        birthDate: birthDate.value.trim(),
      },
    })
    setSession(data)
    emit('success')
  }
  catch (err: unknown) {
    toast.error('Falha no cadastro', extractError(err, 'Não foi possível criar a conta.'))
  }
  finally {
    loading.value = false
  }
}

async function onStep1Submit() {
  const validationError = validateStep1()
  if (validationError) {
    toast.error('Campos incompletos', validationError)
    return
  }

  if (requireEmailConfirmation.value) {
    await startEmailConfirmation()
    return
  }

  phase.value = 'step2'
}

async function onStep2Submit() {
  const validationError = validateStep2()
  if (validationError) {
    toast.error('Campos incompletos', validationError)
    return
  }

  await completeRegistration()
}

function goBackToStep1() {
  phase.value = 'step1'
  password.value = ''
  passwordConfirm.value = ''
}

function restart() {
  phase.value = 'step1'
  demoContinueUrl.value = ''
  sentEmail.value = ''
}
</script>

<template>
  <div class="space-y-5">
    <template v-if="phase === 'check-email'">
      <div class="space-y-3 rounded-[var(--radius)] border border-[var(--color-line)] bg-white/70 px-4 py-5">
        <Icon
          name="i-solar:letter-bold-duotone"
          class="text-3xl text-[var(--color-accent)]"
        />
        <h3 class="text-lg font-semibold text-[var(--color-ink)]">
          Confirme seu e-mail
        </h3>
        <p class="text-sm text-[var(--color-muted)]">
          Enviamos um link para
          <span class="font-medium text-[var(--color-ink)]">{{ sentEmail }}</span>
          para continuar o cadastro.
        </p>
        <p
          v-if="demoContinuePath"
          class="rounded-md border border-dashed border-[var(--color-line)] bg-[#F8F8F6] px-3 py-2 text-xs text-[var(--color-muted)]"
        >
          Demo (sem SMTP real):
          <NuxtLink
            :to="demoContinuePath"
            class="break-all text-[var(--color-accent)] underline underline-offset-2"
          >
            abrir link de continuação
          </NuxtLink>
        </p>
      </div>

      <UiButton
        variant="ghost"
        type="button"
        block
        @click="restart"
      >
        Usar outro e-mail
      </UiButton>
    </template>

    <form
      v-else-if="phase === 'step1'"
      class="space-y-5"
      @submit.prevent="onStep1Submit"
    >
      <p class="text-sm text-[var(--color-muted)]">
        Etapa 1 de 2 — seus dados básicos
      </p>

      <UiInput
        v-if="showName"
        id="register-name"
        v-model="name"
        label="Nome"
        type="text"
        autocomplete="name"
        placeholder="Seu nome"
        :required="nameRequired"
      />

      <UiInput
        v-if="enableEmailRegistration"
        id="register-email"
        v-model="email"
        label="E-mail"
        type="email"
        autocomplete="email"
        placeholder="voce@empresa.com"
        required
      />

      <UiButton
        type="submit"
        block
        :loading="loading"
      >
        {{ requireEmailConfirmation ? 'Enviar confirmação' : 'Continuar' }}
      </UiButton>
    </form>

    <form
      v-else
      class="space-y-5"
      @submit.prevent="onStep2Submit"
    >
      <p class="text-sm text-[var(--color-muted)]">
        Etapa 2 de 2 — usuário, nascimento e senha
      </p>

      <UiInput
        v-if="showUsername"
        id="register-username"
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
        id="register-birthdate"
        v-model="birthDate"
        label="Data de nascimento"
        type="date"
        autocomplete="bday"
        :max="new Date().toISOString().slice(0, 10)"
        :required="birthDateRequired"
      />

      <UiInput
        id="register-password"
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
        id="register-password-confirm"
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

      <div class="flex flex-col gap-2 sm:flex-row">
        <UiButton
          type="button"
          variant="outline"
          block
          :disabled="loading"
          @click="goBackToStep1"
        >
          Voltar
        </UiButton>
        <UiButton
          type="submit"
          block
          :loading="loading"
        >
          Criar conta
        </UiButton>
      </div>
    </form>
  </div>
</template>
