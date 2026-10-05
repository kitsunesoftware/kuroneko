<script setup lang="ts">
import { sanitizeUsernameInput } from '../../../../shared/username-policy'

export type AccountModal =
  | 'username'
  | 'name'
  | 'birthDate'
  | 'email'
  | 'recoveryEmail'
  | 'password'
  | 'delete'
  | null

const open = defineModel<AccountModal>({ default: null })

const props = defineProps<{
  username?: string | null
  name?: string | null
  birthDate?: string | null
  email?: string | null
  recoveryEmail?: string | null
  birthDateMinAge?: number
  canChangeUsername?: boolean
  usernameHint?: string
}>()

const emit = defineEmits<{
  saved: []
}>()

const { token, fetchUser, logout } = useAuth()
const toast = useToast()

const saving = ref(false)
const error = ref('')

const usernameDraft = ref('')
const usernameValid = ref(false)
const nameDraft = ref('')
const birthDateDraft = ref('')
const emailDraft = ref('')
const recoveryDraft = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const deleteConfirm = ref('')

const title = computed(() => {
  switch (open.value) {
    case 'username': return 'Alterar nome de usuário'
    case 'name': return 'Alterar nome de exibição'
    case 'birthDate': return 'Alterar data de nascimento'
    case 'email': return 'Alterar e-mail'
    case 'recoveryEmail': return 'E-mail de recuperação'
    case 'password': return 'Alterar senha'
    case 'delete': return 'Excluir conta'
    default: return ''
  }
})

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

function resetDrafts() {
  error.value = ''
  saving.value = false
  usernameDraft.value = props.username ?? ''
  usernameValid.value = false
  nameDraft.value = props.name ?? ''
  birthDateDraft.value = props.birthDate ?? ''
  emailDraft.value = props.email ?? ''
  recoveryDraft.value = props.recoveryEmail ?? ''
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  deleteConfirm.value = ''
}

watch(open, (value) => {
  if (value) resetDrafts()
})

function onUsernameInput(value: string) {
  usernameDraft.value = sanitizeUsernameInput(value)
}

function onUsernameStatus(payload: { valid: boolean }) {
  usernameValid.value = payload.valid
}

async function submit() {
  if (!open.value || saving.value) return
  error.value = ''
  saving.value = true

  try {
    switch (open.value) {
      case 'username': {
        if (!props.canChangeUsername) {
          throw Object.assign(new Error(), { data: { message: 'Alteração indisponível no momento.' } })
        }
        if (!usernameValid.value) {
          throw Object.assign(new Error(), { data: { message: 'Informe um nome de usuário válido e disponível.' } })
        }
        await $fetch('/api/account/username', {
          method: 'POST',
          headers: authHeaders(),
          body: { username: usernameDraft.value },
        })
        toast.success('Nome de usuário atualizado', 'Sua conta foi atualizada.')
        break
      }
      case 'name': {
        await $fetch('/api/account/profile', {
          method: 'PATCH',
          headers: authHeaders(),
          body: { name: nameDraft.value },
        })
        toast.success('Nome atualizado', 'Seu nome de exibição foi salvo.')
        break
      }
      case 'birthDate': {
        await $fetch('/api/account/profile', {
          method: 'PATCH',
          headers: authHeaders(),
          body: { birthDate: birthDateDraft.value || null },
        })
        toast.success('Data atualizada', 'Sua data de nascimento foi salva.')
        break
      }
      case 'email': {
        await $fetch('/api/account/email', {
          method: 'POST',
          headers: authHeaders(),
          body: {
            email: emailDraft.value,
            currentPassword: currentPassword.value,
          },
        })
        toast.success('E-mail atualizado', 'O e-mail principal da conta foi alterado.')
        break
      }
      case 'recoveryEmail': {
        await $fetch('/api/account/profile', {
          method: 'PATCH',
          headers: authHeaders(),
          body: { recoveryEmail: recoveryDraft.value || null },
        })
        toast.success(
          recoveryDraft.value ? 'Recuperação salva' : 'Recuperação removida',
          recoveryDraft.value
            ? 'O e-mail de recuperação foi definido.'
            : 'O e-mail de recuperação foi removido.',
        )
        break
      }
      case 'password': {
        await $fetch('/api/account/password', {
          method: 'POST',
          headers: authHeaders(),
          body: {
            currentPassword: currentPassword.value,
            newPassword: newPassword.value,
            confirmPassword: confirmPassword.value,
          },
        })
        toast.success('Senha alterada', 'Use a nova senha no próximo login.')
        break
      }
      case 'delete': {
        await $fetch('/api/account', {
          method: 'DELETE',
          headers: authHeaders(),
          body: {
            currentPassword: currentPassword.value,
            confirmText: deleteConfirm.value,
          },
        })
        toast.success('Conta excluída', 'Sua conta foi removida permanentemente.')
        open.value = null
        await logout()
        return
      }
    }

    await fetchUser()
    emit('saved')
    open.value = null
  }
  catch (err: unknown) {
    error.value = extractError(err, 'Não foi possível salvar as alterações.')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UiModal
    :model-value="Boolean(open)"
    :title="title"
    @update:model-value="(value) => { if (!value) open = null }"
  >
    <div class="space-y-4">
      <p
        v-if="error"
        class="rounded-[var(--radius)] border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {{ error }}
      </p>

      <template v-if="open === 'username'">
        <p class="text-sm text-[var(--color-muted)]">
          {{ usernameHint || 'Escolha um nome único. Alterações podem ser limitadas pela política da conta.' }}
        </p>
        <UiInput
          id="account-username"
          :model-value="usernameDraft"
          label="Nome de usuário"
          autocomplete="username"
          :disabled="saving || !canChangeUsername"
          @update:model-value="onUsernameInput"
        >
          <template #trailing>
            <UsernameRules
              :username="usernameDraft"
              @status="onUsernameStatus"
            />
          </template>
        </UiInput>
      </template>

      <template v-else-if="open === 'name'">
        <UiInput
          id="account-name"
          v-model="nameDraft"
          label="Nome de exibição"
          autocomplete="name"
          :disabled="saving"
          maxlength="80"
        />
      </template>

      <template v-else-if="open === 'birthDate'">
        <UiInput
          id="account-birth"
          v-model="birthDateDraft"
          label="Data de nascimento"
          type="date"
          :disabled="saving"
          :hint="`Idade mínima: ${birthDateMinAge ?? 13} anos`"
        />
      </template>

      <template v-else-if="open === 'email'">
        <UiInput
          id="account-email"
          v-model="emailDraft"
          label="Novo e-mail"
          type="email"
          autocomplete="email"
          :disabled="saving"
        />
        <UiInput
          id="account-email-password"
          v-model="currentPassword"
          label="Senha atual"
          type="password"
          autocomplete="current-password"
          :disabled="saving"
        />
      </template>

      <template v-else-if="open === 'recoveryEmail'">
        <p class="text-sm text-[var(--color-muted)]">
          Usado para recuperar o acesso se você perder o e-mail principal. Deixe em branco para remover.
        </p>
        <UiInput
          id="account-recovery"
          v-model="recoveryDraft"
          label="E-mail de recuperação"
          type="email"
          autocomplete="email"
          :disabled="saving"
        />
      </template>

      <template v-else-if="open === 'password'">
        <UiInput
          id="account-password-current"
          v-model="currentPassword"
          label="Senha atual"
          type="password"
          autocomplete="current-password"
          :disabled="saving"
        />
        <UiInput
          id="account-password-new"
          v-model="newPassword"
          label="Nova senha"
          type="password"
          autocomplete="new-password"
          :disabled="saving"
        >
          <template #trailing>
            <PasswordRules
              :password="newPassword"
              :confirm-password="confirmPassword"
              show-confirm
            />
          </template>
        </UiInput>
        <UiInput
          id="account-password-confirm"
          v-model="confirmPassword"
          label="Confirmar nova senha"
          type="password"
          autocomplete="new-password"
          :disabled="saving"
        />
      </template>

      <template v-else-if="open === 'delete'">
        <p class="text-sm text-[var(--color-muted)]">
          Esta ação é permanente. Digite <strong>EXCLUIR</strong> e sua senha para confirmar.
        </p>
        <UiInput
          id="account-delete-confirm"
          v-model="deleteConfirm"
          label="Confirmação"
          placeholder="EXCLUIR"
          :disabled="saving"
        />
        <UiInput
          id="account-delete-password"
          v-model="currentPassword"
          label="Senha atual"
          type="password"
          autocomplete="current-password"
          :disabled="saving"
        />
      </template>
    </div>

    <template #footer>
      <UiButton
        variant="outline"
        type="button"
        :disabled="saving"
        @click="open = null"
      >
        Cancelar
      </UiButton>
      <UiButton
        type="button"
        :disabled="saving"
        :class="open === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''"
        @click="submit"
      >
        {{ saving ? 'Salvando…' : open === 'delete' ? 'Excluir conta' : 'Salvar' }}
      </UiButton>
    </template>
  </UiModal>
</template>
