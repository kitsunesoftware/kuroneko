import { createReadStream } from 'node:fs'
import { sendStream, setHeader, sendRedirect } from 'h3'
import { resolveModuleIconAsset } from '../../../../utils/module-store'

export default defineEventHandler(async (event) => {
  const moduleId = getRouterParam(event, 'id')
  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Módulo inválido.' })
  }

  const asset = await resolveModuleIconAsset(decodeURIComponent(moduleId))

  if (asset.kind === 'remote') {
    // Mesmo contrato de URL: redireciona para o raw do monorepo.
    return sendRedirect(event, asset.url, 302)
  }

  setHeader(event, 'Content-Type', asset.contentType)
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  return sendStream(event, createReadStream(asset.absolutePath))
})
