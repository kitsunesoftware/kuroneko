/**
 * Rebuild via PM2 daemon.
 *
 * Fluxo:
 *   pm2 stop
 *   → processa fila ModuleChangeQueue (install/uninstall + drop schema)
 *   → db:compose (installed-only) → generate → db push
 *   → npm run build
 *   → pm2 restart
 */
import { execFile, spawn } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const appName = process.argv[2] || 'kuroneko'
const root = process.cwd()
const isWin = process.platform === 'win32'
const logPath = join(root, '.kuroneko', 'restart.log')
const jobName = `${appName}-rebuild`

function log(line) {
  try {
    mkdirSync(join(root, '.kuroneko'), { recursive: true })
    appendFileSync(logPath, `${line}\n`, 'utf8')
  }
  catch {
    // ignore
  }
  console.log(line)
}

function quoteWin(value) {
  const text = String(value)
  if (!/[\s"]/.test(text)) return text
  return `"${text.replace(/"/g, '\\"')}"`
}

/**
 * - node.exe com espaço em Program Files → execFile (sem shell)
 * - npm.cmd / pm2.cmd no Node 20+ → precisam shell:true (senão EINVAL)
 * - com shell, aspas evitam `'C:\Program' não é reconhecido`
 */
function run(command, args = []) {
  return new Promise((resolve, reject) => {
    log(`$ ${command} ${args.join(' ')}`)
    const useShell = isWin && /\.(cmd|bat)$/i.test(command)

    const child = useShell
      ? spawn([quoteWin(command), ...args.map(quoteWin)].join(' '), {
          cwd: root,
          env: process.env,
          shell: true,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      : execFile(command, args, {
          cwd: root,
          env: process.env,
          windowsHide: true,
          maxBuffer: 20 * 1024 * 1024,
        })

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString('utf8').trimEnd()
      if (text) log(text)
    })
    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString('utf8').trimEnd()
      if (text) log(text)
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} saiu com código ${code}`))
    })
  })
}

async function cleanupJob(pm2) {
  try {
    await run(pm2, ['delete', jobName])
  }
  catch {
    // ignore
  }
}

function resolveNpm() {
  if (!isWin) return 'npm'
  // Preferir npm.cmd no PATH; fallback via `where`
  return 'npm.cmd'
}

function resolvePm2() {
  return isWin ? 'pm2.cmd' : 'pm2'
}

async function main() {
  const npm = resolveNpm()
  const pm2 = resolvePm2()
  const node = process.execPath
  let pipelineOk = false

  log(`\n--- ${new Date().toISOString()} pm2-rebuild ${appName} (job ${jobName}) ---`)
  await sleep(1000)

  log(`[pm2-rebuild] parando ${appName}…`)
  try {
    await run(pm2, ['stop', appName])
  }
  catch (error) {
    log(`[aviso] stop: ${error instanceof Error ? error.message : error}`)
  }

  await sleep(isWin ? 3000 : 1000)

  try {
    log('[pm2-rebuild] process-module-queue…')
    await run(node, [join(root, 'scripts', 'process-module-queue.mjs')])

    log('[pm2-rebuild] db:compose (installed-only)…')
    await run(node, [join(root, 'scripts', 'db-setup.mjs'), '--compose-only', '--installed-only'])

    log('[pm2-rebuild] db:generate…')
    await run(npm, ['run', 'db:generate'])

    log('[pm2-rebuild] db:push…')
    await run(node, [
      join(root, 'scripts', 'db-setup.mjs'),
      '--skip-generate',
      '--installed-only',
    ])

    log('[pm2-rebuild] npm run build…')
    await run(npm, ['run', 'build'])

    pipelineOk = true
  }
  catch (error) {
    log(`[erro] pipeline: ${error instanceof Error ? error.message : error}`)
  }

  log(`[pm2-rebuild] pm2 restart ${appName}…`)
  try {
    await run(pm2, ['restart', appName])
  }
  catch {
    await run(pm2, ['start', appName])
  }

  await cleanupJob(pm2)

  if (!pipelineOk) {
    log('[pm2-rebuild] app no ar, mas a pipeline falhou — veja o log.')
    process.exit(1)
  }

  log('[pm2-rebuild] concluído.')
}

main().catch(async (error) => {
  log(`[erro fatal] ${error instanceof Error ? error.message : error}`)
  const pm2 = isWin ? 'pm2.cmd' : 'pm2'
  try {
    await run(pm2, ['restart', appName])
  }
  catch {
    try {
      await run(pm2, ['start', appName])
    }
    catch {
      // ignore
    }
  }
  try {
    await cleanupJob(pm2)
  }
  catch {
    // ignore
  }
  process.exit(1)
})
