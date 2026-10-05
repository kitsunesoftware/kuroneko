import { getInstallStatus } from '../../utils/install'
import { inspectDatabaseSchema } from '../../utils/module-schema'

/** Inspeciona tabelas — não depende do status “instalado”. */
export default defineEventHandler(async () => {
  const status = await getInstallStatus()
  if (!status.databaseConnected) {
    throw createError({
      statusCode: 400,
      message: 'Configure a conexão com o banco antes de inspecionar o schema.',
    })
  }

  try {
    const schema = await inspectDatabaseSchema()
    return {
      ok: true,
      status,
      schema,
    }
  }
  catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha ao inspecionar o schema.'
    return {
      ok: true,
      status,
      schema: {
        exists: false,
        upToDate: false,
        expectedTables: [],
        presentTables: [],
        missingTables: [],
        extraTables: [],
        driftSummary: message,
      },
    }
  }
})
