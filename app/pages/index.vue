<template>
  <div class="space-y-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
    <header class="max-w-2xl space-y-3">
      <p class="text-sm font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
        Projeto
      </p>
      <h1 class="font-display text-3xl font-extrabold text-[var(--color-ink)] sm:text-4xl">
        Início
      </h1>
      <p class="text-[var(--color-muted)]">
        Esta página vive em
        <code class="rounded bg-[var(--color-paper-deep)] px-1.5 py-0.5 text-[var(--color-ink)]">app/pages</code>
        — a zona do seu site. O painel e a autenticação vêm das layers da plataforma.
      </p>
    </header>

    <div class="flex flex-wrap gap-3">
      <NuxtLink
        to="/sobre"
        class="inline-flex items-center rounded-[var(--radius)] border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-ink)]"
      >
        Página de exemplo
      </NuxtLink>
      <NuxtLink
        to="/panel"
        class="inline-flex items-center rounded-[var(--radius)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)]"
      >
        Abrir painel
      </NuxtLink>
    </div>
  </div>
</template>
