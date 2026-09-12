import {
  classifyChangedFiles,
  getChangedFiles,
  resolveRange,
  UnresolvableRangeError,
} from './migration-safety-policy'

// Logs only non-sensitive spawn-failure metadata (never env vars, GitHub
// contexts, secrets, or full stdout/stderr contents) so a fail-closed
// exit still leaves enough evidence to distinguish a genuine resource
// failure from other causes without a follow-up log-diving round trip.
function logSafeSpawnDiagnostics(cause: unknown): void {
  if (!cause || typeof cause !== 'object') return
  const err = cause as NodeJS.ErrnoException & {
    stdout?: unknown
    stderr?: unknown
    status?: number
    signal?: unknown
  }
  const byteLength = (value: unknown): number | null => {
    if (typeof value === 'string') return Buffer.byteLength(value)
    if (Buffer.isBuffer(value)) return value.length
    return null
  }
  console.error(
    JSON.stringify({
      spawnErrorName: err.name ?? null,
      spawnErrorMessage: err.message ?? null,
      spawnErrorCode: err.code ?? null,
      spawnErrorErrno: err.errno ?? null,
      spawnErrorSyscall: err.syscall ?? null,
      spawnErrorSignal: err.signal ?? null,
      spawnErrorStatus: err.status ?? null,
      stdoutBytes: byteLength(err.stdout),
      stderrBytes: byteLength(err.stderr),
    }),
  )
}

function main() {
  const range = resolveRange(process.argv, process.env)

  let changed: string[]
  try {
    changed = getChangedFiles(range)
  } catch (error) {
    if (error instanceof UnresolvableRangeError) {
      console.error(error.message)
      console.error('Refusing to treat an unresolvable comparison range as migration-free.')
      logSafeSpawnDiagnostics(error.cause)
      process.exit(1)
    }
    throw error
  }

  const { migrationFiles, hasRunbookUpdate } = classifyChangedFiles(changed)

  if (migrationFiles.length === 0) {
    console.log('No migration files changed. Migration safety check passed.')
    return
  }

  if (!hasRunbookUpdate) {
    console.error('Migration files changed but no runbook/release-governance docs were updated in the same change.')
    console.error(`Changed migration files: ${migrationFiles.join(', ')}`)
    process.exit(1)
  }

  console.log('Migration safety check passed with required operational documentation updates.')
}

main()
