<script setup lang="ts">
useSeoMeta({
  title: 'Como criar um módulo',
})

const toc = [
  { href: '#conceito', label: 'Conceito', num: '01' },
  { href: '#modulo-raiz', label: 'Módulo raiz', num: '02' },
  { href: '#submodulo', label: 'Submódulo', num: '03' },
  { href: '#registro', label: 'Catálogo', num: '04' },
  { href: '#settings', label: 'Settings e Prisma', num: '05' },
  { href: '#fila', label: 'Fila e reinício', num: '06' },
  { href: '#publicar', label: 'Publicar', num: '07' },
  { href: '#loja', label: 'Loja', num: '08' },
] as const

const codeInline
  = 'rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5 text-[var(--color-ink)]'
</script>

<template>
  <div class="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
    <div class="mx-auto w-full max-w-[1100px]">
      <header class="max-w-3xl space-y-3">
        <NuxtLink
          to="/panel/modules"
          class="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
        >
          <Icon
            name="i-solar:alt-arrow-left-bold-duotone"
            class="text-base"
          />
          Voltar para módulos
        </NuxtLink>
        <p class="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Documentação
        </p>
        <h1 class="font-display text-2xl font-extrabold text-[var(--color-ink)] sm:text-3xl">
          Como criar um módulo
        </h1>
        <p class="text-[var(--color-muted)]">
          No Kuroneko, módulos são Nuxt layers. Cada um registra-se no catálogo, pode ter settings,
          schema Prisma e filhos. Instalação e remoção passam pela fila e pedem reinício da aplicação.
        </p>
      </header>

      <div class="mt-10 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-12">
        <!-- Mobile TOC -->
        <nav
          class="mb-10 rounded-xl border border-[var(--color-line)] bg-white/80 p-4 lg:hidden"
          aria-label="Nesta página"
        >
          <p class="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
            Nesta página
          </p>
          <ul class="space-y-1.5 text-sm">
            <li
              v-for="item in toc"
              :key="item.href"
            >
              <a
                :href="item.href"
                class="flex items-baseline gap-2 text-[var(--color-ink)] underline-offset-2 hover:underline"
              >
                <span class="font-mono text-[11px] text-[var(--color-muted)]">{{ item.num }}</span>
                {{ item.label }}
              </a>
            </li>
          </ul>
        </nav>

        <!-- Desktop sticky TOC -->
        <nav
          class="sticky top-6 hidden lg:block"
          aria-label="Nesta página"
        >
          <p class="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
            Nesta página
          </p>
          <ul class="space-y-1 border-l border-[var(--color-line)] text-sm">
            <li
              v-for="item in toc"
              :key="item.href"
            >
              <a
                :href="item.href"
                class="-ml-px block border-l border-transparent py-1.5 pl-3 text-[var(--color-muted)] transition hover:border-[#1C223D]/40 hover:text-[var(--color-ink)]"
              >
                <span class="mr-2 font-mono text-[11px] opacity-70">{{ item.num }}</span>
                {{ item.label }}
              </a>
            </li>
          </ul>
        </nav>

        <div class="min-w-0 max-w-3xl space-y-14">
          <section
            id="conceito"
            class="scroll-mt-8 space-y-4"
          >
            <div class="flex items-baseline gap-3">
              <span class="font-mono text-xs text-[var(--color-muted)]">01</span>
              <h2 class="font-display text-xl font-bold text-[var(--color-ink)]">
                Conceito
              </h2>
            </div>
            <p class="text-sm leading-relaxed text-[var(--color-muted)]">
              Um
              <strong class="text-[var(--color-ink)]">módulo raiz</strong>
              vive em
              <code :class="codeInline">layers/&lt;nome&gt;</code>
              e é
              <strong class="text-[var(--color-ink)]">descoberto automaticamente</strong>
              — não precisa listar em
              <code :class="codeInline">extends</code>.
            </p>
            <p class="text-sm leading-relaxed text-[var(--color-muted)]">
              Um
              <strong class="text-[var(--color-ink)]">submódulo</strong>
              fica em
              <code :class="codeInline">layers/&lt;pai&gt;/modules/&lt;filho&gt;</code>
              (também descoberto automaticamente). O vínculo no painel usa
              <code :class="codeInline">parentId</code>.
            </p>
            <div class="space-y-2">
              <p class="font-mono text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                layers/
              </p>
              <pre
                class="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[#1C223D] p-4 text-xs leading-relaxed text-white/85"
              ><code>layers/
  auth/                    ← módulo raiz (auto)
    app/plugins/modules.ts
    prisma/schema.prisma
    nuxt.config.ts         ← descobre ./modules/*
    modules/
      login/               ← submódulo (auto)
      account/</code></pre>
            </div>
          </section>

          <section
            id="modulo-raiz"
            class="scroll-mt-8 space-y-4"
          >
            <div class="flex items-baseline gap-3">
              <span class="font-mono text-xs text-[var(--color-muted)]">02</span>
              <h2 class="font-display text-xl font-bold text-[var(--color-ink)]">
                Criar um módulo raiz
              </h2>
            </div>
            <ol class="space-y-3">
              <li class="border-l-2 border-[#1C223D]/25 pl-4 text-sm leading-relaxed text-[var(--color-muted)]">
                <span class="mb-1 block font-mono text-[11px] text-[var(--color-muted)]">Passo 1</span>
                Crie a pasta
                <code :class="codeInline">layers/meu-modulo/</code>
                com
                <code :class="codeInline">nuxt.config.ts</code>
                (pode ser vazio).
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4 text-sm leading-relaxed text-[var(--color-muted)]">
                <span class="mb-1 block font-mono text-[11px] text-[var(--color-muted)]">Passo 2</span>
                Adicione um plugin que chama
                <code :class="codeInline">contributeModule({...})</code>
                sem
                <code :class="codeInline">parentId</code>.
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4 text-sm leading-relaxed text-[var(--color-muted)]">
                <span class="mb-1 block font-mono text-[11px] text-[var(--color-muted)]">Passo 3</span>
                Reinicie a aplicação para o layer entrar no catálogo (obrigatório se a pasta foi criada com o servidor já rodando).
              </li>
            </ol>
            <div class="space-y-2">
              <p class="font-mono text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                modules.ts
              </p>
              <pre
                class="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[#1C223D] p-4 text-xs leading-relaxed text-white/85"
              ><code>// layers/meu-modulo/app/plugins/modules.ts
export default defineNuxtPlugin(() => {
  contributeModule({
    id: 'meu-modulo',
    label: 'Meu módulo',
    description: 'Descrição curta do recurso.',
    icon: 'i-solar:box-bold-duotone',
    defaultEnabled: false,
    order: 50,
  })
})</code></pre>
            </div>
          </section>

          <section
            id="submodulo"
            class="scroll-mt-8 space-y-4"
          >
            <div class="flex items-baseline gap-3">
              <span class="font-mono text-xs text-[var(--color-muted)]">03</span>
              <h2 class="font-display text-xl font-bold text-[var(--color-ink)]">
                Criar um submódulo
              </h2>
            </div>
            <ol class="space-y-3">
              <li class="border-l-2 border-[#1C223D]/25 pl-4 text-sm leading-relaxed text-[var(--color-muted)]">
                <span class="mb-1 block font-mono text-[11px] text-[var(--color-muted)]">Passo 1</span>
                Crie
                <code :class="codeInline">layers/&lt;pai&gt;/modules/&lt;filho&gt;/</code>
                com
                <code :class="codeInline">nuxt.config.ts</code>.
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4 text-sm leading-relaxed text-[var(--color-muted)]">
                <span class="mb-1 block font-mono text-[11px] text-[var(--color-muted)]">Passo 2</span>
                Registre o módulo com
                <code :class="codeInline">parentId</code>
                apontando para o pai (ex.:
                <code :class="codeInline">'auth'</code>
                ou
                <code :class="codeInline">'auth.account'</code>).
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4 text-sm leading-relaxed text-[var(--color-muted)]">
                <span class="mb-1 block font-mono text-[11px] text-[var(--color-muted)]">Passo 3</span>
                Pronto — a pasta é descoberta sozinha. Instale pela loja ou pelo painel para aplicar schema/settings no reinício.
              </li>
            </ol>
            <div class="space-y-2">
              <p class="font-mono text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                sidebar.ts
              </p>
              <pre
                class="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[#1C223D] p-4 text-xs leading-relaxed text-white/85"
              ><code>// layers/auth/modules/newsletter/app/plugins/sidebar.ts
export default defineNuxtPlugin(() => {
  contributeModule({
    id: 'auth.newsletter',
    parentId: 'auth',
    label: 'Newsletter',
    description: 'Inscrição e preferências de e-mail.',
    icon: 'i-solar:letter-bold-duotone',
    routes: ['/newsletter'],
    defaultEnabled: false,
    order: 50,
  })
})</code></pre>
            </div>
            <p class="text-sm leading-relaxed text-[var(--color-muted)]">
              Use IDs com ponto (
              <code :class="codeInline">pai.filho</code>
              ) para deixar a árvore legível. Netos usam
              <code :class="codeInline">parentId: 'auth.account'</code>,
              por exemplo. Um id com ponto pode ser
              <strong class="text-[var(--color-ink)]">raiz</strong>
              se
              <code :class="codeInline">parentId</code>
              for
              <code :class="codeInline">null</code>
              (ex.:
              <code :class="codeInline">demo.hello</code>).
            </p>
          </section>

          <section
            id="registro"
            class="scroll-mt-8 space-y-4"
          >
            <div class="flex items-baseline gap-3">
              <span class="font-mono text-xs text-[var(--color-muted)]">04</span>
              <h2 class="font-display text-xl font-bold text-[var(--color-ink)]">
                Registrar no catálogo
              </h2>
            </div>
            <p class="text-sm leading-relaxed text-[var(--color-muted)]">
              Campos principais de
              <code :class="codeInline">contributeModule</code>:
            </p>
            <div class="overflow-x-auto rounded-xl border border-[var(--color-line)]">
              <table class="w-full min-w-[28rem] text-left text-sm">
                <thead class="bg-[#F8F8F6] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  <tr>
                    <th class="px-4 py-2.5 font-medium">
                      Campo
                    </th>
                    <th class="px-4 py-2.5 font-medium">
                      Uso
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--color-line)] bg-white/80 text-[var(--color-muted)]">
                  <tr>
                    <td class="px-4 py-2.5 font-mono text-xs text-[var(--color-ink)]">
                      id
                    </td>
                    <td class="px-4 py-2.5">
                      Identificador único (ex.: auth.login)
                    </td>
                  </tr>
                  <tr>
                    <td class="px-4 py-2.5 font-mono text-xs text-[var(--color-ink)]">
                      parentId
                    </td>
                    <td class="px-4 py-2.5">
                      Pai na árvore do painel (submódulo). Use null para raiz.
                    </td>
                  </tr>
                  <tr>
                    <td class="px-4 py-2.5 font-mono text-xs text-[var(--color-ink)]">
                      routes
                    </td>
                    <td class="px-4 py-2.5">
                      Rotas liberadas só com o módulo ativo
                    </td>
                  </tr>
                  <tr>
                    <td class="px-4 py-2.5 font-mono text-xs text-[var(--color-ink)]">
                      installable
                    </td>
                    <td class="px-4 py-2.5">
                      false = módulo de sistema (sem instalar/desinstalar pela loja)
                    </td>
                  </tr>
                  <tr>
                    <td class="px-4 py-2.5 font-mono text-xs text-[var(--color-ink)]">
                      canDisable
                    </td>
                    <td class="px-4 py-2.5">
                      false = não pode desativar (ex.: painel, login, permissões)
                    </td>
                  </tr>
                  <tr>
                    <td class="px-4 py-2.5 font-mono text-xs text-[var(--color-ink)]">
                      sidebarGroupId
                    </td>
                    <td class="px-4 py-2.5">
                      Liga o módulo a um grupo do menu
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="text-sm leading-relaxed text-[var(--color-muted)]">
              Para item no menu lateral, use também
              <code :class="codeInline">contributeSidebarChild</code>
              com o mesmo
              <code :class="codeInline">moduleId</code>.
            </p>
          </section>

          <section
            id="settings"
            class="scroll-mt-8 space-y-4"
          >
            <div class="flex items-baseline gap-3">
              <span class="font-mono text-xs text-[var(--color-muted)]">05</span>
              <h2 class="font-display text-xl font-bold text-[var(--color-ink)]">
                Settings e Prisma
              </h2>
            </div>
            <p class="text-sm leading-relaxed text-[var(--color-muted)]">
              Configurações do painel: chame
              <code :class="codeInline">contributeModuleSettings</code>
              no mesmo plugin. Os valores vão para a tabela
              <code :class="codeInline">ModuleSetting</code>
              na instalação (ou no boot, se for módulo de sistema).
            </p>
            <p class="text-sm leading-relaxed text-[var(--color-muted)]">
              Se o módulo cria tabelas, adicione
              <code :class="codeInline">prisma/schema.prisma</code>.
              Módulos built-in registram em
              <code :class="codeInline">module-schemas.ts</code>;
              pacotes da loja declaram
              <code :class="codeInline">prisma</code>
              no
              <code :class="codeInline">kuroneko.module.json</code>
              (metadados em
              <code :class="codeInline">.kuroneko/</code>
              após o download).
            </p>
            <p class="flex items-start gap-2.5 rounded-lg border border-[#1C223D]/10 bg-[#1C223D]/[0.04] px-3.5 py-3 text-sm text-[var(--color-ink)]">
              <Icon
                name="i-solar:database-bold-duotone"
                class="mt-0.5 shrink-0 text-base text-[#1C223D]/70"
              />
              <span class="min-w-0">
                O schema é aplicado no reinício (job PM2). Na desinstalação, tabelas listadas e settings do módulo são removidas.
              </span>
            </p>
          </section>

          <section
            id="fila"
            class="scroll-mt-8 space-y-4"
          >
            <div class="flex items-baseline gap-3">
              <span class="font-mono text-xs text-[var(--color-muted)]">06</span>
              <h2 class="font-display text-xl font-bold text-[var(--color-ink)]">
                Fila e reinício
              </h2>
            </div>
            <p class="text-sm leading-relaxed text-[var(--color-muted)]">
              Em
              <NuxtLink
                to="/panel/modules"
                class="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
              >/panel/modules</NuxtLink>
              e na
              <NuxtLink
                to="/panel/modules/store"
                class="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
              >loja</NuxtLink>,
              instalar ou desinstalar
              <strong class="text-[var(--color-ink)]">não aplica na hora</strong>.
              A ação entra na fila; o botão
              <strong class="text-[var(--color-ink)]">Reiniciar aplicação</strong>
              processa schema, build e PM2.
            </p>
            <p class="flex items-start gap-2.5 rounded-lg border border-[#1C223D]/10 bg-[#1C223D]/[0.04] px-3.5 py-3 text-sm text-[var(--color-ink)]">
              <Icon
                name="i-solar:restart-circle-bold-duotone"
                class="mt-0.5 shrink-0 text-base text-[#1C223D]/70"
              />
              <span class="min-w-0">
                Há módulos na fila? Use
                <strong class="font-semibold">Reiniciar aplicação</strong>
                em Meus módulos. Até lá, cards com overlay mostram o estado pendente.
              </span>
            </p>
            <ul class="space-y-3 text-sm leading-relaxed text-[var(--color-muted)]">
              <li class="border-l-2 border-[#1C223D]/25 pl-4">
                <strong class="text-[var(--color-ink)]">Instalar</strong>
                (loja) baixa o pacote para
                <code :class="codeInline">layers/</code>
                e enfileira a ativação. O módulo já aparece em Meus módulos.
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4">
                <strong class="text-[var(--color-ink)]">Desinstalar</strong>
                enfileira remoção de tabelas, dados e settings. O pacote pode continuar em
                <code :class="codeInline">layers/</code>
                até a remoção da pasta.
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4">
                <strong class="text-[var(--color-ink)]">Remover módulo</strong>
                apaga a pasta em
                <code :class="codeInline">layers/</code>
                quando o pacote ainda não está instalado (ou após desinstalar).
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4">
                Layers em disco são descobertos automaticamente — não edite
                <code :class="codeInline">extends</code>
                à mão.
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4">
                Módulos com
                <code :class="codeInline">installable: false</code>
                entram em
                <code :class="codeInline">SYSTEM_MODULE_IDS</code>
                e já nascem instalados. Com
                <code :class="codeInline">canDisable: false</code>
                o toggle fica bloqueado.
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4">
                Desativar o pai desliga a árvore de filhos. Backup/restauração do pai inclui filhos instalados.
              </li>
            </ul>
          </section>

          <section
            id="publicar"
            class="scroll-mt-8 space-y-4"
          >
            <div class="flex items-baseline gap-3">
              <span class="font-mono text-xs text-[var(--color-muted)]">07</span>
              <h2 class="font-display text-xl font-bold text-[var(--color-ink)]">
                Publicar no monorepo
              </h2>
            </div>
            <p class="text-sm leading-relaxed text-[var(--color-muted)]">
              A loja lê o monorepo oficial
              <a
                href="https://github.com/kitsunesoftware/kuroneko-modules"
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
              >kitsunesoftware/kuroneko-modules</a>.
              Para o pacote do módulo, abra um PR com a pasta e um
              <code :class="codeInline">kuroneko.module.json</code>.
            </p>
            <p class="flex items-start gap-2.5 rounded-lg border border-[#1C223D]/10 bg-[#1C223D]/[0.04] px-3.5 py-3 text-sm text-[var(--color-ink)]">
              <Icon
                name="i-solar:branching-paths-up-bold-duotone"
                class="mt-0.5 shrink-0 text-base text-[#1C223D]/70"
              />
              <span class="min-w-0">
                Na prática, criar um módulo costuma exigir mudanças também no
                <strong class="font-semibold">template Kuroneko</strong>
                (APIs, tipos, painel, integrações). Nesse caso são
                <strong class="font-semibold">dois PRs</strong>:
                um em
                <a
                  href="https://github.com/kitsunesoftware/kuroneko"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium underline underline-offset-2"
                >kitsunesoftware/kuroneko</a>
                (plataforma/template) e outro em
                <a
                  href="https://github.com/kitsunesoftware/kuroneko-modules"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium underline underline-offset-2"
                >kuroneko-modules</a>
                (pacote da loja). Só o manifesto no monorepo de módulos não basta se o template precisa acompanhar.
              </span>
            </p>
            <ol class="space-y-3">
              <li class="border-l-2 border-[#1C223D]/25 pl-4 text-sm leading-relaxed text-[var(--color-muted)]">
                <span class="mb-1 block font-mono text-[11px] text-[var(--color-muted)]">Passo 1</span>
                Monte a layer completa (plugin
                <code :class="codeInline">contributeModule</code>,
                páginas, Prisma se houver).
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4 text-sm leading-relaxed text-[var(--color-muted)]">
                <span class="mb-1 block font-mono text-[11px] text-[var(--color-muted)]">Passo 2</span>
                Crie o manifesto na raiz da pasta do pacote:
              </li>
            </ol>
            <div class="space-y-2">
              <p class="font-mono text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                kuroneko.module.json
              </p>
              <pre
                class="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[#1C223D] p-4 text-xs leading-relaxed text-white/85"
              ><code>{
  "id": "demo.hello",
  "name": "Hello Demo",
  "description": "Módulo de exemplo.",
  "version": "1.0.0",
  "parentId": null,
  "layer": {
    "kind": "root",
    "target": "layers/demo-hello"
  },
  "icon": "i-solar:hand-shake-bold-duotone",
  "dependsOn": [],
  "minKuroneko": "1.0.0",
  "prisma": {
    "schema": "prisma/schema.prisma",
    "tables": ["HelloGreeting"]
  }
}</code></pre>
            </div>
            <p class="text-sm leading-relaxed text-[var(--color-muted)]">
              Use o mesmo
              <code :class="codeInline">icon</code>
              no manifesto e no
              <code :class="codeInline">contributeModule</code>
              — a página Módulos prioriza o valor do
              <code :class="codeInline">kuroneko.module.json</code>
              quando a layer está em
              <code :class="codeInline">layers/</code>.
            </p>
            <div class="space-y-3 rounded-xl border border-[var(--color-line)] bg-[#F8F8F6]/80 px-4 py-4">
              <p class="text-sm font-medium text-[var(--color-ink)]">
                Exemplos de
                <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5 text-xs">icon</code>
              </p>
              <pre
                class="overflow-x-auto rounded-lg bg-[#1C223D] p-3 text-xs leading-relaxed text-white/85"
              ><code>// Iconify (padrão)
"icon": "i-solar:hand-shake-bold-duotone"
"icon": "icon:i-solar:hand-shake-bold-duotone"

// Imagem dentro do pacote (relativa ao kuroneko.module.json)
"icon": "./assets/logo.png"
"icon": "assets/logo.png"

// URL externa
"icon": "https://cdn.exemplo.com/logo.png"

// Objeto (opcional)
"icon": { "type": "image", "src": "./assets/logo.png" }</code></pre>
              <p class="text-xs leading-relaxed text-[var(--color-muted)]">
                Imagem local vira URL automaticamente (
                <code :class="codeInline">/api/store/modules/:id/icon</code>
                ); externa é usada direto no
                <code :class="codeInline">&lt;img&gt;</code>.
              </p>
            </div>
            <ul class="space-y-3 text-sm leading-relaxed text-[var(--color-muted)]">
              <li class="border-l-2 border-[#1C223D]/25 pl-4">
                <code :class="codeInline">minKuroneko</code>
                — versão mínima da plataforma (semver). Download e instalação são bloqueados se a instalação local for mais antiga. A versão vem do
                <code :class="codeInline">package.json</code>
                na raiz.
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4">
                <code :class="codeInline">layer.target</code>
                — destino relativo ao copiar o pacote (ex.:
                <code :class="codeInline">layers/demo-hello</code>).
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4">
                Submódulo: use
                <code :class="codeInline">"kind": "child"</code>,
                <code :class="codeInline">"parent": "demo-hello"</code>
                e
                <code :class="codeInline">parentId</code>
                do pai.
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4">
                Envie a pasta para o monorepo (ex.:
                <code :class="codeInline">modules/hello/</code>
                ) via pull request.
              </li>
            </ul>
          </section>

          <section
            id="loja"
            class="scroll-mt-8 space-y-4"
          >
            <div class="flex items-baseline gap-3">
              <span class="font-mono text-xs text-[var(--color-muted)]">08</span>
              <h2 class="font-display text-xl font-bold text-[var(--color-ink)]">
                Sincronizar a loja e instalar
              </h2>
            </div>
            <p class="text-sm leading-relaxed text-[var(--color-muted)]">
              Em
              <NuxtLink
                to="/panel/modules/store"
                class="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
              >/panel/modules/store</NuxtLink>,
              o botão
              <strong class="text-[var(--color-ink)]">Sincronizar</strong>
              varre o monorepo atrás de cada
              <code :class="codeInline">kuroneko.module.json</code>
              e atualiza o cache do catálogo.
            </p>
            <ol class="space-y-3">
              <li class="border-l-2 border-[#1C223D]/25 pl-4 text-sm leading-relaxed text-[var(--color-muted)]">
                <span class="mb-1 block font-mono text-[11px] text-[var(--color-muted)]">Passo 1</span>
                O monorepo oficial é
                <code :class="codeInline">kitsunesoftware/kuroneko-modules</code>
                (branch
                <code :class="codeInline">main</code>).
                Em
                <NuxtLink
                  to="/panel/settings"
                  class="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
                >Configurações</NuxtLink>
                você pode informar um token GitHub opcional para rate limit.
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4 text-sm leading-relaxed text-[var(--color-muted)]">
                <span class="mb-1 block font-mono text-[11px] text-[var(--color-muted)]">Passo 2</span>
                Clique em
                <strong class="text-[var(--color-ink)]">Sincronizar</strong>
                na loja (na primeira carga vazia o sync pode rodar sozinho).
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4 text-sm leading-relaxed text-[var(--color-muted)]">
                <span class="mb-1 block font-mono text-[11px] text-[var(--color-muted)]">Passo 3</span>
                Módulos
                <strong class="text-[var(--color-ink)]">raiz</strong>
                aparecem no grid. Filhos de sistema ou já instalados (ex.:
                <code :class="codeInline">panel.seafile</code>
                →
                <code :class="codeInline">panel</code>)
                ficam sob o pai na loja e em Meus módulos.
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4 text-sm leading-relaxed text-[var(--color-muted)]">
                <span class="mb-1 block font-mono text-[11px] text-[var(--color-muted)]">Passo 4</span>
                <strong class="text-[var(--color-ink)]">Instalar</strong>
                (ou
                <strong class="text-[var(--color-ink)]">Atualizar</strong>)
                copia o pacote para
                <code :class="codeInline">layers/</code>
                e enfileira a ativação. Se
                <code :class="codeInline">minKuroneko</code>
                não for atendido, a ação é bloqueada. Com atualização disponível, a loja mostra o badge correspondente.
              </li>
              <li class="border-l-2 border-[#1C223D]/25 pl-4 text-sm leading-relaxed text-[var(--color-muted)]">
                <span class="mb-1 block font-mono text-[11px] text-[var(--color-muted)]">Passo 5</span>
                Vá em
                <NuxtLink
                  to="/panel/modules"
                  class="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
                >Meus módulos</NuxtLink>
                e use
                <strong class="text-[var(--color-ink)]">Reiniciar aplicação</strong>
                para concluir.
              </li>
            </ol>
          </section>

          <div class="flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-8">
            <NuxtLink
              to="/panel/modules/store"
              class="inline-flex"
            >
              <UiButton>
                <Icon
                  name="i-solar:shop-bold-duotone"
                  class="text-lg"
                />
                Abrir loja
              </UiButton>
            </NuxtLink>
            <NuxtLink
              to="/panel/modules"
              class="inline-flex"
            >
              <UiButton variant="outline">
                Ir para módulos
              </UiButton>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
