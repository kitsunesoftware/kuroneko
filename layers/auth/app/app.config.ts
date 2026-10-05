/**
 * Shell do grupo "Conta" no sidebar.
 * Não declare `children` aqui — os submódulos registram via plugin.
 */
export default defineAppConfig({
  sidebar: {
    entries: {
      auth: {
        enabled: true,
        type: 'group',
        label: 'Conta',
        icon: 'i-solar:user-bold-duotone',
        order: 20,
        defaultOpen: true,
        moduleId: 'auth',
      },
    },
  },
})
