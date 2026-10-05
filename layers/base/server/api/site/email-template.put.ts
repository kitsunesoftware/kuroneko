import { requirePermission } from '../../../../auth/modules/roles/server/utils/require-permission'
import { getDefaultEmailHtmlTemplate } from '../../utils/mail-template'
import { setEmailTemplateConfig } from '../../utils/site-settings'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'panel.settings')

  const body = await readBody<{
    showLogo?: boolean
    showTagline?: boolean
    showAccentBar?: boolean
    footerNote?: string
    backgroundColor?: string
    cardBackgroundColor?: string
    htmlTemplate?: string
  }>(event)

  const patch: Parameters<typeof setEmailTemplateConfig>[0] = {}
  if (typeof body?.showLogo === 'boolean') patch.showLogo = body.showLogo
  if (typeof body?.showTagline === 'boolean') patch.showTagline = body.showTagline
  if (typeof body?.showAccentBar === 'boolean') patch.showAccentBar = body.showAccentBar
  if (typeof body?.footerNote === 'string') patch.footerNote = body.footerNote
  if (typeof body?.backgroundColor === 'string') patch.backgroundColor = body.backgroundColor
  if (typeof body?.cardBackgroundColor === 'string') patch.cardBackgroundColor = body.cardBackgroundColor
  if (typeof body?.htmlTemplate === 'string') {
    const normalized = body.htmlTemplate.trim()
    const defaultHtml = getDefaultEmailHtmlTemplate().trim()
    // Guarda vazio quando igual ao padrão, para acompanhar melhorias futuras do layout.
    patch.htmlTemplate = normalized === defaultHtml ? '' : body.htmlTemplate
  }

  const template = await setEmailTemplateConfig(patch)
  const defaultHtmlTemplate = getDefaultEmailHtmlTemplate()

  return {
    ok: true as const,
    template: {
      ...template,
      htmlTemplate: template.htmlTemplate.trim() || defaultHtmlTemplate,
    },
  }
})
