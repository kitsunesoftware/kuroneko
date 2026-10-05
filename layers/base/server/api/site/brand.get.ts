import { requirePermission } from '../../../../auth/modules/roles/server/utils/require-permission'
import { getBrandSiteConfig } from '../../utils/site-settings'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'panel.settings')
  const site = await getBrandSiteConfig()
  return {
    title: site.title,
    tagline: site.tagline,
    primaryColor: site.primaryColor,
    logo: site.logo,
  }
})
