<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

type AvatarTransform = {
  viewSize: number
  zoom: number
  rotation: number
  flipH: boolean
  flipV: boolean
  offsetX: number
  offsetY: number
}

type RoleOption = {
  id: string
  key: string
  name: string
  isSystem: boolean
}

type PanelUserDetail = {
  id: string
  email: string | null
  username: string | null
  name: string | null
  roleId: string | null
  roleKey: string | null
  roleName: string | null
  enabled: boolean
  avatarUrl: string | null
  avatarTransform: AvatarTransform | null
  createdAt: string
  updatedAt: string
  birthDate: string | null
  oldEmail: string | null
  hasPassword: boolean
  loginAttemptCount: number
  loginGlobalCount: number
  loginWindowEndsAt: string | null
  loginBlockedUntil: string | null
  loginLastAttemptAt: string | null
  profile: {
    avatarUrl: string | null
    avatarTransform: AvatarTransform | null
    recoveryEmail: string | null
    showBirthDate: boolean
    hideBirthYear: boolean
    passwordAlerts: boolean
    usernameChangeCount: number
    usernameWindowStartedAt: string | null
    createdAt: string
    updatedAt: string
  } | null
  sessions: {
    active: number
    total: number
  }
  twoFactor: {
    available: boolean
    enabled: boolean
    totpEnabled: boolean
    securityKeyCount: number
    recoveryCodesRemaining: number
  }
}

const route = useRoute()
const { token, user: authUser } = useAuth()
const { can } = usePermissions()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const togglingEnabled = ref(false)
const error = ref('')
const user = ref<PanelUserDetail | null>(null)
const roles = ref<RoleOption[]>([])

const draftName = ref('')
const draftRoleId = ref('')

const userId = computed(() => {
  const raw = route.params.id
  const value = Array.isArray(raw) ? raw[0] : raw
  return value ? decodeURIComponent(value) : ''
})

const canManage = computed(() => can('users.manage'))
const isSelf = computed(() =>
  Boolean(user.value && authUser.value && user.value.id === authUser.value.id),
)

const authHeaders = computed(() =>
  token.value ? { Authorization: `Bearer ${token.value}` } : undefined,
)

const pageTitle = computed(() => {
  if (!user.value) return 'Usuário'
  return `${user.value.name || user.value.username || user.value.email || 'Usuário'} · Usuários`
})
useSeoMeta({ title: pageTitle })

const isDirty = computed(() => {
  if (!user.value) return false
  if ((draftName.value.trim() || '') !== (user.value.name || '')) return true
  if (draftRoleId.value !== (user.value.roleId || '')) return true
  return false
})

const displayName = computed(() =>
  user.value?.name || user.value?.username || user.value?.email || 'Usuário',
)

const initials = computed(() => displayName.value.slice(0, 1).toUpperCase())

const avatarSrc = computed(() => user.value?.avatarUrl || user.value?.profile?.avatarUrl || null)
const avatarTransform = computed(
  () => user.value?.avatarTransform || user.value?.profile?.avatarTransform || null,
)

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

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  }
  catch {
    return value
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  // Data civil (YYYY-MM-DD): não converter via fuso local — evita 14/06 virar 13/06.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return value
  const [, y, m, d] = match
  return `${d}/${m}/${y}`
}

function yesNo(value: boolean) {
  return value ? 'Sim' : 'Não'
}

function loadDraft(detail: PanelUserDetail) {
  draftName.value = detail.name || ''
  draftRoleId.value = detail.roleId || ''
}

async function loadUser() {
  if (!userId.value) {
    error.value = 'Usuário inválido.'
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''
  try {
    const data = await $fetch<{ user: PanelUserDetail, roles: RoleOption[] }>(
      `/api/users/${encodeURIComponent(userId.value)}`,
      { headers: authHeaders.value },
    )
    user.value = data.user
    roles.value = data.roles
    loadDraft(data.user)
  }
  catch (err: unknown) {
    user.value = null
    error.value = extractError(err, 'Não foi possível carregar o usuário.')
  }
  finally {
    loading.value = false
  }
}

function discardChanges() {
  if (!user.value) return
  loadDraft(user.value)
}

async function saveUser() {
  if (!user.value || !canManage.value) return
  saving.value = true
  try {
    await $fetch(`/api/users/${encodeURIComponent(user.value.id)}`, {
      method: 'PUT',
      headers: authHeaders.value,
      body: {
        name: draftName.value.trim(),
        roleId: draftRoleId.value || null,
      },
    })
    await loadUser()
    toast.success('Salvo', 'Usuário atualizado.')
  }
  catch (err: unknown) {
    toast.error('Erro', extractError(err, 'Não foi possível salvar.'))
  }
  finally {
    saving.value = false
  }
}

async function setUserEnabled(next: boolean) {
  if (!user.value || !canManage.value || togglingEnabled.value) return
  if (next === user.value.enabled) return
  if (!next && isSelf.value) {
    toast.error('Erro', 'Você não pode desativar a própria conta.')
    return
  }

  togglingEnabled.value = true
  try {
    await $fetch(`/api/users/${encodeURIComponent(user.value.id)}`, {
      method: 'PUT',
      headers: authHeaders.value,
      body: { enabled: next },
    })
    await loadUser()
    toast.success(
      next ? 'Conta ativada' : 'Conta desativada',
      next
        ? 'O usuário pode entrar novamente.'
        : 'Login bloqueado e sessões encerradas.',
    )
  }
  catch (err: unknown) {
    toast.error('Erro', extractError(err, 'Não foi possível alterar o status.'))
  }
  finally {
    togglingEnabled.value = false
  }
}

watch(userId, () => {
  void loadUser()
}, { immediate: true })
</script>

<template>
  <div class="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
    <div class="mx-auto w-full max-w-5xl space-y-8">
      <header class="space-y-4">
        <div class="flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
          <NuxtLink
            to="/panel/users"
            class="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
          >
            Usuários
          </NuxtLink>
          <span aria-hidden="true">/</span>
          <span class="min-w-0 break-words text-[var(--color-ink)]">
            {{ user ? displayName : 'Detalhe' }}
          </span>
        </div>

        <div
          v-if="user"
          class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="flex min-w-0 items-start gap-3 sm:gap-4">
            <AccountAvatar
              :src="avatarSrc"
              :transform="avatarTransform"
              :initials="initials"
              :size="56"
              :alt="`Avatar de ${displayName}`"
            />
            <div class="min-w-0 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="font-display text-2xl font-extrabold text-[var(--color-ink)] sm:text-3xl">
                  {{ displayName }}
                </h1>
                <span
                  v-if="isSelf"
                  class="rounded-full bg-[var(--color-paper-deep)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]"
                >
                  Você
                </span>
              </div>
              <p class="break-all font-mono text-sm text-[var(--color-muted)]">
                {{ user.id }}
              </p>
              <div class="flex flex-wrap gap-1.5">
                <span class="rounded-md bg-[#1C223D]/10 px-2 py-0.5 text-xs font-medium text-[#1C223D]">
                  {{ user.roleName || 'Sem papel' }}
                </span>
                <span
                  v-if="user.username"
                  class="rounded-md bg-[var(--color-paper-deep)] px-2 py-0.5 font-mono text-xs text-[var(--color-muted)]"
                >
                  @{{ user.username }}
                </span>
                <span
                  class="rounded-md px-2 py-0.5 text-xs font-medium"
                  :class="user.enabled
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'"
                >
                  {{ user.enabled ? 'Ativo' : 'Desativado' }}
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="canManage"
            class="flex flex-wrap gap-2"
          >
            <UiButton
              type="button"
              variant="outline"
              :disabled="!isDirty || saving"
              @click="discardChanges"
            >
              Descartar
            </UiButton>
            <UiButton
              type="button"
              :loading="saving"
              :disabled="!isDirty || saving"
              @click="saveUser"
            >
              Salvar
            </UiButton>
          </div>
        </div>
      </header>

      <p
        v-if="error"
        class="rounded-[var(--radius)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {{ error }}
      </p>

      <div
        v-if="loading"
        class="flex items-center justify-center gap-3 py-20 text-sm text-[var(--color-muted)]"
      >
        <Icon
          name="svg-spinners:ring-resize"
          class="text-xl"
        />
        Carregando usuário…
      </div>

      <template v-else-if="user">
        <section class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-4 py-3">
            <p class="text-xs text-[var(--color-muted)]">
              Sessões ativas
            </p>
            <p class="mt-1 font-display text-2xl font-bold text-[var(--color-ink)]">
              {{ user.sessions.active }}
              <span class="text-base font-medium text-[var(--color-muted)]">
                / {{ user.sessions.total }}
              </span>
            </p>
          </div>
          <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-4 py-3">
            <p class="text-xs text-[var(--color-muted)]">
              2FA
            </p>
            <p class="mt-1 font-display text-2xl font-bold text-[var(--color-ink)]">
              <template v-if="!user.twoFactor.available">
                —
              </template>
              <template v-else>
                {{ user.twoFactor.enabled ? 'Ativo' : 'Off' }}
              </template>
            </p>
          </div>
          <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-4 py-3">
            <p class="text-xs text-[var(--color-muted)]">
              Senha
            </p>
            <p class="mt-1 font-display text-2xl font-bold text-[var(--color-ink)]">
              {{ user.hasPassword ? 'Definida' : 'Não' }}
            </p>
          </div>
        </section>

        <section class="space-y-4 rounded-[var(--radius)] border border-[var(--color-line)] bg-white p-5">
          <div>
            <h2 class="text-lg font-semibold text-[var(--color-ink)]">
              Conta
            </h2>
            <p class="mt-1 text-sm text-[var(--color-muted)]">
              Dados principais da conta.
            </p>
          </div>

          <div class="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="text-sm font-medium text-[var(--color-ink)]">
                Conta ativa
              </p>
              <p class="mt-0.5 text-xs text-[var(--color-muted)]">
                {{ user.enabled
                  ? 'O usuário pode entrar no sistema.'
                  : 'Login bloqueado. Sessões ativas são encerradas ao desativar.' }}
              </p>
            </div>
            <UiToggle
              :model-value="user.enabled"
              :disabled="!canManage || togglingEnabled || isSelf"
              label=""
              @update:model-value="setUserEnabled"
            />
          </div>
          <p
            v-if="canManage && isSelf"
            class="text-xs text-[var(--color-muted)]"
          >
            Você não pode desativar a própria conta.
          </p>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block space-y-1.5 sm:col-span-2">
              <span class="text-sm font-medium text-[var(--color-ink)]">Nome</span>
              <input
                v-model="draftName"
                type="text"
                :disabled="!canManage"
                class="w-full rounded-[var(--radius)] border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:bg-[var(--color-paper-deep)]/50"
                placeholder="Nome exibido"
              >
            </label>

            <label class="block space-y-1.5 sm:col-span-2">
              <span class="text-sm font-medium text-[var(--color-ink)]">Tipo de permissão</span>
              <select
                v-model="draftRoleId"
                :disabled="!canManage"
                class="w-full rounded-[var(--radius)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:bg-[var(--color-paper-deep)]/50"
              >
                <option
                  disabled
                  value=""
                >
                  Selecione…
                </option>
                <option
                  v-for="role in roles"
                  :key="role.id"
                  :value="role.id"
                >
                  {{ role.name }}{{ role.isSystem ? ' (sistema)' : '' }}
                </option>
              </select>
            </label>
          </div>

          <dl class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
              <dt class="text-xs text-[var(--color-muted)]">
                E-mail
              </dt>
              <dd class="mt-1 break-all text-sm text-[var(--color-ink)]">
                {{ user.email || '—' }}
              </dd>
            </div>
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
              <dt class="text-xs text-[var(--color-muted)]">
                E-mail anterior
              </dt>
              <dd class="mt-1 break-all text-sm text-[var(--color-ink)]">
                {{ user.oldEmail || '—' }}
              </dd>
            </div>
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
              <dt class="text-xs text-[var(--color-muted)]">
                Nome de usuário
              </dt>
              <dd class="mt-1 text-sm text-[var(--color-ink)]">
                {{ user.username || '—' }}
              </dd>
            </div>
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
              <dt class="text-xs text-[var(--color-muted)]">
                Data de nascimento
              </dt>
              <dd class="mt-1 text-sm text-[var(--color-ink)]">
                {{ formatDate(user.birthDate) }}
              </dd>
            </div>
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
              <dt class="text-xs text-[var(--color-muted)]">
                Criado em
              </dt>
              <dd class="mt-1 text-sm text-[var(--color-ink)]">
                {{ formatDateTime(user.createdAt) }}
              </dd>
            </div>
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
              <dt class="text-xs text-[var(--color-muted)]">
                Atualizado em
              </dt>
              <dd class="mt-1 text-sm text-[var(--color-ink)]">
                {{ formatDateTime(user.updatedAt) }}
              </dd>
            </div>
          </dl>

          <p
            v-if="!canManage"
            class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6] px-3 py-2 text-sm text-[var(--color-muted)]"
          >
            Você pode visualizar este usuário, mas não tem permissão para editá-lo.
          </p>
        </section>

        <section class="space-y-4 rounded-[var(--radius)] border border-[var(--color-line)] bg-white p-5">
          <div>
            <h2 class="text-lg font-semibold text-[var(--color-ink)]">
              Segurança e login
            </h2>
            <p class="mt-1 text-sm text-[var(--color-muted)]">
              Rate limit, bloqueios e autenticação.
            </p>
          </div>

          <dl class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
              <dt class="text-xs text-[var(--color-muted)]">
                Tentativas na janela
              </dt>
              <dd class="mt-1 text-sm text-[var(--color-ink)]">
                {{ user.loginAttemptCount }}
              </dd>
            </div>
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
              <dt class="text-xs text-[var(--color-muted)]">
                Contagem global
              </dt>
              <dd class="mt-1 text-sm text-[var(--color-ink)]">
                {{ user.loginGlobalCount }}
              </dd>
            </div>
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
              <dt class="text-xs text-[var(--color-muted)]">
                Janela termina em
              </dt>
              <dd class="mt-1 text-sm text-[var(--color-ink)]">
                {{ formatDateTime(user.loginWindowEndsAt) }}
              </dd>
            </div>
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
              <dt class="text-xs text-[var(--color-muted)]">
                Bloqueado até
              </dt>
              <dd class="mt-1 text-sm text-[var(--color-ink)]">
                {{ formatDateTime(user.loginBlockedUntil) }}
              </dd>
            </div>
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5 sm:col-span-2">
              <dt class="text-xs text-[var(--color-muted)]">
                Última tentativa de login
              </dt>
              <dd class="mt-1 text-sm text-[var(--color-ink)]">
                {{ formatDateTime(user.loginLastAttemptAt) }}
              </dd>
            </div>
          </dl>

          <dl
            v-if="user.twoFactor.available"
            class="grid gap-3 sm:grid-cols-2"
          >
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
              <dt class="text-xs text-[var(--color-muted)]">
                TOTP
              </dt>
              <dd class="mt-1 text-sm text-[var(--color-ink)]">
                {{ yesNo(user.twoFactor.totpEnabled) }}
              </dd>
            </div>
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
              <dt class="text-xs text-[var(--color-muted)]">
                Chaves de segurança
              </dt>
              <dd class="mt-1 text-sm text-[var(--color-ink)]">
                {{ user.twoFactor.securityKeyCount }}
              </dd>
            </div>
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5 sm:col-span-2">
              <dt class="text-xs text-[var(--color-muted)]">
                Códigos de recuperação restantes
              </dt>
              <dd class="mt-1 text-sm text-[var(--color-ink)]">
                {{ user.twoFactor.recoveryCodesRemaining }}
              </dd>
            </div>
          </dl>
          <p
            v-else
            class="text-sm text-[var(--color-muted)]"
          >
            Módulo de dois fatores não disponível nesta instalação.
          </p>
        </section>

        <section class="space-y-4 rounded-[var(--radius)] border border-[var(--color-line)] bg-white p-5">
          <div>
            <h2 class="text-lg font-semibold text-[var(--color-ink)]">
              Perfil
            </h2>
            <p class="mt-1 text-sm text-[var(--color-muted)]">
              Dados do módulo Conta (avatar, recuperação e preferências).
            </p>
          </div>

          <template v-if="user.profile">
            <div class="flex items-center gap-3">
              <AccountAvatar
                :src="user.profile.avatarUrl"
                :transform="user.profile.avatarTransform"
                :initials="initials"
                :size="64"
                :alt="`Avatar de ${displayName}`"
              />
              <p class="text-sm text-[var(--color-muted)]">
                {{ user.profile.avatarUrl ? 'Avatar definido.' : 'Sem imagem de perfil.' }}
              </p>
            </div>
            <dl class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
                <dt class="text-xs text-[var(--color-muted)]">
                  E-mail de recuperação
                </dt>
                <dd class="mt-1 break-all text-sm text-[var(--color-ink)]">
                  {{ user.profile.recoveryEmail || '—' }}
                </dd>
              </div>
              <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
                <dt class="text-xs text-[var(--color-muted)]">
                  Alertas de senha
                </dt>
                <dd class="mt-1 text-sm text-[var(--color-ink)]">
                  {{ yesNo(user.profile.passwordAlerts) }}
                </dd>
              </div>
              <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
                <dt class="text-xs text-[var(--color-muted)]">
                  Exibir data de nascimento
                </dt>
                <dd class="mt-1 text-sm text-[var(--color-ink)]">
                  {{ yesNo(user.profile.showBirthDate) }}
                </dd>
              </div>
              <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
                <dt class="text-xs text-[var(--color-muted)]">
                  Ocultar ano
                </dt>
                <dd class="mt-1 text-sm text-[var(--color-ink)]">
                  {{ yesNo(user.profile.hideBirthYear) }}
                </dd>
              </div>
              <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
                <dt class="text-xs text-[var(--color-muted)]">
                  Trocas de username
                </dt>
                <dd class="mt-1 text-sm text-[var(--color-ink)]">
                  {{ user.profile.usernameChangeCount }}
                </dd>
              </div>
              <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
                <dt class="text-xs text-[var(--color-muted)]">
                  Janela de username desde
                </dt>
                <dd class="mt-1 text-sm text-[var(--color-ink)]">
                  {{ formatDateTime(user.profile.usernameWindowStartedAt) }}
                </dd>
              </div>
              <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
                <dt class="text-xs text-[var(--color-muted)]">
                  Perfil criado em
                </dt>
                <dd class="mt-1 text-sm text-[var(--color-ink)]">
                  {{ formatDateTime(user.profile.createdAt) }}
                </dd>
              </div>
              <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[#F8F8F6]/80 px-3 py-2.5">
                <dt class="text-xs text-[var(--color-muted)]">
                  Perfil atualizado em
                </dt>
                <dd class="mt-1 text-sm text-[var(--color-ink)]">
                  {{ formatDateTime(user.profile.updatedAt) }}
                </dd>
              </div>
            </dl>
          </template>
          <p
            v-else
            class="text-sm text-[var(--color-muted)]"
          >
            Sem perfil de conta registrado para este usuário.
          </p>
        </section>
      </template>
    </div>
  </div>
</template>
