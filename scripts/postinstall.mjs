import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

/**
 * Quando o Kuroneko é instalado como dependência (node_modules), não rode
 * prepare/db do monorepo. Só na raiz do próprio projeto (tem .git ou flag).
 */
const isPlatformRoot = existsSync('.git') || process.env.KURONEKO_ROOT === '1'

if (!isPlatformRoot) {
  console.log('[kuroneko] Instalado como layer — pulando postinstall da plataforma.')
  process.exit(0)
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('npx', ['nuxt', 'prepare'])
run('npm', ['run', 'db:compose'])
run('npm', ['run', 'db:generate'])
