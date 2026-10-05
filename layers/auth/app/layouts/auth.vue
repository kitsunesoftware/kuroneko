<template>
  <div class="relative h-dvh overflow-hidden bg-[var(--color-paper)]">
    <div
      class="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden bg-[var(--color-ink)] md:block"
      aria-hidden="true"
    >
      <img
        src="/images/auth-side.jpg"
        alt=""
        class="absolute inset-0 z-0 h-full w-full object-cover object-center"
      >
      <div
        class="absolute inset-0 z-10 bg-gradient-to-r from-[#12141a] via-[#12141a]/80 via-100% to-transparent"
      />
    </div>

    <div class="relative mx-auto grid h-full max-w-6xl md:grid-cols-2">
      <section class="flex h-full min-h-0 flex-col px-4 py-6 sm:px-10 lg:px-16">
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div class="flex min-h-full flex-col justify-center py-2">
            <div class="w-full max-w-md">
              <AppBrand
                variant="light"
                class="mb-8"
              />
              <slot />
            </div>
          </div>
        </div>
      </section>

      <section
        class="hidden md:block"
        aria-hidden="true"
      />
    </div>
  </div>
</template>
