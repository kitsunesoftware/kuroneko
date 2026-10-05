<script setup lang="ts">
const { collapsed, displayCollapsed, mobileOpen, toggle, closeMobile, toggleMobile } = useSidebar();

const route = useRoute();

watch(
	() => route.fullPath,
	() => {
		closeMobile();
	},
);

watch(mobileOpen, (open) => {
	if (!import.meta.client) return;
	if (open) {
		document.body.style.overflow = "hidden";
		return;
	}
	const modalStack = useState<number>("kuroneko-modal-stack", () => 0);
	if (modalStack.value === 0) {
		document.body.style.overflow = "";
	}
});

onBeforeUnmount(() => {
	if (!import.meta.client) return;
	document.body.style.overflow = "";
});
</script>

<template>
	<div class="flex h-dvh w-full bg-[#F8F8F6]">
		<div
			v-if="mobileOpen"
			class="fixed inset-0 z-40 bg-black/45 lg:hidden"
			aria-hidden="true"
			@click="closeMobile"
		/>

		<aside
			class="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col justify-between overflow-hidden bg-[#1C223D] text-white transition-[transform,width] duration-300 ease-in-out lg:static lg:z-auto lg:h-full lg:shrink-0 lg:translate-x-0"
			:class="[mobileOpen ? 'translate-x-0' : '-translate-x-full', collapsed ? 'lg:w-20' : 'lg:w-[320px]']"
		>
			<div class="min-h-0 flex-1 overflow-y-auto">
				<div
					class="flex w-full border-b border-white/5 transition-all duration-300"
					:class="
						displayCollapsed
							? 'flex-col items-center gap-3 px-2 py-4'
							: 'h-20 flex-row items-center justify-between px-5'
					"
				>
					<AppBrand :collapsed="displayCollapsed" />

					<button
						type="button"
						class="flex w-11 shrink-0 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
						:class="displayCollapsed ? 'h-10' : 'h-11'"
						aria-label="Fechar menu"
						@click="closeMobile"
					>
						<Icon name="solar:close-circle-line-duotone" class="text-xl" />
					</button>

					<button
						type="button"
						class="hidden w-11 shrink-0 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white lg:flex"
						:class="displayCollapsed ? 'h-10' : 'h-11'"
						:aria-label="displayCollapsed ? 'Expandir menu' : 'Recolher menu'"
						:aria-expanded="!displayCollapsed"
						@click="toggle"
					>
						<Icon
							name="i-solar:alt-arrow-left-bold-duotone"
							class="text-xl transition-transform duration-300"
							:class="{ 'rotate-180': displayCollapsed }"
						/>
					</button>
				</div>

				<slot name="sidebar">
					<AppSidebarNav />
				</slot>
			</div>

			<div class="shrink-0 border-t border-white/5 px-2 py-4">
				<slot name="sidebar-footer">
					<AppSidebarFooter />
				</slot>
			</div>
		</aside>

		<div class="flex min-w-0 flex-1 flex-col">
			<header
				class="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--color-line)] bg-white px-3 lg:hidden"
			>
				<button
					type="button"
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--color-ink)] transition hover:bg-[var(--color-paper-deep)]"
					aria-label="Abrir menu"
					:aria-expanded="mobileOpen"
					@click="toggleMobile"
				>
					<Icon name="solar:hamburger-menu-line-duotone" class="text-2xl" />
				</button>
				<AppBrand class="min-w-0" variant="light" />
			</header>

			<main class="min-h-0 flex-1 overflow-auto">
				<slot />
			</main>
		</div>

		<AppRestartOverlay />
	</div>
</template>
