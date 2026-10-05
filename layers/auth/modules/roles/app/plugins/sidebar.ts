export const ROLES_MODULE_ID = 'auth.roles'

export default defineNuxtPlugin(() => {
  contributeModule({
    id: ROLES_MODULE_ID,
    parentId: 'auth',
    label: 'Permissões',
    description: 'Tipos de permissão e o que cada papel pode fazer.',
    icon: 'i-solar:shield-user-bold-duotone',
    routes: ['/panel/roles', '/panel/users'],
    sidebarGroupId: 'panel',
    sidebarChildId: 'roles',
    defaultEnabled: true,
    installable: false,
    canDisable: false,
    order: 25,
  })

  contributeSidebarChild('panel', 'roles', {
    label: 'Permissões',
    to: '/panel/roles',
    order: 4,
    moduleId: ROLES_MODULE_ID,
    permission: 'panel.roles.manage',
  })

  contributeSidebarChild('panel', 'users', {
    label: 'Usuários',
    to: '/panel/users',
    order: 5,
    moduleId: ROLES_MODULE_ID,
    permission: 'users.view',
  })
})
