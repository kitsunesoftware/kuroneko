import type {
  ModuleSettingField,
  ModuleSettingsSchema,
  ModuleSettingsValues,
} from '../../shared/types/module-settings'
import {
  enabledWhenKeys,
  isModuleSettingFieldEnabled,
} from '../../shared/types/module-settings'

type SettingValue = ModuleSettingsValues[string]

/** Clona valores sem structuredClone — proxies do useState não são clonáveis. */
function cloneSettingValue(value: SettingValue): SettingValue {
  if (Array.isArray(value)) {
    return [...toRaw(value)]
  }
  return value
}

function defaultsFromSchema(schema: ModuleSettingsSchema): ModuleSettingsValues {
  const values: ModuleSettingsValues = {}
  for (const group of schema.groups) {
    for (const field of group.fields) {
      values[field.key] = cloneSettingValue(field.default as SettingValue)
    }
  }
  return values
}

function plainValues(values: ModuleSettingsValues): ModuleSettingsValues {
  const next: ModuleSettingsValues = {}
  for (const [key, value] of Object.entries(values)) {
    next[key] = cloneSettingValue(value)
  }
  return next
}

function applyForcedValues(
  schema: ModuleSettingsSchema,
  merged: ModuleSettingsValues,
): ModuleSettingsValues {
  for (const group of schema.groups) {
    for (const field of group.fields) {
      if (!field.enabledWhen || field.forcedWhenDisabled === undefined) continue
      if (!isModuleSettingFieldEnabled(field, merged)) {
        merged[field.key] = cloneSettingValue(field.forcedWhenDisabled as SettingValue)
      }
    }
  }
  return merged
}

export function useModuleSettings() {
  const schemas = useState<ModuleSettingsSchema[]>(
    'kuroneko-module-settings-schemas',
    () => [],
  )

  const stored = useState<Record<string, ModuleSettingsValues>>(
    'kuroneko-module-settings-db',
    () => ({}),
  )

  const loaded = useState('kuroneko-module-settings-loaded', () => false)

  async function refreshSettings() {
    try {
      const data = await $fetch<{ settings: Record<string, ModuleSettingsValues> }>(
        '/api/modules/settings',
      )
      stored.value = data.settings ?? {}
    }
    catch {
      // banco indisponível — mantém o que já estiver em memória
    }
    finally {
      loaded.value = true
    }
  }

  if (import.meta.client && !loaded.value) {
    refreshSettings()
  }

  function registerSchema(schema: ModuleSettingsSchema) {
    const exists = schemas.value.some((item) => item.moduleId === schema.moduleId)
    if (exists) {
      schemas.value = schemas.value.map((item) =>
        item.moduleId === schema.moduleId ? schema : item,
      )
      return
    }
    schemas.value = [...schemas.value, schema]
  }

  function getSchema(moduleId: string) {
    return schemas.value.find((item) => item.moduleId === moduleId) ?? null
  }

  function hasSettings(moduleId: string) {
    return Boolean(getSchema(moduleId))
  }

  function getDefaults(moduleId: string): ModuleSettingsValues {
    const schema = getSchema(moduleId)
    if (!schema) return {}
    return defaultsFromSchema(schema)
  }

  function getValues(moduleId: string): ModuleSettingsValues {
    const schema = getSchema(moduleId)
    if (!schema) return {}

    const base = defaultsFromSchema(schema)
    const custom = stored.value[moduleId] ?? {}
    return applyForcedValues(schema, plainValues({ ...base, ...custom }))
  }

  async function persist(moduleId: string, values: ModuleSettingsValues, replace = false) {
    stored.value = {
      ...stored.value,
      [moduleId]: plainValues(values),
    }

    await $fetch(`/api/modules/${encodeURIComponent(moduleId)}/settings`, {
      method: 'PUT',
      body: { values: plainValues(values), replace },
    })
  }

  async function setValue(
    moduleId: string,
    key: string,
    value: SettingValue,
  ) {
    const schema = getSchema(moduleId)
    const current = getValues(moduleId)
    const next: ModuleSettingsValues = {
      ...current,
      [key]: cloneSettingValue(value),
    }

    if (schema) {
      for (const group of schema.groups) {
        for (const field of group.fields) {
          if (field.forcedWhenDisabled === undefined) continue
          if (!enabledWhenKeys(field).includes(key)) continue
          if (!isModuleSettingFieldEnabled(field, next)) {
            next[field.key] = cloneSettingValue(field.forcedWhenDisabled as SettingValue)
          }
        }
      }
    }

    await persist(moduleId, next)
  }

  async function setValues(moduleId: string, values: ModuleSettingsValues) {
    const current = getValues(moduleId)
    await persist(moduleId, {
      ...current,
      ...plainValues(values),
    })
  }

  async function resetValues(moduleId: string) {
    const defaults = getDefaults(moduleId)
    await persist(moduleId, defaults, true)
  }

  function clearLocal(moduleId: string) {
    const next = { ...stored.value }
    delete next[moduleId]
    for (const key of Object.keys(next)) {
      if (key.startsWith(`${moduleId}.`)) delete next[key]
    }
    stored.value = next
  }

  function fieldOf(moduleId: string, key: string): ModuleSettingField | null {
    const schema = getSchema(moduleId)
    if (!schema) return null
    for (const group of schema.groups) {
      const field = group.fields.find((item) => item.key === key)
      if (field) return field
    }
    return null
  }

  return {
    schemas,
    loaded,
    registerSchema,
    getSchema,
    hasSettings,
    getDefaults,
    getValues,
    setValue,
    setValues,
    resetValues,
    clearLocal,
    refreshSettings,
    fieldOf,
  }
}

export function contributeModuleSettings(schema: ModuleSettingsSchema) {
  useModuleSettings().registerSchema(schema)
}
