<script setup lang="ts">
useSeoMeta({ title: "Módulos" });

const { modules } = useModules();
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
	hasPendingRestart,
	restarting,
	restartPhase,
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
	requestAppRestart,
} = usePanelModulesWorkspace();

function moduleHref(id: string, tab?: "submodulos") {
	const path = `/panel/modules/${encodeURIComponent(id)}`;
	return tab ? { path, query: { tab } } : path;
}

function childrenCount(mod: { children?: unknown[] }) {
	return mod.children?.length ?? 0;
}

onMounted(() => {
	void hydrateWorkspace();
});
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
						<p class="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">Painel</p>
						<h1 class="font-display text-2xl font-extrabold text-[var(--color-ink)] sm:text-3xl">
							Módulos
						</h1>
						<p class="text-[var(--color-muted)]">
							Catálogo local de módulos raiz. Abra um módulo para ver detalhes, submódulos e ações de
							instalação.
						</p>
					</div>
					<div class="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
						<UiButton
							v-if="hasPendingRestart"
							type="button"
							:disabled="restarting"
							@click="requestAppRestart"
						>
							<Icon
								:name="
									restarting ? 'i-solar:refresh-bold-duotone' : 'i-solar:refresh-circle-bold-duotone'
								"
								class="text-lg"
								:class="{ 'animate-spin': restarting }"
							/>
							{{ restarting ? restartPhase || "Reiniciando…" : "Reiniciar aplicação" }}
						</UiButton>
						<NuxtLink to="/panel/modules/store" class="inline-flex">
							<UiButton variant="outline">
								<Icon name="i-solar:shop-bold-duotone" class="text-lg" />
								Loja
							</UiButton>
						</NuxtLink>
						<NuxtLink to="/panel/modules/documentation" class="inline-flex">
							<UiButton variant="outline">
								<Icon name="i-solar:notebook-bookmark-bold-duotone" class="text-lg" />
								Documentação
							</UiButton>
						</NuxtLink>
					</div>
				</div>
			</header>

			<input
				ref="restoreFileInput"
				type="file"
				accept="application/json,.json"
				class="hidden"
				@change="onRestoreFileChange"
			/>

			<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				<article
					v-for="mod in modules"
					:key="mod.id"
					class="relative flex flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-white/80 p-5"
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

					<NuxtLink :to="moduleHref(mod.id)" class="mt-4 block">
						<h2
							class="font-display text-lg font-bold text-[var(--color-ink)] underline-offset-2 hover:underline"
						>
							{{ mod.label }}
						</h2>
					</NuxtLink>
					<p class="mt-1 line-clamp-3 text-sm text-[var(--color-muted)]">
						{{ mod.description || "Sem descrição." }}
					</p>
					<p class="mt-3 font-mono text-xs text-[var(--color-muted)]">
						{{ mod.id }}
					</p>

					<div class="mt-auto flex flex-wrap items-center justify-between gap-4 pt-5">
						<NuxtLink v-if="childrenCount(mod)" :to="moduleHref(mod.id, 'submodulos')" class="inline-flex">
							<UiButton variant="outline" type="button">
								Ver submódulos ({{ childrenCount(mod) }})
							</UiButton>
						</NuxtLink>
						<NuxtLink v-else :to="moduleHref(mod.id)" class="inline-flex">
							<UiButton variant="outline" type="button"> Ver detalhes </UiButton>
						</NuxtLink>

						<ModulesModuleActions
							:installed="mod.installed"
							:enabled="mod.enabled"
							:installable="mod.installable"
							:can-disable="mod.canDisable"
							:can-install="true"
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
					</div>

					<div
						v-if="mod.installed && mod.pendingUninstall"
						class="absolute inset-0 z-[1] flex select-none items-end rounded-xl bg-gradient-to-t from-[#1C223D]/90 via-[#1C223D]/45 to-transparent px-4 pb-4 pt-16"
						aria-hidden="true"
					>
						<p class="flex items-center gap-2 text-sm font-medium leading-snug text-white">
							<Icon name="i-solar:trash-bin-trash-bold-duotone" class="shrink-0 text-base opacity-90" />
							<span>Sai da lista após reiniciar</span>
						</p>
					</div>
					<div
						v-else-if="mod.pendingInstall"
						class="absolute inset-0 z-[1] flex select-none items-end rounded-xl bg-gradient-to-t from-[#1C223D]/90 via-[#1C223D]/45 to-transparent px-4 pb-4 pt-16"
						aria-hidden="true"
					>
						<p class="flex items-center gap-2 text-sm font-medium leading-snug text-white">
							<Icon name="i-solar:restart-circle-bold-duotone" class="shrink-0 text-base opacity-90" />
							<span>O módulo requer reinicialização da aplicação para funcionar</span>
						</p>
					</div>
				</article>

				<p
					v-if="!modules.length"
					class="rounded-xl border border-dashed border-[var(--color-line)] px-5 py-10 text-center text-[var(--color-muted)] sm:col-span-2 xl:col-span-3"
				>
					Nenhum módulo registrado ainda.
				</p>
			</div>
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
	</div>
</template>
