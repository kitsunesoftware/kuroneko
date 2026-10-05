function normalizePath(path: string) {
  if (!path) return '/'
  const trimmed = path.replace(/\/+$/, '')
  return trimmed || '/'
}

/**
 * Marca ativo o link cujo path é o mais específico entre os candidatos
 * que batem com a rota atual (evita `/panel` ativo em `/panel/settings`).
 */
export function isSidebarPathActive(
  currentPath: string,
  linkPath: string,
  siblingPaths: string[] = [],
) {
  const current = normalizePath(currentPath)
  const link = normalizePath(linkPath)

  function matches(path: string) {
    const target = normalizePath(path)
    if (current === target) return true
    if (target === '/') return false
    return current.startsWith(`${target}/`)
  }

  if (!matches(link)) return false

  const pool = siblingPaths.length > 0 ? siblingPaths : [linkPath]
  const best = pool
    .filter(matches)
    .map(normalizePath)
    .sort((a, b) => b.length - a.length)[0]

  return best === link
}

/**
 * Grupo ativo se qualquer filho for o match mais específico da rota atual.
 */
export function isSidebarGroupActive(
  currentPath: string,
  childPaths: string[],
) {
  if (!childPaths.length) return false
  return childPaths.some((path) =>
    isSidebarPathActive(currentPath, path, childPaths),
  )
}
