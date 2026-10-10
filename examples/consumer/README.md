# Fixture consumidor Kuroneko

Projeto mínimo usado para validar updates da base.

## Estrutura

```text
examples/consumer/
├── app/                    # site do cliente
│   ├── app.vue             # obrigatório: <NuxtLayout> + <NuxtPage>
│   ├── pages/              # /, /contato
│   └── app.config.ts
├── layers/
│   └── hello-site/         # módulo próprio (/hello)
└── nuxt.config.ts          # extends hello-site + Kuroneko
```

O `app.vue` do Nuxt starter **substitui** o da plataforma. Sem `<NuxtLayout>`, a sidebar/layouts do Kuroneko não montam.

**Não existe** `layers/base|auth|panel` aqui — isso vem do `extends`.

## Rodar (a partir deste diretório)

O `extends: ['../..']` aponta para o monorepo. Preferível validar zonas e desenvolver no app raiz; este fixture é referência estrutural.

```bash
# na raiz do monorepo
npm run kuroneko:check-zones -- examples/consumer
```

## Produção (PM2)

Este fixture **não** tem `scripts/pm2-rebuild.mjs`, `process-module-queue.mjs` nem `db-setup.mjs`. O restart usa os scripts do pacote.

`ecosystem.config.cjs` sobe o app com `name` = `NUXT_PM2_APP_NAME` = `kuroneko-consumer`.

```bash
npm run build
pm2 start ecosystem.config.cjs
```

Smoke: instalar um módulo da loja → **Reiniciar aplicação** → o banner de reinício some. `GET /api/modules/installed` fica com `needsRestart: false` e `pendingModuleIds: []`. Log em `.kuroneko/restart.log`.

Os scripts `db:setup` / `db:generate` do `package.json` apontam para `node_modules/@kitsunesoftware/kuroneko/scripts/db-setup.mjs`.

## Simular update

1. Mude a tag em `nuxt.config.ts` / `package.json`
2. `npm install` (se usar git/npm)
3. Confira que `/contato` e `/hello` continuam e `/panel` sobe da plataforma nova

Ver [docs/UPDATE.md](../../docs/UPDATE.md).
