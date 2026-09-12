import { execSync } from 'node:child_process'

const ZERO_SHA = '0000000000000000000000000000000000000000'

// Exact-path runbooks: broadening this to a directory prefix would let any
// unrelated document in that tree satisfy the migration-documentation gate.
const APPROVED_RUNBOOK_PATHS = [
  'docs/ops/ENVIRONMENT_OPERATIONS.md',
  'docs/union-eyes/P4_AUTHORITY_ROLLOUT_REMEDIATION.md',
]

const APPROVED_RUNBOOK_PREFIXES = [
  'ops/runbooks/',
  'docs/ops/release-governance/',
]

const DJANGO_MIGRATION_PATTERN = /(^|\/)migrations\/([^/]+\.py)$/
const DJANGO_MIGRATION_INIT_FILENAME = '__init__.py'

// Transient OS-level spawn failures (runner resource contention), distinct
// from a genuine unresolvable git revision, which must still fail closed.
const TRANSIENT_SPAWN_ERROR_CODES = new Set(['ENOBUFS', 'EAGAIN', 'EMFILE', 'ENFILE', 'ENOMEM'])

function isTransientSpawnError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  return typeof code === 'string' && TRANSIENT_SPAWN_ERROR_CODES.has(code)
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

export function runWithTransientRetry<T>(fn: () => T, attempts = 3, delayMs = 50): T {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return fn()
    } catch (error) {
      if (!isTransientSpawnError(error) || attempt === attempts - 1) throw error
      sleepSync(delayMs * (attempt + 1))
    }
  }
  throw new Error('unreachable')
}

export function isMigrationFile(path: string): boolean {
  if (path.startsWith('migrations/')) return true
  if (path.includes('/migrate-')) return true
  if (path.endsWith('.sql')) return true

  const nestedDjangoMigration = path.match(DJANGO_MIGRATION_PATTERN)
  if (nestedDjangoMigration) {
    return nestedDjangoMigration[2] !== DJANGO_MIGRATION_INIT_FILENAME
  }

  return false
}

export function isApprovedRunbookUpdate(path: string): boolean {
  if (APPROVED_RUNBOOK_PATHS.includes(path)) return true
  return APPROVED_RUNBOOK_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export function classifyChangedFiles(changed: string[]): {
  migrationFiles: string[]
  hasRunbookUpdate: boolean
} {
  const migrationFiles = changed.filter(isMigrationFile)
  const hasRunbookUpdate = changed.some(isApprovedRunbookUpdate)
  return { migrationFiles, hasRunbookUpdate }
}

export function resolveRange(argv: string[], env: NodeJS.ProcessEnv): string {
  const explicitRange = argv[2]
  if (explicitRange) return explicitRange

  const before = env.GITHUB_EVENT_BEFORE
  const sha = env.GITHUB_SHA
  if (before && sha) {
    // A new branch's first push has no prior commit to diff against; treat
    // the pushed commit itself as the changeset instead of attempting to
    // resolve the synthetic all-zero SHA as a real git object.
    if (before === ZERO_SHA) return sha
    return `${before}..${sha}`
  }

  try {
    runWithTransientRetry(() =>
      execSync('git rev-parse --verify --quiet HEAD~1', { stdio: 'ignore' }),
    )
    return 'HEAD~1..HEAD'
  } catch {
    return 'HEAD'
  }
}

export class UnresolvableRangeError extends Error {}

export type ExecFn = (command: string, options?: { cwd?: string }) => string

const defaultExec: ExecFn = (command, options) =>
  execSync(command, { encoding: 'utf8', ...options }) as unknown as string

export function getChangedFiles(range: string, execImpl: ExecFn = defaultExec): string[] {
  const command = range.includes('..')
    ? `git diff --name-only ${range}`
    : `git show --pretty="" --name-only ${range}`

  let output: string
  try {
    output = runWithTransientRetry(() => execImpl(command))
  } catch (error) {
    // A supplied-but-unresolvable comparison range (e.g. a shallow checkout
    // missing the "before" object) must fail closed, never be silently
    // treated as an empty/migration-free changeset.
    throw new UnresolvableRangeError(
      `Unable to resolve changed files for range "${range}": ${(error as Error).message}`,
    )
  }
  return output.split('\n').map((f) => f.trim()).filter(Boolean)
}
