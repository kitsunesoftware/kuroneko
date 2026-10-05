import { getInstallStatus } from '../../utils/install'
import { applyDatabaseSchema, inspectDatabaseSchema } from '../../utils/module-schema'

/** Aplica o schema no banco conectado — não depende do status “instalado”. */
export default defineEventHandler(async () => {
  const before = await getInstallStatus()
  if (!before.databaseConnected) {
    throw createError({
      statusCode: 400,
      message: 'Configure e teste a conexão com o banco antes de aplicar o schema.',
    })
  }

  try {
    await applyDatabaseSchema()
  }
  catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha ao aplicar o schema.'
    throw createError({
      statusCode: 502,
      message: `Não foi possível aplicar o schema no banco. ${message}`,
    })
  }

  const status = await getInstallStatus()
  const schema = await inspectDatabaseSchema().catch(() => null)

  return {
    ok: true,
    status,
    schema,
  }
})
