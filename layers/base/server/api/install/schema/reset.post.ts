import { assertInstallAllowed, getInstallStatus } from '../../../utils/install'
import { inspectDatabaseSchema, resetDatabaseSchema } from '../../../utils/module-schema'

export default defineEventHandler(async () => {
  await assertInstallAllowed()

  const before = await getInstallStatus()
  if (!before.databaseConnected) {
    throw createError({
      statusCode: 400,
      message: 'Configure a conexão com o banco antes de resetar as tabelas.',
    })
  }

  try {
    await resetDatabaseSchema()
  }
  catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha ao resetar o schema.'
    throw createError({
      statusCode: 502,
      message: `Não foi possível resetar as tabelas. ${message}`,
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
