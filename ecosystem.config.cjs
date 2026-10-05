const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

function loadEnvFiles(cwd, mode) {
	const files = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];

	const merged = {};

	for (const file of files) {
		const envPath = path.join(cwd, file);
		if (!fs.existsSync(envPath)) continue;
		Object.assign(merged, dotenv.parse(fs.readFileSync(envPath)));
	}

	return merged;
}

/**
 * Modo do dotenv:
 * - `pm2 start ecosystem.config.cjs --env development`
 * - `DOTENV_MODE=development pm2 start ecosystem.config.cjs`
 * - padrão: production
 */
function resolveMode() {
	const fromEnv = String(process.env.DOTENV_MODE || process.env.ECOSYSTEM_ENV || "")
		.trim()
		.toLowerCase();

	if (fromEnv === "development" || fromEnv === "dev") return "development";
	if (fromEnv === "production" || fromEnv === "prod") return "production";

	const argv = process.argv;
	const envFlagIdx = argv.findIndex((arg) => arg === "--env" || arg === "--dotenv");

	if (envFlagIdx >= 0) {
		const value = String(argv[envFlagIdx + 1] || "")
			.trim()
			.toLowerCase();

		if (value === "development" || value === "dev") return "development";
		if (value === "production" || value === "prod") return "production";
		if (value) return value;
	}

	return "production";
}

const mode = resolveMode();
const envFromFile = loadEnvFiles(__dirname, mode);

const sharedEnv = {
	...envFromFile,
	NODE_ENV: mode === "development" ? "development" : "production",
	DOTENV_MODE: mode,
};

if (!sharedEnv.DATABASE_URL) {
	console.warn(
		`[Kuroneko] DATABASE_URL não encontrada em .env / .env.${mode} — o app não conectará ao PostgreSQL até configurar a variável.`,
	);
}

console.info(`[Kuroneko] Ecosystem carregando modo "${mode}"`);

module.exports = {
	apps: [
		{
			name: mode === "development" ? "kuroneko-dev" : "kuroneko",
			// Override: NUXT_PM2_APP_NAME no .env / runtimeConfig
			cwd: __dirname,
			script: ".output/server/index.mjs",
			interpreter: "node",
			instances: 1,
			exec_mode: "fork",
			autorestart: true,
			max_restarts: 20,
			env: {
				...sharedEnv,
			},
			env_development: {
				...loadEnvFiles(__dirname, "development"),
				NODE_ENV: "development",
				DOTENV_MODE: "development",
			},
			env_production: {
				...loadEnvFiles(__dirname, "production"),
				NODE_ENV: "production",
				DOTENV_MODE: "production",
			},
		},
	],
};
