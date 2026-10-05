export default defineNuxtPlugin(() => {
  contributeModule({
    id: 'auth.recover',
    parentId: 'auth',
    label: 'Recuperar conta',
    description: 'Fluxo de recuperação de senha/account.',
    icon: 'i-solar:key-bold-duotone',
    routes: ['/recover'],
    sidebarGroupId: 'auth',
    sidebarChildId: 'recover',
    defaultEnabled: true,
    installable: false,
    order: 3,
  })

  contributeSidebarChild('auth', 'recover', {
    label: 'Recuperar conta',
    to: '/recover',
    order: 3,
    when: 'guest',
    moduleId: 'auth.recover',
  })
})
