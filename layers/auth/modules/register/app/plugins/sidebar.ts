export const REGISTER_MODULE_ID = 'auth.register'

export const registerSettingsDefaults = {
  enableEmailRegistration: true,
  requireEmailConfirmation: false,
  requireName: true,
  allowNameLater: true,
  requireUsername: true,
  allowUsernameLater: true,
  requireBirthDate: true,
  allowBirthDateLater: true,
} as const

export default defineNuxtPlugin(() => {
  contributeModule({
    id: REGISTER_MODULE_ID,
    parentId: 'auth',
    label: 'Cadastro',
    description: 'Criação de novas contas.',
    icon: 'i-solar:user-plus-bold-duotone',
    routes: ['/register', '/register/continue'],
    sidebarGroupId: 'auth',
    sidebarChildId: 'register',
    defaultEnabled: true,
    installable: false,
    order: 2,
  })

  contributeSidebarChild('auth', 'register', {
    label: 'Cadastro',
    to: '/register',
    order: 2,
    when: 'guest',
    moduleId: REGISTER_MODULE_ID,
  })

  contributeModuleSettings({
    moduleId: REGISTER_MODULE_ID,
    groups: [
      {
        id: 'email',
        label: 'E-mail',
        fields: [
          {
            key: 'enableEmailRegistration',
            type: 'boolean',
            label: 'Cadastro com e-mail',
            description: 'Se desativado, o cadastro exige nome de usuário e não permite defini-lo depois.',
            default: registerSettingsDefaults.enableEmailRegistration,
          },
          {
            key: 'requireEmailConfirmation',
            type: 'boolean',
            label: 'Exigir confirmação de e-mail',
            description: 'O cadastro começa com nome/e-mail, envia um link e só então pede o restante dos dados.',
            default: registerSettingsDefaults.requireEmailConfirmation,
            enabledWhen: 'enableEmailRegistration',
            forcedWhenDisabled: false,
          },
        ],
      },
      {
        id: 'name',
        label: 'Nome',
        fields: [
          {
            key: 'requireName',
            type: 'boolean',
            label: 'Exigir no cadastro',
            description: 'O nome de exibição deve ser informado ao criar a conta.',
            default: registerSettingsDefaults.requireName,
          },
          {
            key: 'allowNameLater',
            type: 'boolean',
            label: 'Permitir definir depois',
            description: 'Se desativado, o campo não aparece em Conta e senha.',
            default: registerSettingsDefaults.allowNameLater,
          },
        ],
      },
      {
        id: 'username',
        label: 'Nome de usuário',
        fields: [
          {
            key: 'requireUsername',
            type: 'boolean',
            label: 'Exigir no cadastro',
            description: 'O nome de usuário deve ser informado ao criar a conta.',
            default: registerSettingsDefaults.requireUsername,
            enabledWhen: 'enableEmailRegistration',
            forcedWhenDisabled: true,
          },
          {
            key: 'allowUsernameLater',
            type: 'boolean',
            label: 'Permitir definir depois',
            description: 'Se desativado, o campo não aparece em Conta e senha.',
            default: registerSettingsDefaults.allowUsernameLater,
            enabledWhen: 'enableEmailRegistration',
            forcedWhenDisabled: false,
          },
        ],
      },
      {
        id: 'birthDate',
        label: 'Data de nascimento',
        fields: [
          {
            key: 'requireBirthDate',
            type: 'boolean',
            label: 'Exigir no cadastro',
            description: 'A data de nascimento deve ser informada ao criar a conta.',
            default: registerSettingsDefaults.requireBirthDate,
          },
          {
            key: 'allowBirthDateLater',
            type: 'boolean',
            label: 'Permitir definir depois',
            description: 'Se desativado, o campo não aparece em Conta e senha.',
            default: registerSettingsDefaults.allowBirthDateLater,
          },
        ],
      },
    ],
  })
})
