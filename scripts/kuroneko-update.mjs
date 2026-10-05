#!/usr/bin/env node
/**
 * Atualiza a referência da base Kuroneko no package.json do projeto atual.
 *
 * Uso:
 *   node scripts/kuroneko-update.mjs --to 1.1.0
 *   node scripts/kuroneko-update.mjs --to v1.1.0 --dep github
 *   node scripts/kuroneko-update.mjs --to 1.1.0 --dep npm
 *
 * Depois: npm install && ler CHANGELOG && reiniciar.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function parseArgs(argv) {
  const out = { to: '', dep: 'github' }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--to') out.to = String(argv[++i] || '')
    else if (a === '--dep') out.dep = String(argv[++i] || 'github')
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

if (args.help || !args.to) {
  console.log(`Uso: node scripts/kuroneko-update.mjs --to <versão> [--dep github|npm]

Exemplos:
  node scripts/kuroneko-update.mjs --to 1.1.0
  node scripts/kuroneko-update.mjs --to v1.1.0 --dep github
  node scripts/kuroneko-update.mjs --to 1.1.0 --dep npm
`)
  process.exit(args.help ? 0 : 1)
}

const version = args.to.replace(/^v/, '')
const tag = `v${version}`
const pkgPath = join(process.cwd(), 'package.json')

if (!existsSync(pkgPath)) {
  console.error('package.json não encontrado no diretório atual.')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const bags = ['dependencies', 'devDependencies', 'optionalDependencies']
const keys = [
  '@kitsunesoftware/kuroneko',
  'kuroneko',
]

let updated = false
const nextValue = args.dep === 'npm'
  ? version
  : `github:kitsunesoftware/kuroneko#${tag}`

for (const bag of bags) {
  if (!pkg[bag] || typeof pkg[bag] !== 'object') continue
  for (const key of keys) {
    if (pkg[bag][key] !== undefined) {
      const prev = pkg[bag][key]
      pkg[bag][key] = nextValue
      console.log(`Atualizado ${bag}.${key}:`)
      console.log(`  ${prev}`)
      console.log(`  → ${nextValue}`)
      updated = true
    }
  }
  // Também atualiza qualquer github:kitsunesoftware/kuroneko#...
  for (const [key, value] of Object.entries(pkg[bag])) {
    if (typeof value === 'string' && value.includes('kitsunesoftware/kuroneko#')) {
      if (pkg[bag][key] === nextValue) continue
      const prev = pkg[bag][key]
      pkg[bag][key] = nextValue
      console.log(`Atualizado ${bag}.${key}:`)
      console.log(`  ${prev}`)
      console.log(`  → ${nextValue}`)
      updated = true
    }
  }
}

if (!updated) {
  if (!pkg.devDependencies) pkg.devDependencies = {}
  pkg.devDependencies['@kitsunesoftware/kuroneko'] = nextValue
  console.log(`Adicionado devDependencies.@kitsunesoftware/kuroneko → ${nextValue}`)
  updated = true
}

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')

console.log(`
Próximos passos:
  1. npm install
  2. Ler CHANGELOG da tag ${tag}
  3. db:generate / migrate se necessário
  4. Reiniciar a aplicação
  5. Smoke: /, /panel, login

Guia: docs/UPDATE.md
`)
