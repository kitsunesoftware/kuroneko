import { assertInstallAllowed, getInstallStatus } from '../../utils/install'
import { setBrandSiteConfig } from '../../utils/site-settings'

export default defineEventHandler(async (event) => {
  await assertInstallAllowed()

  const status = await getInstallStatus()
  if (!status.schemaReady) {
    throw createError({
      statusCode: 400,
      message: 'Aplique o schema do banco antes de salvar os dados do site.',
    })
  }

  const body = await readBody<{
    title?: string
    tagline?: string
    primaryColor?: string
    logo?: string | null
  }>(event)

  const site = await setBrandSiteConfig({
    title: body?.title,
    tagline: body?.tagline,
    primaryColor: body?.primaryColor,
    logo: body?.logo,
  })

  return {
    ok: true,
    site,
  }
})
