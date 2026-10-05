export type SavedAccount = {
  name: string
  email: string
  username: string | null
  profileImage: string | null
  lastLoginAt: string | null
}

const SAVED_ACCOUNTS_KEY = 'kuroneko_saved_accounts'

/** Contas lembradas neste dispositivo (localStorage). */
export function useSavedAccounts() {
  const savedAccounts = useState<SavedAccount[]>('kuroneko-saved-accounts', () => [])

  function load() {
    if (!import.meta.client) return
    savedAccounts.value = readFromStorage()
  }

  function persist(accounts: SavedAccount[]) {
    savedAccounts.value = accounts
    if (!import.meta.client) return
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts))
  }

  function upsert(
    saved: Omit<SavedAccount, 'lastLoginAt' | 'profileImage' | 'username'> & {
      username?: string | null
      profileImage?: string | null
      lastLoginAt?: string | null
    },
  ) {
    const entry: SavedAccount = {
      name: saved.name,
      email: saved.email.toLowerCase(),
      username: saved.username?.trim() || null,
      profileImage: saved.profileImage ?? null,
      lastLoginAt: saved.lastLoginAt ?? new Date().toISOString(),
    }
    persist([
      entry,
      ...savedAccounts.value.filter((item) => item.email !== entry.email),
    ])
  }

  function remove(email: string) {
    persist(
      savedAccounts.value.filter((item) => item.email !== email.toLowerCase()),
    )
  }

  return {
    savedAccounts,
    load,
    upsert,
    remove,
  }
}

function readFromStorage(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is SavedAccount =>
          Boolean(
            item
            && typeof item === 'object'
            && typeof item.name === 'string'
            && typeof item.email === 'string',
          ),
      )
      .map((item) => ({
        name: item.name,
        email: item.email.toLowerCase(),
        username: typeof item.username === 'string' ? item.username : null,
        profileImage: typeof item.profileImage === 'string' ? item.profileImage : null,
        lastLoginAt: typeof item.lastLoginAt === 'string' ? item.lastLoginAt : null,
      }))
  }
  catch {
    return []
  }
}
