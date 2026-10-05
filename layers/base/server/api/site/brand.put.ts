import { requirePermission } from '../../../../auth/modules/roles/server/utils/require-permission'
import { setBrandSiteConfig } from '../../utils/site-settings'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'panel.settings')

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
    logo: body?.logo === undefined ? undefined : body.logo,
  })

  return {
    ok: true as const,
    site: {
      title: site.title,
      tagline: site.tagline,
      primaryColor: site.primaryColor,
      hasLogo: Boolean(site.logo),
    },
  }
})
