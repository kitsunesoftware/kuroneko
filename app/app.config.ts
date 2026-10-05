/**
 * Overrides do projeto (superfície do usuário).
 * A plataforma contribui entries em layers/* — aqui só o que é do seu site.
 */
export default defineAppConfig({
  sidebar: {
    entries: {
      about: {
        enabled: true,
        type: 'item',
        label: 'Sobre',
        icon: 'i-solar:info-circle-bold-duotone',
        to: '/sobre',
        order: 20,
      },
    },
  },
})
