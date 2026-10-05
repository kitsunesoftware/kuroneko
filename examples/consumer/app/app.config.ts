/** Overrides só do site consumidor. */
export default defineAppConfig({
  sidebar: {
    entries: {
      contato: {
        enabled: true,
        type: 'item',
        label: 'Contato',
        icon: 'i-solar:letter-bold-duotone',
        to: '/contato',
        order: 25,
      },
    },
  },
})
