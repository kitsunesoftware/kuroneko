<p align="center">
  <img src="layers/base/app/assets/images/logo.png" alt="Kuroneko" width="110" />
</p>

<h1 align="center">Kuroneko</h1>

<p align="center">
  Plataforma <strong>Nuxt 4</strong> modular para sites e painéis administrativos.
</p>

Você cria um projeto Nuxt normal e **estende** o Kuroneko: login, conta, roles, instalar módulos, SMTP, settings e wizard `/install` já vêm prontos. Suas páginas ficam em `app/` — a base pode atualizar sem apagar o site.

Repositório: [github.com/kitsunesoftware/kuroneko](https://github.com/kitsunesoftware/kuroneko)

---

## O que você ganha

- Wizard de instalação (`/install`) — schema, identidade, SMTP e conta admin
- Autenticação (login, registro, recuperação, conta)
- Painel (`/panel`) — overview, usuários, roles, módulos, loja, settings
- Engine de módulos instaláveis (com `minKuroneko`)
- PostgreSQL + Prisma
- Base versionada via `extends` (GitHub / npm)

---

## Requisitos

| Ferramenta | Uso |
|---|---|
| [Node.js LTS](https://nodejs.org) | Rodar Nuxt |
| [Git](https://git-scm.com) | Baixar o Kuroneko |
| [PostgreSQL](https://www.postgresql.org/download) | Banco de dados |

No Windows, use **Git Bash** para o script de criação.

---

## Criar um projeto (recomendado)

Na pasta onde o site deve nascer:

```bash
curl -fsSL https://gist.githubusercontent.com/clvrsnsampaio/e848ddc9b2947e93eb5ed6f723dfc713/raw/create-project.sh -o create-project.sh
bash create-project.sh
```

Ou com o nome já definido:

```bash
bash create-project.sh meu-site
```

O script:

1. Cria o Nuxt (`nuxi init`)
2. Pergunta host, porta, usuário, senha e database do Postgres
3. Gera o `.env` (`DATABASE_URL`, `HOST=0.0.0.0`, `PORT=3000`)
4. Instala Kuroneko + Prisma 6
5. Configura `nuxt.config.ts`, `app/app.vue` e scripts `db:*`
6. Roda `npm run db:generate`

Depois:

```bash
cd meu-site
npm run dev
```

Abra **http://localhost:3000/install** e conclua o wizard (schema → identidade → SMTP → admin).

> Use um **database vazio/novo**. Se apontar para um banco que já tem usuário admin, o `/install` não aparece (site considerado instalado).

Cópia local do script neste repo: [`scripts/create-project.sh`](scripts/create-project.sh).

---

## Ideia central: plataforma × seu site

| Zona | Onde | Quem edita |
|---|---|---|
| Plataforma | pacote `@kitsunesoftware/kuroneko` (`layers/base`, `auth`, `panel`) | Kuroneko |
| Seu site | `app/`, `layers/<seu-modulo>/` | Você |

**Não** copie nem edite `layers/base|auth|panel` no projeto consumidor. Customize em `app/pages`, `app/app.config.ts` ou um layer próprio.

```text
meu-site/
├── app/
│   ├── app.vue              # NuxtLayout + NuxtPage (obrigatório)
│   └── pages/               # suas rotas
├── .env                     # DATABASE_URL
├── nuxt.config.ts           # extends: Kuroneko
└── node_modules/@kitsunesoftware/kuroneko/
```

Fixture de exemplo: [`examples/consumer/`](examples/consumer/).

---

## Atualizar a plataforma

1. Leia o [`CHANGELOG.md`](CHANGELOG.md)
2. Suba a tag no `package.json` (ex.: `#v1.0.5`)
3. `npm install` → `npm run db:setup` se o changelog pedir → reinicie o `dev`

Detalhes: [`docs/UPDATE.md`](docs/UPDATE.md).

---

## Desenvolver este repositório

Clone e rode a própria plataforma:

```bash
git clone https://github.com/kitsunesoftware/kuroneko.git
cd kuroneko
cp .env.example .env   # ou configure DATABASE_URL
npm install
npm run db:setup
npm run dev
```

Rotas úteis: `/`, `/login`, `/panel`, `/install`.

Demo (se seedada): `demo@kuroneko.dev` / `kuroneko`.

---

## Links

- [Atualizar a base](docs/UPDATE.md)
- [Changelog](CHANGELOG.md)
- [Script create-project (gist)](https://gist.github.com/clvrsnsampaio/e848ddc9b2947e93eb5ed6f723dfc713)
