export type InstallStatus = {
  installed: boolean
  databaseConfigured: boolean
  databaseConnected: boolean
  schemaReady: boolean
  userCount: number
  /** `database` = .env/DATABASE_URL ausente ou conexão falhou (não há formulário no wizard). */
  suggestedStep: 'database' | 'schema' | 'site' | 'admin' | 'done'
  databaseUrlPreview: string | null
}
