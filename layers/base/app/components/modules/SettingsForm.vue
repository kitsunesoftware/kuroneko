<script setup lang="ts">
import type {
  ModuleSettingField,
  ModuleSettingsGroup,
  ModuleSettingsValues,
} from '../../../shared/types/module-settings'
import { isModuleSettingFieldEnabled } from '../../../shared/types/module-settings'

type FieldRow = {
  id: string
  fields: ModuleSettingField[]
}

export type SettingsSaveStatus = 'idle' | 'saving' | 'saved'

const props = defineProps<{
  moduleId: string
}>()

const emit = defineEmits<{
  status: [status: SettingsSaveStatus]
}>()

const { getSchema, getValues, setValue, resetValues, refreshSettings } = useModuleSettings()
const { token: authToken } = useAuth()

const schema = computed(() => getSchema(props.moduleId))
const values = computed(() => getValues(props.moduleId))

const actionLoading = ref<Record<string, boolean>>({})
const actionError = ref<Record<string, string>>({})
const actionSuccess = ref<Record<string, string>>({})

type ActionField = Extract<ModuleSettingField, { type: 'action' }>

const actionModalOpen = ref(false)
const actionModalField = ref<ActionField | null>(null)
const actionModalValues = ref<Record<string, string>>({})
const actionModalError = ref('')

function groupFieldsIntoRows(group: ModuleSettingsGroup): FieldRow[] {
  const rows: FieldRow[] = []
  const seen = new Set<string>()

  for (const field of group.fields) {
    if (field.row) {
      if (seen.has(field.row)) continue
      seen.add(field.row)
      rows.push({
        id: field.row,
        fields: group.fields.filter((item) => item.row === field.row),
      })
      continue
    }

    rows.push({ id: field.key, fields: [field] })
  }

  return rows
}

function isFieldEnabled(field: ModuleSettingField) {
  return isModuleSettingFieldEnabled(field, values.value)
}

async function updateField(key: string, value: ModuleSettingsValues[string]) {
  emit('status', 'saving')
  try {
    await setValue(props.moduleId, key, value)
    emit('status', 'saved')
  }
  catch {
    emit('status', 'idle')
  }
}

function toggleMulti(key: string, option: string, checked: boolean) {
  const current = (values.value[key] as string[] | undefined) ?? []
  const next = checked
    ? [...new Set([...current, option])]
    : current.filter((item) => item !== option)
  void updateField(key, next)
}

function openActionModal(field: ActionField) {
  if (!field.modal || !isFieldEnabled(field)) return
  actionModalField.value = field
  actionModalError.value = ''
  actionError.value = { ...actionError.value, [field.key]: '' }
  const initial: Record<string, string> = {}
  for (const item of field.modal.fields) {
    initial[item.name] = ''
  }
  actionModalValues.value = initial
  // Garante que o watch de open dispare depois do campo estar pronto.
  nextTick(() => {
    actionModalOpen.value = true
  })
}

function closeActionModal() {
  actionModalOpen.value = false
  actionModalField.value = null
  actionModalValues.value = {}
  actionModalError.value = ''
}

async function executeAction(field: ActionField, body?: Record<string, string>) {
  actionLoading.value = { ...actionLoading.value, [field.key]: true }
  actionError.value = { ...actionError.value, [field.key]: '' }
  actionSuccess.value = { ...actionSuccess.value, [field.key]: '' }
  actionModalError.value = ''
  emit('status', 'saving')

  try {
    const result = await $fetch<{ ok?: boolean, tokenPreview?: string }>(field.endpoint, {
      method: 'POST',
      headers: authToken.value
        ? { Authorization: `Bearer ${authToken.value}` }
        : undefined,
      body,
    })
    await refreshSettings()
    actionSuccess.value = {
      ...actionSuccess.value,
      [field.key]: result.tokenPreview
        ? `Acesso salvo (${result.tokenPreview}).`
        : 'Acesso gerado e salvo.',
    }
    emit('status', 'saved')
    if (field.modal) closeActionModal()
  }
  catch (error: unknown) {
    const message =
      error
      && typeof error === 'object'
      && 'data' in error
      && error.data
      && typeof error.data === 'object'
      && 'message' in error.data
      && typeof error.data.message === 'string'
        ? error.data.message
        : 'Não foi possível executar a ação.'
    if (field.modal && actionModalOpen.value) {
      actionModalError.value = message
    }
    else {
      actionError.value = { ...actionError.value, [field.key]: message }
    }
    emit('status', 'idle')
  }
  finally {
    actionLoading.value = { ...actionLoading.value, [field.key]: false }
  }
}

function onActionClick(field: ActionField) {
  if (!isFieldEnabled(field)) return
  if (field.modal) {
    openActionModal(field)
    return
  }
  void executeAction(field)
}

async function submitActionModal() {
  const field = actionModalField.value
  if (!field?.modal) return

  for (const item of field.modal.fields) {
    if (!String(actionModalValues.value[item.name] ?? '').trim()) {
      actionModalError.value = `Preencha o campo ${item.label}.`
      return
    }
  }

  await executeAction(field, { ...actionModalValues.value })
}

function isActionConfigured(field: ActionField) {
  return Boolean(field.statusKey && values.value[field.statusKey])
}

function actionButtonLabel(field: ActionField) {
  if (isActionConfigured(field) && field.buttonLabelConfigured) {
    return field.buttonLabelConfigured
  }
  return field.buttonLabel
}

function actionModalTitle(field: ActionField | null) {
  if (!field?.modal) return 'Autenticar'
  if (isActionConfigured(field) && field.modal.titleConfigured) {
    return field.modal.titleConfigured
  }
  return field.modal.title
}

function actionModalSubmitLabel(field: ActionField | null) {
  if (!field?.modal) return 'Confirmar'
  if (isActionConfigured(field) && field.modal.submitLabelConfigured) {
    return field.modal.submitLabelConfigured
  }
  return field.modal.submitLabel
}

async function onReset() {
  emit('status', 'saving')
  try {
    await resetValues(props.moduleId)
    emit('status', 'saved')
  }
  catch {
    emit('status', 'idle')
  }
}

defineExpose({
  reset: onReset,
})

watch(
  () => props.moduleId,
  () => {
    emit('status', 'idle')
    actionError.value = {}
    actionSuccess.value = {}
    closeActionModal()
  },
)
</script>

<template>
  <div
    v-if="schema"
    class="space-y-5"
  >
    <div
      v-for="group in schema.groups"
      :key="group.id"
      class="space-y-3 rounded-lg border border-[var(--color-line)] bg-white p-4"
    >
      <div>
        <h4 class="text-sm font-semibold text-[var(--color-ink)]">
          {{ group.label }}
        </h4>
        <p
          v-if="group.description"
          class="mt-0.5 text-xs text-[var(--color-muted)]"
        >
          {{ group.description }}
        </p>
      </div>

      <div class="space-y-3">
        <div
          v-for="row in groupFieldsIntoRows(group)"
          :key="row.id"
          :class="row.fields.length > 1 ? 'flex justify-between gap-4' : undefined"
        >
          <div
            v-for="field in row.fields"
            :key="field.key"
            class="space-y-1.5"
            :class="[
              row.fields.length > 1 ? 'min-w-0 flex-1' : undefined,
              { 'pointer-events-none opacity-45': !isFieldEnabled(field) },
            ]"
          >
            <template v-if="field.type === 'number'">
              <UiInput
                :id="`${moduleId}-${field.key}`"
                :model-value="String(values[field.key] ?? '')"
                :label="field.unit ? `${field.label} (${field.unit})` : field.label"
                :hint="field.description || ''"
                type="number"
                :min="field.min"
                :max="field.max"
                :step="field.step ?? 1"
                :disabled="!isFieldEnabled(field)"
                @update:model-value="updateField(field.key, Number($event))"
              />
            </template>

            <template v-else-if="field.type === 'boolean'">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-medium text-[var(--color-ink)]">
                    {{ field.label }}
                  </p>
                  <p
                    v-if="field.description"
                    class="mt-0.5 text-xs text-[var(--color-muted)]"
                  >
                    {{ field.description }}
                  </p>
                </div>
                <UiToggle
                  :model-value="Boolean(values[field.key])"
                  :disabled="!isFieldEnabled(field)"
                  @update:model-value="updateField(field.key, $event)"
                />
              </div>
            </template>

            <template v-else-if="field.type === 'select'">
              <label
                :for="`${moduleId}-${field.key}`"
                class="block text-sm font-medium text-[var(--color-ink)]"
              >
                {{ field.label }}
              </label>
              <p
                v-if="field.description"
                class="text-xs text-[var(--color-muted)]"
              >
                {{ field.description }}
              </p>
              <select
                :id="`${moduleId}-${field.key}`"
                class="w-full rounded-[var(--radius)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink)] disabled:cursor-not-allowed"
                :value="String(values[field.key] ?? field.default)"
                :disabled="!isFieldEnabled(field)"
                @change="updateField(field.key, ($event.target as HTMLSelectElement).value)"
              >
                <option
                  v-for="option in field.options"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </template>

            <template v-else-if="field.type === 'multiselect'">
              <p class="text-sm font-medium text-[var(--color-ink)]">
                {{ field.label }}
              </p>
              <p
                v-if="field.description"
                class="text-xs text-[var(--color-muted)]"
              >
                {{ field.description }}
              </p>
              <div class="flex flex-wrap gap-2">
                <label
                  v-for="option in field.options"
                  :key="option.value"
                  class="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition"
                  :class="[
                    isFieldEnabled(field) ? 'cursor-pointer' : 'cursor-not-allowed',
                    (values[field.key] as string[] | undefined)?.includes(option.value)
                      ? 'border-[#1C223D] bg-[#1C223D] text-white shadow-sm'
                      : 'border-dashed border-[var(--color-line)] bg-[#F8F8F6] text-[var(--color-muted)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
                  ]"
                >
                  <input
                    type="checkbox"
                    class="sr-only"
                    :checked="(values[field.key] as string[] | undefined)?.includes(option.value)"
                    :disabled="!isFieldEnabled(field)"
                    @change="toggleMulti(field.key, option.value, ($event.target as HTMLInputElement).checked)"
                  >
                  <Icon
                    :name="
                      (values[field.key] as string[] | undefined)?.includes(option.value)
                        ? 'i-solar:check-circle-bold'
                        : 'i-solar:close-circle-linear'
                    "
                    class="text-base"
                    :class="
                      (values[field.key] as string[] | undefined)?.includes(option.value)
                        ? 'text-white'
                        : 'text-[var(--color-muted)]/70'
                    "
                  />
                  {{ option.label }}
                </label>
              </div>
            </template>

            <template v-else-if="field.type === 'text'">
              <UiInput
                :id="`${moduleId}-${field.key}`"
                :model-value="String(values[field.key] ?? '')"
                :label="field.label"
                :hint="field.description || ''"
                :type="field.secret ? 'password' : 'text'"
                :placeholder="field.placeholder"
                :autocomplete="field.secret ? 'new-password' : 'off'"
                :disabled="!isFieldEnabled(field)"
                @update:model-value="updateField(field.key, $event)"
              />
            </template>

            <template v-else-if="field.type === 'action'">
              <div
                class="rounded-lg border px-3 py-3"
                :class="
                  isActionConfigured(field)
                    ? 'border-emerald-200 bg-emerald-50/70'
                    : 'border-dashed border-[var(--color-line)] bg-[#F8F8F6]'
                "
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0 space-y-1">
                    <p class="text-sm font-medium text-[var(--color-ink)]">
                      {{ field.label }}
                    </p>
                    <p
                      v-if="field.description"
                      class="text-xs text-[var(--color-muted)]"
                    >
                      {{ field.description }}
                    </p>
                    <div
                      v-if="field.statusKey"
                      class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="
                        isActionConfigured(field)
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-[var(--color-paper-deep)] text-[var(--color-muted)]'
                      "
                    >
                      <span
                        class="size-1.5 rounded-full"
                        :class="isActionConfigured(field) ? 'bg-emerald-500' : 'bg-[var(--color-muted)]'"
                      />
                      {{
                        isActionConfigured(field)
                          ? (field.statusConfiguredLabel || 'Configurado')
                          : (field.statusEmptyLabel || 'Não configurado')
                      }}
                    </div>
                  </div>

                  <UiButton
                    type="button"
                    :variant="isActionConfigured(field) ? 'outline' : 'primary'"
                    :disabled="!isFieldEnabled(field) || actionLoading[field.key]"
                    :loading="Boolean(actionLoading[field.key]) && !field.modal"
                    @click="onActionClick(field)"
                  >
                    {{ actionButtonLabel(field) }}
                  </UiButton>
                </div>

                <p
                  v-if="actionSuccess[field.key]"
                  class="mt-2 text-xs text-emerald-700"
                >
                  {{ actionSuccess[field.key] }}
                </p>
                <p
                  v-if="actionError[field.key]"
                  class="mt-2 text-xs text-red-600"
                  role="alert"
                >
                  {{ actionError[field.key] }}
                </p>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <UiModal
      v-model="actionModalOpen"
      :title="actionModalTitle(actionModalField)"
    >
      <div
        v-if="actionModalField?.modal"
        class="space-y-4"
      >
        <p
          v-if="actionModalField.modal.description"
          class="text-sm text-[var(--color-muted)]"
        >
          {{ actionModalField.modal.description }}
        </p>

        <UiInput
          v-for="item in actionModalField.modal.fields"
          :id="`action-modal-${item.name}`"
          :key="item.name"
          v-model="actionModalValues[item.name]"
          :label="item.label"
          :type="item.secret ? 'password' : 'text'"
          :placeholder="item.placeholder"
          :autocomplete="item.secret ? 'new-password' : 'username'"
          @keyup.enter="submitActionModal"
        />

        <p
          v-if="actionModalError"
          class="text-sm text-red-600"
          role="alert"
        >
          {{ actionModalError }}
        </p>
      </div>

      <template #footer>
        <UiButton
          variant="ghost"
          type="button"
          @click="closeActionModal"
        >
          Cancelar
        </UiButton>
        <UiButton
          type="button"
          :loading="Boolean(actionModalField && actionLoading[actionModalField.key])"
          @click="submitActionModal"
        >
          {{ actionModalSubmitLabel(actionModalField) }}
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>
