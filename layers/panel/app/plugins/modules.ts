export default defineNuxtPlugin(() => {
  contributeModule({
    id: 'panel',
    label: 'Painel administrativo',
    description: 'Área administrativa do template (não pode ser desativada).',
    icon: 'i-solar:widget-4-bold-duotone',
    routes: ['/panel'],
    sidebarGroupId: 'panel',
    defaultEnabled: true,
    canDisable: false,
    installable: false,
    order: 80,
  })
})
