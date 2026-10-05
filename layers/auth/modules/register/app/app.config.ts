export default defineAppConfig({
  sidebar: {
    entries: {
      auth: {
        children: {
          register: {
            label: 'Cadastro',
            to: '/register',
            order: 2,
            when: 'guest',
          },
        },
      },
    },
  },
})
