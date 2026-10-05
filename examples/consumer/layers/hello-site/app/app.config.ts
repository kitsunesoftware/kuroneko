export default defineAppConfig({
  sidebar: {
    entries: {
      hello: {
        enabled: true,
        type: 'item',
        label: 'Hello',
        icon: 'i-solar:hand-shake-bold-duotone',
        to: '/hello',
        order: 30,
        moduleId: 'hello.site',
      },
    },
  },
})
