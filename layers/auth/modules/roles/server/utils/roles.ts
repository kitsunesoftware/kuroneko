import { usePrisma } from '../../../../../base/server/utils/prisma'
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_GROUPS,
  SYSTEM_ROLE_KEYS,
  isKnownPermissionKey,
} from '../../shared/permissions'

export type RoleDto = {
  id: string
  key: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: Record<string, boolean>
  userCount: number
  createdAt: string
  updatedAt: string
}

function slugifyRoleKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function permissionsMapFromRows(rows: Array<{ key: string, allowed: boolean }>) {
  const map: Record<string, boolean> = {}
  for (const key of ALL_PERMISSION_KEYS) {
    map[key] = false
  }
  for (const row of rows) {
    map[row.key] = Boolean(row.allowed)
  }
  return map
}

function toRoleDto(
  role: {
    id: string
    key: string
    name: string
    description: string | null
    isSystem: boolean
    createdAt: Date
    updatedAt: Date
    permissions: Array<{ key: string, allowed: boolean }>
    _count?: { users: number }
  },
): RoleDto {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: permissionsMapFromRows(role.permissions),
    userCount: role._count?.users ?? 0,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  }
}

async function replaceRolePermissions(roleId: string, permissions: Record<string, boolean>) {
  const prisma = usePrisma()
  const entries = Object.entries(permissions)
    .filter(([key]) => isKnownPermissionKey(key))
    .map(([key, allowed]) => ({ roleId, key, allowed: Boolean(allowed) }))

  await prisma.rolePermission.deleteMany({ where: { roleId } })
  if (entries.length) {
    await prisma.rolePermission.createMany({ data: entries })
  }
}

/** Garante papéis padrão (admin / user) e permissões. */
export async function ensureRolesSeeded() {
  const prisma = usePrisma()

  let admin = await prisma.role.findUnique({ where: { key: SYSTEM_ROLE_KEYS.admin } })
  if (!admin) {
    admin = await prisma.role.create({
      data: {
        key: SYSTEM_ROLE_KEYS.admin,
        name: 'Administrador',
        description: 'Acesso total ao painel e às configurações.',
        isSystem: true,
      },
    })
  }

  let user = await prisma.role.findUnique({ where: { key: SYSTEM_ROLE_KEYS.user } })
  if (!user) {
    user = await prisma.role.create({
      data: {
        key: SYSTEM_ROLE_KEYS.user,
        name: 'Usuário',
        description: 'Conta padrão com acesso à própria conta.',
        isSystem: true,
      },
    })
  }

  const adminPerms = Object.fromEntries(ALL_PERMISSION_KEYS.map((key) => [key, true]))
  const userPerms = Object.fromEntries(
    ALL_PERMISSION_KEYS.map((key) => [key, key === 'account.view']),
  )

  const adminCount = await prisma.rolePermission.count({ where: { roleId: admin.id } })
  if (adminCount === 0) {
    await replaceRolePermissions(admin.id, adminPerms)
  }

  const userCount = await prisma.rolePermission.count({ where: { roleId: user.id } })
  if (userCount === 0) {
    await replaceRolePermissions(user.id, userPerms)
  }

  // Contas antigas sem papel recebem o papel padrão "user".
  await prisma.user.updateMany({
    where: { roleId: null },
    data: { roleId: user.id },
  })

  return { admin, user }
}

export async function getDefaultUserRoleId() {
  const { user } = await ensureRolesSeeded()
  return user.id
}

export async function getAdminRoleId() {
  const { admin } = await ensureRolesSeeded()
  return admin.id
}

export async function listRoles() {
  await ensureRolesSeeded()
  const prisma = usePrisma()
  const roles = await prisma.role.findMany({
    include: {
      permissions: true,
      _count: { select: { users: true } },
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  })
  return roles.map(toRoleDto)
}

export async function getRoleById(id: string) {
  await ensureRolesSeeded()
  const prisma = usePrisma()
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      permissions: true,
      _count: { select: { users: true } },
    },
  })
  return role ? toRoleDto(role) : null
}

export async function createRole(input: {
  name: string
  key?: string
  description?: string
  permissions?: Record<string, boolean>
}) {
  await ensureRolesSeeded()
  const prisma = usePrisma()
  const name = input.name.trim()
  if (!name) {
    throw createError({ statusCode: 400, message: 'Informe o nome do tipo de permissão.' })
  }

  let key = slugifyRoleKey(input.key || name)
  if (!key) {
    throw createError({ statusCode: 400, message: 'Informe uma chave válida.' })
  }

  const existing = await prisma.role.findUnique({ where: { key } })
  if (existing) {
    key = `${key}-${Date.now().toString(36)}`
  }

  const role = await prisma.role.create({
    data: {
      key,
      name,
      description: input.description?.trim() || null,
      isSystem: false,
    },
  })

  const permissions = input.permissions
    ?? Object.fromEntries(ALL_PERMISSION_KEYS.map((item) => [item, item === 'account.view']))
  await replaceRolePermissions(role.id, permissions)

  const full = await getRoleById(role.id)
  if (!full) {
    throw createError({ statusCode: 500, message: 'Falha ao criar o tipo de permissão.' })
  }
  return full
}

export async function updateRole(
  id: string,
  input: {
    name?: string
    description?: string | null
    permissions?: Record<string, boolean>
  },
) {
  await ensureRolesSeeded()
  const prisma = usePrisma()
  const role = await prisma.role.findUnique({ where: { id } })
  if (!role) {
    throw createError({ statusCode: 404, message: 'Tipo de permissão não encontrado.' })
  }

  const name = input.name?.trim()
  if (name !== undefined && !name) {
    throw createError({ statusCode: 400, message: 'Informe o nome do tipo de permissão.' })
  }

  await prisma.role.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
    },
  })

  if (input.permissions) {
    // Papel admin do sistema sempre mantém todas as permissões.
    if (role.key === SYSTEM_ROLE_KEYS.admin && role.isSystem) {
      const all = Object.fromEntries(ALL_PERMISSION_KEYS.map((key) => [key, true]))
      await replaceRolePermissions(id, all)
    }
    else {
      await replaceRolePermissions(id, input.permissions)
    }
  }

  const full = await getRoleById(id)
  if (!full) {
    throw createError({ statusCode: 404, message: 'Tipo de permissão não encontrado.' })
  }
  return full
}

export async function deleteRole(id: string) {
  await ensureRolesSeeded()
  const prisma = usePrisma()
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  })
  if (!role) {
    throw createError({ statusCode: 404, message: 'Tipo de permissão não encontrado.' })
  }
  if (role.isSystem) {
    throw createError({
      statusCode: 400,
      message: 'Tipos de permissão do sistema não podem ser excluídos.',
    })
  }
  if (role._count.users > 0) {
    throw createError({
      statusCode: 400,
      message: 'Reassocie os usuários antes de excluir este tipo de permissão.',
    })
  }

  await prisma.role.delete({ where: { id } })
  return { ok: true }
}

export function getPermissionCatalog() {
  return PERMISSION_GROUPS
}

export async function getUserPermissionKeys(userId: string) {
  await ensureRolesSeeded()
  const prisma = usePrisma()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      roleId: true,
      role: {
        select: {
          key: true,
          permissions: {
            where: { allowed: true },
            select: { key: true },
          },
        },
      },
    },
  })

  if (!user?.role) {
    return { roleKey: null as string | null, permissions: [] as string[] }
  }

  if (user.role.key === SYSTEM_ROLE_KEYS.admin) {
    return {
      roleKey: user.role.key,
      permissions: [...ALL_PERMISSION_KEYS],
    }
  }

  return {
    roleKey: user.role.key,
    permissions: user.role.permissions.map((item) => item.key),
  }
}
