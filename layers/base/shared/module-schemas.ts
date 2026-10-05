/**
 * Metadados de schema Prisma por módulo.
 * Cada módulo instalável declara o arquivo de schema e as tabelas que aplica/dropa.
 */
export type ModuleSchemaMeta = {
  moduleId: string
  /** Caminho relativo à raiz do projeto */
  schemaPath: string
  /** Tabelas criadas/droadas na instalação */
  tables: string[]
}

export const MODULE_SCHEMAS: ModuleSchemaMeta[] = [
  {
    moduleId: 'auth',
    schemaPath: 'layers/auth/prisma/schema.prisma',
    tables: ['User', 'Role', 'RolePermission', 'LoginRateLimit', 'AuthSession'],
  },
  {
    moduleId: 'auth.register',
    schemaPath: 'layers/auth/modules/register/prisma/schema.prisma',
    tables: ['PendingRegistration'],
  },
  {
    moduleId: 'auth.account',
    schemaPath: 'layers/auth/modules/account/prisma/schema.prisma',
    tables: ['AccountProfile'],
  },
  // Módulos instaláveis com prisma (ex.: auth.two-factor) entram via
  // discoverLocalModuleSchemas / kuroneko.module.json — não listar aqui.
]

/** Módulos do sistema sempre instalados (não passam pelo fluxo de instalação). */
export const SYSTEM_MODULE_IDS = [
  'panel',
  'auth',
  'auth.login',
  'auth.register',
  'auth.account',
  'auth.recover',
  'auth.roles',
] as const

export function schemaMetaFor(moduleId: string) {
  return MODULE_SCHEMAS.find((item) => item.moduleId === moduleId) ?? null
}
