export default defineAppConfig({
  sidebar: {
    entries: {
      panel: {
        enabled: true,
        type: 'group',
        label: 'Painel',
        icon: 'i-solar:widget-4-bold-duotone',
        order: 80,
        defaultOpen: true,
        moduleId: 'panel',
        children: {
          overview: {
            label: 'Visão geral',
            to: '/panel',
            order: 1,
            moduleId: 'panel',
            permission: 'panel.overview',
          },
          modules: {
            label: 'Módulos',
            to: '/panel/modules',
            order: 2,
            moduleId: 'panel',
            permission: 'panel.modules.view',
          },
          settings: {
            label: 'Configurações',
            to: '/panel/settings',
            order: 3,
            moduleId: 'panel',
            permission: 'panel.settings',
          },
          roles: {
            label: 'Permissões',
            to: '/panel/roles',
            order: 4,
            moduleId: 'auth.roles',
            permission: 'panel.roles.manage',
          },
          users: {
            label: 'Usuários',
            to: '/panel/users',
            order: 5,
            moduleId: 'auth.roles',
            permission: 'users.view',
          },
        },
      },
    },
  },
})
