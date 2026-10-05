<script setup lang="ts">
const { displayCollapsed } = useSidebar();
const { entries } = useSidebarMenu();

const rootItemPaths = computed(() =>
	entries.value
		.filter((entry): entry is Extract<typeof entry, { type: 'item' }> => entry.type === 'item')
		.map((entry) => entry.to),
);

function childPaths(children: Array<{ to: string }>) {
	return children.map((child) => child.to);
}
</script>

<template>
	<nav
		class="flex flex-col gap-1"
		:class="displayCollapsed ? 'items-center px-2 py-4' : 'p-3'"
	>
		<template
			v-for="entry in entries"
			:key="entry.id"
		>
			<SidebarMenuItem
				v-if="entry.type === 'item'"
				:to="entry.to"
				:label="entry.label"
				:icon="entry.icon"
				:sibling-paths="rootItemPaths"
			/>

			<SidebarMenuGroup
				v-else
				:label="entry.label"
				:icon="entry.icon"
				:default-open="entry.defaultOpen"
				:child-paths="childPaths(entry.children)"
			>
				<SidebarMenuItem
					v-for="child in entry.children"
					:key="`${entry.id}-${child.id}`"
					:to="child.to"
					:label="child.label"
					:sibling-paths="childPaths(entry.children)"
				/>
			</SidebarMenuGroup>
		</template>
	</nav>
</template>
