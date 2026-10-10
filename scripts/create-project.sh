#!/usr/bin/env bash
# Cria um projeto Nuxt consumidor do Kuroneko.
# Uso (na pasta onde o projeto deve nascer):
#   bash scripts/create-project.sh
#   bash scripts/create-project.sh meu-site
set -euo pipefail

die() {
  echo "Erro: $*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "comando '$1' não encontrado. Instale e tente de novo."
}

need node
need npm
need npx

echo "=== Kuroneko — criar projeto Nuxt ==="
echo

PROJECT="${1:-}"
if [[ -z "$PROJECT" ]]; then
  read -r -p "Nome do projeto: " PROJECT
fi

# trim (bash; evita sed no Git Bash/MINGW)
PROJECT="${PROJECT#"${PROJECT%%[![:space:]]*}"}"
PROJECT="${PROJECT%"${PROJECT##*[![:space:]]}"}"
[[ -n "$PROJECT" ]] || die "informe um nome de projeto."
[[ "$PROJECT" =~ ^[a-zA-Z0-9._-]+$ ]] || die "use só letras, números, ponto, hífen ou underline."

TARGET="$(pwd)/$PROJECT"
[[ ! -e "$TARGET" ]] || die "já existe: $TARGET"

DB_NAME_DEFAULT="$(echo "$PROJECT" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')"
[[ -n "$DB_NAME_DEFAULT" ]] || DB_NAME_DEFAULT="meusite"

echo
echo "→ Criando projeto Nuxt em ${TARGET}"
npx --yes nuxi@latest init "$PROJECT" --packageManager npm --gitInit --force

cd "$TARGET"

echo
echo "=== PostgreSQL (.env) ==="
read -r -p "Host [localhost]: " PG_HOST
PG_HOST="${PG_HOST:-localhost}"
read -r -p "Porta [5432]: " PG_PORT
PG_PORT="${PG_PORT:-5432}"
read -r -p "Usuário [postgres]: " PG_USER
PG_USER="${PG_USER:-postgres}"
read -r -p "Senha: " PG_PASSWORD
echo
read -r -p "Database [${DB_NAME_DEFAULT}]: " PG_DB
PG_DB="${PG_DB:-$DB_NAME_DEFAULT}"

[[ -n "$PG_PASSWORD" ]] || die "informe a senha do PostgreSQL."
[[ -n "$PG_DB" ]] || die "informe o nome do database."

ESCAPED_USER="$(node -p "encodeURIComponent(process.argv[1])" "$PG_USER")"
ESCAPED_PASS="$(node -p "encodeURIComponent(process.argv[1])" "$PG_PASSWORD")"
DATABASE_URL="postgresql://${ESCAPED_USER}:${ESCAPED_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}?schema=public"

echo
echo "→ Escrevendo .env"
cat > .env <<EOF
DATABASE_URL="${DATABASE_URL}"
HOST="0.0.0.0"
PORT="3000"
NUXT_PM2_APP_NAME="${PROJECT}"
EOF

cat > .env.example <<EOF
DATABASE_URL="postgresql://postgres:SUA_SENHA@${PG_HOST}:${PG_PORT}/${PG_DB}?schema=public"
HOST="0.0.0.0"
PORT="3000"
NUXT_PM2_APP_NAME="${PROJECT}"
EOF

echo "→ Escrevendo ecosystem.config.cjs (name = NUXT_PM2_APP_NAME = ${PROJECT})"
cat > ecosystem.config.cjs <<EOF
/**
 * name e NUXT_PM2_APP_NAME são o mesmo valor.
 * Reiniciar aplicação usa os scripts do pacote Kuroneko — não copie scripts/ para cá.
 */
const appName = '${PROJECT}'

module.exports = {
  apps: [
    {
      name: appName,
      cwd: __dirname,
      script: '.output/server/index.mjs',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        NUXT_PM2_APP_NAME: appName,
      },
    },
  ],
}
EOF

echo
echo "→ Instalando dependências"
npm install -D github:kitsunesoftware/kuroneko
npm i @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 pg@8.16.3
npm i -D prisma@7.10.0

echo
echo "→ Escrevendo nuxt.config.ts"
cat > nuxt.config.ts <<'EOF'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  extends: ['github:kitsunesoftware/kuroneko'],
})
EOF

echo "→ Escrevendo app/app.vue"
mkdir -p app
cat > app/app.vue <<'EOF'
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <UiToastHost />
</template>
EOF

echo "→ Atualizando scripts do package.json"
node <<'EOF'
const { readFileSync, writeFileSync } = require('node:fs')

const path = 'package.json'
const pkg = JSON.parse(readFileSync(path, 'utf8'))
pkg.type = pkg.type || 'module'
pkg.private = true
pkg.scripts = Object.assign({}, pkg.scripts || {}, {
  dev: 'nuxt dev',
  build: 'nuxt build',
  preview: 'nuxt preview',
  postinstall: 'nuxt prepare',
  'db:setup': 'node node_modules/@kitsunesoftware/kuroneko/scripts/db-setup.mjs',
  'db:generate': 'node node_modules/@kitsunesoftware/kuroneko/scripts/db-setup.mjs --generate-only',
})
writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
EOF

echo "→ Escrevendo prisma.config.ts"
cat > prisma.config.ts <<'EOF'
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, env } from 'prisma/config'

const root = process.cwd()
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development'
for (const file of [`.env.${mode}`, '.env']) {
  const path = resolve(root, file)
  if (existsSync(path)) loadEnv({ path })
}

export default defineConfig({
  schema: 'prisma/schema',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
EOF

echo
echo "→ Gerando Prisma client (db:generate)"
npm run db:generate

echo
echo "=== Concluído ==="
echo "Pasta: $TARGET"
echo
echo "Dev:"
echo "  cd $PROJECT"
echo "  npm run dev"
echo "  http://localhost:3000/install"
echo
echo "Produção (PM2):"
echo "  NUXT_PM2_APP_NAME=${PROJECT}  (igual ao name em ecosystem.config.cjs)"
echo "  npm run build && pm2 start ecosystem.config.cjs"
echo "  Loja → instalar módulo → Reiniciar aplicação"
echo "  A fila usa os scripts do pacote. Não copie scripts/ do Kuroneko."
echo "  Prisma 7: não instale prisma@latest (hoje isso é o CLI 8)."
echo
echo "O servidor de dev escuta em HOST=0.0.0.0 PORT=3000 (rede local também)."
