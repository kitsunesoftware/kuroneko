import { createError } from 'h3'

export type SeafileConnection = {
  server: string
  repoId: string
  token: string
  defaultPath: string
}

export type SeafileUploadOptions = {
  parentDir: string
  filename: string
  buffer: Buffer
  contentType?: string
  validateToken?: boolean
}

/** API exposta pelo módulo panel.seafile quando a layer está presente. */
export type SeafileApi = {
  getSeafileConnection: () => Promise<SeafileConnection>
  isSeafileReady: (
    conn: Pick<SeafileConnection, 'server' | 'repoId' | 'token'> | null | undefined,
  ) => boolean
  normalizeSeafileDir: (pathValue: string) => string
  seafileAuthHeaders: (token: string) => HeadersInit
  seafileDeleteFile: (
    conn: Pick<SeafileConnection, 'server' | 'repoId' | 'token'>,
    filePath: string,
  ) => Promise<void>
  seafileGetDownloadUrl: (
    conn: Pick<SeafileConnection, 'server' | 'repoId'>,
    filePath: string,
    authHeaders: HeadersInit,
  ) => Promise<string>
  seafileUploadFile: (
    conn: SeafileConnection,
    options: SeafileUploadOptions,
  ) => Promise<string>
}

let registered: SeafileApi | null = null

/** Chamado pelo plugin Nitro do módulo Seafile no boot. */
export function registerSeafileApi(api: SeafileApi) {
  registered = api
}

export function getSeafileApi(): SeafileApi | null {
  return registered
}

export function requireSeafileApi(): SeafileApi {
  if (!registered) {
    throw createError({
      statusCode: 400,
      message:
        'Módulo Seafile não está disponível. Baixe e instale panel.seafile pela loja e faça rebuild.',
    })
  }
  return registered
}
