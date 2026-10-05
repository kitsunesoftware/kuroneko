import { join } from 'node:path'
import { createWriteStream } from 'node:fs'
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createError } from 'h3'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type {
  KuronekoModuleManifest,
  StoreModuleCard,
  StoreRegistry,
  StoreRegistryEntry,
} from '../../shared/types/store'
import type { ModuleSchemaMeta } from '../../shared/module-schemas'
import { parseModuleIcon, isSafeModuleAssetPath, normalizeLocalPath } from '../../shared/module-icon'
import {
  assertModulePlatformCompatible,
  checkModulePlatformCompatibility,
} from '../../shared/platform-compatibility'
import { compareSemver } from '../../shared/semver'
import { usePrisma } from './prisma'

const execFileAsync = promisify(execFile)

function projectRoot() {
  return process.cwd()
}

function assertSafeTarget(target: string) {
  const root = resolve(projectRoot())
  const absolute = resolve(root, target)
  const rel = relative(root, absolute)
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) {
    throw createError({ statusCode: 400, message: 'Destino de módulo inválido.' })
  }
  if (!rel.replace(/\\/g, '/').startsWith('layers/')) {
    throw createError({ statusCode: 400, message: 'Módulos só podem ser instalados em layers/.' })
  }
  return absolute
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** GitHub raw devolve text/plain; $fetch pode chegar como string. */
function coerceJsonObject(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw) as unknown
  }
  catch {
    throw createError({ statusCode: 400, message: 'Manifesto kuroneko.module.json não é JSON válido.' })
  }
}

export function parseManifest(raw: unknown): KuronekoModuleManifest {
  const data = coerceJsonObject(raw)
  if (!isPlainObject(data)) {
    throw createError({ statusCode: 400, message: 'Manifesto kuroneko.module.json inválido.' })
  }
  if (typeof data.id !== 'string' || !data.id) {
    throw createError({ statusCode: 400, message: 'Manifesto sem id.' })
  }
  if (typeof data.name !== 'string' || !data.name) {
    throw createError({ statusCode: 400, message: 'Manifesto sem name.' })
  }
  if (typeof data.version !== 'string' || !data.version) {
    throw createError({ statusCode: 400, message: 'Manifesto sem version.' })
  }
  if (!isPlainObject(data.layer) || typeof data.layer.target !== 'string') {
    throw createError({ statusCode: 400, message: 'Manifesto sem layer.target.' })
  }
  if (data.layer.kind !== 'root' && data.layer.kind !== 'child') {
    throw createError({ statusCode: 400, message: 'layer.kind deve ser root ou child.' })
  }
  if (data.layer.kind === 'child' && typeof data.layer.parent !== 'string') {
    throw createError({ statusCode: 400, message: 'Submódulo exige layer.parent.' })
  }
  if (data.minKuroneko !== undefined && data.minKuroneko !== null) {
    if (typeof data.minKuroneko !== 'string' || !data.minKuroneko.trim()) {
      throw createError({
        statusCode: 400,
        message: 'minKuroneko deve ser uma string semver (ex.: 1.0.0).',
      })
    }
  }

  return data as KuronekoModuleManifest
}

async function readJsonFile<T>(path: string): Promise<T> {
  const text = await readFile(path, 'utf8')
  return JSON.parse(text) as T
}

export async function loadStoreRegistry(): Promise<StoreRegistry> {
  const prisma = usePrisma()

  const rows = await prisma.storeCatalogModule.findMany({
    orderBy: { moduleId: 'asc' },
  })

  return {
    version: 1,
    modules: rows.map((row) => {
      const entry: StoreRegistryEntry = {
        id: row.moduleId,
        source: row.source,
        ref: row.ref || 'main',
      }
      if (row.path) entry.path = row.path
      return entry
    }),
  }
}

export async function peekStoreManifest(entry: StoreRegistryEntry) {
  return peekManifest(entry)
}

import { getStoreSiteConfig } from './site-settings'
import { STORE_MONOREPO } from '../../shared/store-monorepo'

export type StoreSourceInfo = {
  configured: boolean
  repo: string
  ref: string
  moduleCount: number
}

async function getStoreConfig() {
  const stored = await getStoreSiteConfig()
  return {
    repo: STORE_MONOREPO.repo,
    ref: STORE_MONOREPO.ref,
    token: stored.githubToken,
  }
}

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'kuroneko-store',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function dirnamePosix(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx <= 0 ? '' : normalized.slice(0, idx)
}

export async function getStoreSourceInfo(): Promise<StoreSourceInfo> {
  const { repo, ref } = await getStoreConfig()
  const prisma = usePrisma()
  const moduleCount = await prisma.storeCatalogModule.count().catch(() => 0)
  return {
    configured: true,
    repo,
    ref,
    moduleCount,
  }
}

/**
 * Varre o monorepo GitHub (Trees API) e sincroniza StoreCatalogModule.
 */
export async function syncStoreCatalogFromRepo() {
  const { repo, ref, token } = await getStoreConfig()

  const [owner, name] = repo.split('/')
  const treeUrl = `https://api.github.com/repos/${owner}/${name}/git/trees/${encodeURIComponent(ref)}?recursive=1`

  let treePayload: { truncated?: boolean, tree?: Array<{ path?: string, type?: string }> }
  try {
    treePayload = await $fetch(treeUrl, { headers: githubHeaders(token) })
  }
  catch (error: unknown) {
    const status = (error as { statusCode?: number, status?: number })?.statusCode
      || (error as { status?: number })?.status
    throw createError({
      statusCode: status && status >= 400 ? status : 502,
      message: `Falha ao ler a árvore de ${repo}@${ref} no GitHub.`,
    })
  }

  if (treePayload.truncated) {
    throw createError({
      statusCode: 502,
      message: 'Árvore do repositório truncada pelo GitHub. Use um repo menor ou um índice explícito.',
    })
  }

  const manifestPaths = (treePayload.tree || [])
    .filter((item) => item.type === 'blob' && typeof item.path === 'string' && item.path.endsWith('kuroneko.module.json'))
    .map((item) => item.path as string)

  const prisma = usePrisma()
  const seenIds = new Set<string>()
  const upserted: Array<{ id: string, path: string }> = []
  const errors: Array<{ path: string, message: string }> = []

  for (const manifestPath of manifestPaths) {
    const packagePath = dirnamePosix(manifestPath)
    const rawUrl = packagePath
      ? `https://raw.githubusercontent.com/${owner}/${name}/${encodeURIComponent(ref)}/${packagePath}/kuroneko.module.json`
      : `https://raw.githubusercontent.com/${owner}/${name}/${encodeURIComponent(ref)}/kuroneko.module.json`

    try {
      const raw = await $fetch<unknown>(rawUrl, { headers: githubHeaders(token) })
      const manifest = parseManifest(raw)

      if (seenIds.has(manifest.id)) {
        errors.push({
          path: manifestPath,
          message: `id duplicado "${manifest.id}" (ignorado).`,
        })
        continue
      }
      seenIds.add(manifest.id)

      await prisma.storeCatalogModule.upsert({
        where: { moduleId: manifest.id },
        create: {
          moduleId: manifest.id,
          source: repo,
          ref,
          path: packagePath || null,
        },
        update: {
          source: repo,
          ref,
          path: packagePath || null,
        },
      })
      upserted.push({ id: manifest.id, path: packagePath || '.' })
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao ler manifesto.'
      errors.push({ path: manifestPath, message })
    }
  }

  // Remove entradas deste monorepo que sumiram do tree
  const stale = await prisma.storeCatalogModule.findMany({
    where: {
      source: repo,
      moduleId: { notIn: [...seenIds] },
    },
    select: { moduleId: true },
  })
  if (stale.length) {
    await prisma.storeCatalogModule.deleteMany({
      where: {
        source: repo,
        moduleId: { in: stale.map((row) => row.moduleId) },
      },
    })
  }

  return {
    ok: true as const,
    repo,
    ref,
    found: manifestPaths.length,
    synced: upserted.length,
    removed: stale.length,
    modules: upserted,
    errors,
  }
}

async function readManifestFromDir(dir: string): Promise<KuronekoModuleManifest> {
  const path = join(dir, 'kuroneko.module.json')
  const raw = await readJsonFile<unknown>(path)
  return parseManifest(raw)
}

async function resolveLocalPackageDir(source: string) {
  const rel = source.slice('local:'.length)
  return resolve(projectRoot(), rel)
}

async function downloadGithubZip(source: string, ref: string, destZip: string) {
  const [owner, repo] = source.split('/')
  if (!owner || !repo) {
    throw createError({ statusCode: 400, message: `Fonte GitHub inválida: ${source}` })
  }

  const url = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${encodeURIComponent(ref)}`
  const tagUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/tags/${encodeURIComponent(ref)}`

  let response = await fetch(url)
  if (!response.ok) {
    response = await fetch(tagUrl)
  }
  if (!response.ok || !response.body) {
    throw createError({
      statusCode: 502,
      message: `Não foi possível baixar ${source}@${ref} do GitHub.`,
    })
  }

  await mkdir(join(destZip, '..'), { recursive: true })
  const fileStream = createWriteStream(destZip)
  await pipeline(Readable.fromWeb(response.body as never), fileStream)
}

/**
 * Caminhos absolutos com `C:` quebram o tar do Windows (interpreta como host remoto).
 * Preferir path relativo ao cwd.
 */
function pathForTar(absolutePath: string) {
  const rel = relative(process.cwd(), absolutePath)
  if (
    rel
    && rel !== '..'
    && !rel.startsWith(`..${sep}`)
    && !rel.startsWith('../')
    && !isAbsolute(rel)
  ) {
    return rel.split(sep).join('/')
  }
  return absolutePath
}

async function extractZip(zipPath: string, outDir: string) {
  await mkdir(outDir, { recursive: true })

  const zipArg = pathForTar(zipPath)
  const outArg = pathForTar(outDir)

  // Evita `tar … C:\…` no Windows → "Cannot connect to C: resolve failed"
  if (!zipArg.includes(':') && !outArg.includes(':')) {
    try {
      await execFileAsync('tar', ['-xf', zipArg, '-C', outArg])
      return
    }
    catch (err) {
      if (process.platform !== 'win32') throw err
    }
  }

  if (process.platform === 'win32') {
    const psZip = zipPath.replace(/'/g, "''")
    const psOut = outDir.replace(/'/g, "''")
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath '${psZip}' -DestinationPath '${psOut}' -Force`,
    ])
    return
  }

  await execFileAsync('tar', ['-xf', zipPath, '-C', outDir])
}

async function findPackageRoot(extractDir: string, nestedPath?: string) {
  const entries = await readdir(extractDir, { withFileTypes: true })
  const top = entries.find((e) => e.isDirectory())
  if (!top) {
    throw createError({ statusCode: 500, message: 'Zip do GitHub vazio.' })
  }
  let root = join(extractDir, top.name)
  if (nestedPath) {
    root = join(root, nestedPath)
  }
  return root
}

export async function isLayerDownloaded(target: string) {
  try {
    const absolute = assertSafeTarget(target)
    await stat(join(absolute, 'kuroneko.module.json'))
    return true
  }
  catch {
    return false
  }
}

/** Lê a versão do manifesto local em layers/, se existir. */
export async function readLocalModuleVersion(target: string): Promise<string | null> {
  try {
    const absolute = assertSafeTarget(target)
    const manifest = await readManifestFromDir(absolute)
    return manifest.version || null
  }
  catch {
    return null
  }
}

/** True se a versão remota é maior que a local (semver). */
export function isRemoteUpdateAvailable(remoteVersion: string, localVersion: string | null | undefined) {
  if (!localVersion) return false
  const result = compareSemver(remoteVersion, localVersion)
  if (Number.isNaN(result)) return false
  return result > 0
}

async function loadGeneratedSchemas(): Promise<ModuleSchemaMeta[]> {
  const path = join(projectRoot(), '.kuroneko', 'module-schemas.generated.json')
  try {
    return await readJsonFile<ModuleSchemaMeta[]>(path)
  }
  catch {
    return []
  }
}

export async function registerStorePrismaSchema(manifest: KuronekoModuleManifest) {
  if (!manifest.prisma?.schema || !manifest.prisma.tables?.length) return

  const targetAbs = assertSafeTarget(manifest.layer.target)
  const schemaRel = join(manifest.layer.target, manifest.prisma.schema).replace(/\\/g, '/')
  const schemaAbs = join(targetAbs, manifest.prisma.schema)
  try {
    await stat(schemaAbs)
  }
  catch {
    return
  }

  const generated = await loadGeneratedSchemas()
  const next: ModuleSchemaMeta = {
    moduleId: manifest.id,
    schemaPath: schemaRel,
    tables: [...manifest.prisma.tables],
  }
  const filtered = generated.filter((item) => item.moduleId !== manifest.id)
  filtered.push(next)

  const dir = join(projectRoot(), '.kuroneko')
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, 'module-schemas.generated.json'),
    `${JSON.stringify(filtered, null, 2)}\n`,
    'utf8',
  )
}

export async function unregisterStorePrismaSchema(moduleId: string) {
  const generated = await loadGeneratedSchemas()
  const filtered = generated.filter(
    (item) => item.moduleId !== moduleId && !item.moduleId.startsWith(`${moduleId}.`),
  )
  const dir = join(projectRoot(), '.kuroneko')
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, 'module-schemas.generated.json'),
    `${JSON.stringify(filtered, null, 2)}\n`,
    'utf8',
  )
}

export async function listStoreModules(): Promise<StoreModuleCard[]> {
  let registry = await loadStoreRegistry()
  const { repo } = await getStoreConfig()

  if (!registry.modules.length && repo) {
    try {
      await syncStoreCatalogFromRepo()
      registry = await loadStoreRegistry()
    }
    catch (error) {
      console.warn('[kuroneko:store] sync automático falhou', error)
    }
  }

  const prisma = usePrisma()
  const installedRows = await prisma.installedModule.findMany({
    select: { moduleId: true },
  }).catch(() => [] as Array<{ moduleId: string }>)
  const installedSet = new Set(installedRows.map((row) => row.moduleId))

  const cards: StoreModuleCard[] = []

  for (const entry of registry.modules) {
    try {
      const manifest = await peekManifest(entry)
      const downloaded = await isLayerDownloaded(manifest.layer.target)
      const localVersion = downloaded
        ? await readLocalModuleVersion(manifest.layer.target)
        : null
      const updateAvailable = isRemoteUpdateAvailable(manifest.version, localVersion)
      const iconRaw = manifest.icon || 'i-solar:box-bold-duotone'
      const compatibility = checkModulePlatformCompatibility(manifest)
      cards.push({
        id: manifest.id,
        name: manifest.name,
        description: manifest.description || '',
        version: manifest.version,
        source: entry.source,
        ref: entry.ref || 'main',
        parentId: manifest.parentId ?? null,
        icon: iconToCardString(iconRaw),
        iconUrl: resolveStoreModuleIconUrl(iconRaw, manifest.id),
        dependsOn: manifest.dependsOn || [],
        downloaded,
        installed: installedSet.has(manifest.id),
        target: manifest.layer.target,
        author: manifest.author,
        license: manifest.license,
        minKuroneko: compatibility.minKuroneko,
        platformCompatible: compatibility.compatible,
        localVersion,
        updateAvailable,
      })
    }
    catch (error) {
      console.warn('[kuroneko:store] falha ao ler módulo do registry', entry.id, error)
    }
  }

  return cards
}

async function peekManifest(entry: StoreRegistryEntry): Promise<KuronekoModuleManifest> {
  if (entry.source.startsWith('local:')) {
    const dir = await resolveLocalPackageDir(entry.source)
    return readManifestFromDir(dir)
  }

  // Para GitHub sem baixar tudo: usamos raw content do manifesto.
  const [owner, repo] = entry.source.split('/')
  const ref = entry.ref || 'main'
  const basePath = entry.path ? `${entry.path.replace(/^\/|\/$/g, '')}/` : ''
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${basePath}kuroneko.module.json`
  const raw = await $fetch<unknown>(url)
  return parseManifest(raw)
}

export type DownloadProgressFn = (phase: string, progress: number, message: string) => void

export async function downloadStoreModule(
  moduleId: string,
  options?: { onProgress?: DownloadProgressFn, enqueueInstall?: boolean },
) {
  const onProgress = options?.onProgress
  const registry = await loadStoreRegistry()
  const entry = registry.modules.find((item) => item.id === moduleId)
  if (!entry) {
    throw createError({ statusCode: 404, message: 'Módulo não encontrado no registry.' })
  }

  onProgress?.('downloading', 8, 'Preparando instalação…')

  const tmpRoot = join(projectRoot(), '.kuroneko', 'tmp', moduleId.replace(/\./g, '-'))
  await rm(tmpRoot, { recursive: true, force: true })
  await mkdir(tmpRoot, { recursive: true })

  let packageDir: string

  if (entry.source.startsWith('local:')) {
    onProgress?.('downloading', 35, 'Obtendo pacote local…')
    packageDir = await resolveLocalPackageDir(entry.source)
  }
  else {
    const zipPath = join(tmpRoot, 'package.zip')
    const extractDir = join(tmpRoot, 'extract')
    onProgress?.('downloading', 25, 'Obtendo pacote…')
    await downloadGithubZip(entry.source, entry.ref || 'main', zipPath)
    onProgress?.('extracting', 55, 'Preparando arquivos…')
    await extractZip(zipPath, extractDir)
    packageDir = await findPackageRoot(extractDir, entry.path)
  }

  onProgress?.('saving', 70, 'Validando manifesto…')
  const manifest = await readManifestFromDir(packageDir)

  if (manifest.id !== moduleId) {
    throw createError({
      statusCode: 400,
      message: `O pacote declara id "${manifest.id}", esperado "${moduleId}".`,
    })
  }

  assertModulePlatformCompatible(manifest)

  for (const dep of manifest.dependsOn || []) {
    // Dependência precisa existir como layer presente ou módulo de sistema.
    const depDownloaded = await isDependencySatisfied(dep)
    if (!depDownloaded) {
      throw createError({
        statusCode: 400,
        message: `Dependência ausente: instale "${dep}" antes.`,
      })
    }
  }

  onProgress?.('saving', 82, 'Instalando módulo…')
  const targetAbs = assertSafeTarget(manifest.layer.target)
  await rm(targetAbs, { recursive: true, force: true })
  await mkdir(join(targetAbs, '..'), { recursive: true })
  await cp(packageDir, targetAbs, { recursive: true })

  await registerStorePrismaSchema(manifest)

  // Limpa tmp
  await rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined)

  const hasSchema = Boolean(manifest.prisma?.schema && manifest.prisma.tables?.length)

  if (options?.enqueueInstall !== false) {
    onProgress?.('enqueue', 92, 'Adicionando à fila…')
    const { enqueueModuleChange } = await import('./module-queue')
    await enqueueModuleChange({
      moduleId: manifest.id,
      action: 'install',
      label: manifest.name,
      version: manifest.version,
      target: manifest.layer.target.replace(/\\/g, '/'),
      hasSchema,
    })

    // Aparece em Meus módulos já; ativação real no process da fila (PM2).
    const { usePrisma } = await import('./prisma')
    const prisma = usePrisma()
    await prisma.installedModule.upsert({
      where: { moduleId: manifest.id },
      create: { moduleId: manifest.id, enabled: false },
      update: { enabled: false },
    })
    // Só o parentId do manifesto — ids com ponto (ex.: demo.hello) podem ser raiz.
    const parentId = manifest.parentId ? String(manifest.parentId).trim() : ''
    if (parentId) {
      await prisma.installedModule.upsert({
        where: { moduleId: parentId },
        create: { moduleId: parentId, enabled: true },
        update: {},
      })
    }
  }

  onProgress?.('done', 100, 'Módulo na fila de instalação.')

  return {
    ok: true,
    moduleId: manifest.id,
    name: manifest.name,
    target: manifest.layer.target.replace(/\\/g, '/'),
    version: manifest.version,
    hasSchema,
    needsRestart: true,
    needsRebuild: true,
    queued: options?.enqueueInstall !== false,
    restartTriggered: false,
  }
}

/**
 * Remove o pacote de layers/. Se estiver instalado, desinstala do banco antes.
 * Funciona com entrada no catálogo da loja ou só com kuroneko.module.json local.
 */
export async function removeStoreModule(moduleId: string) {
  const id = String(moduleId || '').trim()
  if (!id) {
    throw createError({ statusCode: 400, message: 'Módulo inválido.' })
  }

  const { SYSTEM_MODULE_IDS } = await import('../../shared/module-schemas')
  if ((SYSTEM_MODULE_IDS as readonly string[]).includes(id)) {
    throw createError({ statusCode: 400, message: 'Módulo de sistema não pode ser removido.' })
  }

  let manifest: KuronekoModuleManifest | null = null

  const registry = await loadStoreRegistry()
  const entry = registry.modules.find((item) => item.id === id)
  if (entry) {
    try {
      manifest = await peekManifest(entry)
    }
    catch {
      manifest = null
    }
  }

  if (!manifest) {
    manifest = await findManifestByIdInLayers(join(projectRoot(), 'layers'), id)
  }

  if (!manifest) {
    throw createError({ statusCode: 404, message: 'Módulo não encontrado em layers/ nem no catálogo.' })
  }

  const targetAbs = assertSafeTarget(manifest.layer.target)
  const downloaded = await isLayerDownloaded(manifest.layer.target)
  if (!downloaded) {
    throw createError({ statusCode: 400, message: 'Este módulo não está baixado em layers/.' })
  }

  const prisma = usePrisma()
  const { dropModuleTables } = await import('./module-schema')
  const { deleteModuleSettings } = await import('./module-settings')
  const { resolveSchemaMeta } = await import('./schema-meta')

  async function uninstallOne(moduleKey: string) {
    if ((SYSTEM_MODULE_IDS as readonly string[]).includes(moduleKey)) return
    const meta = await resolveSchemaMeta(moduleKey)
    if (meta?.tables.length) {
      await dropModuleTables(meta.tables)
    }
    await deleteModuleSettings(moduleKey)
    await prisma.installedModule.deleteMany({ where: { moduleId: moduleKey } })
  }

  const installedRow = await prisma.installedModule.findUnique({ where: { moduleId: id } })
  let uninstalled = false

  if (installedRow) {
    await uninstallOne(id)
    uninstalled = true
  }

  const children = await prisma.installedModule.findMany({
    where: { moduleId: { startsWith: `${id}.` } },
  })
  for (const child of children) {
    await uninstallOne(child.moduleId)
    uninstalled = true
  }

  await rm(targetAbs, { recursive: true, force: true })
  await unregisterStorePrismaSchema(id)

  // Se ainda estiver na fila de install, cancela; se estava instalado, a remoção
  // da layer exige rebuild (tratado pela fila de uninstall quando aplicável).
  const { removeFromModuleQueue } = await import('./module-queue')
  await removeFromModuleQueue(id).catch(() => undefined)

  return {
    ok: true,
    moduleId: id,
    target: manifest.layer.target.replace(/\\/g, '/'),
    uninstalled,
    needsRebuild: true,
    needsRestart: true,
    restartTriggered: false,
  }
}

export type LocalLayerModule = {
  id: string
  target: string
  name: string
  description: string
  parentId: string | null
  /** Valor bruto normalizado do manifesto (Iconify, path ou URL). */
  icon: string
  /** URL resolvida quando o ícone é imagem. */
  iconUrl: string | null
}

/** Lista módulos com kuroneko.module.json em layers/ (pacotes da loja). */
export async function listLocalLayerModules(): Promise<LocalLayerModule[]> {
  const results: LocalLayerModule[] = []
  await collectLayerManifests(join(projectRoot(), 'layers'), results)
  return results
}

/**
 * URL pronta para `<img>`: externa fica como está; local aponta para a API do módulo
 * (o endpoint lê de layers/ ou faz proxy/redirect do GitHub raw).
 */
export function resolveStoreModuleIconUrl(iconRaw: unknown, moduleId: string): string | null {
  const parsed = parseModuleIcon(iconRaw)
  if (parsed.kind !== 'image') return null
  if (parsed.source === 'external') return parsed.src
  return `/api/store/modules/${encodeURIComponent(moduleId)}/icon`
}

function iconToCardString(iconRaw: unknown): string {
  if (typeof iconRaw === 'string' && iconRaw.trim()) return iconRaw.trim()
  const parsed = parseModuleIcon(iconRaw)
  if (parsed.kind === 'icon') return parsed.name
  return parsed.src
}

export type ModuleIconAsset =
  | { kind: 'file', absolutePath: string, contentType: string }
  | { kind: 'remote', url: string }

const ICON_CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
}

function contentTypeForPath(filePath: string) {
  const lower = filePath.toLowerCase()
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : ''
  return ICON_CONTENT_TYPES[ext] || 'application/octet-stream'
}

/**
 * Resolve o arquivo/URL da imagem de ícone local de um módulo do catálogo.
 */
export async function resolveModuleIconAsset(moduleId: string): Promise<ModuleIconAsset> {
  const id = String(moduleId || '').trim()
  if (!id) {
    throw createError({ statusCode: 400, message: 'Módulo inválido.' })
  }

  const registry = await loadStoreRegistry()
  const entry = registry.modules.find((item) => item.id === id)

  let manifest: KuronekoModuleManifest | null = null
  if (entry) {
    try {
      manifest = await peekManifest(entry)
    }
    catch {
      manifest = null
    }
  }
  if (!manifest) {
    manifest = await findManifestByIdInLayers(join(projectRoot(), 'layers'), id)
  }
  if (!manifest) {
    throw createError({ statusCode: 404, message: 'Módulo não encontrado.' })
  }

  const parsed = parseModuleIcon(manifest.icon)
  if (parsed.kind !== 'image' || parsed.source !== 'local') {
    throw createError({ statusCode: 404, message: 'Este módulo não declara ícone de imagem local.' })
  }

  const relative = normalizeLocalPath(parsed.src)
  if (!isSafeModuleAssetPath(relative)) {
    throw createError({ statusCode: 400, message: 'Caminho de ícone inválido.' })
  }

  const downloaded = await isLayerDownloaded(manifest.layer.target)
  if (downloaded) {
    const targetAbs = assertSafeTarget(manifest.layer.target)
    const absolutePath = join(targetAbs, relative)
    // Garante que o arquivo fica dentro do pacote
    const relCheck = absolutePath.replace(/\\/g, '/')
    const rootCheck = targetAbs.replace(/\\/g, '/')
    if (!relCheck.startsWith(`${rootCheck}/`) && relCheck !== rootCheck) {
      throw createError({ statusCode: 400, message: 'Caminho de ícone fora do pacote.' })
    }
    try {
      await stat(absolutePath)
    }
    catch {
      throw createError({ statusCode: 404, message: 'Arquivo de ícone não encontrado no pacote.' })
    }
    return {
      kind: 'file',
      absolutePath,
      contentType: contentTypeForPath(absolutePath),
    }
  }

  if (entry && !entry.source.startsWith('local:')) {
    const [owner, repo] = entry.source.split('/')
    if (owner && repo) {
      const ref = entry.ref || 'main'
      const basePath = entry.path ? `${entry.path.replace(/^\/|\/$/g, '')}/` : ''
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${basePath}${relative}`
      return { kind: 'remote', url }
    }
  }

  throw createError({
    statusCode: 404,
    message: 'Ícone local indisponível até baixar o módulo.',
  })
}

async function collectLayerManifests(
  dir: string,
  out: LocalLayerModule[],
) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  }
  catch {
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const base = join(dir, entry.name)
    try {
      const manifest = await readManifestFromDir(base)
      const iconRaw = manifest.icon || 'i-solar:box-bold-duotone'
      const parentRaw = manifest.parentId != null ? String(manifest.parentId).trim() : ''
      out.push({
        id: manifest.id,
        target: manifest.layer.target.replace(/\\/g, '/'),
        name: manifest.name || manifest.id,
        description: manifest.description || '',
        parentId: parentRaw || null,
        icon: iconToCardString(iconRaw),
        iconUrl: resolveStoreModuleIconUrl(iconRaw, manifest.id),
      })
    }
    catch {
      // pasta sem manifesto
    }
    await collectLayerManifests(join(base, 'modules'), out)
  }
}

export async function findManifestByIdInLayers(
  dir: string,
  moduleId: string,
): Promise<KuronekoModuleManifest | null> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  }
  catch {
    return null
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const base = join(dir, entry.name)
    try {
      const manifest = await readManifestFromDir(base)
      if (manifest.id === moduleId) return manifest
    }
    catch {
      // ignore
    }
    const nested = await findManifestByIdInLayers(join(base, 'modules'), moduleId)
    if (nested) return nested
  }
  return null
}

/** Garante compatibilidade de plataforma para um módulo já presente em layers/. */
export async function assertDownloadedModulePlatformCompatible(moduleId: string) {
  const manifest = await findManifestByIdInLayers(join(projectRoot(), 'layers'), moduleId)
  if (!manifest) return null
  return assertModulePlatformCompatible(manifest)
}

async function isDependencySatisfied(depId: string) {
  const { SYSTEM_MODULE_IDS } = await import('../../shared/module-schemas')
  if ((SYSTEM_MODULE_IDS as readonly string[]).includes(depId)) return true

  const found = await findManifestByIdInLayers(join(projectRoot(), 'layers'), depId)
  return Boolean(found)
}

export async function getGeneratedSchemaMetas(): Promise<ModuleSchemaMeta[]> {
  return loadGeneratedSchemas()
}
