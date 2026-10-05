import type { Prisma } from '@prisma/client'
import { usePrisma } from './prisma'

export type ModuleSettingsMap = Record<string, string | number | boolean | string[]>

function toJsonValue(value: ModuleSettingsMap[string]): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function fromJsonValue(value: Prisma.JsonValue): ModuleSettingsMap[string] {
  return value as ModuleSettingsMap[string]
}

/** Grava (ou sobrescreve) as configurações de um módulo. */
export async function seedModuleSettings(
  moduleId: string,
  defaults: ModuleSettingsMap,
) {
  const prisma = usePrisma()
  const entries = Object.entries(defaults)
  if (!entries.length) return

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.moduleSetting.upsert({
        where: {
          moduleId_key: { moduleId, key },
        },
        create: {
          moduleId,
          key,
          value: toJsonValue(value),
        },
        update: {
          value: toJsonValue(value),
        },
      }),
    ),
  )
}

/** Remove configurações do módulo e de filhos (`moduleId.`*). */
export async function deleteModuleSettings(moduleId: string) {
  const prisma = usePrisma()
  await prisma.moduleSetting.deleteMany({
    where: {
      OR: [
        { moduleId },
        { moduleId: { startsWith: `${moduleId}.` } },
      ],
    },
  })
}

/** Lê as configurações de um módulo como mapa chave → valor. */
export async function getModuleSettings(moduleId: string): Promise<ModuleSettingsMap> {
  const prisma = usePrisma()
  const rows = await prisma.moduleSetting.findMany({ where: { moduleId } })
  const values: ModuleSettingsMap = {}
  for (const row of rows) {
    values[row.key] = fromJsonValue(row.value)
  }
  return values
}

/** Lê todas as configurações agrupadas por moduleId. */
export async function getAllModuleSettings(): Promise<Record<string, ModuleSettingsMap>> {
  const prisma = usePrisma()
  const rows = await prisma.moduleSetting.findMany()
  const byModule: Record<string, ModuleSettingsMap> = {}
  for (const row of rows) {
    if (!byModule[row.moduleId]) byModule[row.moduleId] = {}
    byModule[row.moduleId]![row.key] = fromJsonValue(row.value)
  }
  return byModule
}

/** Atualiza um subconjunto de chaves sem apagar as demais. */
export async function patchModuleSettings(
  moduleId: string,
  values: ModuleSettingsMap,
) {
  const prisma = usePrisma()
  const entries = Object.entries(values)
  if (!entries.length) return

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.moduleSetting.upsert({
        where: {
          moduleId_key: { moduleId, key },
        },
        create: {
          moduleId,
          key,
          value: toJsonValue(value),
        },
        update: {
          value: toJsonValue(value),
        },
      }),
    ),
  )
}
