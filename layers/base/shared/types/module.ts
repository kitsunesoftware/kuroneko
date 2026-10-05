export type ModuleDefinition = {
  id: string
  label: string
  description?: string
  icon?: string
  /** Se definido, este é um submódulo do pai */
  parentId?: string
  /** Rotas controladas por este módulo */
  routes?: string[]
  /** Liga ao grupo do sidebar (entry id) */
  sidebarGroupId?: string
  /** Liga ao filho do sidebar */
  sidebarChildId?: string
  /**
   * Se o módulo começa habilitado quando já instalado.
   * Módulos instaláveis começam desinstalados (inativos) por padrão.
   * @default false
   */
  defaultEnabled?: boolean
  /** Se false, não pode desativar/desinstalar (ex.: o próprio painel) */
  canDisable?: boolean
  /** Se false, não passa pelo fluxo de instalação (sempre presente). @default true */
  installable?: boolean
  order?: number
}
