#!/usr/bin/env node
/**
 * Valida a separação plataforma vs projeto.
 *
 * Uso:
 *   node scripts/check-zones.mjs                 # valida este monorepo (plataforma)
 *   node scripts/check-zones.mjs examples/consumer
 *   node scripts/check-zones.mjs /caminho/projeto-consumidor
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const targetArg = process.argv[2]
const root = resolve(process.cwd(), targetArg || '.')
const isPlatformRoot = !targetArg

const FORBIDDEN_IN_CONSUMER = ['base', 'auth', 'panel']
const PLATFORM_PAGES_IN_APP = [
  'panel',
  'install',
  'maintenance',
  'blocked',
  'account',
  'settings',
]

let errors = 0
let warnings = 0

function fail(msg) {
  console.error(`✗ ${msg}`)
  errors += 1
}

function warn(msg) {
  console.warn(`! ${msg}`)
  warnings += 1
}

function ok(msg) {
  console.log(`✓ ${msg}`)
}

function listDirs(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
}

console.log(`Kuroneko zones check → ${root}`)
console.log(isPlatformRoot ? '(modo plataforma)' : '(modo consumidor)\n')

if (isPlatformRoot) {
  for (const name of FORBIDDEN_IN_CONSUMER) {
    const dir = join(root, 'layers', name)
    if (existsSync(dir)) ok(`layers/${name} presente (plataforma)`)
    else fail(`layers/${name} ausente na plataforma`)
  }

  const appPages = join(root, 'app', 'pages')
  if (!existsSync(appPages)) {
    fail('app/pages ausente')
  }
  else {
    const pages = listDirs(appPages).concat(
      readdirSync(appPages).filter((f) => f.endsWith('.vue')).map((f) => f.replace(/\.vue$/, '')),
    )
    for (const banned of PLATFORM_PAGES_IN_APP) {
      if (pages.includes(banned) || existsSync(join(appPages, banned))) {
        fail(`app/pages contém "${banned}" — isso é da plataforma, mova para layers/`)
      }
    }
    if (existsSync(join(appPages, 'index.vue')) || existsSync(join(appPages, 'index'))) {
      ok('app/pages tem skeleton (index)')
    }
    else {
      warn('app/pages sem index.vue (skeleton vazio?)')
    }
  }

  const appComponents = join(root, 'app', 'components')
  if (existsSync(appComponents) && listDirs(appComponents).length + readdirSync(appComponents).length > 0) {
    const files = readdirSync(appComponents)
    const platformish = files.filter((f) =>
      /^(Modules|Store|AppRestart|ErrorState|FuzzyText|Account)/i.test(f),
    )
    if (platformish.length) {
      fail(`app/components ainda tem UI de plataforma: ${platformish.join(', ')}`)
    }
    else {
      ok('app/components sem UI de plataforma conhecida')
    }
  }
  else {
    ok('app/components vazio ou ausente (ok no skeleton)')
  }
}
else {
  // Consumidor: não pode ter layers da plataforma
  const layersDir = join(root, 'layers')
  const layerNames = listDirs(layersDir)

  for (const banned of FORBIDDEN_IN_CONSUMER) {
    if (layerNames.includes(banned)) {
      fail(
        `layers/${banned} encontrado no consumidor — remova e use extends do pacote Kuroneko`,
      )
    }
  }

  const custom = layerNames.filter((n) => !FORBIDDEN_IN_CONSUMER.includes(n))
  if (custom.length) ok(`layers próprias: ${custom.join(', ')}`)
  else warn('nenhuma layer própria (só app/ — ok se for site simples)')

  if (!existsSync(join(root, 'app'))) {
    fail('app/ ausente no consumidor')
  }
  else {
    ok('app/ presente')
  }

  const nuxtConfig = ['nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mjs']
    .map((f) => join(root, f))
    .find((f) => existsSync(f))
  if (!nuxtConfig) fail('nuxt.config.* ausente')
  else ok(`config: ${nuxtConfig.replace(`${root}\\`, '').replace(`${root}/`, '')}`)
}

console.log('')
if (errors) {
  console.error(`Falhou: ${errors} erro(s), ${warnings} aviso(s).`)
  process.exit(1)
}
console.log(`Ok: zonas válidas.${warnings ? ` (${warnings} aviso(s))` : ''}`)
