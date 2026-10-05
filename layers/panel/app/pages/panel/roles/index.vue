<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

type PermissionDef = {
  key: string
  label: string
  description?: string
}

type PermissionGroup = {
  id: string
  label: string
  description?: string
  permissions: PermissionDef[]
}

type RoleDto = {
  id: string
  key: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: Record<string, boolean>
  userCount: number
  createdAt: string
  updatedAt: string
}

const { token } = useAuth()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const roles = ref<RoleDto[]>([])
const catalog = ref<PermissionGroup[]>([])
const selectedId = ref<string | null>(null)
const permissionSearch = ref('')

const createOpen = ref(false)
const createName = ref('')
const createDescription = ref('')
const createError = ref('')
const createSaving = ref(false)

const deleteOpen = ref(false)
const deleteSaving = ref(false)

const draftName = ref('')
const draftDescription = ref('')
const draftPermissions = ref<Record<string, boolean>>({})

const selected = computed(() => roles.value.find((item) => item.id === selectedId.value) ?? null)

const authHeaders = computed(() =>
  token.value ? { Authorization: `Bearer ${token.value}` } : undefined,
)

const isAdminRole = computed(
  () => Boolean(selected.value?.isSystem && selected.value.key === 'admin'),
)

const canDelete = computed(() =>
  Boolean(selected.value && !selected.value.isSystem && selected.value.userCount === 0),
)

const totalPermissionCount = computed(() =>
  catalog.value.reduce((sum, group) => sum + group.permissions.length, 0),
)

const enabledPermissionCount = computed(() => {
  if (isAdminRole.value) return totalPermissionCount.value
  return Object.values(draftPermissions.value).filter(Boolean).length
})

const isDirty = computed(() => {
  if (!selected.value) return false
  if (draftName.value.trim() !== selected.value.name) return true
  if ((draftDescription.value.trim() || '') !== (selected.value.description ?? '')) return true
  if (isAdminRole.value) return draftName.value.trim() !== selected.value.name
    || (draftDescription.value.trim() || '') !== (selected.value.description ?? '')

  for (const group of catalog.value) {
    for (const permission of group.permissions) {
      const current = Boolean(draftPermissions.value[permission.key])
      const original = Boolean(selected.value.permissions[permission.key])
      if (current !== original) return true
    }
  }
  return false
})

const filteredCatalog = computed(() => {
  const query = permissionSearch.value.trim().toLowerCase()
  if (!query) return catalog.value

  return catalog.value
    .map((group) => {
      const permissions = group.permissions.filter((permission) => {
        const haystack = [
          permission.label,
          permission.description || '',
          permission.key,
          group.label,
        ].join(' ').toLowerCase()
        return haystack.includes(query)
      })
      return { ...group, permissions }
    })
    .filter((group) => group.permissions.length > 0)
})

function emptyPermissions() {
  const map: Record<string, boolean> = {}
  for (const group of catalog.value) {
    for (const permission of group.permissions) {
      map[permission.key] = false
    }
  }
  return map
}

function loadDraft(role: RoleDto) {
  draftName.value = role.name
  draftDescription.value = role.description ?? ''
  draftPermissions.value = {
    ...emptyPermissions(),
    ...role.permissions,
  }
  permissionSearch.value = ''
}

function selectRole(id: string) {
  selectedId.value = id
  const role = roles.value.find((item) => item.id === id)
  if (role) loadDraft(role)
}

function groupEnabledCount(group: PermissionGroup) {
  if (isAdminRole.value) return group.permissions.length
  return group.permissions.filter((permission) => draftPermissions.value[permission.key]).length
}

async function loadRoles() {
  loading.value = true
  error.value = ''
  try {
    const data = await $fetch<{ roles: RoleDto[], catalog: PermissionGroup[] }>('/api/roles', {
      headers: authHeaders.value,
    })
    roles.value = data.roles
    catalog.value = data.catalog
    if (!selectedId.value && data.roles[0]) {
      selectRole(data.roles[0].id)
    }
    else if (selectedId.value) {
      const stillThere = data.roles.find((item) => item.id === selectedId.value)
      if (stillThere) loadDraft(stillThere)
      else if (data.roles[0]) selectRole(data.roles[0].id)
      else selectedId.value = null
    }
  }
  catch (err: unknown) {
    error.value = extractError(err, 'Não foi possível carregar as permissões.')
  }
  finally {
    loading.value = false
  }
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

function setPermission(key: string, allowed: boolean) {
  if (selected.value?.isSystem && selected.value.key === 'admin') return
  draftPermissions.value = {
    ...draftPermissions.value,
    [key]: allowed,
  }
}

function setGroup(group: PermissionGroup, allowed: boolean) {
  if (selected.value?.isSystem && selected.value.key === 'admin') return
  const next = { ...draftPermissions.value }
  for (const permission of group.permissions) {
    next[permission.key] = allowed
  }
  draftPermissions.value = next
}

async function saveRole() {
  if (!selected.value) return
  saving.value = true
  try {
    const data = await $fetch<{ role: RoleDto }>(`/api/roles/${selected.value.id}`, {
      method: 'PUT',
      headers: authHeaders.value,
      body: {
        name: draftName.value.trim(),
        description: draftDescription.value.trim(),
        permissions: draftPermissions.value,
      },
    })
    const index = roles.value.findIndex((item) => item.id === data.role.id)
    if (index >= 0) roles.value[index] = data.role
    loadDraft(data.role)
    toast.success('Salvo', 'Tipo de permissão atualizado.')
  }
  catch (err: unknown) {
    toast.error('Erro', extractError(err, 'Não foi possível salvar.'))
  }
  finally {
    saving.value = false
  }
}

function discardChanges() {
  if (!selected.value) return
  loadDraft(selected.value)
}

function openCreate() {
  createName.value = ''
  createDescription.value = ''
  createError.value = ''
  createOpen.value = true
}

async function createRole() {
  if (!createName.value.trim()) {
    createError.value = 'Informe o nome.'
    return
  }
  createSaving.value = true
  createError.value = ''
  try {
    const data = await $fetch<{ role: RoleDto }>('/api/roles', {
      method: 'POST',
      headers: authHeaders.value,
      body: {
        name: createName.value.trim(),
        description: createDescription.value.trim(),
      },
    })
    roles.value = [...roles.value, data.role]
    createOpen.value = false
    selectRole(data.role.id)
    toast.success('Criado', 'Novo tipo de permissão disponível.')
  }
  catch (err: unknown) {
    createError.value = extractError(err, 'Não foi possível criar.')
  }
  finally {
    createSaving.value = false
  }
}

function openDelete() {
  if (!selected.value || selected.value.isSystem) return
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!selected.value || selected.value.isSystem) return
  deleteSaving.value = true
  try {
    await $fetch(`/api/roles/${selected.value.id}`, {
      method: 'DELETE',
      headers: authHeaders.value,
    })
    roles.value = roles.value.filter((item) => item.id !== selected.value!.id)
    deleteOpen.value = false
    if (roles.value[0]) selectRole(roles.value[0].id)
    else selectedId.value = null
    toast.success('Excluído', 'Tipo de permissão removido.')
  }
  catch (err: unknown) {
    toast.error('Erro', extractError(err, 'Não foi possível excluir.'))
  }
  finally {
    deleteSaving.value = false
  }
}

onMounted(() => {
  void loadRoles()
})
</script>

<template>
  <div class="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
    <div class="mx-auto w-full max-w-6xl space-y-8">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="space-y-2">
          <p class="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Painel
          </p>
          <h1 class="font-display text-2xl font-extrabold text-[var(--color-ink)] sm:text-3xl">
            Permissões
          </h1>
          <p class="max-w-2xl text-[var(--color-muted)]">
            Defina tipos de acesso e escolha exatamente o que cada um pode fazer no sistema.
          </p>
        </div>
        <UiButton
          type="button"
          @click="openCreate"
        >
          Novo tipo
        </UiButton>
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
        Carregando permissões…
      </div>

      <template v-else>
        <section class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold text-[var(--color-ink)]">
              Tipos de permissão
            </h2>
            <p class="text-xs text-[var(--color-muted)]">
              {{ roles.length }} tipo{{ roles.length === 1 ? '' : 's' }}
            </p>
          </div>

          <div class="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible xl:grid-cols-4">
            <button
              v-for="role in roles"
              :key="role.id"
              type="button"
              class="min-w-[200px] shrink-0 rounded-[var(--radius)] border px-4 py-3 text-left transition lg:min-w-0"
              :class="
                selectedId === role.id
                  ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white shadow-[var(--shadow-soft)]'
                  : 'border-[var(--color-line)] bg-white/80 hover:border-[var(--color-ink)]/40'
              "
              @click="selectRole(role.id)"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="truncate text-sm font-semibold">
                  {{ role.name }}
                </p>
                <span
                  v-if="role.isSystem"
                  class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  :class="
                    selectedId === role.id
                      ? 'bg-white/15 text-white/90'
                      : 'bg-[var(--color-paper-deep)] text-[var(--color-muted)]'
                  "
                >
                  Sistema
                </span>
              </div>
              <p
                class="mt-1 text-xs"
                :class="selectedId === role.id ? 'text-white/70' : 'text-[var(--color-muted)]'"
              >
                {{ role.userCount }} usuário{{ role.userCount === 1 ? '' : 's' }}
              </p>
            </button>
          </div>
        </section>

        <section
          v-if="selected"
          class="space-y-6"
        >
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-4 py-3">
              <p class="text-xs text-[var(--color-muted)]">
                Capacidades ativas
              </p>
              <p class="mt-1 font-display text-2xl font-bold text-[var(--color-ink)]">
                {{ enabledPermissionCount }}
                <span class="text-base font-medium text-[var(--color-muted)]">
                  / {{ totalPermissionCount }}
                </span>
              </p>
            </div>
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-4 py-3">
              <p class="text-xs text-[var(--color-muted)]">
                Usuários com este tipo
              </p>
              <p class="mt-1 font-display text-2xl font-bold text-[var(--color-ink)]">
                {{ selected.userCount }}
              </p>
            </div>
            <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-4 py-3">
              <p class="text-xs text-[var(--color-muted)]">
                Identificador
              </p>
              <p class="mt-1 truncate font-mono text-sm font-semibold text-[var(--color-ink)]">
                {{ selected.key }}
              </p>
            </div>
          </div>

          <div class="space-y-5 rounded-[var(--radius)] border border-[var(--color-line)] bg-white p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold text-[var(--color-ink)]">
                  Identidade
                </h2>
                <p class="mt-1 text-sm text-[var(--color-muted)]">
                  Nome e descrição exibidos ao atribuir este tipo.
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <UiButton
                  type="button"
                  variant="outline"
                  :disabled="!canDelete"
                  @click="openDelete"
                >
                  Excluir
                </UiButton>
                <UiButton
                  type="button"
                  variant="ghost"
                  :disabled="!isDirty || saving"
                  @click="discardChanges"
                >
                  Descartar
                </UiButton>
                <UiButton
                  type="button"
                  :loading="saving"
                  :disabled="!isDirty"
                  @click="saveRole"
                >
                  Salvar
                </UiButton>
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <UiInput
                id="role-draft-name"
                v-model="draftName"
                label="Nome"
                type="text"
              />
              <UiInput
                id="role-draft-description"
                v-model="draftDescription"
                class="sm:col-span-2"
                label="Descrição"
                type="text"
                placeholder="Opcional"
              />
            </div>

            <p
              v-if="isAdminRole"
              class="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              O tipo Administrador sempre possui todas as capacidades.
            </p>
            <p
              v-else-if="selected.isSystem"
              class="rounded-[var(--radius)] border border-[var(--color-line)] bg-[var(--color-paper-deep)] px-3 py-2 text-sm text-[var(--color-muted)]"
            >
              Tipo de sistema: você pode ajustar as capacidades, mas não pode excluí-lo.
            </p>
          </div>

          <div class="space-y-4">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold text-[var(--color-ink)]">
                  Capacidades
                </h2>
                <p class="mt-1 text-sm text-[var(--color-muted)]">
                  Ative ou desative o que este tipo pode fazer.
                </p>
              </div>
              <div class="w-full max-w-xs">
                <UiInput
                  id="role-permission-search"
                  v-model="permissionSearch"
                  label=""
                  type="search"
                  placeholder="Buscar capacidade…"
                />
              </div>
            </div>

            <div
              v-if="filteredCatalog.length === 0"
              class="rounded-[var(--radius)] border border-dashed border-[var(--color-line)] px-4 py-10 text-center text-sm text-[var(--color-muted)]"
            >
              Nenhuma capacidade encontrada para “{{ permissionSearch }}”.
            </div>

            <div
              v-for="group in filteredCatalog"
              :key="group.id"
              class="overflow-hidden rounded-[var(--radius)] border border-[var(--color-line)] bg-white"
            >
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-sm font-semibold text-[var(--color-ink)]">
                      {{ group.label }}
                    </p>
                    <span class="rounded-full bg-[var(--color-paper-deep)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)]">
                      {{ groupEnabledCount(group) }}/{{ group.permissions.length }}
                    </span>
                  </div>
                  <p
                    v-if="group.description"
                    class="mt-0.5 text-xs text-[var(--color-muted)]"
                  >
                    {{ group.description }}
                  </p>
                </div>
                <div class="flex gap-3">
                  <button
                    type="button"
                    class="text-xs font-semibold text-[var(--color-accent)] transition hover:text-[var(--color-accent-hover)] disabled:opacity-40"
                    :disabled="isAdminRole"
                    @click="setGroup(group, true)"
                  >
                    Liberar
                  </button>
                  <button
                    type="button"
                    class="text-xs font-semibold text-[var(--color-muted)] transition hover:text-[var(--color-ink)] disabled:opacity-40"
                    :disabled="isAdminRole"
                    @click="setGroup(group, false)"
                  >
                    Bloquear
                  </button>
                </div>
              </div>

              <ul class="divide-y divide-[var(--color-line)]">
                <li
                  v-for="permission in group.permissions"
                  :key="permission.key"
                  class="flex items-start justify-between gap-4 px-4 py-3.5 transition hover:bg-[var(--color-paper)]/40"
                >
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-[var(--color-ink)]">
                      {{ permission.label }}
                    </p>
                    <p
                      v-if="permission.description"
                      class="mt-0.5 text-xs leading-relaxed text-[var(--color-muted)]"
                    >
                      {{ permission.description }}
                    </p>
                  </div>
                  <UiToggle
                    :model-value="Boolean(draftPermissions[permission.key] || isAdminRole)"
                    :disabled="isAdminRole"
                    @update:model-value="setPermission(permission.key, $event)"
                  />
                </li>
              </ul>
            </div>
          </div>

          <div
            v-if="isDirty"
            class="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-ink)]/10 bg-[var(--color-ink)] px-4 py-3 text-white shadow-[var(--shadow-soft)]"
          >
            <p class="text-sm">
              Há alterações não salvas neste tipo.
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-[var(--radius)] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-55"
                :disabled="saving"
                @click="discardChanges"
              >
                Descartar
              </button>
              <UiButton
                type="button"
                :loading="saving"
                @click="saveRole"
              >
                Salvar alterações
              </UiButton>
            </div>
          </div>
        </section>

        <section
          v-else
          class="rounded-[var(--radius)] border border-dashed border-[var(--color-line)] px-4 py-16 text-center"
        >
          <Icon
            name="i-solar:shield-user-bold-duotone"
            class="mx-auto text-3xl text-[var(--color-muted)]"
          />
          <p class="mt-3 text-sm text-[var(--color-muted)]">
            Nenhum tipo de permissão selecionado.
          </p>
          <div class="mt-4 flex justify-center">
            <UiButton
              type="button"
              @click="openCreate"
            >
              Criar o primeiro tipo
            </UiButton>
          </div>
        </section>
      </template>
    </div>

    <UiModal
      v-model="createOpen"
      title="Novo tipo de permissão"
    >
      <div class="space-y-4">
        <UiInput
          id="role-create-name"
          v-model="createName"
          label="Nome"
          type="text"
          placeholder="Ex.: Moderador"
          @keyup.enter="createRole"
        />
        <UiInput
          id="role-create-description"
          v-model="createDescription"
          label="Descrição"
          type="text"
          placeholder="Opcional"
        />
        <p
          v-if="createError"
          class="text-sm text-red-600"
        >
          {{ createError }}
        </p>
      </div>
      <template #footer>
        <UiButton
          variant="ghost"
          type="button"
          @click="createOpen = false"
        >
          Cancelar
        </UiButton>
        <UiButton
          type="button"
          :loading="createSaving"
          @click="createRole"
        >
          Criar
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      v-model="deleteOpen"
      title="Excluir tipo de permissão"
    >
      <p class="text-sm text-[var(--color-muted)]">
        Excluir
        <span class="font-medium text-[var(--color-ink)]">{{ selected?.name }}</span>?
        Esta ação não pode ser desfeita.
      </p>
      <template #footer>
        <UiButton
          variant="ghost"
          type="button"
          @click="deleteOpen = false"
        >
          Cancelar
        </UiButton>
        <UiButton
          type="button"
          :loading="deleteSaving"
          @click="confirmDelete"
        >
          Excluir
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>
