export type SidebarAudience = 'always' | 'auth' | 'guest'

export type SidebarChildConfig = {
  label: string
  to: string
  order?: number
  enabled?: boolean
  /** @default 'always' */
  when?: SidebarAudience
  /** ID do módulo/submódulo que controla este item */
  moduleId?: string
  /** Permissão necessária para exibir o item */
  permission?: string
}

/** Filhos como Record para cada submódulo contribuir via merge do app.config */
export type SidebarChildren = Record<string, SidebarChildConfig>

export type SidebarItemConfig = {
  enabled?: boolean
  type: 'item'
  label: string
  icon: string
  to: string
  order?: number
  when?: SidebarAudience
  moduleId?: string
  permission?: string
}

export type SidebarGroupConfig = {
  enabled?: boolean
  type: 'group'
  label: string
  icon: string
  order?: number
  defaultOpen?: boolean
  children?: SidebarChildren
  moduleId?: string
}

/** Override parcial para ocultar ou ajustar uma entry de outra layer */
export type SidebarEntryOverride = {
  enabled?: boolean
  type?: 'item' | 'group'
  label?: string
  icon?: string
  to?: string
  order?: number
  defaultOpen?: boolean
  when?: SidebarAudience
  children?: SidebarChildren
  moduleId?: string
}

export type SidebarEntryConfig =
  | SidebarItemConfig
  | SidebarGroupConfig
  | SidebarEntryOverride

export type SidebarEntries = Record<string, SidebarEntryConfig>
