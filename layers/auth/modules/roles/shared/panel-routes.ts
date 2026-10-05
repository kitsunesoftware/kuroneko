/**
 * Mapeia rotas do painel → permissão necessária
 * (além de `panel.access`, exigida em qualquer /panel).
 */
export function resolvePanelPermission(path: string): string {
  const normalized = path.replace(/\/+$/, '') || '/'

  if (normalized.startsWith('/panel/users')) return 'users.view'
  if (normalized.startsWith('/panel/roles')) return 'panel.roles.manage'
  if (normalized.startsWith('/panel/settings')) return 'panel.settings'
  if (normalized.startsWith('/panel/modules/store')) return 'panel.store.view'
  if (normalized.startsWith('/panel/modules')) return 'panel.modules.view'
  if (normalized === '/panel') return 'panel.overview'
  return 'panel.access'
}

/** Ordem de fallback quando a rota pedida não é permitida. */
export const PANEL_FALLBACK_ROUTES: Array<{ path: string, permission: string }> = [
  { path: '/panel', permission: 'panel.overview' },
  { path: '/panel/modules', permission: 'panel.modules.view' },
  { path: '/panel/users', permission: 'users.view' },
  { path: '/panel/settings', permission: 'panel.settings' },
  { path: '/panel/roles', permission: 'panel.roles.manage' },
]
