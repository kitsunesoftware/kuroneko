export type KuronekoModuleLayer =
  | {
    kind: 'root'
    /** Destino relativo à raiz do projeto, ex.: layers/demo-hello */
    target: string
  }
  | {
    kind: 'child'
    /** Nome do layer pai em layers/<parent> */
    parent: string
    /** Destino relativo, ex.: layers/demo-hello/modules/notes */
    target: string
  }

export type KuronekoModuleManifest = {
  id: string
  name: string
  description?: string
  version: string
  parentId?: string | null
  layer: KuronekoModuleLayer
  icon?: string | {
    type: 'icon'
    name: string
  } | {
    type: 'image'
    src: string
  } | {
    image: string
  }
  dependsOn?: string[]
  prisma?: {
    schema?: string
    tables?: string[]
  }
  author?: string
  license?: string
  minKuroneko?: string
}

export type StoreRegistryEntry = {
  id: string
  /** owner/repo do monorepo GitHub (cache do sync). */
  source: string
  /** branch, tag ou commit. */
  ref?: string
  /** Caminho dentro do repo até a pasta do módulo (se o pacote não for a raiz) */
  path?: string
}

export type StoreRegistry = {
  version: 1
  updatedAt?: string
  modules: StoreRegistryEntry[]
}

export type StoreModuleCard = {
  id: string
  name: string
  description: string
  version: string
  source: string
  ref: string
  parentId: string | null
  icon: string
  /** URL resolvida quando `icon` é imagem (local via API ou externa). */
  iconUrl?: string | null
  dependsOn: string[]
  downloaded: boolean
  installed: boolean
  target: string
  author?: string
  license?: string
  /** Versão mínima da plataforma Kuroneko exigida pelo módulo. */
  minKuroneko?: string | null
  /** Se a instalação atual satisfaz `minKuroneko`. */
  platformCompatible: boolean
  /**
   * Pai injetado (sistema ou já instalado) para montar a árvore na loja.
   * Não vem do monorepo — sem download.
   */
  platformEntry?: boolean
  /** Versão do manifesto local em layers/ (quando baixado). */
  localVersion?: string | null
  /** Catálogo remoto tem versão maior que a local. */
  updateAvailable?: boolean
}
