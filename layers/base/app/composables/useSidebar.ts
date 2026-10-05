export function useSidebar() {
  const collapsed = useCookie<boolean>('kuroneko-sidebar-collapsed', {
    default: () => false,
    sameSite: 'lax',
  })

  const mobileOpen = useState('kuroneko-sidebar-mobile-open', () => false)

  /** No drawer mobile o menu fica sempre expandido (com labels). */
  const displayCollapsed = computed(() => {
    if (mobileOpen.value) return false
    return collapsed.value
  })

  const width = computed(() => (displayCollapsed.value ? 80 : 320))

  function toggle() {
    collapsed.value = !collapsed.value
  }

  function expand() {
    collapsed.value = false
  }

  function collapse() {
    collapsed.value = true
  }

  function openMobile() {
    mobileOpen.value = true
  }

  function closeMobile() {
    mobileOpen.value = false
  }

  function toggleMobile() {
    mobileOpen.value = !mobileOpen.value
  }

  return {
    collapsed,
    displayCollapsed,
    mobileOpen,
    width,
    toggle,
    expand,
    collapse,
    openMobile,
    closeMobile,
    toggleMobile,
  }
}
