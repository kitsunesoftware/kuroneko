export default defineAppConfig({
  title: 'Kuroneko',
  tagline: 'Template modular Nuxt',

  /**
   * Entries do sidebar. Layers/submódulos contribuem por chave (merge profundo).
   * Filhos de grupos também são Record — cada submódulo adiciona sua chave.
   */
  sidebar: {
    entries: {
      home: {
        enabled: true,
        type: 'item',
        label: 'Início',
        icon: 'i-solar:home-2-bold-duotone',
        to: '/',
        order: 10,
      },
    },
  },
})

declare module 'nuxt/schema' {
  interface AppConfigInput {
    title?: string
    tagline?: string
    sidebar?: {
      entries?: Record<
        string,
        {
          enabled?: boolean
          type?: 'item' | 'group'
          label?: string
          icon?: string
          to?: string
          order?: number
          defaultOpen?: boolean
          when?: 'always' | 'auth' | 'guest'
          moduleId?: string
          children?: Record<
            string,
            {
              label: string
              to: string
              order?: number
              enabled?: boolean
              when?: 'always' | 'auth' | 'guest'
              moduleId?: string
            }
          >
        }
      >
    }
  }
}

export {}
