# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato é inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere a [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [2.0.0] - 2026-10-10

### Breaking

- Prisma ORM 6.19 → **7.10**. Consumers precisam de `prisma@7`, `@prisma/client@7`, `@prisma/adapter-pg` e `pg`. `npm i prisma` sem `@7` instala o CLI 8, que não tem `generate` nem `db push`
- O client passa a ser gerado em `generated/prisma` (não commitar). `DATABASE_URL` fica em `prisma.config.ts`; o `db:setup` cria esse arquivo se ele não existir
- A conexão usa `@prisma/adapter-pg`. `new PrismaClient()` sem adapter deixa de funcionar
- Removida a cópia de `node_modules/.prisma` para o `.output` (`scripts/fix-prisma-output.mjs`)

### Fixed

- **Reiniciar aplicação** resolve `pm2-rebuild.mjs`, `process-module-queue.mjs` e `db-setup.mjs` no pacote Kuroneko. O consumer não precisa copiar esses scripts. Um `scripts/pm2-rebuild.mjs` local diferente do pacote continua valendo como override
- O job PM2 carrega o Prisma Client gerado na raiz do projeto, não um client aninhado dentro do pacote

### Added

- Fixture `examples/consumer` com `ecosystem.config.cjs` e `NUXT_PM2_APP_NAME=kuroneko-consumer`
- `create-project.sh` grava `ecosystem.config.cjs`, `NUXT_PM2_APP_NAME` e `prisma.config.ts`

## [1.0.0] - 2026-10-05

Primeira release pública da plataforma Kuroneko (Nuxt 4 modular).

### Added

- Layer `base`: layout, settings, SMTP, manutenção, wizard `/install` e compatibilidade de plataforma
- Layer `auth`: login, registro, recuperação, conta, roles, dispositivos, Turnstile e 2FA
- Layer `panel`: painel administrativo (overview, usuários, roles, módulos, loja, settings)
- Schema Prisma modular (`prisma/schema/`) com PostgreSQL
- Scripts de tooling: `db-setup`, postinstall, update, check-zones e `create-project`
- Fixture `examples/consumer` e documentação de update (`docs/UPDATE.md`)
- README e script de bootstrap via gist

### Notes

- Consumidores devem usar um database vazio para o wizard `/install` aparecer
- Prisma 6.x (não 8 RC) é o alvo suportado nesta versão
