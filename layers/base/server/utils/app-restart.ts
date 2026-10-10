import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { createError } from 'h3'
import { resolvePm2RebuildScriptPath } from './resolve-pm2-rebuild-script.mjs'

export type AppRuntimeMode = 'dev' | 'prod'

export type StoreRuntimeInfo = {
  mode: AppRuntimeMode
  pm2: boolean
  available: boolean
  appName: string
  label: string
  hint: string
}

let scheduled = false

export function getAppRuntimeMode(): AppRuntimeMode {
  return import.meta.dev ? 'dev' : 'prod'
}

export function isRunningUnderPm2() {
  return process.env.pm_id !== undefined || Boolean(process.env.PM2_HOME)
}

export function resolvePm2AppName() {
  const config = useRuntimeConfig()
  const fromConfig = String(config.pm2AppName || '').trim()
  if (fromConfig) return fromConfig
  return 'kuroneko'
}

export function getStoreRuntimeInfo(): StoreRuntimeInfo {
  const mode = getAppRuntimeMode()
  const pm2 = isRunningUnderPm2()
  const appName = resolvePm2AppName()
  const available = mode === 'prod' && pm2

  return {
    mode,
    pm2,
    available,
    appName,
    label: 'Reiniciar aplicação',
    hint: available
      ? `Para ${appName}: processa a fila de módulos, aplica schema, faz build e sobe no PM2.`
      : mode === 'dev'
        ? 'Reinício automático só sob PM2. Em desenvolvimento, processe a fila manualmente ou use PM2.'
        : 'Disponível só sob PM2 (pm2 start ecosystem.config.cjs).',
  }
}

/**
 * Remove caches externos que mantêm layers fantasma.
 * NÃO apaga `.nuxt` com o dev server vivo — isso quebra o Vite
 * (`Tsconfig not found .nuxt/tsconfig.app.json`) no meio do rebuild.
 */
export function clearNuxtLayerCaches(moduleId?: string) {
  const root = process.cwd()
  const removed: string[] = []

  const targets = [
    join(root, 'node_modules', '.cache', 'nuxt'),
  ]

  for (const dir of targets) {
    if (!existsSync(dir)) continue
    try {
      rmSync(dir, { recursive: true, force: true })
      removed.push(dir.replace(/\\/g, '/'))
    }
    catch {
      // Windows pode segurar handle — o restart seguinte recria
    }
  }

  const jitiDir = join(root, 'node_modules', '.cache', 'jiti')
  if (existsSync(jitiDir)) {
    const needle = String(moduleId || '')
      .split('.')
      .filter(Boolean)
      .pop()
      ?.toLowerCase()
    try {
      for (const name of readdirSync(jitiDir)) {
        const lower = name.toLowerCase()
        const matchModule = needle && lower.includes(needle)
        const matchDiscover = lower.includes('discover-layers')
        if (matchModule || matchDiscover) {
          try {
            rmSync(join(jitiDir, name), { force: true })
            removed.push(join(jitiDir, name).replace(/\\/g, '/'))
          }
          catch {
            // ignore
          }
        }
      }
    }
    catch {
      // ignore
    }
  }

  mkdirSync(join(root, '.kuroneko'), { recursive: true })
  appendFileSync(
    join(root, '.kuroneko', 'restart.log'),
    `\n--- ${new Date().toISOString()} clear nuxt layer caches${moduleId ? ` (${moduleId})` : ''} → ${removed.length} path(s) ---\n`,
  )

  return { removed }
}

/**
 * Em desenvolvimento, toca o nuxt.config para forçar reload e rediscovery de layers/
 * (mesmo efeito prático de remover uma layer e o watcher reiniciar o processo).
 */
export async function triggerNuxtDevRestart(reason = 'layer-change', options?: { clearCaches?: boolean, moduleId?: string }) {
  if (!import.meta.dev) {
    return { triggered: false as const, reason }
  }

  const root = process.cwd()
  if (options?.clearCaches) {
    clearNuxtLayerCaches(options.moduleId)
  }

  const configPath = ['nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mjs']
    .map((name) => join(root, name))
    .find((path) => existsSync(path))

  if (!configPath) {
    return { triggered: false as const, reason }
  }

  const now = new Date()
  await utimes(configPath, now, now)

  mkdirSync(join(root, '.kuroneko'), { recursive: true })
  appendFileSync(
    join(root, '.kuroneko', 'restart.log'),
    `\n--- ${now.toISOString()} nuxt:dev restart (${reason}) → ${configPath} ---\n`,
  )

  return { triggered: true as const, reason, path: configPath.replace(/\\/g, '/') }
}

/** Aspas para cmd.exe quando `shell: true` junta os args com espaço. */
function quoteCmdArg(value: string) {
  if (!/[\s"]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * Default: script do pacote. `scripts/pm2-rebuild.mjs` na raiz do consumer
 * só entra se for um arquivo diferente (override). No monorepo os dois paths coincidem.
 */
export function resolvePm2RebuildScript(projectRoot = process.cwd()) {
  try {
    return resolvePm2RebuildScriptPath(projectRoot)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw createError({ statusCode: 500, message })
  }
}

/**
 * Agenda rebuild como app one-shot no daemon PM2 (fora da árvore do processo atual).
 * No Windows, filho detached do Node do app morre junto no `pm2 stop`.
 * O script roda com cwd = raiz do consumer; o arquivo em si vem do pacote.
 */
export function schedulePm2Rebuild() {
  const info = getStoreRuntimeInfo()

  if (!info.available) {
    throw createError({
      statusCode: 400,
      message: info.mode === 'dev'
        ? 'Reinício automático só está disponível sob PM2 em produção. Em dev, reinicie manualmente após baixar/instalar módulos.'
        : 'Este processo não está sob PM2. Inicie com: pm2 start ecosystem.config.cjs',
    })
  }

  if (scheduled) {
    throw createError({
      statusCode: 409,
      message: 'Já existe um rebuild agendado.',
    })
  }

  const root = process.cwd()
  const script = resolvePm2RebuildScript(root)
  scheduled = true

  const jobName = `${info.appName}-rebuild`
  const isWin = process.platform === 'win32'
  const pm2 = isWin ? 'pm2.cmd' : 'pm2'
  const pm2Args = (args: string[]) => (isWin ? args.map(quoteCmdArg) : args)

  mkdirSync(join(root, '.kuroneko'), { recursive: true })
  appendFileSync(
    join(root, '.kuroneko', 'restart.log'),
    `\n--- ${new Date().toISOString()} schedule pm2 job ${jobName} → ${script.replace(/\\/g, '/')} ---\n`,
  )

  // remove job antigo se existir (fire-and-forget)
  spawn(pm2, pm2Args(['delete', jobName]), {
    cwd: root,
    env: process.env,
    shell: isWin,
    stdio: 'ignore',
    windowsHide: true,
  }).on('close', () => {
    const child = spawn(
      pm2,
      pm2Args([
        'start',
        script,
        '--name',
        jobName,
        '--interpreter',
        'node',
        '--no-autorestart',
        '--',
        info.appName,
      ]),
      {
        cwd: root,
        env: process.env,
        shell: isWin,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      },
    )
    child.unref()
  })

  return {
    ok: true as const,
    scheduled: true as const,
    appName: info.appName,
    jobName,
    message: `Job PM2 “${jobName}” agendado: stop → fila → compose → generate → push → build → restart.`,
  }
}

/**
 * Marca generate pendente: o próximo `npm run dev` roda db:generate antes do Nuxt
 * (sem matar o processo atual — evita derrubar o terminal no Windows).
 */
export function markPendingPrismaGenerate(reason = 'install') {
  const root = process.cwd()
  mkdirSync(join(root, '.kuroneko'), { recursive: true })
  const flagPath = join(root, '.kuroneko', 'pending-prisma-generate')
  writeFileSync(
    flagPath,
    `${JSON.stringify({ reason, at: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  )
  appendFileSync(
    join(root, '.kuroneko', 'restart.log'),
    `\n--- ${new Date().toISOString()} pending-prisma-generate (${reason}) ---\n`,
  )
  return { ok: true as const, reason, path: flagPath.replace(/\\/g, '/') }
}
