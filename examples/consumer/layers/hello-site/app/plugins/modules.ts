export default defineNuxtPlugin(() => {
  contributeModule({
    id: 'hello.site',
    label: 'Hello Site',
    description: 'Módulo de exemplo do projeto consumidor (não faz parte da plataforma).',
    icon: 'i-solar:hand-shake-bold-duotone',
    routes: ['/hello'],
    defaultEnabled: true,
    canDisable: true,
    installable: false,
    order: 40,
  })
})
