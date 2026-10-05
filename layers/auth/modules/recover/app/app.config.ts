export default defineAppConfig({
  sidebar: {
    entries: {
      auth: {
        children: {
          recover: {
            label: 'Recuperar conta',
            to: '/recover',
            order: 3,
            when: 'guest',
          },
        },
      },
    },
  },
})
