# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato é inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere a [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
