<template>
  <div class="space-y-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
    <header class="max-w-2xl space-y-3">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
      >
        <Icon
          name="i-solar:alt-arrow-left-bold-duotone"
          class="text-base"
        />
        Voltar
      </NuxtLink>
      <p class="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
        Exemplo
      </p>
      <h1 class="font-display text-3xl font-extrabold text-[var(--color-ink)] sm:text-4xl">
        Sobre
      </h1>
      <p class="text-[var(--color-muted)]">
        Página de demonstração do skeleton do usuário. Crie as suas rotas em
        <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5 text-[var(--color-ink)]">app/pages</code>
        ou em
        <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5 text-[var(--color-ink)]">layers/&lt;seu-modulo&gt;</code>
        sem editar
        <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5 text-[var(--color-ink)]">layers/base|auth|panel</code>.
      </p>
    </header>
  </div>
</template>
