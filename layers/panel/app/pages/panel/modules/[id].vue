<script setup lang="ts">
const route = useRoute();
const { flat } = useModules();
const {
	hasSettings,
	busyId,
	busyAction,
	settingsOpen,
	settingsModuleId,
	settingsTitle,
	settingsSaveStatus,
	uninstallOpen,
	uninstallTarget,
	removeLayerOpen,
	removeLayerTarget,
	removeLayerNoticeOpen,
	lastRemovedLayerTarget,
	lastRemovedLayerLabel,
	restoreOpen,
	restoreTarget,
	restoreFileInput,
	transferLoading,
	transferTitle,
	transferMessage,
	canRebuildPm2,
	restartHint,
	restarting,
	hydrateWorkspace,
	onToggle,
	onInstall,
	requestUninstall,
	cancelUninstall,
	confirmUninstall,
	requestRemoveLayer,
	cancelRemoveLayer,
	confirmRemoveLayer,
	onBackup,
	requestRestore,
	onRestoreFileChange,
	cancelRestore,
	confirmRestore,
	openSettings,
	onSettingsStatus,
	closeRemoveLayerNotice,
	clearRemoveLayerNotice,
} = usePanelModulesWorkspace();

const moduleId = computed(() => {
	const raw = route.params.id;
	const value = Array.isArray(raw) ? raw[0] : raw;
	return value ? decodeURIComponent(value) : "";
});

const activeTab = ref<"detalhes" | "submodulos">("detalhes");

const mod = computed(() => (moduleId.value ? (flat.value.find((item) => item.id === moduleId.value) ?? null) : null));

const parentMod = computed(() => {
	if (!mod.value?.parentId) return null;
	return flat.value.find((item) => item.id === mod.value!.parentId) ?? null;
});

const directChildren = computed(() =>
	moduleId.value
		? flat.value
				.filter((item) => item.parentId === moduleId.value)
				.sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
		: [],
);

const directChildCount = computed(() => directChildren.value.length);

const canInstallHere = computed(() => {
	if (!mod.value) return false;
	if (!mod.value.parentId) return true;
	if (!parentMod.value) return false;
	return parentMod.value.installed && parentMod.value.enabled;
});

const pageTitle = computed(() => (mod.value ? `${mod.value.label} · Módulos` : "Módulo"));
useSeoMeta({ title: pageTitle });

function moduleHref(id: string, tab?: "submodulos") {
	const path = `/panel/modules/${encodeURIComponent(id)}`;
	return tab ? { path, query: { tab } } : path;
}

function childCanInstall(child: { parentId?: string }) {
	if (!child.parentId) return true;
	const parent = flat.value.find((item) => item.id === child.parentId);
	return Boolean(parent?.installed && parent.enabled);
}

function childrenOf(id: string) {
	return flat.value.filter((item) => item.parentId === id);
}

function tabFromQuery() {
	return route.query.tab === "submodulos" ? "submodulos" : "detalhes";
}

watch(
	[moduleId, () => route.query.tab],
	() => {
		activeTab.value = tabFromQuery();
	},
	{ immediate: true },
);

watch(activeTab, (tab) => {
	if (tab === tabFromQuery()) return;
	navigateTo(
		{
			path: route.path,
			query: tab === "submodulos" ? { tab: "submodulos" } : {},
		},
		{ replace: true },
	);
});

onMounted(() => {
	void hydrateWorkspace();
});
</script>

<template>
	<div class="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
		<div class="mx-auto w-full max-w-[1440px] space-y-8">
			<header class="space-y-4">
				<div class="flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
					<NuxtLink
						to="/panel/modules"
						class="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
					>
						Módulos
					</NuxtLink>
					<span aria-hidden="true">/</span>
					<template v-if="parentMod">
						<NuxtLink
							:to="moduleHref(parentMod.id)"
							class="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
						>
							{{ parentMod.label }}
						</NuxtLink>
						<span aria-hidden="true">/</span>
					</template>
					<span class="min-w-0 break-words text-[var(--color-ink)]">{{
						mod?.label || moduleId || "Módulo"
					}}</span>
				</div>

				<div v-if="mod" class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
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
								{{ mod.label }}
							</h1>
							<p class="break-all font-mono text-sm text-[var(--color-muted)]">
								{{ mod.id }}
							</p>
							<div class="flex flex-wrap gap-1.5">
								<span
									v-if="!mod.installable"
									class="rounded-md bg-[var(--color-paper-deep)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted)]"
								>
									sistema
								</span>
								<span
									v-else
									class="rounded-md px-2 py-0.5 text-xs font-medium"
									:class="
										mod.installed
											? 'bg-[#1C223D]/10 text-[#1C223D]'
											: 'bg-[var(--color-paper-deep)] text-[var(--color-muted)]'
									"
								>
									{{ mod.installed ? "instalado" : "não instalado" }}
								</span>
								<span
									v-if="mod.installed && !mod.pendingUninstall && !mod.needsRestart"
									class="rounded-md px-2 py-0.5 text-xs font-medium"
									:class="
										mod.enabled
											? 'bg-emerald-500/10 text-[var(--color-success)]'
											: 'bg-[var(--color-paper-deep)] text-[var(--color-muted)]'
									"
								>
									{{ mod.enabled ? "ativo" : "pausado" }}
								</span>
							</div>
						</div>
					</div>

					<div class="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:shrink-0 sm:justify-end">
						<ModulesModuleActions
							:installed="mod.installed"
							:enabled="mod.enabled"
							:installable="mod.installable"
							:can-disable="mod.canDisable"
							:can-install="canInstallHere"
							:can-remove-layer="mod.canRemoveLayer"
							:needs-restart="mod.needsRestart"
							:busy="busyId === mod.id"
							:busy-action="busyId === mod.id ? busyAction : null"
							:has-settings="hasSettings(mod.id)"
							@install="onInstall(mod.id)"
							@uninstall="requestUninstall(mod.id, mod.label)"
							@remove-layer="requestRemoveLayer(mod.id, mod.label, mod.layerTarget)"
							@backup="onBackup(mod.id)"
							@restore="requestRestore(mod.id, mod.label)"
							@settings="openSettings(mod.id, mod.label)"
							@toggle="onToggle(mod.id, $event)"
						/>
						<NuxtLink to="/panel/modules/store" class="inline-flex">
							<UiButton variant="ghost"> Loja </UiButton>
						</NuxtLink>
					</div>
				</div>

				<p
					v-if="mod.pendingUninstall && !restarting"
					class="mt-4 flex items-start gap-2.5 rounded-lg border border-[#1C223D]/10 bg-[#1C223D]/[0.04] px-3.5 py-3 text-sm text-[var(--color-ink)]"
				>
					<Icon
						name="i-solar:trash-bin-trash-bold-duotone"
						class="mt-0.5 shrink-0 text-base text-[#1C223D]/70"
					/>
					<span>
						Remoção agendada — este módulo deixa a lista no próximo reinício.
						<template v-if="canRebuildPm2">
							Vá em
							<NuxtLink
								to="/panel/modules"
								class="font-medium underline underline-offset-2"
							>
								Meus módulos
							</NuxtLink>
							para reiniciar.
						</template>
						<template v-else>
							{{ restartHint }}
						</template>
					</span>
				</p>
				<p
					v-else-if="mod.needsRestart && !restarting"
					class="mt-4 rounded-lg border border-[var(--color-line)] bg-[#F8F8F6] px-3 py-2 text-sm text-[var(--color-ink)]"
				>
					<template v-if="canRebuildPm2">
						Este módulo só ativa após reiniciar. Vá em
						<NuxtLink
							to="/panel/modules"
							class="font-medium text-[var(--color-ink)] underline underline-offset-2"
						>
							Meus módulos
						</NuxtLink>
						para reiniciar a aplicação.
					</template>
					<template v-else>
						Este módulo só pode ser ativado após reiniciar a aplicação — {{ restartHint }}
					</template>
				</p>
			</header>

			<input
				ref="restoreFileInput"
				type="file"
				accept="application/json,.json"
				class="hidden"
				@change="onRestoreFileChange"
			/>

			<template v-if="mod">
				<div class="flex gap-1 overflow-x-auto border-b border-[var(--color-line)]">
					<button
						type="button"
						class="shrink-0 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4"
						:class="
							activeTab === 'detalhes'
								? 'border-b-2 border-[var(--color-ink)] text-[var(--color-ink)]'
								: 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
						"
						@click="activeTab = 'detalhes'"
					>
						Detalhes
					</button>
					<button
						type="button"
						class="shrink-0 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4"
						:class="
							activeTab === 'submodulos'
								? 'border-b-2 border-[var(--color-ink)] text-[var(--color-ink)]'
								: 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
						"
						@click="activeTab = 'submodulos'"
					>
						Submódulos
						<span class="ml-1 text-[var(--color-muted)]">({{ directChildCount }})</span>
					</button>
				</div>

				<section v-if="activeTab === 'detalhes'" class="max-w-3xl space-y-6">
					<div class="space-y-2">
						<h2 class="font-display text-lg font-bold text-[var(--color-ink)]">Sobre</h2>
						<p class="text-[var(--color-muted)]">
							{{ mod.description || "Sem descrição." }}
						</p>
					</div>

					<dl class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
								Identificador
							</dt>
							<dd class="break-all font-mono text-sm text-[var(--color-ink)]">
								{{ mod.id }}
							</dd>
						</div>
						<div class="space-y-1">
							<dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
								Estado
							</dt>
							<dd class="text-sm text-[var(--color-ink)]">
								<template v-if="!mod.installed"> Não instalado </template>
								<template v-else-if="mod.pendingUninstall">
									Remoção agendada
								</template>
								<template v-else-if="mod.needsRestart">
									Instalado — aguarda reinício da aplicação
								</template>
								<template v-else>
									{{ mod.enabled ? "Instalado e ativo" : "Instalado e pausado" }}
								</template>
							</dd>
						</div>
						<div v-if="mod.layerTarget" class="space-y-1">
							<dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
								Pacote em layers/
							</dt>
							<dd class="font-mono text-sm text-[var(--color-ink)]">
								{{ mod.layerTarget }}
							</dd>
						</div>
						<div class="space-y-1">
							<dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
								Instalável
							</dt>
							<dd class="text-sm text-[var(--color-ink)]">
								{{ mod.installable ? "Sim" : "Não (módulo de sistema)" }}
							</dd>
						</div>
						<div v-if="parentMod" class="space-y-1">
							<dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
								Módulo pai
							</dt>
							<dd>
								<NuxtLink
									:to="moduleHref(parentMod.id)"
									class="text-sm font-medium text-[var(--color-ink)] underline underline-offset-2"
								>
									{{ parentMod.label }}
								</NuxtLink>
							</dd>
						</div>
						<div class="space-y-1">
							<dt class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
								Submódulos
							</dt>
							<dd class="text-sm text-[var(--color-ink)]">
								{{ directChildCount }}
							</dd>
						</div>
					</dl>

					<p
						v-if="mod.parentId && !canInstallHere"
						class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
					>
						Instale e ative o módulo pai antes de instalar este submódulo.
					</p>
				</section>

				<section v-else class="space-y-4">
					<p class="text-sm text-[var(--color-muted)]">
						Submódulos diretos de
						<code class="rounded bg-[var(--color-paper-deep)] px-1 py-0.5 text-[var(--color-ink)]">{{
							mod.id
						}}</code
						>.
					</p>

					<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
						<article
							v-for="child in directChildren"
							:key="child.id"
							class="relative flex flex-col rounded-xl border border-[var(--color-line)] bg-white/80 p-5 overflow-hidden"
							:class="{ 'opacity-55': !childCanInstall(child) && !child.installed }"
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
										v-if="!child.installable"
										class="rounded-md bg-[var(--color-paper-deep)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted)]"
									>
										sistema
									</span>
									<span
										v-else
										class="rounded-md px-2 py-0.5 text-xs font-medium"
										:class="
											child.installed
												? 'bg-[#1C223D]/10 text-[#1C223D]'
												: 'bg-[var(--color-paper-deep)] text-[var(--color-muted)]'
										"
									>
										{{ child.installed ? "instalado" : "não instalado" }}
									</span>
									<span
										v-if="child.installed && !child.pendingUninstall && !child.needsRestart"
										class="rounded-md px-2 py-0.5 text-xs font-medium"
										:class="
											child.enabled
												? 'bg-emerald-500/10 text-[var(--color-success)]'
												: 'bg-[var(--color-paper-deep)] text-[var(--color-muted)]'
										"
									>
										{{ child.enabled ? "ativo" : "pausado" }}
									</span>
								</div>
							</div>

							<NuxtLink :to="moduleHref(child.id)" class="mt-4 block">
								<h2
									class="font-display text-lg font-bold text-[var(--color-ink)] underline-offset-2 hover:underline"
								>
									{{ child.label }}
								</h2>
							</NuxtLink>
							<p class="mt-1 line-clamp-3 text-sm text-[var(--color-muted)]">
								{{ child.description || "Sem descrição." }}
							</p>
							<p class="mt-3 font-mono text-xs text-[var(--color-muted)]">
								{{ child.id }}
							</p>

							<div class="mt-auto flex flex-wrap items-center justify-between gap-4 pt-5">
								<NuxtLink
									v-if="childrenOf(child.id).length"
									:to="moduleHref(child.id, 'submodulos')"
									class="inline-flex"
								>
									<UiButton variant="outline" type="button">
										Ver submódulos ({{ childrenOf(child.id).length }})
									</UiButton>
								</NuxtLink>
								<NuxtLink v-else :to="moduleHref(child.id)" class="inline-flex">
									<UiButton variant="outline" type="button"> Ver detalhes </UiButton>
								</NuxtLink>

								<ModulesModuleActions
									:installed="child.installed"
									:enabled="child.enabled"
									:installable="child.installable"
									:can-disable="child.canDisable"
									:can-install="childCanInstall(child)"
									:can-remove-layer="child.canRemoveLayer"
									:needs-restart="child.needsRestart"
									:busy="busyId === child.id"
									:busy-action="busyId === child.id ? busyAction : null"
									:has-settings="hasSettings(child.id)"
									@install="onInstall(child.id)"
									@uninstall="requestUninstall(child.id, child.label)"
									@remove-layer="requestRemoveLayer(child.id, child.label, child.layerTarget)"
									@backup="onBackup(child.id)"
									@restore="requestRestore(child.id, child.label)"
									@settings="openSettings(child.id, child.label)"
									@toggle="onToggle(child.id, $event)"
								/>
							</div>

							<div
								v-if="child.installed && child.pendingUninstall"
								class="absolute inset-0 z-[1] flex select-none items-end rounded-xl bg-gradient-to-t from-[#1C223D]/90 via-[#1C223D]/45 to-transparent px-4 pb-4 pt-16"
								aria-hidden="true"
							>
								<p class="flex items-center gap-2 text-sm font-medium leading-snug text-white">
									<Icon
										name="i-solar:trash-bin-trash-bold-duotone"
										class="shrink-0 text-base opacity-90"
									/>
									<span>Sai da lista após reiniciar</span>
								</p>
							</div>
							<div
								v-else-if="child.pendingInstall"
								class="absolute inset-0 z-[1] flex select-none items-end rounded-xl bg-gradient-to-t from-[#1C223D]/90 via-[#1C223D]/45 to-transparent px-4 pb-4 pt-16"
								aria-hidden="true"
							>
								<p class="flex items-center gap-2 text-sm font-medium leading-snug text-white">
									<Icon
										name="i-solar:restart-circle-bold-duotone"
										class="shrink-0 text-base opacity-90"
									/>
									<span>O módulo requer reinicialização da aplicação para funcionar</span>
								</p>
							</div>
						</article>

						<p
							v-if="!directChildren.length"
							class="rounded-xl border border-dashed border-[var(--color-line)] px-5 py-10 text-center text-[var(--color-muted)] sm:col-span-2 xl:col-span-3"
						>
							Nenhum submódulo neste módulo.
						</p>
					</div>
				</section>
			</template>

			<p
				v-else
				class="rounded-xl border border-dashed border-[var(--color-line)] px-5 py-10 text-center text-[var(--color-muted)]"
			>
				Módulo
				<code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5 text-[var(--color-ink)]">{{
					moduleId
				}}</code>
				não encontrado no catálogo local.
				<NuxtLink
					to="/panel/modules"
					class="ml-1 font-medium text-[var(--color-ink)] underline underline-offset-2"
				>
					Voltar aos módulos
				</NuxtLink>
			</p>
		</div>

		<ModulesWorkspaceModals
			v-model:settings-open="settingsOpen"
			v-model:uninstall-open="uninstallOpen"
			v-model:remove-layer-open="removeLayerOpen"
			v-model:remove-layer-notice-open="removeLayerNoticeOpen"
			v-model:restore-open="restoreOpen"
			:settings-module-id="settingsModuleId"
			:settings-title="settingsTitle"
			:settings-save-status="settingsSaveStatus"
			:uninstall-target="uninstallTarget"
			:remove-layer-target="removeLayerTarget"
			:last-removed-layer-target="lastRemovedLayerTarget"
			:last-removed-layer-label="lastRemovedLayerLabel"
			:restore-target="restoreTarget"
			:busy-id="busyId"
			:transfer-loading="transferLoading"
			:transfer-title="transferTitle"
			:transfer-message="transferMessage"
			@settings-status="onSettingsStatus"
			@cancel-uninstall="cancelUninstall"
			@confirm-uninstall="confirmUninstall"
			@cancel-remove-layer="cancelRemoveLayer"
			@confirm-remove-layer="confirmRemoveLayer"
			@close-remove-layer-notice="closeRemoveLayerNotice"
			@clear-remove-layer-notice="clearRemoveLayerNotice"
			@cancel-restore="cancelRestore"
			@confirm-restore="confirmRestore"
		/>
	</div>
</template>
