import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import type { User } from '@prisma/client'
import { usePrisma } from '../../../base/server/utils/prisma'

export type AuthUser = {
  id: string
  email: string
  name: string
  username: string | null
  roleId?: string | null
  roleKey?: string | null
  permissions?: string[]
}

export type DeviceSessionView = {
  id: string
  title: string
  type: string
  ip: string
  activity: string
  current: boolean
  remember: boolean
  createdAt: string
  lastSeenAt: string
}

export type ResolvedAuthSession = {
  user: AuthUser
  sessionId: string
  tokenHash: string
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000
const LAST_SEEN_THROTTLE_MS = 60 * 1000

export function toAuthUser(
  user: User & { role?: { key: string } | null },
): AuthUser {
  return {
    id: user.id,
    email: user.email ?? '',
    name: user.name || user.username || user.email?.split('@')[0] || 'Usuário',
    username: user.username ?? null,
    roleId: user.roleId ?? null,
    roleKey: user.role?.key ?? null,
  }
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function parseUserAgent(userAgent: string | null | undefined) {
  const ua = userAgent || ''

  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/i.test(ua)
      ? 'Opera'
      : /Chrome\//i.test(ua) && !/Chromium/i.test(ua)
        ? 'Chrome'
        : /Firefox\//i.test(ua)
          ? 'Firefox'
          : /Safari\//i.test(ua) && !/Chrome/i.test(ua)
            ? 'Safari'
            : ua
              ? 'Navegador'
              : 'Desconhecido'

  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/i.test(ua)
        ? 'iOS'
        : /Mac OS X|macOS/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Sistema'

  const deviceType = /Mobile|Android|iPhone|iPad|iPod/i.test(ua)
    ? 'Dispositivo móvel'
    : 'Computador'

  return {
    deviceLabel: `${browser} · ${os}`,
    deviceType,
  }
}

function formatActivity(lastSeenAt: Date, remember: boolean) {
  const diffMs = Date.now() - lastSeenAt.getTime()
  const recent = diffMs < 2 * 60 * 1000
  const base = recent
    ? 'Ativo agora'
    : `Ativo ${new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(lastSeenAt)}`

  if (remember && !recent) return `${base} — Lembrar dispositivo`
  return base
}

export async function createAuthSession(
  userId: string,
  meta: {
    userAgent?: string | null
    ip?: string | null
    remember?: boolean
  } = {},
) {
  const prisma = usePrisma()
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashSessionToken(token)
  const remember = Boolean(meta.remember)
  const ttl = remember ? REMEMBER_TTL_MS : SESSION_TTL_MS
  const { deviceLabel, deviceType } = parseUserAgent(meta.userAgent)

  const session = await prisma.authSession.create({
    data: {
      userId,
      tokenHash,
      userAgent: meta.userAgent || null,
      deviceLabel,
      deviceType,
      ip: meta.ip || null,
      remember,
      expiresAt: new Date(Date.now() + ttl),
    },
  })

  return {
    token,
    sessionId: session.id,
  }
}

export async function createAuthSessionFromEvent(
  event: H3Event,
  userId: string,
  options: { remember?: boolean } = {},
) {
  const userAgent = getHeader(event, 'user-agent') || null
  const ip = getRequestIP(event, { xForwardedFor: true }) || null
  return createAuthSession(userId, {
    userAgent,
    ip,
    remember: options.remember,
  })
}

export async function resolveAuthSession(token?: string): Promise<ResolvedAuthSession | null> {
  if (!token) return null

  try {
    const prisma = usePrisma()
    const tokenHash = hashSessionToken(token)
    const session = await prisma.authSession.findUnique({
      where: { tokenHash },
    })

    if (!session) return null
    if (session.revokedAt) return null
    if (session.expiresAt.getTime() <= Date.now()) {
      await prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }).catch(() => {})
      return null
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { role: { select: { key: true } } },
    })
    if (!user) return null
    if (!user.enabled) {
      await prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }).catch(() => {})
      return null
    }

    const now = Date.now()
    if (now - session.lastSeenAt.getTime() >= LAST_SEEN_THROTTLE_MS) {
      await prisma.authSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      }).catch(() => {})
    }

    return {
      user: toAuthUser(user),
      sessionId: session.id,
      tokenHash,
    }
  }
  catch {
    return null
  }
}

export async function revokeSessionById(userId: string, sessionId: string) {
  const prisma = usePrisma()
  const session = await prisma.authSession.findFirst({
    where: { id: sessionId, userId, revokedAt: null },
  })
  if (!session) {
    throw createError({ statusCode: 404, message: 'Sessão não encontrada.' })
  }

  await prisma.authSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  })

  return { ok: true, revokedId: session.id }
}

export async function revokeOtherSessions(userId: string, currentSessionId: string) {
  const prisma = usePrisma()
  const result = await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      NOT: { id: currentSessionId },
    },
    data: { revokedAt: new Date() },
  })
  return { ok: true, revokedCount: result.count }
}

export async function revokeAllSessionsForUser(userId: string) {
  const prisma = usePrisma()
  const result = await prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return { ok: true, revokedCount: result.count }
}

export async function revokeSessionByToken(token?: string) {
  if (!token) return { ok: true }
  const prisma = usePrisma()
  const tokenHash = hashSessionToken(token)
  await prisma.authSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return { ok: true }
}

export async function listUserDevices(userId: string, currentSessionId?: string | null) {
  const prisma = usePrisma()
  const now = new Date()

  await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { lte: now },
    },
    data: { revokedAt: now },
  }).catch(() => {})

  const sessions = await prisma.authSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: [
      { lastSeenAt: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  const devices: DeviceSessionView[] = sessions.map((session) => ({
    id: session.id,
    title: session.deviceLabel || 'Dispositivo desconhecido',
    type: session.deviceType || 'Computador',
    ip: session.ip || '—',
    activity: formatActivity(session.lastSeenAt, session.remember),
    current: Boolean(currentSessionId && session.id === currentSessionId),
    remember: session.remember,
    createdAt: session.createdAt.toISOString(),
    lastSeenAt: session.lastSeenAt.toISOString(),
  }))

  devices.sort((a, b) => Number(b.current) - Number(a.current))
  return devices
}
