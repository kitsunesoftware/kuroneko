<script setup lang="ts">
const route = useRoute()
const {
  loading,
  busyId,
  loadError,
  installModalOpen,
  installTarget,
  installJob,
  installPolling,
  restarting,
  findModule,
  childrenOf,
  canInstall,
  installActionLabel,
  openInstall,
  closeInstallModal,
  confirmInstall,
  refresh,
} = useStoreLoja()

const moduleId = computed(() => {
  const raw = route.params.id
  const value = Array.isArray(raw) ? raw[0] : raw
  return value ? decodeURIComponent(value) : ''
})

const activeTab = ref<'detalhes' | 'submodulos'>('detalhes')

const mod = computed(() => (moduleId.value ? findModule(moduleId.value) : null))
const parentMod = computed(() => {
  if (!mod.value?.parentId) return null
  return findModule(mod.value.parentId)
})
const directChildren = computed(() =>
  moduleId.value ? childrenOf(moduleId.value) : [],
)
const directChildCount = computed(() => directChildren.value.length)

const pageTitle = computed(() =>
  mod.value ? `${mod.value.name} · Loja` : 'Módulo · Loja',
)
useSeoMeta({ title: pageTitle })

function moduleHref(id: string, tab?: 'submodulos') {
  const path = `/panel/modules/store/${encodeURIComponent(id)}`
  return tab ? { path, query: { tab } } : path
}

function tabFromQuery() {
  return route.query.tab === 'submodulos' ? 'submodulos' : 'detalhes'
}

watch([moduleId, () => route.query.tab], () => {
  activeTab.value = tabFromQuery()
}, { immediate: true })

watch(activeTab, (tab) => {
  if (tab === tabFromQuery()) return
  navigateTo({
    path: route.path,
    query: tab === 'submodulos' ? { tab: 'submodulos' } : {},
  }, { replace: true })
})

onMounted(async () => {
  await refresh()
})
</script>

<template>
  <div class="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
    <div class="mx-auto w-full max-w-[1440px] space-y-8">
      <header class="space-y-4">
        <div class="flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
          <NuxtLink
            to="/panel/modules/store"
            class="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
          >
            Loja
          </NuxtLink>
          <span aria-hidden="true">/</span>
          <template v-if="parentMod">
            <NuxtLink
              :to="`/panel/modules/store/${encodeURIComponent(parentMod.id)}`"
              class="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
            >
              {{ parentMod.name }}
            </NuxtLink>
            <span aria-hidden="true">/</span>
          </template>
          <span class="min-w-0 break-words text-[var(--color-ink)]">{{ mod?.name || moduleId || 'Módulo' }}</span>
        </div>

        <div
          v-if="mod"
          class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"
        >
          <div class="flex min-w-0 items-start gap-3 sm:gap-4">
            <span class="flex w-12 shrink-0 items-center justify-center text-[var(--color-ink)]">
              <ModuleIcon
                :icon="mod.icon"
                :icon-url="mod.iconUrl"
                :module-id="mod.id"
                icon-class="w-full text-[3rem]"
              />
            </span>
            <div class="min-w-0 space-y-2">
              <h1 class="font-display text-2xl font-extrabold text-[var(--color-ink)] sm:text-3xl">
                {{ mod.name }}
              </h1>
              <p class="break-all font-mono text-sm text-[var(--color-muted)]">
                {{ mod.id }}
                <template v-if="!mod.platformEntry">
                  ·
                  <template v-if="mod.updateAvailable && mod.localVersion">
                    v{{ mod.localVersion }} → v{{ mod.version }}
                  </template>
                  <template v-else>
                    v{{ mod.version }}
                  </template>
                </template>
              </p>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-if="mod.platformEntry"
                  class="rounded-md bg-[#1C223D]/10 px-2 py-0.5 text-xs font-medium text-[#1C223D]"
                >
                  {{ mod.source === 'sistema' ? 'sistema' : 'na plataforma' }}
                </span>
                <template v-else>
                  <span
                    v-if="mod.installed"
                    class="rounded-md bg-[#1C223D]/10 px-2 py-0.5 text-xs font-medium text-[#1C223D]"
                  >
                    instalado
                  </span>
                  <span
                    v-if="mod.updateAvailable"
                    class="rounded-md bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]"
                    :title="mod.localVersion
                      ? `Local v${mod.localVersion} → catálogo v${mod.version}`
                      : `Nova versão v${mod.version}`"
                  >
                    atualização
                  </span>
                  <span
                    v-if="!mod.platformCompatible"
                    class="rounded-md bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]"
                    :title="mod.minKuroneko
                      ? `Exige Kuroneko ${mod.minKuroneko}+`
                      : 'Incompatível com esta plataforma'"
                  >
                    incompatível
                  </span>
                </template>
              </div>
            </div>
          </div>

          <div class="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            <button
              v-if="canInstall(mod)"
              type="button"
              class="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)] transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-55"
              :disabled="Boolean(busyId) || restarting"
              @click="openInstall(mod)"
            >
              <Icon
                :name="busyId === mod.id ? 'svg-spinners:ring-resize' : 'i-solar:download-minimalistic-bold-duotone'"
                class="text-lg"
              />
              {{ installActionLabel(mod) }}
            </button>
            <NuxtLink
              to="/panel/modules/store"
              class="inline-flex"
            >
              <UiButton variant="ghost">
                Ir para loja
              </UiButton>
            </NuxtLink>
            <NuxtLink
              to="/panel/modules"
              class="inline-flex"
            >
              <UiButton variant="ghost">
                Meus módulos
              </UiButton>
            </NuxtLink>
          </div>
        </div>
      </header>

      <p
        v-if="loadError"
        class="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-sm text-[var(--color-accent)]"
      >
        {{ loadError }}
      </p>

      <p
        v-else-if="loading"
        class="text-sm text-[var(--color-muted)]"
      >
        Carregando módulo…
      </p>

      <template v-else-if="mod">
        <div class="flex gap-1 overflow-x-auto border-b border-[var(--color-line)]">
          <button
            type="button"
            class="shrink-0 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4"
            :class="activeTab === 'detalhes'
              ? 'border-b-2 border-[var(--color-ink)] text-[var(--color-ink)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'"
            @click="activeTab = 'detalhes'"
          >
            Detalhes
          </button>
          <button
            type="button"
            class="shrink-0 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4"
            :class="activeTab === 'submodulos'
              ? 'border-b-2 border-[var(--color-ink)] text-[var(--color-ink)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'"
            @click="activeTab = 'submodulos'"
          >
            Submódulos
            <span class="ml-1 text-[var(--color-muted)]">({{ directChildCount }})</span>
          </button>
        </div>

        <section
          v-if="activeTab === 'detalhes'"
          class="max-w-3xl space-y-6"
        >
          <div class="space-y-2">
            <h2 class="font-display text-lg font-bold text-[var(--color-ink)]">
              Sobre
            </h2>
            <p class="text-[var(--color-muted)]">
              {{ mod.description || 'Sem descrição.' }}
            </p>
          </div>

          <dl class="grid gap-4 sm:grid-cols-2">
            <div
              v-if="!mod.platformEntry"
              class="space-y-1"
            >
              <dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                Versão
              </dt>
              <dd class="text-sm text-[var(--color-ink)]">
                <template v-if="mod.updateAvailable && mod.localVersion">
                  Local v{{ mod.localVersion }} → catálogo v{{ mod.version }}
                </template>
                <template v-else>
                  {{ mod.version }}
                  <span
                    v-if="mod.installed && mod.localVersion && mod.localVersion === mod.version"
                    class="ml-1.5 text-xs text-[var(--color-success)]"
                  >
                    atualizado
                  </span>
                </template>
              </dd>
            </div>
            <div
              v-if="!mod.platformEntry"
              class="space-y-1"
            >
              <dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                Kuroneko mínimo
              </dt>
              <dd class="text-sm text-[var(--color-ink)]">
                <template v-if="mod.minKuroneko">
                  ≥ {{ mod.minKuroneko }}
                  <span
                    class="ml-1.5 text-xs"
                    :class="mod.platformCompatible
                      ? 'text-[var(--color-success)]'
                      : 'text-[var(--color-accent)]'"
                  >
                    {{ mod.platformCompatible ? 'compatível' : 'incompatível' }}
                  </span>
                </template>
                <template v-else>
                  Não declarado
                </template>
              </dd>
            </div>
            <div class="space-y-1">
              <dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                Origem
              </dt>
              <dd class="font-mono text-sm text-[var(--color-ink)]">
                <template v-if="mod.platformEntry">
                  {{ mod.source }}
                </template>
                <template v-else>
                  {{ mod.source }}@{{ mod.ref }}
                </template>
              </dd>
            </div>
            <div
              v-if="!mod.platformEntry"
              class="space-y-1"
            >
              <dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                Destino
              </dt>
              <dd class="font-mono text-sm text-[var(--color-ink)]">
                {{ mod.target }}
              </dd>
            </div>
            <div
              v-if="mod.author"
              class="space-y-1"
            >
              <dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                Autor
              </dt>
              <dd class="text-sm text-[var(--color-ink)]">
                {{ mod.author }}
              </dd>
            </div>
            <div
              v-if="mod.license"
              class="space-y-1"
            >
              <dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                Licença
              </dt>
              <dd class="text-sm text-[var(--color-ink)]">
                {{ mod.license }}
              </dd>
            </div>
            <div
              v-if="parentMod"
              class="space-y-1"
            >
              <dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                Módulo pai
              </dt>
              <dd>
                <NuxtLink
                  :to="`/panel/modules/store/${encodeURIComponent(parentMod.id)}`"
                  class="text-sm font-medium text-[var(--color-ink)] underline underline-offset-2"
                >
                  {{ parentMod.name }}
                </NuxtLink>
              </dd>
            </div>
            <div
              v-if="mod.dependsOn.length"
              class="space-y-1 sm:col-span-2"
            >
              <dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                Dependências
              </dt>
              <dd class="text-sm text-[var(--color-ink)]">
                {{ mod.dependsOn.join(', ') }}
              </dd>
            </div>
          </dl>
        </section>

        <section
          v-else
          class="space-y-4"
        >
          <p class="text-sm text-[var(--color-muted)]">
            Submódulos de
            <code class="rounded bg-[var(--color-paper-deep)] px-1 py-0.5 text-[var(--color-ink)]">{{ mod.id }}</code>.
            Instale o módulo pai antes, se ainda não estiver instalado.
          </p>

          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <article
              v-for="child in directChildren"
              :key="child.id"
              class="flex flex-col rounded-xl border border-[var(--color-line)] bg-white/80 p-5"
            >
              <div class="flex items-start justify-between gap-3">
                <span class="flex w-10 shrink-0 items-center justify-center text-[var(--color-ink)]">
                  <ModuleIcon
                    :icon="child.icon"
                    :icon-url="child.iconUrl"
                    :module-id="child.id"
                    icon-class="w-full text-[2.5rem]"
                  />
                </span>
                <div class="flex flex-wrap justify-end gap-1.5">
                  <span
                    v-if="child.platformEntry"
                    class="rounded-md bg-[#1C223D]/10 px-2 py-0.5 text-xs font-medium text-[#1C223D]"
                  >
                    {{ child.source === 'sistema' ? 'sistema' : 'na plataforma' }}
                  </span>
                  <template v-else>
                    <span
                      v-if="child.installed"
                      class="rounded-md bg-[#1C223D]/10 px-2 py-0.5 text-xs font-medium text-[#1C223D]"
                    >
                      instalado
                    </span>
                    <span
                      v-if="child.updateAvailable"
                      class="rounded-md bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]"
                      :title="child.localVersion
                        ? `Local v${child.localVersion} → catálogo v${child.version}`
                        : `Nova versão v${child.version}`"
                    >
                      atualização
                    </span>
                    <span
                      v-if="!child.platformCompatible"
                      class="rounded-md bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]"
                      :title="child.minKuroneko
                        ? `Exige Kuroneko ${child.minKuroneko}+`
                        : 'Incompatível com esta plataforma'"
                    >
                      incompatível
                    </span>
                  </template>
                </div>
              </div>

              <NuxtLink
                :to="moduleHref(child.id)"
                class="mt-4 block"
              >
                <h2 class="font-display text-lg font-bold text-[var(--color-ink)] underline-offset-2 hover:underline">
                  {{ child.name }}
                </h2>
              </NuxtLink>
              <p class="mt-1 line-clamp-3 text-sm text-[var(--color-muted)]">
                {{ child.description || 'Sem descrição.' }}
              </p>
              <p class="mt-3 font-mono text-xs text-[var(--color-muted)]">
                {{ child.id }}
                <template v-if="!child.platformEntry">
                  ·
                  <template v-if="child.updateAvailable && child.localVersion">
                    v{{ child.localVersion }} → v{{ child.version }}
                  </template>
                  <template v-else>
                    v{{ child.version }}
                  </template>
                  ·
                  {{ child.source }}
                </template>
              </p>
              <p
                v-if="child.minKuroneko"
                class="mt-1 text-xs text-[var(--color-muted)]"
              >
                Kuroneko ≥ {{ child.minKuroneko }}
              </p>
              <p
                v-if="child.dependsOn.length"
                class="mt-1 text-xs text-[var(--color-muted)]"
              >
                Depende de: {{ child.dependsOn.join(', ') }}
              </p>

              <div class="mt-auto flex flex-wrap items-center gap-4 pt-5">
                <NuxtLink
                  v-if="childrenOf(child.id).length"
                  :to="moduleHref(child.id, 'submodulos')"
                  class="inline-flex"
                >
                  <UiButton
                    variant="outline"
                    type="button"
                    :disabled="restarting"
                  >
                    Ver submódulos ({{ childrenOf(child.id).length }})
                  </UiButton>
                </NuxtLink>
                <NuxtLink
                  v-else
                  :to="moduleHref(child.id)"
                  class="inline-flex"
                >
                  <UiButton
                    variant="outline"
                    type="button"
                    :disabled="restarting"
                  >
                    Ver detalhes
                  </UiButton>
                </NuxtLink>
                <button
                  v-if="canInstall(child)"
                  type="button"
                  class="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)] transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-55"
                  :disabled="Boolean(busyId) || restarting"
                  @click="openInstall(child)"
                >
                  <Icon
                    :name="busyId === child.id ? 'svg-spinners:ring-resize' : 'i-solar:download-minimalistic-bold-duotone'"
                    class="text-lg"
                  />
                  {{ installActionLabel(child) }}
                </button>
              </div>
            </article>

            <p
              v-if="!directChildren.length"
              class="rounded-xl border border-dashed border-[var(--color-line)] px-5 py-10 text-center text-[var(--color-muted)] sm:col-span-2 xl:col-span-3"
            >
              Nenhum submódulo neste catálogo.
            </p>
          </div>
        </section>
      </template>

      <p
        v-else
        class="rounded-xl border border-dashed border-[var(--color-line)] px-5 py-10 text-center text-[var(--color-muted)]"
      >
        Módulo
        <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5 text-[var(--color-ink)]">{{ moduleId }}</code>
        não encontrado no catálogo.
        <NuxtLink
          to="/panel/modules/store"
          class="ml-1 font-medium text-[var(--color-ink)] underline underline-offset-2"
        >
          Voltar à loja
        </NuxtLink>
      </p>
    </div>

    <StoreLojaModals
      v-model:install-modal-open="installModalOpen"
      :install-target="installTarget"
      :install-job="installJob"
      :install-polling="installPolling"
      @close-install="closeInstallModal"
      @confirm-install="confirmInstall"
    />
  </div>
</template>
