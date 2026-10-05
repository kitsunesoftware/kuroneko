export { LOGIN_MODULE_ID, LOGIN_GLOBAL_BLOCK_HOURS, loginSettingsDefaults } from '../../shared/login-settings'
import { LOGIN_MODULE_ID, LOGIN_GLOBAL_BLOCK_HOURS, loginSettingsDefaults } from '../../shared/login-settings'

export default defineNuxtPlugin(() => {
  contributeModule({
    id: LOGIN_MODULE_ID,
    parentId: 'auth',
    label: 'Login',
    description: 'Página e fluxo de entrada.',
    icon: 'i-solar:login-3-bold-duotone',
    routes: ['/login'],
    sidebarGroupId: 'auth',
    sidebarChildId: 'login',
    defaultEnabled: true,
    installable: false,
    canDisable: false,
    order: 1,
  })

  contributeSidebarChild('auth', 'login', {
    label: 'Entrar',
    to: '/login',
    order: 1,
    when: 'guest',
    moduleId: LOGIN_MODULE_ID,
  })

  contributeModuleSettings({
    moduleId: LOGIN_MODULE_ID,
    groups: [
      {
        id: 'identifier',
        label: 'Identificação',
        fields: [
          {
            key: 'allowUsernameLogin',
            type: 'boolean',
            label: 'Aceitar nome de usuário',
            description: 'Além do e-mail, permite entrar com o nome de usuário.',
            default: loginSettingsDefaults.allowUsernameLogin,
          },
          {
            key: 'allowRememberAccount',
            type: 'boolean',
            label: 'Permitir salvar conta',
            description: 'Exibe a opção de lembrar o e-mail/usuário no formulário de login.',
            default: loginSettingsDefaults.allowRememberAccount,
          },
        ],
      },
      {
        id: 'rateLimit',
        label: 'Rate limit',
        description: 'Limite de tentativas malsucedidas. Após a janela, bloqueio temporário; ao esgotar o global, bloqueio de 24 horas.',
        fields: [
          {
            key: 'loginMaxAttempts',
            type: 'number',
            label: 'Tentativas por janela',
            description: 'Quantas falhas seguidas disparam o bloqueio temporário.',
            default: loginSettingsDefaults.loginMaxAttempts,
            min: 1,
            max: 50,
            step: 1,
          },
          {
            key: 'loginRateLimitMinutes',
            type: 'number',
            label: 'Bloqueio da janela',
            description: 'Tempo de espera após esgotar as tentativas da janela.',
            default: loginSettingsDefaults.loginRateLimitMinutes,
            min: 1,
            max: 1440,
            step: 1,
            unit: 'min',
          },
          {
            key: 'loginGlobalMaxAttempts',
            type: 'number',
            label: 'Tentativas globais',
            description: `Total de falhas acumuladas antes do bloqueio longo de ${LOGIN_GLOBAL_BLOCK_HOURS} horas.`,
            default: loginSettingsDefaults.loginGlobalMaxAttempts,
            min: 1,
            max: 500,
            step: 1,
          },
        ],
      },
    ],
  })
})
