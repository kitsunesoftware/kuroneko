import type { InstallStatus } from '../../shared/install'

export function useInstallStatus() {
  const status = useState<InstallStatus | null>('kuroneko-install-status', () => null)
  const loaded = useState('kuroneko-install-status-loaded', () => false)

  async function refresh() {
    try {
      status.value = await $fetch<InstallStatus>('/api/install/status')
      loaded.value = true
      return status.value
    }
    catch {
      // Não força installed:false — evita redirecionar o app inteiro
      // para /install quando a API falha por erro transitório.
      loaded.value = true
      return status.value
    }
  }

  return {
    status,
    loaded,
    refresh,
  }
}
