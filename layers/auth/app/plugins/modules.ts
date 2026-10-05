export default defineNuxtPlugin(() => {
  contributeModule({
    id: 'auth',
    label: 'Autenticação',
    description: 'Núcleo de autenticação, sessão e middlewares.',
    icon: 'i-solar:shield-keyhole-bold-duotone',
    sidebarGroupId: 'auth',
    defaultEnabled: true,
    installable: false,
    canDisable: false,
    order: 20,
  })
})
