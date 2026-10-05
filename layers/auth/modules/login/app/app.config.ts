export default defineAppConfig({
    sidebar: {
        entries: {
            auth: {
                children: {
                    login: {
                        label: "Entrar",
                        to: "/login",
                        order: 1,
                        when: "guest",
                    },
                },
            },
        },
    },
});
