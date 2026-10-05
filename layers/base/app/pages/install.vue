<script setup lang="ts">
import { isPasswordRulesMet, policyFromAccountSettings } from '../../../auth/shared/password-policy'

definePageMeta({
	layout: false,
});

const WIZARD_KEY = "kuroneko-install-wizard";

type SchemaInspection = {
	exists: boolean;
	upToDate: boolean;
	expectedTables: string[];
	presentTables: string[];
	missingTables: string[];
	extraTables: string[];
	driftSummary: string | null;
};

type TableRow = {
	name: string;
	status: "ok" | "missing" | "pending";
};

const steps: Array<{ id: number; label: string; icon: string }> = [
	{ id: 1, label: "Schema", icon: "i-solar:database-bold-duotone" },
	{ id: 2, label: "Identidade", icon: "i-solar:pallete-2-bold-duotone" },
	{ id: 3, label: "SMTP", icon: "i-solar:letter-bold-duotone" },
	{ id: 4, label: "Conta", icon: "i-solar:user-bold-duotone" },
];

const { status, refresh } = useInstallStatus();
const toast = useToast();
const { setSession } = useAuth();
const config = useRuntimeConfig();
const { settings, logo, setLogo, update: updateSiteSettings, loadLogo, defaults: siteDefaults } = useSiteSettings();
const { getValues } = useModuleSettings();

const ACCOUNT_MODULE_ID = "auth.account";

type SmtpEncryption = "none" | "tls" | "ssl";

const step = ref(1);

const siteTitle = ref(siteDefaults.title);
const siteTagline = ref(siteDefaults.tagline);
const sitePrimaryColor = ref(siteDefaults.primaryColor);
const logoError = ref("");

const smtpEnabled = ref(false);
const smtpHost = ref("");
const smtpPort = ref("587");
const smtpUser = ref("");
const smtpPassword = ref("");
const smtpEncryption = ref<SmtpEncryption>("tls");
const smtpFromEmail = ref("");
const smtpFromName = ref("");
const smtpTestOpen = ref(false);
const smtpTestTo = ref("");

const adminName = ref("");
const adminEmail = ref("");
const adminPassword = ref("");
const adminPasswordConfirm = ref("");
const installDone = ref(false);

const bootLoading = ref(true);
const envChecking = ref(false);
const busy = ref(false);
const busyAction = ref<"schema" | "identity" | "smtp" | "smtp-test" | "admin" | null>(null);

const dbReady = computed(
	() => Boolean(status.value?.databaseConfigured && status.value?.databaseConnected),
);

const schemaInfo = ref<SchemaInspection | null>(null);
const schemaDeploying = ref(false);
const schemaInspecting = ref(false);
const deployConfirmOpen = ref(false);

const tableRows = computed<TableRow[]>(() => {
	const info = schemaInfo.value;
	if (!info) return [];
	return info.expectedTables.map((name) => ({
		name,
		status: schemaDeploying.value ? "pending" : info.presentTables.includes(name) ? "ok" : "missing",
	}));
});

const schemaReady = computed(() => {
	const info = schemaInfo.value;
	if (!info) return false;
	return info.exists && info.missingTables.length === 0;
});

/** Já há tabelas do Kuroneko no banco. */
const hasExistingTables = computed(() => {
	return (schemaInfo.value?.presentTables.length ?? 0) > 0;
});

function segmentProgress(fromId: number) {
	if (installDone.value || step.value > fromId) return 100;
	return 0;
}

function extractError(err: unknown, fallback: string) {
	if (
		err &&
		typeof err === "object" &&
		"data" in err &&
		err.data &&
		typeof err.data === "object" &&
		"message" in err.data &&
		typeof (err.data as { message?: unknown }).message === "string"
	) {
		return (err.data as { message: string }).message;
	}
	return fallback;
}

type WizardState = {
	step: number;
};

function persistWizard(partial?: Partial<WizardState>) {
	if (!import.meta.client) return;
	sessionStorage.setItem(
		WIZARD_KEY,
		JSON.stringify({ step: partial?.step ?? step.value } satisfies WizardState),
	);
}

function readWizard(): WizardState | null {
	if (!import.meta.client) return null;
	try {
		const raw = sessionStorage.getItem(WIZARD_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<WizardState>;
		return { step: Number(parsed.step) || 1 };
	} catch {
		return null;
	}
}

async function recheckEnv() {
	envChecking.value = true;
	try {
		await refresh();
		if (dbReady.value && step.value === 1) {
			await enterSchemaPhase({ askDeploy: true });
		} else if (!dbReady.value) {
			toast.error(
				"Banco indisponível",
				"Configure DATABASE_URL no .env e reinicie o npm run dev.",
			);
		}
	} finally {
		envChecking.value = false;
	}
}

async function loadSchemaInfo() {
	schemaInspecting.value = true;
	try {
		const data = await $fetch<{ schema: SchemaInspection }>("/api/install/schema");
		schemaInfo.value = data.schema;
		return data.schema;
	} catch (err: unknown) {
		schemaInfo.value = null;
		toast.error("Falha ao inspecionar", extractError(err, "Não foi possível ler o schema."));
		return null;
	} finally {
		schemaInspecting.value = false;
	}
}

async function deploySchema() {
	schemaDeploying.value = true;
	busy.value = true;
	busyAction.value = "schema";
	deployConfirmOpen.value = false;
	try {
		const data = await $fetch<{ schema: SchemaInspection | null }>("/api/install/schema", {
			method: "POST",
		});
		schemaInfo.value = data.schema;
		await refresh();
		if (data.schema && data.schema.missingTables.length === 0) {
			toast.success("Schema aplicado", `${data.schema.presentTables.length} tabelas prontas.`);
		} else {
			toast.info("Schema parcial", "Algumas tabelas ainda estão ausentes. Tente aplicar de novo.");
		}
	} catch (err: unknown) {
		await loadSchemaInfo();
		toast.error("Falha no deploy", extractError(err, "Não foi possível aplicar o schema."));
	} finally {
		schemaDeploying.value = false;
		busy.value = false;
		busyAction.value = null;
	}
}

/** Etapa 1: inspeciona schema e opcionalmente abre o modal de deploy. */
async function enterSchemaPhase(options?: { askDeploy?: boolean }) {
	const askDeploy = options?.askDeploy ?? true;
	step.value = 1;
	persistWizard({ step: 1 });
	await navigateTo({ path: "/install", query: { step: "1" } }, { replace: true });

	await loadSchemaInfo();
	if (askDeploy && !schemaReady.value) {
		deployConfirmOpen.value = true;
	}
}

function requestDeploySchema() {
	deployConfirmOpen.value = true;
}

function confirmDeploySchema() {
	void deploySchema();
}

function cancelDeploySchema() {
	deployConfirmOpen.value = false;
}

function syncIdentityFields() {
	loadLogo();
	siteTitle.value = settings.value.title || siteDefaults.title;
	siteTagline.value = settings.value.tagline || siteDefaults.tagline;
	sitePrimaryColor.value = settings.value.primaryColor || siteDefaults.primaryColor;
	logoError.value = "";
}

function onPrimaryColorChange(value: string) {
	sitePrimaryColor.value = value;
	updateSiteSettings({ primaryColor: value });
}

async function goToIdentity() {
	if (!schemaReady.value) {
		toast.error("Schema incompleto", "Aplique o schema e aguarde todas as tabelas ficarem prontas.");
		return;
	}
	syncIdentityFields();
	step.value = 2;
	persistWizard({ step: 2 });
	await navigateTo({ path: "/install", query: { step: "2" } }, { replace: true });
}

function backToSchema() {
	step.value = 1;
	persistWizard({ step: 1 });
	void navigateTo({ path: "/install", query: { step: "1" } }, { replace: true });
	void loadSchemaInfo();
}

function onLogoChange(event: Event) {
	logoError.value = "";
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	input.value = "";
	if (!file) return;

	if (!file.type.startsWith("image/")) {
		logoError.value = "Selecione um arquivo de imagem.";
		toast.error("Arquivo inválido", logoError.value);
		return;
	}

	if (file.size > 15 * 1024 * 1024) {
		logoError.value = "Logo muito grande. Use até 15 MB.";
		toast.error("Arquivo grande", logoError.value);
		return;
	}

	const reader = new FileReader();
	reader.onload = () => {
		if (typeof reader.result === "string") {
			setLogo(reader.result);
			toast.success("Logo atualizada", "A imagem será usada na marca do site.");
		}
	};
	reader.onerror = () => {
		logoError.value = "Falha ao ler a imagem.";
		toast.error("Falha no upload", logoError.value);
	};
	reader.readAsDataURL(file);
}

function clearLogo() {
	setLogo(null);
	logoError.value = "";
}

function backToIdentity() {
	step.value = 2;
	persistWizard({ step: 2 });
	syncIdentityFields();
	void navigateTo({ path: "/install", query: { step: "2" } }, { replace: true });
}

function syncSmtpFields() {
	smtpEnabled.value = settings.value.smtpEnabled;
	smtpHost.value = settings.value.smtpHost;
	smtpPort.value = String(settings.value.smtpPort || siteDefaults.smtpPort);
	smtpUser.value = settings.value.smtpUser;
	smtpPassword.value = settings.value.smtpPassword;
	smtpEncryption.value = settings.value.smtpEncryption;
	smtpFromEmail.value = settings.value.smtpFromEmail;
	smtpFromName.value = settings.value.smtpFromName || settings.value.title || siteDefaults.title;
}

function smtpPayload() {
	return {
		enabled: smtpEnabled.value,
		host: smtpHost.value.trim(),
		port: Number(smtpPort.value) || siteDefaults.smtpPort,
		user: smtpUser.value.trim(),
		password: smtpPassword.value,
		encryption: smtpEncryption.value,
		fromEmail: smtpFromEmail.value.trim(),
		fromName: smtpFromName.value.trim(),
	};
}

function validateSmtpForm() {
	if (!smtpEnabled.value) return true;
	if (!smtpHost.value.trim()) {
		toast.error("Campos incompletos", "Informe o host SMTP.");
		return false;
	}
	if (!smtpFromEmail.value.trim() || !smtpFromEmail.value.includes("@")) {
		toast.error("Campos incompletos", "Informe um e-mail remetente válido.");
		return false;
	}
	return true;
}

function goToSmtp() {
	syncSmtpFields();
	step.value = 3;
	persistWizard({ step: 3 });
	void navigateTo({ path: "/install", query: { step: "3" } }, { replace: true });
}

function openSmtpTest() {
	if (!validateSmtpForm()) return;
	if (!smtpEnabled.value) {
		toast.info("SMTP desativado", "Ative o SMTP para enviar um e-mail de teste.");
		return;
	}
	smtpTestTo.value = smtpFromEmail.value.trim();
	smtpTestOpen.value = true;
}

async function confirmSmtpTest() {
	if (!validateSmtpForm()) return;
	const to = smtpTestTo.value.trim();
	if (!to || !to.includes("@")) {
		toast.error("E-mail inválido", "Informe o e-mail que receberá o teste.");
		return;
	}

	busy.value = true;
	busyAction.value = "smtp-test";
	try {
		await $fetch("/api/install/smtp/test", {
			method: "POST",
			body: {
				...smtpPayload(),
				enabled: true,
				to,
			},
		});
		smtpTestOpen.value = false;
		toast.success("Teste enviado", `Verifique a caixa de entrada de ${to}.`);
	} catch (err: unknown) {
		toast.error("Falha no teste", extractError(err, "Não foi possível enviar o e-mail de teste."));
	} finally {
		busy.value = false;
		busyAction.value = null;
	}
}

async function saveSmtpAndNext() {
	if (!validateSmtpForm()) return;

	busy.value = true;
	busyAction.value = "smtp";
	try {
		await $fetch("/api/install/smtp", {
			method: "POST",
			body: smtpPayload(),
		});

		updateSiteSettings({
			smtpEnabled: smtpEnabled.value,
			smtpHost: smtpHost.value.trim(),
			smtpPort: Number(smtpPort.value) || siteDefaults.smtpPort,
			smtpUser: smtpUser.value.trim(),
			smtpPassword: smtpPassword.value,
			smtpEncryption: smtpEncryption.value,
			smtpFromEmail: smtpFromEmail.value.trim(),
			smtpFromName: smtpFromName.value.trim(),
		});

		toast.success(
			smtpEnabled.value ? "SMTP salvo" : "SMTP pulado",
			smtpEnabled.value ? "Configuração de e-mail gravada." : "Você pode configurar o SMTP depois no painel.",
		);
		goToAdmin();
	} catch (err: unknown) {
		toast.error("Falha ao salvar", extractError(err, "Não foi possível salvar o SMTP."));
	} finally {
		busy.value = false;
		busyAction.value = null;
	}
}

function backToSmtp() {
	step.value = 3;
	persistWizard({ step: 3 });
	syncSmtpFields();
	void navigateTo({ path: "/install", query: { step: "3" } }, { replace: true });
}

function goToAdmin() {
	step.value = 4;
	persistWizard({ step: 4 });
	void navigateTo({ path: "/install", query: { step: "4" } }, { replace: true });
}

function clearWizardStorage() {
	if (import.meta.client) {
		sessionStorage.removeItem(WIZARD_KEY);
		sessionStorage.removeItem("kuroneko-install2-wizard");
		sessionStorage.removeItem("kuroneko-install2-restart");
	}
}

async function createAdmin() {
	if (!adminEmail.value.trim() || !adminEmail.value.includes("@")) {
		toast.error("Campos incompletos", "Informe um e-mail válido.");
		return;
	}
	if (
		!isPasswordRulesMet({
			password: adminPassword.value,
			confirmPassword: adminPasswordConfirm.value,
			showConfirm: true,
			policy: policyFromAccountSettings(getValues(ACCOUNT_MODULE_ID)),
		})
	) {
		toast.error("Senha inválida", "Atenda a todas as regras de senha antes de continuar.");
		return;
	}

	busy.value = true;
	busyAction.value = "admin";
	try {
		const data = await $fetch<{
			token: string;
			user: {
				id: string;
				email: string;
				name: string;
				username?: string | null;
				roleKey?: string | null;
				permissions?: string[];
			};
		}>("/api/install/admin", {
			method: "POST",
			body: {
				name: adminName.value.trim(),
				email: adminEmail.value.trim(),
				password: adminPassword.value,
			},
		});

		setSession(data);
		clearWizardStorage();
		installDone.value = true;
		step.value = 4;
		await refresh();
		toast.success("Conta criada", "Administrador pronto. Instalação concluída.");
	} catch (err: unknown) {
		toast.error("Falha ao criar conta", extractError(err, "Não foi possível criar o administrador."));
	} finally {
		busy.value = false;
		busyAction.value = null;
	}
}

function goHome() {
	return navigateTo(config.public.auth?.homePath || "/");
}

async function saveIdentityAndNext() {
	if (!siteTitle.value.trim()) {
		toast.error("Campos incompletos", "Informe o título do site.");
		return;
	}

	busy.value = true;
	busyAction.value = "identity";
	logoError.value = "";

	try {
		const data = await $fetch<{
			site: { title: string; tagline: string; primaryColor: string };
		}>("/api/install/site", {
			method: "POST",
			body: {
				title: siteTitle.value.trim(),
				tagline: siteTagline.value.trim(),
				primaryColor: sitePrimaryColor.value.trim() || siteDefaults.primaryColor,
			},
		});

		updateSiteSettings({
			title: data.site.title,
			tagline: data.site.tagline,
			primaryColor: data.site.primaryColor,
		});

		toast.success("Identidade salva", "Marca e cor primária foram gravadas.");
		goToSmtp();
	} catch (err: unknown) {
		toast.error("Falha ao salvar", extractError(err, "Não foi possível salvar a identidade."));
	} finally {
		busy.value = false;
		busyAction.value = null;
	}
}

async function boot() {
	bootLoading.value = true;

	try {
		await refresh();
		if (status.value?.installed) {
			await goHome();
			return;
		}

		if (!dbReady.value) {
			step.value = 1;
			persistWizard({ step: 1 });
			return;
		}

		const wizard = readWizard();
		const route = useRoute();
		const rawStep = route.query.step;
		const fromUrl = Number(Array.isArray(rawStep) ? rawStep[0] : rawStep);

		if (Number.isFinite(fromUrl) && fromUrl >= 1 && fromUrl <= steps.length) {
			step.value = fromUrl;
		} else if (wizard?.step) {
			step.value = Math.min(wizard.step, steps.length);
		} else if (status.value?.schemaReady) {
			step.value = 2;
		} else {
			step.value = 1;
		}

		persistWizard({ step: step.value });

		if (step.value === 1) {
			await enterSchemaPhase({ askDeploy: !status.value?.schemaReady });
		} else if (step.value === 2) {
			syncIdentityFields();
		} else if (step.value === 3) {
			syncSmtpFields();
		}
	} finally {
		bootLoading.value = false;
	}
}

onMounted(() => {
	void boot();
});
</script>

<template>
	<div class="min-h-screen bg-[linear-gradient(160deg,#F7F4F0_0%,#EFE8E0_45%,#F7F4F0_100%)] px-4 py-10 sm:px-6">
		<div class="mx-auto w-full max-w-2xl space-y-8">
			<header class="space-y-2 text-center">
				<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)]">Kuroneko</p>
				<h1 class="font-display text-3xl font-extrabold text-[var(--color-ink)] sm:text-4xl">Instalação</h1>
				<p class="text-sm text-[var(--color-muted)]">
					Pré-requisito: <code class="text-xs">DATABASE_URL</code> no <code class="text-xs">.env</code>.
					Depois: schema, identidade, SMTP e conta admin.
				</p>
			</header>

			<nav aria-label="Etapas da instalação">
				<div class="flex w-full flex-row items-start">
					<template v-for="(item, index) in steps" :key="item.id">
						<div class="flex w-32 shrink-0 flex-col items-center gap-2 text-center">
							<span
								class="relative z-10 flex size-20 items-center justify-center rounded-full border-2 text-lg transition duration-300"
						:class="
									installDone || item.id < step
										? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
										: step === item.id
											? 'border-[var(--color-ink)] bg-white text-[var(--color-ink)] shadow-[var(--shadow-soft)]'
											: 'border-[var(--color-line)] bg-white text-[var(--color-muted)]'
								"
							>
								<Icon
									:name="installDone || item.id < step ? 'i-solar:check-bold' : item.icon"
									class="text-3xl"
								/>
							</span>
							<span
								class="text-[11px] font-medium leading-tight sm:text-xs"
								:class="
									installDone || item.id <= step
										? 'text-[var(--color-ink)]'
										: 'text-[var(--color-muted)]'
								"
							>
								{{ item.label }}
							</span>
			</div>

						<div
							v-if="index < steps.length - 1"
							class="min-w-4 flex-1"
							style="margin-top: 39px; height: 2px"
							aria-hidden="true"
						>
							<div
								style="
									height: 100%;
									width: 100%;
									border-radius: 999px;
									background: color-mix(in srgb, var(--color-ink) 22%, transparent);
									overflow: hidden;
								"
							>
								<div
									style="
										height: 100%;
										border-radius: 999px;
										background: var(--color-ink);
										transition: width 0.45s ease;
									"
									:style="{ width: `${segmentProgress(item.id)}%` }"
								/>
							</div>
						</div>
					</template>
				</div>
			</nav>

			<div
				v-if="bootLoading"
				class="flex min-h-96 w-full items-center justify-center rounded-lg bg-white p-6 text-sm text-gray-500"
			>
				Verificando ambiente…
			</div>

			<!-- Bloqueio: .env / DATABASE_URL ausente ou inválido -->
			<div
				v-else-if="step === 1 && !dbReady"
				class="flex min-h-96 w-full flex-col justify-between gap-5 rounded-lg bg-white p-6"
			>
				<div class="flex w-full flex-col gap-4">
					<div>
						<h2 class="text-lg font-medium">Banco não configurado</h2>
						<p class="mt-1 text-sm text-gray-500">
							O wizard não grava mais a conexão. Configure
							<code class="text-xs">DATABASE_URL</code> no arquivo
							<code class="text-xs">.env</code> na raiz do projeto e
							<strong>reinicie</strong> o <code class="text-xs">npm run dev</code>.
						</p>
					</div>
					<pre
						class="overflow-x-auto rounded-md bg-[#F8F8F6] px-4 py-3 text-xs text-gray-700"
					>DATABASE_URL="postgresql://postgres:SENHA@localhost:5432/meusite?schema=public"</pre>
					<p v-if="status?.databaseUrlPreview" class="text-xs text-gray-500">
						URL atual (mascarada):
						<span class="font-mono">{{ status.databaseUrlPreview }}</span>
					</p>
					<p v-else-if="status && !status.databaseConfigured" class="text-xs text-amber-700">
						Nenhuma <code class="text-xs">DATABASE_URL</code> foi carregada pelo servidor.
					</p>
					<p v-else-if="status && !status.databaseConnected" class="text-xs text-amber-700">
						Há uma URL configurada, mas a conexão com o Postgres falhou.
					</p>
				</div>
				<div class="flex justify-end">
					<button
						type="button"
						class="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white transition disabled:opacity-55"
						:disabled="envChecking"
						@click="recheckEnv"
					>
						{{ envChecking ? "Verificando…" : "Verificar de novo" }}
					</button>
				</div>
			</div>

			<!-- Etapa 1 · deploy do schema -->
			<div
				v-else-if="step === 1 && dbReady"
				class="flex min-h-96 w-full flex-col justify-between gap-5 rounded-lg bg-white p-6"
			>
				<div class="flex w-full flex-col gap-4">
					<div>
						<h2 class="text-lg font-medium">Deploy do schema</h2>
						<p class="text-sm text-gray-500">
							Usando a conexão do <code class="text-xs">.env</code>. Aplique as tabelas do Kuroneko no PostgreSQL.
						</p>
					</div>

					<div
						v-if="schemaInspecting"
						class="flex items-center gap-3 rounded-md bg-[#F8F8F6] px-4 py-3 text-sm text-gray-600"
					>
						<Icon name="svg-spinners:ring-resize" class="h-5 w-5 shrink-0" />
						<span>Verificando tabelas no banco…</span>
					</div>

					<div
						v-else-if="schemaDeploying"
						class="flex items-center gap-3 rounded-md bg-[#F8F8F6] px-4 py-3 text-sm text-gray-600"
					>
						<Icon name="svg-spinners:ring-resize" class="h-5 w-5 shrink-0" />
						<span>Publicando schema e criando tabelas…</span>
						</div>

					<div v-else class="flex flex-wrap gap-3 text-xs">
						<span
							class="rounded-full px-3 py-1 font-medium"
							:class="
								schemaInfo?.exists ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
							"
						>
							Schema: {{ schemaInfo?.exists ? "encontrado" : "ausente" }}
						</span>
						<span
							class="rounded-full px-3 py-1 font-medium"
							:class="
								schemaInfo?.upToDate ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
							"
						>
							Atualizado: {{ schemaInfo?.upToDate ? "sim" : "não" }}
						</span>
						<span class="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
							{{ schemaInfo?.presentTables.length ?? 0 }}/{{ schemaInfo?.expectedTables.length ?? 0 }}
							tabelas
						</span>
					</div>

					<div class="max-h-64 overflow-auto rounded-md border border-gray-200">
						<table class="w-full text-left text-sm">
							<thead
								class="sticky top-0 z-10 bg-[#F8F8F6] text-xs uppercase tracking-wide text-gray-500 shadow-[0_1px_0_0_rgb(229,231,235)]"
							>
								<tr>
									<th class="relative z-10 bg-[#F8F8F6] px-3 py-2 font-medium">Tabela</th>
									<th class="relative z-10 bg-[#F8F8F6] px-3 py-2 font-medium">Status</th>
								</tr>
							</thead>
							<tbody>
								<tr v-if="!tableRows.length && !schemaDeploying" class="border-t border-gray-100">
									<td colspan="2" class="px-3 py-6 text-center text-gray-500">
										Nenhuma tabela listada ainda.
									</td>
								</tr>
								<tr v-for="row in tableRows" :key="row.name" class="border-t border-gray-100">
									<td class="px-3 py-2 font-mono text-xs text-[var(--color-ink)]">
										{{ row.name }}
									</td>
									<td class="px-3 py-2">
										<span
											class="inline-flex items-center gap-1.5 text-xs font-medium"
											:class="{
												'text-emerald-700': row.status === 'ok',
												'text-amber-700': row.status === 'missing',
												'text-gray-500': row.status === 'pending',
											}"
										>
											<Icon
												:name="
													row.status === 'ok'
														? 'i-solar:check-circle-bold'
														: row.status === 'pending'
															? 'svg-spinners:ring-resize'
															: 'i-solar:danger-triangle-bold'
												"
												class="text-sm"
											/>
											{{
												row.status === "ok"
													? "Criada"
													: row.status === "pending"
														? "Publicando…"
														: "Ausente"
											}}
										</span>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>

				<div class="flex w-full flex-row items-center justify-end gap-3">
					<button
						type="button"
						class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition disabled:opacity-55"
						:disabled="busy || schemaDeploying || schemaInspecting"
						@click="requestDeploySchema"
					>
						{{
							schemaDeploying
								? "Aplicando…"
								: hasExistingTables
									? "Reaplicar schema"
									: "Aplicar schema"
						}}
					</button>
					<button
						type="button"
						class="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-55"
						:disabled="busy || schemaDeploying || schemaInspecting || !schemaReady"
						@click="goToIdentity"
					>
						Próximo
					</button>
				</div>
			</div>

			<!-- Etapa 2 · identidade -->
			<div
				v-else-if="step === 2"
				class="flex min-h-96 w-full flex-col justify-between gap-5 rounded-lg bg-white p-6"
			>
				<div class="flex w-full flex-col gap-5">
					<div>
						<h2 class="text-lg font-medium">Identidade</h2>
						<p class="text-sm text-gray-500">
							Defina a marca do site: logo, título, slogan e cor primária.
						</p>
					</div>

					<div class="space-y-3">
						<h3 class="text-sm font-bold text-[var(--color-ink)]">Logo</h3>
						<div class="flex flex-wrap items-center gap-4">
							<div
								class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 p-2"
							>
								<img
									v-if="logo"
									:src="logo"
									alt="Logo do site"
									class="max-h-full max-w-full object-contain"
								/>
								<Icon v-else name="i-solar:gallery-bold-duotone" class="text-3xl text-gray-400" />
							</div>
							<div class="flex min-w-0 flex-1 flex-col gap-2">
								<div class="flex flex-wrap gap-2">
									<label class="inline-flex cursor-pointer">
										<input
											type="file"
											accept="image/png,image/jpeg,image/webp,image/svg+xml"
											class="hidden"
											:disabled="busy"
											@change="onLogoChange"
										/>
										<span
											class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-ink)]"
										>
											{{ logo ? "Trocar logo" : "Enviar logo" }}
										</span>
									</label>
									<button
										v-if="logo"
								type="button"
										class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-55"
								:disabled="busy"
										@click="clearLogo"
									>
										Remover
									</button>
								</div>
								<p class="text-xs text-gray-500">PNG, JPG, WebP ou SVG · até 15 MB</p>
								<p v-if="logoError" class="text-xs text-red-600">{{ logoError }}</p>
							</div>
						</div>
					</div>

					<div class="flex flex-col gap-3">
						<UiInput
							id="install2-site-title"
							v-model="siteTitle"
							label="Título"
							type="text"
							placeholder="Kuroneko"
							required
							:disabled="busy"
						/>
						<UiInput
							id="install2-site-tagline"
							v-model="siteTagline"
							label="Slogan"
							type="text"
							placeholder="Template modular Nuxt"
							:disabled="busy"
						/>
						<UiColorPicker
							id="install2-site-primary"
							v-model="sitePrimaryColor"
							:disabled="busy"
							@change="onPrimaryColorChange"
						/>
					</div>
				</div>

				<div class="flex w-full flex-row items-center justify-between gap-3">
					<button
						type="button"
						class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition disabled:opacity-55"
						:disabled="busy"
						@click="backToSchema"
					>
						Voltar
					</button>
					<button
						type="button"
						class="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-55"
						:disabled="busy"
						@click="saveIdentityAndNext"
					>
						{{ busyAction === "identity" ? "Salvando…" : "Próximo" }}
					</button>
				</div>
				</div>

			<!-- Etapa 3 · SMTP -->
			<div
				v-else-if="step === 3"
				class="flex min-h-96 w-full flex-col justify-between gap-5 rounded-lg bg-white p-6"
			>
				<div class="flex w-full flex-col gap-5">
					<div class="flex items-start justify-between gap-3">
					<div>
							<h2 class="text-lg font-medium">SMTP</h2>
							<p class="text-sm text-gray-500">
								Configure o envio de e-mails. Você pode pular e ajustar depois no painel.
							</p>
						</div>
						<UiToggle v-model="smtpEnabled" :disabled="busy" />
					</div>

					<div class="flex flex-col gap-3" :class="{ 'pointer-events-none opacity-45': !smtpEnabled }">
						<div class="flex flex-col gap-3 sm:flex-row">
							<UiInput
								id="install2-smtp-host"
								v-model="smtpHost"
								class="min-w-0 flex-1"
								label="Host"
								type="text"
								placeholder="smtp.exemplo.com"
								:disabled="busy || !smtpEnabled"
							/>
							<UiInput
								id="install2-smtp-port"
								v-model="smtpPort"
								class="w-full sm:w-28"
								label="Porta"
								type="number"
								placeholder="587"
								:disabled="busy || !smtpEnabled"
							/>
						</div>

						<label class="block space-y-1.5">
							<span class="text-sm font-medium text-[var(--color-ink-soft)]">Criptografia</span>
							<select
								v-model="smtpEncryption"
								class="w-full rounded-[var(--radius)] border border-[var(--color-line)] bg-white/80 px-3 py-2.5 text-[var(--color-ink)] shadow-[var(--shadow-soft)] outline-none transition focus:border-[var(--color-ink)] disabled:cursor-not-allowed"
								:disabled="busy || !smtpEnabled"
							>
								<option value="none">Nenhuma</option>
								<option value="tls">TLS (STARTTLS)</option>
								<option value="ssl">SSL</option>
							</select>
						</label>

						<UiInput
							id="install2-smtp-user"
							v-model="smtpUser"
							label="Usuário"
								type="text"
							autocomplete="off"
							placeholder="usuario@exemplo.com"
							:disabled="busy || !smtpEnabled"
						/>
						<UiInput
							id="install2-smtp-password"
							v-model="smtpPassword"
							label="Senha"
							type="password"
							autocomplete="new-password"
							placeholder="••••••••"
							:disabled="busy || !smtpEnabled"
						/>

						<div class="flex flex-col gap-3 sm:flex-row">
							<UiInput
								id="install2-smtp-from-email"
								v-model="smtpFromEmail"
								class="min-w-0 flex-1"
								label="E-mail remetente"
								type="email"
								placeholder="noreply@exemplo.com"
								:disabled="busy || !smtpEnabled"
							/>
							<UiInput
								id="install2-smtp-from-name"
								v-model="smtpFromName"
								class="min-w-0 flex-1"
								label="Nome remetente"
									type="text"
								placeholder="Kuroneko"
								:disabled="busy || !smtpEnabled"
								/>
							</div>
						</div>
					</div>

				<div class="flex w-full flex-row flex-wrap items-center justify-between gap-3">
					<button
						type="button"
						class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition disabled:opacity-55"
						:disabled="busy"
						@click="backToIdentity"
					>
						Voltar
					</button>
					<div class="flex flex-wrap gap-2">
						<button
							type="button"
							class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition disabled:cursor-not-allowed disabled:opacity-55"
							:disabled="busy || !smtpEnabled"
							@click="openSmtpTest"
						>
							{{ busyAction === "smtp-test" ? "Enviando…" : "Testar" }}
						</button>
						<button
							type="button"
							class="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-55"
							:disabled="busy"
							@click="saveSmtpAndNext"
						>
							{{ busyAction === "smtp" ? "Salvando…" : "Próximo" }}
						</button>
					</div>
				</div>
				</div>

			<!-- Etapa 4 · conta admin / conclusão -->
			<div
				v-else-if="step === 4 && installDone"
				class="flex min-h-96 w-full flex-col items-center justify-center gap-5 rounded-lg bg-white p-6 text-center"
			>
				<div class="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
					<Icon name="i-solar:check-circle-bold" class="text-4xl" />
				</div>
					<div>
					<h2 class="text-lg font-medium">Instalação concluída</h2>
					<p class="mt-1 text-sm text-gray-500">Você já está autenticado como administrador.</p>
				</div>
				<button
					type="button"
					class="rounded-md bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white transition"
					@click="goHome"
				>
					Ir para o início
				</button>
			</div>

			<div
				v-else-if="step === 4"
				class="flex min-h-96 w-full flex-col justify-between gap-5 rounded-lg bg-white p-6"
			>
				<div class="flex w-full flex-col gap-5">
					<div>
						<h2 class="text-lg font-medium">Conta</h2>
						<p class="text-sm text-gray-500">
							Crie a conta administrador — a primeira do sistema, com acesso total.
						</p>
					</div>

					<div class="flex flex-col gap-3">
						<UiInput
							id="install2-admin-name"
								v-model="adminName"
							label="Nome"
								type="text"
								placeholder="Seu nome"
							:disabled="busy"
						/>
						<UiInput
							id="install2-admin-email"
								v-model="adminEmail"
							label="E-mail"
								type="email"
								placeholder="admin@exemplo.com"
								autocomplete="username"
							required
							:disabled="busy"
						/>
						<UiInput
							id="install2-admin-password"
								v-model="adminPassword"
							label="Senha"
								type="password"
								autocomplete="new-password"
							required
							:disabled="busy"
						>
							<template #trailing>
								<PasswordRules :password="adminPassword" />
							</template>
						</UiInput>
						<UiInput
							id="install2-admin-password-confirm"
								v-model="adminPasswordConfirm"
							label="Confirmar senha"
								type="password"
								autocomplete="new-password"
							required
							:disabled="busy"
						>
							<template #trailing>
								<PasswordConfirmStatus
									:password="adminPassword"
									:confirm-password="adminPasswordConfirm"
								/>
							</template>
						</UiInput>
						</div>
					</div>

				<div class="flex w-full flex-row items-center justify-between gap-3">
					<button
						type="button"
						class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition disabled:opacity-55"
						:disabled="busy"
						@click="backToSmtp"
					>
						Voltar
					</button>
					<button
						type="button"
						class="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-55"
						:disabled="busy"
						@click="createAdmin"
					>
						{{ busyAction === "admin" ? "Criando…" : "Criar administrador" }}
					</button>
				</div>
			</div>
				</div>

		<UiModal
			v-model="deployConfirmOpen"
			:title="hasExistingTables ? 'Reaplicar schema?' : 'Iniciar deploy do schema?'"
		>
			<p v-if="hasExistingTables" class="text-sm text-[var(--color-muted)]">
				Encontramos
				<strong class="text-[var(--color-ink)]">{{ schemaInfo?.presentTables.length ?? 0 }}</strong>
				tabela(s) do Kuroneko neste banco. Deseja reaplicar o schema? Isso pode alterar estruturas existentes.
			</p>
			<p v-else class="text-sm text-[var(--color-muted)]">
				A conexão está pronta. Deseja iniciar o deploy das tabelas do Kuroneko agora?
			</p>
			<template #footer>
				<button
					type="button"
					class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
					:disabled="schemaDeploying"
					@click="cancelDeploySchema"
				>
					Agora não
				</button>
				<button
					type="button"
					class="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white"
					:disabled="schemaDeploying"
					@click="confirmDeploySchema"
				>
					{{ hasExistingTables ? "Reaplicar schema" : "Iniciar deploy" }}
				</button>
			</template>
		</UiModal>

		<UiModal v-model="smtpTestOpen" title="Enviar e-mail de teste">
			<p class="mb-4 text-sm text-[var(--color-muted)]">Para qual e-mail devemos enviar a mensagem de teste?</p>
			<UiInput
				id="install2-smtp-test-to"
				v-model="smtpTestTo"
				label="E-mail de destino"
				type="email"
				placeholder="voce@exemplo.com"
				:disabled="busyAction === 'smtp-test'"
				@keyup.enter="confirmSmtpTest"
			/>
			<template #footer>
				<button
					type="button"
					class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
					:disabled="busyAction === 'smtp-test'"
					@click="smtpTestOpen = false"
				>
					Cancelar
				</button>
				<button
					type="button"
					class="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white disabled:opacity-55"
					:disabled="busyAction === 'smtp-test'"
					@click="confirmSmtpTest"
				>
					{{ busyAction === "smtp-test" ? "Enviando…" : "Enviar teste" }}
				</button>
			</template>
		</UiModal>
	</div>
</template>
