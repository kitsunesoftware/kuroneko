# Como atualizar a base Kuroneko

Guia para projetos que **consomem** o Kuroneko via `extends` (npm/git) e querem subir a versão da plataforma **sem perder** páginas e módulos próprios.

## Política (não negociável)

| Pode editar | Não edite |
|---|---|
| `app/` do **seu** projeto | `layers/base` |
| `layers/<seu-modulo>/` | `layers/auth` |
| `app.config.ts` / overrides | `layers/panel` |
| Dependência/tag do Kuroneko | Cópia local da plataforma “só para um fix” |

Se precisar de um fix na plataforma, abra PR no repositório Kuroneko. Patchar a base no projeto do cliente torna o próximo update um conflito garantido.

## Antes de atualizar

1. Leia o [CHANGELOG](../CHANGELOG.md) da versão alvo (breaking vs additive).
2. Commit/backup do seu projeto.
3. Confirme as zonas com:

```bash
# na raiz do seu projeto consumidor
npx --yes node path/to/kuroneko/scripts/check-zones.mjs .

# ou, neste monorepo, validar o fixture:
npm run kuroneko:check-zones -- examples/consumer
```

## Passos

### 1. Bump da versão

**GitHub tag no `extends` / package.json:**

```bash
# helper (neste monorepo ou copie o script)
npm run kuroneko:update -- --to 1.1.0
```

Ou manualmente:

```json
{
  "devDependencies": {
    "@kitsunesoftware/kuroneko": "github:kitsunesoftware/kuroneko#v1.1.0"
  }
}
```

```ts
// nuxt.config.ts — estenda o pacote instalado
export default defineNuxtConfig({
  extends: ['@kitsunesoftware/kuroneko'],
  // ou: 'github:kitsunesoftware/kuroneko#v1.1.0'
})
```

A versão sobe no `package.json` (`github:...#v1.1.0` ou npm); o `extends` continua no nome do pacote.

**Caminho local (monorepo):** faça `git pull` / checkout da tag no clone do Kuroneko. O `extends: ['../kuroneko']` já aponta para o código novo.

### 2. Instalar

```bash
npm install
```

### 3. Banco / Prisma

No **primeiro setup** do projeto consumidor (e após updates que mudem schema):

```bash
# dependências (uma vez)
npm i @prisma/client
npm i -D prisma

# compose schemas da plataforma + generate + db push
npm run db:setup
# equivalente:
# node node_modules/@kitsunesoftware/kuroneko/scripts/db-setup.mjs
```

Scripts sugeridos no `package.json` do consumidor:

```json
{
  "scripts": {
    "db:setup": "node node_modules/@kitsunesoftware/kuroneko/scripts/db-setup.mjs",
    "db:generate": "node node_modules/@kitsunesoftware/kuroneko/scripts/db-setup.mjs --generate-only"
  }
}
```

O script detecta a plataforma em `node_modules/@kitsunesoftware/kuroneko` e escreve `prisma/schema` no **seu** projeto.

### 4. Reiniciar

- Dev: pare e suba de novo `npm run dev`
- Produção (PM2): use o fluxo de rebuild/restart do Kuroneko (painel ou `pm2`)

### 5. Smoke checklist

- [ ] `/` e páginas suas em `app/pages` abrem
- [ ] `/panel` e settings abrem
- [ ] Login / conta
- [ ] Módulos da loja (se usar) compatíveis com `minKuroneko`
- [ ] SMTP / e-mail (se configurado)

## O que NÃO deve acontecer no update

- Seus arquivos em `app/` não são sobrescritos pela plataforma
- Seu `layers/meu-modulo` permanece
- Só sobe código que veio do pacote/tag Kuroneko

Se algo “sumiu”, em geral alguém tinha customizado a plataforma por dentro (violou a política) ou havia override acidental com o mesmo path em `app/`.

## Fixture de referência

Veja `examples/consumer/`: site mínimo + layer própria `hello-site`, sem copiar `base|auth|panel`. Use como modelo de projeto seguro para updates.
