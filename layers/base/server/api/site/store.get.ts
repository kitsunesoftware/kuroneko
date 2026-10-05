import { getStoreSiteConfig } from '../../utils/site-settings'
import { STORE_MONOREPO } from '../../../shared/store-monorepo'

export default defineEventHandler(async () => {
  const config = await getStoreSiteConfig()
  return {
    repo: STORE_MONOREPO.repo,
    ref: STORE_MONOREPO.ref,
    url: STORE_MONOREPO.url,
    githubToken: config.githubToken,
    configured: true,
  }
})
