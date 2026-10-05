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

## Simular update

1. Mude a tag em `nuxt.config.ts` / `package.json`
2. `npm install` (se usar git/npm)
3. Confira que `/contato` e `/hello` continuam e `/panel` sobe da plataforma nova

Ver [docs/UPDATE.md](../../docs/UPDATE.md).
