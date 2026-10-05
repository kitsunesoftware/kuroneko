/**
 * Roda antes do `nuxt dev` quando há generate pendente (instalação de módulo
 * com schema no Windows, onde prisma generate falha com EPERM em runtime).
 */
import { existsSync, mkdirSync, unlinkSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const root = process.cwd()
const flagPath = join(root, '.kuroneko', 'pending-prisma-generate')
const force = process.argv.includes('--force')

if (!force && !existsSync(flagPath)) {
  process.exit(0)
}

function log(line) {
  try {
    mkdirSync(join(root, '.kuroneko'), { recursive: true })
    appendFileSync(join(root, '.kuroneko', 'restart.log'), `${line}\n`, 'utf8')
  }
  catch {
    // ignore
  }
  console.log(line)
}

function run(command, args) {
  const isWin = process.platform === 'win32'
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      shell: isWin,
      stdio: 'inherit',
      windowsHide: true,
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} saiu com código ${code}`))
    })
  })
}

log(`\n--- ${new Date().toISOString()} ensure-prisma (pending generate) ---`)

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
await run(npm, ['run', 'db:generate'])

try {
  unlinkSync(flagPath)
}
catch {
  // ignore
}

log('[ensure-prisma] Prisma Client atualizado.')
