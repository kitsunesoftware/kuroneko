import { requirePermission } from '../../../../../auth/modules/roles/server/utils/require-permission'
import { renderBrandedEmail, sampleEmailBody } from '../../../utils/mail-template'
import {
  coerceEmailTemplateConfig,
  getBrandSiteConfig,
  getEmailTemplateConfig,
} from '../../../utils/site-settings'

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

  const brand = await getBrandSiteConfig()
  const saved = await getEmailTemplateConfig()
  const template = coerceEmailTemplateConfig({
    ...saved,
    ...body,
  })
  const sample = sampleEmailBody()
  const title = brand.title

  const mail = renderBrandedEmail({
    brand,
    template,
    subject: `[${title}] Prévia do template`,
    preheader: sample.heading,
    heading: sample.heading,
    bodyHtml: sample.bodyHtml,
    bodyText: sample.bodyText,
    logoMode: 'data',
  })

  return {
    html: mail.html,
    text: mail.text,
  }
})
