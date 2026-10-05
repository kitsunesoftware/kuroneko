<script setup lang="ts">
const { modules, flat, loaded, refreshInstalled, refreshLayers } = useModules()
const { settings } = useSiteSettings()
const { user } = useAuth()
const { can } = usePermissions()

const activeModules = computed(() =>
  flat.value.filter((item) => item.enabled),
)

const inactiveInstalled = computed(() =>
  flat.value.filter((item) => item.installed && !item.enabled && item.canDisable),
)

const rootCount = computed(() => modules.value.length)
const activeCount = computed(() => activeModules.value.length)
const catalogCount = computed(() => flat.value.length)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
})

const displayName = computed(() => {
  const name = user.value?.name?.trim()
  if (name) return name.split(/\s+/)[0]
  return user.value?.username || 'admin'
})

const quickLinks = computed(() => {
  const links = [
    {
      to: '/panel/modules',
      label: 'Módulos',
      description: 'Ative, instale e configure módulos do sistema.',
      icon: 'i-solar:box-bold-duotone',
      permission: 'panel.modules.view' as const,
    },
    {
      to: '/panel/modules/store',
      label: 'Loja',
      description: 'Baixe e sincronize pacotes disponíveis.',
      icon: 'i-solar:shop-bold-duotone',
      permission: 'panel.store.view' as const,
    },
    {
      to: '/panel/roles',
      label: 'Permissões',
      description: 'Tipos de acesso e o que cada um pode fazer.',
      icon: 'i-solar:shield-user-bold-duotone',
      permission: 'panel.roles.manage' as const,
    },
    {
      to: '/panel/users',
      label: 'Usuários',
      description: 'Contas do sistema e tipos de permissão.',
      icon: 'i-solar:users-group-rounded-bold-duotone',
      permission: 'users.view' as const,
    },
    {
      to: '/panel/settings',
      label: 'Configurações',
      description: 'Identidade, SMTP, loja e manutenção.',
      icon: 'i-solar:settings-bold-duotone',
      permission: 'panel.settings' as const,
    },
    {
      to: '/account',
      label: 'Minha conta',
      description: 'Perfil, e-mail e dados da sessão atual.',
      icon: 'i-solar:user-bold-duotone',
      permission: 'account.view' as const,
    },
  ]

  return links.filter((link) => can(link.permission))
})

const featuredActive = computed(() =>
  activeModules.value
    .slice()
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
    .slice(0, 8),
)

onMounted(() => {
  if (!loaded.value) {
    void Promise.all([refreshInstalled(), refreshLayers()]).catch(() => {})
  }
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
            {{ greeting }}, {{ displayName }}
          </h1>
          <p class="max-w-2xl text-[var(--color-muted)]">
            Visão geral de
            <span class="font-medium text-[var(--color-ink)]">{{ settings.title }}</span>.
            Acompanhe o estado dos módulos e acesse as áreas principais.
          </p>
        </div>

        <div
          v-if="settings.maintenance"
          class="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"
        >
          <Icon
            name="i-solar:danger-triangle-bold"
            class="text-base"
          />
          Manutenção ativa
        </div>
      </header>

      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-4 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs text-[var(--color-muted)]">
                Módulos ativos
              </p>
              <p class="mt-1 font-display text-3xl font-bold text-[var(--color-ink)]">
                {{ activeCount }}
              </p>
            </div>
            <Icon
              name="i-solar:check-circle-bold-duotone"
              class="text-2xl text-[var(--color-success)]"
            />
          </div>
          <p class="mt-2 text-xs text-[var(--color-muted)]">
            de {{ catalogCount }} no catálogo
          </p>
        </div>

        <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-4 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs text-[var(--color-muted)]">
                Módulos raiz
              </p>
              <p class="mt-1 font-display text-3xl font-bold text-[var(--color-ink)]">
                {{ rootCount }}
              </p>
            </div>
            <Icon
              name="i-solar:widget-4-bold-duotone"
              class="text-2xl text-[var(--color-accent)]"
            />
          </div>
          <p class="mt-2 text-xs text-[var(--color-muted)]">
            Estrutura principal do template
          </p>
        </div>

        <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-4 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs text-[var(--color-muted)]">
                Desativados
              </p>
              <p class="mt-1 font-display text-3xl font-bold text-[var(--color-ink)]">
                {{ inactiveInstalled.length }}
              </p>
            </div>
            <Icon
              name="i-solar:pause-circle-bold-duotone"
              class="text-2xl text-[var(--color-muted)]"
            />
          </div>
          <p class="mt-2 text-xs text-[var(--color-muted)]">
            Instalados, mas pausados
          </p>
        </div>

        <div class="rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-4 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs text-[var(--color-muted)]">
                Site
              </p>
              <p class="mt-1 font-display text-xl font-bold text-[var(--color-ink)]">
                {{ settings.maintenance ? 'Em manutenção' : 'Online' }}
              </p>
            </div>
            <Icon
              :name="settings.maintenance ? 'i-solar:danger-triangle-bold-duotone' : 'i-solar:global-bold-duotone'"
              class="text-2xl"
              :class="settings.maintenance ? 'text-amber-600' : 'text-[var(--color-success)]'"
            />
          </div>
          <p class="mt-2 truncate text-xs text-[var(--color-muted)]">
            {{ settings.tagline || settings.title }}
          </p>
        </div>
      </section>

      <section
        v-if="quickLinks.length"
        class="space-y-3"
      >
        <div>
          <h2 class="text-lg font-semibold text-[var(--color-ink)]">
            Acessos rápidos
          </h2>
          <p class="mt-1 text-sm text-[var(--color-muted)]">
            Vá direto para as áreas que você mais usa.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <NuxtLink
            v-for="link in quickLinks"
            :key="link.to"
            :to="link.to"
            class="group flex items-start gap-3 rounded-[var(--radius)] border border-[var(--color-line)] bg-white p-4 transition hover:border-[var(--color-ink)]/35 hover:shadow-[var(--shadow-soft)]"
          >
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--color-paper-deep)] text-[var(--color-ink)] transition group-hover:bg-[var(--color-ink)] group-hover:text-white">
              <Icon
                :name="link.icon"
                class="text-xl"
              />
            </span>
            <span class="min-w-0">
              <span class="flex items-center gap-2">
                <span class="text-sm font-semibold text-[var(--color-ink)]">
                  {{ link.label }}
                </span>
                <Icon
                  name="i-solar:arrow-right-linear"
                  class="text-base text-[var(--color-muted)] opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                />
              </span>
              <span class="mt-1 block text-xs leading-relaxed text-[var(--color-muted)]">
                {{ link.description }}
              </span>
            </span>
          </NuxtLink>
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-[var(--color-ink)]">
              Módulos em atividade
            </h2>
            <p class="mt-1 text-sm text-[var(--color-muted)]">
              Capas e submódulos habilitados neste momento.
            </p>
          </div>
          <NuxtLink
            v-if="can('panel.modules.view')"
            to="/panel/modules"
            class="text-sm font-semibold text-[var(--color-accent)] transition hover:text-[var(--color-accent-hover)]"
          >
            Ver todos
          </NuxtLink>
        </div>

        <div
          v-if="!loaded"
          class="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-line)] bg-white px-4 py-8 text-sm text-[var(--color-muted)]"
        >
          <Icon
            name="svg-spinners:ring-resize"
            class="text-xl"
          />
          Carregando módulos…
        </div>

        <div
          v-else-if="featuredActive.length === 0"
          class="rounded-[var(--radius)] border border-dashed border-[var(--color-line)] px-4 py-10 text-center text-sm text-[var(--color-muted)]"
        >
          Nenhum módulo ativo no momento.
        </div>

        <div
          v-else
          class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          <article
            v-for="mod in featuredActive"
            :key="mod.id"
            class="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--color-line)] bg-white p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius)] bg-[var(--color-paper-deep)] text-[var(--color-ink)]">
                <img
                  v-if="mod.iconUrl"
                  :src="mod.iconUrl"
                  :alt="mod.label"
                  class="h-6 w-6 object-contain"
                >
                <Icon
                  v-else
                  :name="mod.icon || 'i-solar:box-bold-duotone'"
                  class="text-xl"
                />
              </span>
              <span class="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                <span class="size-1.5 rounded-full bg-emerald-500" />
                ativo
              </span>
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-[var(--color-ink)]">
                {{ mod.label }}
              </p>
              <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--color-muted)]">
                {{ mod.description || mod.id }}
              </p>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
