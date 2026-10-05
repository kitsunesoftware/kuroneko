export type ModuleSettingOption = {
  value: string
  label: string
}

/** Condição para habilitar um campo de settings. */
export type ModuleSettingCondition = {
  key: string
  /** Se omitido, exige truthy. */
  equals?: string | number | boolean
}

type ModuleSettingFieldBase = {
  key: string
  label: string
  description?: string
  /**
   * Quando habilitar este campo:
   * - string: truthy de `values[key]` (ou `=== enabledWhenEquals` se definido)
   * - condição / lista: todas precisam passar
   */
  enabledWhen?: string | ModuleSettingCondition | ModuleSettingCondition[]
  /**
   * Legado: usado só quando `enabledWhen` é string.
   * Preferir `{ key, equals }` em `enabledWhen`.
   */
  enabledWhenEquals?: string | number | boolean
  /** Valor forçado enquanto o campo estiver desabilitado por `enabledWhen`. */
  forcedWhenDisabled?: string | number | boolean | string[]
  /** Campos com o mesmo `row` renderizam na mesma linha. */
  row?: string
}

export type ModuleSettingField =
  | (ModuleSettingFieldBase & {
      type: 'number'
      default: number
      min?: number
      max?: number
      step?: number
      unit?: string
    })
  | (ModuleSettingFieldBase & {
      type: 'boolean'
      default: boolean
    })
  | (ModuleSettingFieldBase & {
      type: 'text'
      default: string
      /** Renderiza input type=password. */
      secret?: boolean
      placeholder?: string
    })
  | (ModuleSettingFieldBase & {
      type: 'select'
      options: ModuleSettingOption[]
      default: string
    })
  | (ModuleSettingFieldBase & {
      type: 'multiselect'
      options: ModuleSettingOption[]
      default: string[]
    })
  | (ModuleSettingFieldBase & {
      type: 'action'
      /** Valor placeholder no mapa de settings (não usado). */
      default: string
      /** Endpoint POST relativo, ex.: /api/seafile/generate-token */
      endpoint: string
      buttonLabel: string
      /** Rótulo do botão quando `statusKey` já está configurado. */
      buttonLabelConfigured?: string
      /** Chave cujo valor truthy indica sucesso já configurado. */
      statusKey?: string
      statusConfiguredLabel?: string
      statusEmptyLabel?: string
      /** Se definido, o botão abre um modal e envia os campos no body do POST. */
      modal?: {
        title: string
        /** Título do modal quando já autenticado/configurado. */
        titleConfigured?: string
        description?: string
        fields: Array<{
          name: string
          label: string
          secret?: boolean
          placeholder?: string
        }>
        submitLabel: string
        submitLabelConfigured?: string
      }
    })

export type ModuleSettingsGroup = {
  id: string
  label: string
  description?: string
  fields: ModuleSettingField[]
}

export type ModuleSettingsSchema = {
  moduleId: string
  groups: ModuleSettingsGroup[]
}

export type ModuleSettingsValues = Record<string, string | number | boolean | string[]>

function matchesCondition(
  condition: ModuleSettingCondition,
  values: ModuleSettingsValues,
) {
  const current = values[condition.key]
  if (condition.equals !== undefined) {
    return current === condition.equals
  }
  return Boolean(current)
}

/** Avalia se o campo está habilitado dados os valores atuais. */
export function isModuleSettingFieldEnabled(
  field: ModuleSettingField,
  values: ModuleSettingsValues,
) {
  if (!field.enabledWhen) return true

  if (typeof field.enabledWhen === 'string') {
    const current = values[field.enabledWhen]
    if (field.enabledWhenEquals !== undefined) {
      return current === field.enabledWhenEquals
    }
    return Boolean(current)
  }

  const conditions = Array.isArray(field.enabledWhen)
    ? field.enabledWhen
    : [field.enabledWhen]

  return conditions.every((condition) => matchesCondition(condition, values))
}

/** Chaves referenciadas em `enabledWhen` (para reaplicar forced values). */
export function enabledWhenKeys(field: ModuleSettingField): string[] {
  if (!field.enabledWhen) return []
  if (typeof field.enabledWhen === 'string') return [field.enabledWhen]
  const conditions = Array.isArray(field.enabledWhen)
    ? field.enabledWhen
    : [field.enabledWhen]
  return conditions.map((item) => item.key)
}
