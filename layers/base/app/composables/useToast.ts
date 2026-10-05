export type ToastTone = 'success' | 'error' | 'info'

export type ToastItem = {
  id: string
  tone: ToastTone
  title: string
  description: string
  durationMs: number
  createdAt: number
}

export const TOAST_DEFAULT_DURATION_MS = 4500

const DEFAULT_DESCRIPTION: Record<ToastTone, string> = {
  success: 'A operação foi concluída com êxito.',
  error: 'Tente novamente em alguns instantes.',
  info: 'Confira os detalhes da notificação.',
}

export function useToast() {
  const toasts = useState<ToastItem[]>('kuroneko-toasts', () => [])

  function dismiss(id: string) {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }

  function push(
    tone: ToastTone,
    title: string,
    description?: string,
    durationMs = TOAST_DEFAULT_DURATION_MS,
  ) {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    toasts.value = [
      ...toasts.value,
      {
        id,
        tone,
        title: trimmedTitle,
        description: (description ?? DEFAULT_DESCRIPTION[tone]).trim(),
        durationMs,
        createdAt: Date.now(),
      },
    ]

    return id
  }

  function success(title: string, description?: string, durationMs?: number) {
    return push('success', title, description, durationMs)
  }

  function error(title: string, description?: string, durationMs?: number) {
    return push('error', title, description, durationMs)
  }

  function info(title: string, description?: string, durationMs?: number) {
    return push('info', title, description, durationMs)
  }

  return {
    toasts,
    push,
    success,
    error,
    info,
    dismiss,
  }
}
