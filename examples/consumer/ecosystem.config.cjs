/**
 * Fixture consumidor.
 * `name` e NUXT_PM2_APP_NAME são o mesmo valor — o Kuroneko usa esse nome no pm2 restart.
 * Não há scripts/pm2-rebuild.mjs aqui: o job resolve o script do pacote.
 */
const appName = 'kuroneko-consumer'

module.exports = {
  apps: [
    {
      name: appName,
      cwd: __dirname,
      script: '.output/server/index.mjs',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        NUXT_PM2_APP_NAME: appName,
      },
    },
  ],
}
