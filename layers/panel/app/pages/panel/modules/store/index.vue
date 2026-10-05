<script setup lang="ts">
useSeoMeta({ title: 'Loja de módulos' })

const {
  loading,
  syncing,
  busyId,
  loadError,
  installModalOpen,
  installTarget,
  installJob,
  installPolling,
  restarting,
  hasPendingRestart,
  storeConfigured,
  storeRepoLabel,
  rootModules,
  childrenOf,
  canInstall,
  installActionLabel,
  openInstall,
  closeInstallModal,
  confirmInstall,
  syncStore,
} = useStoreLoja()

function moduleHref(id: string, tab?: 'submodulos') {
  const path = `/panel/modules/store/${encodeURIComponent(id)}`
  return tab ? { path, query: { tab } } : path
}
</script>

<template>
  <div>
    <div
      v-if="hasPendingRestart && !restarting"
      class="border-b border-[#1C223D]/10 bg-[#1C223D]/[0.04] px-4 py-2.5 sm:px-6 lg:px-10"
    >
      <div class="mx-auto flex w-full max-w-[1440px] items-start gap-2.5 text-sm text-[var(--color-ink)]">
        <Icon
          name="i-solar:restart-circle-bold-duotone"
          class="mt-0.5 shrink-0 text-base text-[#1C223D]/70"
        />
        <p class="min-w-0">
          Há módulos para serem instalados ou removidos. Isso requer reinicialização da aplicação.
        </p>
      </div>
    </div>

    <div class="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
    <div class="mx-auto w-full max-w-[1440px] space-y-8">
      <header class="space-y-3">
        <div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div class="min-w-0 space-y-2">
            <p class="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Painel
            </p>
            <h1 class="font-display text-2xl font-extrabold text-[var(--color-ink)] sm:text-3xl">
              Loja de módulos
            </h1>
            <p class="text-[var(--color-muted)]">
              Instalar adiciona o módulo à fila. Reinicie a aplicação para aplicar (schema, build e PM2).
              <template v-if="storeRepoLabel">
                Catálogo:
                <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5 text-sm text-[var(--color-ink)]">{{ storeRepoLabel }}</code>
              </template>
            </p>
          </div>
          <div class="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            <UiButton
              type="button"
              :loading="syncing"
              :disabled="restarting || !storeConfigured"
              @click="syncStore"
            >
              <Icon
                name="i-solar:refresh-bold-duotone"
                class="text-lg"
              />
              Sincronizar
            </UiButton>
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
        Carregando catálogo…
      </p>

      <div
        v-else
        class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <article
          v-for="mod in rootModules"
          :key="mod.id"
          class="flex flex-col rounded-xl border border-[var(--color-line)] bg-white/80 p-5"
        >
          <div class="flex items-start justify-between gap-3">
            <span class="flex w-10 shrink-0 items-center justify-center text-[var(--color-ink)]">
              <ModuleIcon
                :icon="mod.icon"
                :icon-url="mod.iconUrl"
                :module-id="mod.id"
                icon-class="w-full text-[2.5rem]"
              />
            </span>
            <div class="flex flex-wrap justify-end gap-1.5">
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
                >
                  atualização
                </span>
              </template>
            </div>
          </div>

          <NuxtLink
            :to="moduleHref(mod.id)"
            class="mt-4 block"
          >
            <h2 class="font-display text-lg font-bold text-[var(--color-ink)] underline-offset-2 hover:underline">
              {{ mod.name }}
            </h2>
          </NuxtLink>
          <p class="mt-1 line-clamp-3 text-sm text-[var(--color-muted)]">
            {{ mod.description || 'Sem descrição.' }}
          </p>
          <p class="mt-3 font-mono text-xs text-[var(--color-muted)]">
            {{ mod.id }}
            <template v-if="!mod.platformEntry">
              · v{{ mod.version }}
            </template>
          </p>

          <div class="mt-auto flex flex-wrap items-center gap-4 pt-5">
            <NuxtLink
              :to="moduleHref(mod.id, childrenOf(mod.id).length ? 'submodulos' : undefined)"
              class="inline-flex"
            >
              <UiButton
                variant="outline"
                type="button"
                :disabled="restarting"
              >
                {{ childrenOf(mod.id).length ? `Ver submódulos (${childrenOf(mod.id).length})` : 'Ver detalhes' }}
              </UiButton>
            </NuxtLink>
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
          </div>
        </article>

        <p
          v-if="!rootModules.length"
          class="rounded-xl border border-dashed border-[var(--color-line)] px-5 py-10 text-center text-[var(--color-muted)] sm:col-span-2 xl:col-span-3"
        >
          Nenhum módulo no catálogo.
        </p>
      </div>
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
  </div>
</template>
