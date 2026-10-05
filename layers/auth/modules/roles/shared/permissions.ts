export type PermissionDef = {
  key: string
  label: string
  description?: string
}

export type PermissionGroup = {
  id: string
  label: string
  description?: string
  permissions: PermissionDef[]
}

/** Catálogo de capacidades gerenciáveis no painel. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'panel',
    label: 'Painel',
    description: 'Acesso às áreas administrativas.',
    permissions: [
      { key: 'panel.access', label: 'Acessar o painel', description: 'Entrar em /panel.' },
      { key: 'panel.overview', label: 'Visão geral', description: 'Ver a página inicial do painel.' },
      { key: 'panel.settings', label: 'Configurações do site', description: 'Editar título, logo, SMTP e loja.' },
      { key: 'panel.roles.manage', label: 'Gerenciar permissões', description: 'Criar e editar tipos de permissão.' },
    ],
  },
  {
    id: 'modules',
    label: 'Módulos',
    permissions: [
      { key: 'panel.modules.view', label: 'Ver módulos', description: 'Listar módulos instalados.' },
      { key: 'panel.modules.manage', label: 'Gerenciar módulos', description: 'Ativar, instalar e desinstalar.' },
      { key: 'panel.modules.settings', label: 'Configurar módulos', description: 'Alterar settings de cada módulo.' },
      { key: 'panel.store.view', label: 'Ver loja', description: 'Navegar na loja de módulos.' },
      { key: 'panel.store.manage', label: 'Gerenciar loja', description: 'Sincronizar, baixar e remover da loja.' },
    ],
  },
  {
    id: 'users',
    label: 'Usuários e contas',
    permissions: [
      { key: 'users.view', label: 'Ver usuários', description: 'Listar contas do sistema.' },
      { key: 'users.manage', label: 'Gerenciar usuários', description: 'Atribuir papéis, ativar/desativar e editar contas.' },
      { key: 'account.view', label: 'Conta própria', description: 'Acessar /account.' },
      { key: 'account.settings.admin', label: 'Settings de Conta', description: 'Alterar regras do módulo Conta no painel.' },
    ],
  },
]

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((item) => item.key),
)

export const SYSTEM_ROLE_KEYS = {
  admin: 'admin',
  user: 'user',
} as const

export function isKnownPermissionKey(key: string) {
  return ALL_PERMISSION_KEYS.includes(key)
}
