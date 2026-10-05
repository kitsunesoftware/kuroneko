import { setStoreSiteConfig } from '../../utils/site-settings'
import { STORE_MONOREPO } from '../../../shared/store-monorepo'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    githubToken?: string
  }>(event)

  const config = await setStoreSiteConfig({
    githubToken: body?.githubToken,
  })

  return {
    ok: true as const,
    repo: STORE_MONOREPO.repo,
    ref: STORE_MONOREPO.ref,
    url: STORE_MONOREPO.url,
    githubToken: config.githubToken,
    configured: true,
  }
})
