import { syncStoreCatalogFromRepo } from '../../utils/module-store'

export default defineEventHandler(async () => {
  return syncStoreCatalogFromRepo()
})
