<script setup lang="ts">
import { isSidebarPathActive } from '../../../shared/sidebar-active'

const props = defineProps<{
	to: string;
	label: string;
	icon?: string;
	/** Outros `to` do mesmo nível — o mais específico vence. */
	siblingPaths?: string[];
}>();

const { collapsed, displayCollapsed, expand } = useSidebar();
const route = useRoute();

const active = computed(() =>
	isSidebarPathActive(route.path, props.to, props.siblingPaths ?? []),
);

function onClick() {
	if (collapsed.value) expand();
}
</script>

<template>
	<!-- Item raiz (com ícone), usado fora de um grupo -->
	<NuxtLink
		v-if="icon"
		:to="to"
		class="flex w-full items-center rounded-md transition"
		:class="[
			displayCollapsed ? 'h-11 justify-center' : 'gap-3 px-3 py-2.5',
			active ? 'bg-white/[0.14] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
		]"
		:aria-current="active ? 'page' : undefined"
		:title="displayCollapsed ? label : undefined"
		@click="onClick"
	>
		<Icon :name="icon" class="shrink-0 text-xl" />
		<span v-show="!displayCollapsed" class="truncate text-sm font-medium">
			{{ label }}
		</span>
	</NuxtLink>

	<!-- Subitem (sem ícone), dentro de um MenuGroup -->
	<NuxtLink
		v-else
		:to="to"
		class="block rounded-md px-3 py-2 text-sm font-medium transition"
		:class="active
			? 'bg-white/[0.14] text-white'
			: 'text-white/45 hover:bg-white/10 hover:text-white'"
		:aria-current="active ? 'page' : undefined"
	>
		{{ label }}
	</NuxtLink>
</template>
