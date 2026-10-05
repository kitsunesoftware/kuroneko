/**
 * Submódulo de conta autenticada.
 * Página /account e componentes de avatar/modais vivem neste módulo.
 */
export default defineAppConfig({
  sidebar: {
    entries: {
      auth: {
        children: {
          account: {
            label: 'Conta e senha',
            to: '/account',
            order: 4,
            when: 'auth',
            moduleId: 'auth.account',
          },
        },
      },
    },
  },
})
