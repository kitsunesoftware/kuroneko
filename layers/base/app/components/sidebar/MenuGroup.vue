<script setup lang="ts">
import { isSidebarGroupActive } from '../../../shared/sidebar-active'

const props = withDefaults(
	defineProps<{
		label: string;
		icon: string;
		defaultOpen?: boolean;
		childPaths?: string[];
	}>(),
	{
		defaultOpen: false,
		childPaths: () => [],
	},
);

const { displayCollapsed, expand } = useSidebar();
const route = useRoute();
const open = ref(props.defaultOpen);

const active = computed(() =>
	isSidebarGroupActive(route.path, props.childPaths),
);

watch(displayCollapsed, (value) => {
	if (value) open.value = false;
});

watch(
	active,
	(value) => {
		if (value && !displayCollapsed.value) open.value = true;
	},
	{ immediate: true },
);

function onHeaderClick() {
	if (displayCollapsed.value) {
		expand();
		open.value = true;
		return;
	}

	open.value = !open.value;
}
</script>

<template>
	<div class="w-full">
		<button
			type="button"
			class="flex w-full items-center rounded-md text-left transition"
			:class="[
				displayCollapsed ? 'h-11 justify-center' : 'gap-3 px-3 py-2.5',
				active
					? 'bg-white/[0.14] text-white'
					: 'text-white/70 hover:bg-white/10 hover:text-white',
			]"
			:aria-expanded="open"
			:aria-current="active ? 'true' : undefined"
			:title="displayCollapsed ? label : undefined"
			@click="onHeaderClick"
		>
			<Icon
				:name="icon"
				class="shrink-0 text-xl"
				:class="active ? 'text-white' : 'text-white/70'"
			/>

			<span
				v-show="!displayCollapsed"
				class="min-w-0 flex-1 truncate text-sm font-medium"
			>
				{{ label }}
			</span>

			<Icon
				v-show="!displayCollapsed"
				name="i-solar:alt-arrow-up-linear"
				class="shrink-0 text-base transition-transform duration-200"
				:class="[
					active ? 'text-white/70' : 'text-white/45',
					{ 'rotate-180': !open },
				]"
			/>
		</button>

		<div
			v-show="open && !displayCollapsed"
			class="relative mt-1 ml-5 border-l border-white/15 pl-1"
		>
			<div class="flex flex-col gap-0.5">
				<slot />
			</div>
		</div>
	</div>
</template>
