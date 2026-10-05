import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs'
import { join } from 'node:path'

export type InstallJobPhase =
  | 'queued-download'
  | 'downloading'
  | 'extracting'
  | 'saving'
  | 'enqueue'
  | 'done'
  | 'error'

export type InstallJobState = {
  jobId: string
  moduleId: string
  phase: InstallJobPhase
  progress: number
  message: string
  error?: string | null
  target?: string | null
  version?: string | null
  updatedAt: string
}

function jobsDir() {
  return join(process.cwd(), '.kuroneko', 'install-jobs')
}

function jobPath(jobId: string) {
  return join(jobsDir(), `${jobId}.json`)
}

export function createInstallJob(moduleId: string): InstallJobState {
  const jobId = randomUUID()
  const state: InstallJobState = {
    jobId,
    moduleId,
    phase: 'queued-download',
    progress: 0,
    message: 'Preparando download…',
    error: null,
    target: null,
    version: null,
    updatedAt: new Date().toISOString(),
  }
  writeInstallJob(state)
  return state
}

export function writeInstallJob(state: InstallJobState) {
  mkdirSync(jobsDir(), { recursive: true })
  const next = { ...state, updatedAt: new Date().toISOString() }
  writeFileSync(jobPath(state.jobId), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

export function updateInstallJob(
  jobId: string,
  patch: Partial<Omit<InstallJobState, 'jobId'>>,
) {
  const current = readInstallJob(jobId)
  if (!current) return null
  return writeInstallJob({ ...current, ...patch, jobId })
}

export function readInstallJob(jobId: string): InstallJobState | null {
  const path = jobPath(jobId)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as InstallJobState
  }
  catch {
    return null
  }
}

export function clearInstallJob(jobId: string) {
  try {
    unlinkSync(jobPath(jobId))
  }
  catch {
    // ignore
  }
}
