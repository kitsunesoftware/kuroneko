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

type PanelUser = {
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
}

const { token, user: authUser } = useAuth()

const loading = ref(true)
const error = ref('')
const search = ref('')
const users = ref<PanelUser[]>([])

const authHeaders = computed(() =>
  token.value ? { Authorization: `Bearer ${token.value}` } : undefined,
)

const filteredUsers = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return users.value
  return users.value.filter((item) => {
    const haystack = [
      item.name || '',
      item.email || '',
      item.username || '',
      item.roleName || '',
      item.roleKey || '',
    ].join(' ').toLowerCase()
    return haystack.includes(query)
  })
})

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

function initials(user: PanelUser) {
  const source = user.name || user.username || user.email || '?'
  return source.slice(0, 1).toUpperCase()
}

function displayName(user: PanelUser) {
  return user.name || user.username || user.email || 'Sem nome'
}

async function loadUsers() {
  loading.value = true
  error.value = ''
  try {
    const data = await $fetch<{ users: PanelUser[] }>('/api/users', {
      headers: authHeaders.value,
    })
    users.value = data.users
  }
  catch (err: unknown) {
    error.value = extractError(err, 'Não foi possível carregar os usuários.')
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadUsers()
})
</script>

<template>
  <div class="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
    <div class="mx-auto w-full max-w-6xl space-y-8">
      <header class="space-y-2">
        <p class="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Painel
        </p>
        <h1 class="font-display text-2xl font-extrabold text-[var(--color-ink)] sm:text-3xl">
          Usuários
        </h1>
        <p class="max-w-2xl text-[var(--color-muted)]">
          Contas do sistema. Clique em um usuário para ver todos os dados.
        </p>
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
        Carregando usuários…
      </div>

      <template v-else>
        <div class="flex flex-wrap items-end justify-between gap-3">
          <label class="block min-w-[240px] flex-1 space-y-1.5">
            <span class="sr-only">Buscar usuários</span>
            <input
              v-model="search"
              type="search"
              placeholder="Buscar por nome, e-mail, usuário ou papel…"
              class="w-full rounded-[var(--radius)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
            >
          </label>
          <p class="text-xs text-[var(--color-muted)]">
            {{ filteredUsers.length }} de {{ users.length }}
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <NuxtLink
            v-for="item in filteredUsers"
            :key="item.id"
            :to="`/panel/users/${encodeURIComponent(item.id)}`"
            class="group flex flex-col rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 p-5 transition hover:border-[var(--color-ink)]/40 hover:shadow-[var(--shadow-soft)]"
          >
            <div class="flex items-start gap-3">
              <AccountAvatar
                :src="item.avatarUrl"
                :transform="item.avatarTransform"
                :initials="initials(item)"
                :size="44"
                :alt="`Avatar de ${displayName(item)}`"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h2 class="truncate font-display text-lg font-bold text-[var(--color-ink)] group-hover:underline group-hover:underline-offset-2">
                    {{ displayName(item) }}
                  </h2>
                  <span
                    v-if="authUser?.id === item.id"
                    class="shrink-0 rounded-full bg-[var(--color-paper-deep)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]"
                  >
                    Você
                  </span>
                </div>
                <p class="mt-1 truncate text-sm text-[var(--color-muted)]">
                  {{ item.email || item.username || '—' }}
                </p>
              </div>
            </div>

            <div class="mt-auto flex flex-wrap items-center gap-2 pt-5">
              <span class="rounded-md bg-[#1C223D]/10 px-2 py-0.5 text-xs font-medium text-[#1C223D]">
                {{ item.roleName || 'Sem papel' }}
              </span>
              <span
                v-if="item.username"
                class="rounded-md bg-[var(--color-paper-deep)] px-2 py-0.5 font-mono text-xs text-[var(--color-muted)]"
              >
                @{{ item.username }}
              </span>
              <span
                class="rounded-md px-2 py-0.5 text-xs font-medium"
                :class="item.enabled
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-700'"
              >
                {{ item.enabled ? 'Ativo' : 'Desativado' }}
              </span>
            </div>
          </NuxtLink>
        </div>

        <p
          v-if="!filteredUsers.length"
          class="rounded-[var(--radius)] border border-dashed border-[var(--color-line)] px-5 py-16 text-center text-sm text-[var(--color-muted)]"
        >
          Nenhum usuário encontrado.
        </p>
      </template>
    </div>
  </div>
</template>
