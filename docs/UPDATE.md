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
# dependências (uma vez). Sem o @7, `npm i prisma` instala o CLI 8, que não tem generate nem db push.
npm i @prisma/client@7 @prisma/adapter-pg pg
npm i -D prisma@7

# compose schemas da plataforma + generate + db push
npm run db:setup
# equivalente:
# node node_modules/@kitsunesoftware/kuroneko/scripts/db-setup.mjs
```

O `db:setup` cria `prisma.config.ts` na raiz se ele ainda não existir. O client gerado fica em `generated/prisma` (não commitar). `DATABASE_URL` é lida por esse config, não mais pelo bloco `datasource` do schema.

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
- Produção (PM2): botão **Reiniciar aplicação** no painel (ou o job que ele agenda)

O restart **não** exige cópia de `scripts/pm2-rebuild.mjs`, `scripts/process-module-queue.mjs` nem `scripts/db-setup.mjs` no projeto. O Kuroneko resolve esses arquivos no pacote instalado (`node_modules/@kitsunesoftware/kuroneko/scripts/`). `process.cwd()` continua sendo a raiz do consumidor: compose, `.kuroneko/`, `layers/`, `npm run build` e o nome no PM2.

Se existir `scripts/pm2-rebuild.mjs` **diferente** do arquivo do pacote, esse arquivo local é usado como override. Sem ele, vale o script do pacote. Por dentro, a pipeline chama `process-module-queue.mjs` e `db-setup.mjs` da mesma pasta do pacote.

`NUXT_PM2_APP_NAME` tem de ser o mesmo `name` do `ecosystem.config.cjs` (é o alvo de `pm2 restart`):

```js
// ecosystem.config.cjs
{ name: 'meowduel', script: '.output/server/index.mjs' }
```

```env
NUXT_PM2_APP_NAME=meowduel
```

Fluxo depois de baixar um módulo na loja:

1. `pm2 start ecosystem.config.cjs` (app já no ar, em produção)
2. Instalar o módulo — ele entra na `ModuleChangeQueue` com `needsRestart: true`
3. Clicar em **Reiniciar aplicação**
4. O job para o app, processa a fila, aplica schema, faz build e sobe de novo
5. `GET /api/modules/installed` volta com `needsRestart: false` e `pendingModuleIds: []`
6. O aviso “O módulo requer reinicialização da aplicação para funcionar” some

O caminho do script agendado fica em `.kuroneko/restart.log` (`schedule pm2 job … → …/pm2-rebuild.mjs`).

### 5. Smoke checklist

- [ ] `/` e páginas suas em `app/pages` abrem
- [ ] `/panel` e settings abrem
- [ ] Login / conta
- [ ] Módulos da loja (se usar) compatíveis com `minKuroneko`
- [ ] SMTP / e-mail (se configurado)
- [ ] Consumer sob PM2, **sem** scripts Kuroneko em `scripts/`: instalar um módulo da loja, clicar em **Reiniciar aplicação**, e o banner some (`needsRestart: false`, `pendingModuleIds: []`)

## O que NÃO deve acontecer no update

- Seus arquivos em `app/` não são sobrescritos pela plataforma
- Seu `layers/meu-modulo` permanece
- Só sobe código que veio do pacote/tag Kuroneko

Se algo “sumiu”, em geral alguém tinha customizado a plataforma por dentro (violou a política) ou havia override acidental com o mesmo path em `app/`.

## Fixture de referência

Veja `examples/consumer/`: site mínimo + layer própria `hello-site`, sem copiar `base|auth|panel`. Use como modelo de projeto seguro para updates.
