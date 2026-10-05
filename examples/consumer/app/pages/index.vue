<template>
  <div class="space-y-6 px-4 py-8 sm:px-6 lg:px-10">
    <header class="max-w-2xl space-y-3">
      <p class="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
        Fixture consumidor
      </p>
      <h1 class="font-display text-3xl font-extrabold text-[var(--color-ink)]">
        Meu site
      </h1>
      <p class="text-[var(--color-muted)]">
        Páginas em
        <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5">app/</code>
        + módulo
        <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5">layers/hello-site</code>.
        A plataforma entra só via
        <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5">extends</code>.
      </p>
    </header>

    <div class="flex flex-wrap gap-3">
      <NuxtLink
        to="/hello"
        class="inline-flex rounded-[var(--radius)] border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm font-semibold"
      >
        Hello (layer própria)
      </NuxtLink>
      <NuxtLink
        to="/contato"
        class="inline-flex rounded-[var(--radius)] border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm font-semibold"
      >
        Contato (app/)
      </NuxtLink>
      <NuxtLink
        to="/panel"
        class="inline-flex rounded-[var(--radius)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        Painel (plataforma)
      </NuxtLink>
    </div>
  </div>
</template>
