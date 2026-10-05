import { requirePermission } from '../../../../auth/modules/roles/server/utils/require-permission'
import {
  EMAIL_TEMPLATE_PLACEHOLDERS,
  getDefaultEmailHtmlTemplate,
} from '../../utils/mail-template'
import {
  EMAIL_TEMPLATE_SITE_DEFAULTS,
  getEmailTemplateConfig,
} from '../../utils/site-settings'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'panel.settings')
  const template = await getEmailTemplateConfig()
  const defaultHtmlTemplate = getDefaultEmailHtmlTemplate()

  return {
    template: {
      ...template,
      htmlTemplate: template.htmlTemplate.trim() || defaultHtmlTemplate,
    },
    defaults: {
      ...EMAIL_TEMPLATE_SITE_DEFAULTS,
      htmlTemplate: defaultHtmlTemplate,
    },
    placeholders: EMAIL_TEMPLATE_PLACEHOLDERS,
  }
})
