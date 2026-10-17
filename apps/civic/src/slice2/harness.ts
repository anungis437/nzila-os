import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { cpus, totalmem, platform, release } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import {
  repositoryRoot,
  storageDirectory,
  authorizationCalls,
  authorizeRuntime,
} from './authorization'
import {
  boundedPath,
  canonical,
  digest,
  authoritySnapshot,
  Slice2Store,
  type Event,
  type Operation,
} from './store'
import { genesis, apply } from '../slice1/model'
import { proofOperations } from '../slice1/scenario'

export interface WorkerMessage {
  type: 'barrier' | 'result'
  stage?: string
  ok?: boolean
  error?: string
  result?: unknown
  pid: number
  authorizationCalls?: unknown[]
  boundary?: unknown[]
  transactionPhases?: unknown[]
  retryEvidence?: { error: string; reloadedRevision: number }[]
  openedMs?: number
  operationMs?: number
}
export function launch(job: unknown, deadlineMs = 180_000) {
  const launched = performance.now()
  const child = spawn(
    process.execPath,
    [
      join(repositoryRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      '--tsconfig',
      join(repositoryRoot, 'apps', 'civic', 'slice2.tsconfig.json'),
      join(repositoryRoot, 'apps', 'civic', 'src', 'slice2', 'worker.ts'),
      JSON.stringify(job),
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  )
  let buffer = '',
    stderr = ''
  const messages: WorkerMessage[] = []
  let exited = false
  const waiters: {
    predicate: (m: WorkerMessage) => boolean
    resolve: (m: WorkerMessage) => void
    reject: (e: Error) => void
  }[] = []
  const finishWaiters = (error: Error) => {
    for (const w of waiters.splice(0)) w.reject(error)
  }
  const timer = setTimeout(() => {
    child.kill()
    finishWaiters(new Error(`WORKER_DEADLINE ${deadlineMs}ms ${JSON.stringify(job)} ${stderr}`))
  }, deadlineMs)
  child.stdout.on('data', (data) => {
    buffer += String(data)
    while (buffer.includes('\n')) {
      const index = buffer.indexOf('\n'),
        line = buffer.slice(0, index)
      buffer = buffer.slice(index + 1)
      try {
        const message: WorkerMessage = JSON.parse(line)
        messages.push(message)
        for (const waiter of [...waiters])
          if (waiter.predicate(message)) {
            waiters.splice(waiters.indexOf(waiter), 1)
            waiter.resolve(message)
          }
      } catch (error) {
        finishWaiters(new Error(`WORKER_OUTPUT_INVALID ${line} ${String(error)}`))
      }
    }
  })
  child.stderr.on('data', (d) => {
    stderr += String(d)
  })
  const exit = new Promise<{
    code: number | null
    messages: WorkerMessage[]
    stderr: string
    elapsedMs: number
  }>((resolve, reject) => {
    child.on('error', (error) => {
      clearTimeout(timer)
      finishWaiters(error)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      exited = true
      finishWaiters(new Error(`WORKER_EXIT ${code} ${stderr} ${JSON.stringify(messages)}`))
      resolve({ code, messages, stderr, elapsedMs: performance.now() - launched })
    })
  })
  return {
    child,
    messages,
    exit,
    resume: (clock?: string) =>
      child.stdin.write(JSON.stringify({ continue: true, ...(clock ? { clock } : {}) }) + '\n'),
    wait: (type: 'barrier' | 'result', stage?: string): Promise<WorkerMessage> => {
      const predicate = (m: WorkerMessage) => m.type === type && (!stage || m.stage === stage)
      const prior = messages.find(predicate)
      if (prior) return Promise.resolve(prior)
      if (exited) return Promise.reject(new Error(`WORKER_ALREADY_EXITED ${stderr}`))
      return new Promise((resolve, reject) => waiters.push({ predicate, resolve, reject }))
    },
  }
}
export async function runWorker(job: unknown) {
  const launched = launch(job)
  const result = await launched.exit
  const message = result.messages.find((m) => m.type === 'result')
  return { ...result, message }
}
export function retain(name: string, value: unknown): void {
  const evidence = JSON.parse(
    JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item === 'number' && !Number.isFinite(item))
        throw new Error('NONFINITE_PROOF_EVIDENCE')
      return item === undefined ? null : item
    }),
  ) as unknown
  writeFileSync(boundedPath(storageDirectory, name), canonical(evidence) + '\n', { flag: 'wx' })
}
export function environment() {
  const db = new DatabaseSync(':memory:')
  const sqlite = db.prepare('SELECT sqlite_version() AS version').get()!.version
  db.close()
  return {
    node: process.version,
    sqlite,
    os: `${platform()} ${release()}`,
    cpu: cpus()[0]?.model,
    cpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
    worktree: repositoryRoot,
    diskType: 'NOT_MEASURED',
    timer: 'node:perf_hooks performance.now monotonic',
    processCache: 'fresh workers; warm parent; OS page cache uncontrolled, not cold disk',
    contention:
      'SQLite BEGIN IMMEDIATE DELETE journal FULL synchronous; IPC barriers; 10s lock timeout',
    authorization: 'UNCACHED actual exported guard per constructor/admission/precommit',
    custody:
      'Aubert Nungisa; same-host path/access separation assumption; no administrator resistance',
  }
}
export function statistics(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    successful: sorted.length,
    medianMs: sorted.length
      ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2
      : null,
    p95Ms: sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null,
    quantile: 'nearest-rank p95',
  }
}
export function guardLog() {
  return authorizationCalls.map((call) => ({ ...call }))
}

export function performanceFixture(name: string, size: number) {
  if (![16, 64, 256].includes(size)) throw new Error('PERFORMANCE_FIXTURE_SIZE_INVALID')
  const schema = new Slice2Store(name)
  schema.close()
  authorizeRuntime()
  const db = new DatabaseSync(boundedPath(storageDirectory, name))
  try {
    if (Number(db.prepare('SELECT count(*) AS n FROM journals').get()!.n) !== 0)
      throw new Error('PERFORMANCE_FIXTURE_COLLISION')
    db.exec('PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL; BEGIN IMMEDIATE')
    for (const institution of ['A', 'B'] as const) {
      const { s, operations } = proofOperations(institution)
      let state = genesis(s.seed)
      let previousHash: string | null = null
      for (let sequence = 1; sequence <= size; sequence++) {
        const kind = sequence === 1 ? 'genesis' : sequence === 2 ? 'authorize' : 'configuration'
        const key = `fixture-${sequence}`
        let payload: Event['payload'] = { kind: 'genesis', seed: s.seed }
        let requestHash = digest(s.seed)
        let effectiveAt = '2026-01-01T00:00:00Z'
        if (sequence > 1) {
          const operation: Operation =
            sequence === 2
              ? operations[0]
              : {
                  kind: 'configuration',
                  resourceId: s.itemId,
                  at: operations[0].at,
                  configuration: { ...s.seed.config, version: sequence - 1 },
                }
          const snapshot = authoritySnapshot(
            state,
            s.principal,
            new Date().toISOString(),
            kind === 'authorize' ? 'authorize_intervention' : 'grant_authority',
          )
          const changed = apply(state, s.principal, operation)
          payload = {
            kind: 'operation',
            principal: s.principal,
            operation,
            operationSnapshot: changed.snapshot,
            admissionSnapshot: snapshot,
            finalSnapshot: snapshot,
          }
          state = changed.state
          effectiveAt = operation.at
          requestHash = digest({ principal: s.principal, operation })
        }
        const stateDigest = digest(state)
        const material = {
          schemaVersion: 2 as const,
          orgId: s.principal.orgId,
          sequence,
          previousHash,
          commandKey: canonical([kind, key]),
          recordedAt: new Date().toISOString(),
          effectiveAt,
          expectedAuthorityRevision: sequence - 1,
          actualAuthorityRevision: sequence - 1,
          resultDigest: digest({ sequence, stateDigest }),
          payload,
          stateDigest,
        }
        const event: Event = { ...material, hash: digest(material) }
        db.prepare('INSERT INTO journals VALUES (?,?,?,?,?)').run(
          s.principal.orgId,
          sequence,
          event.commandKey,
          canonical(event),
          event.hash,
        )
        db.prepare('INSERT INTO receipts VALUES (?,?,?,?,?,?)').run(
          s.principal.orgId,
          kind,
          key,
          requestHash,
          sequence,
          canonical({ sequence, hash: event.hash, stateDigest }),
        )
        previousHash = event.hash
      }
      db.prepare('INSERT INTO heads VALUES (?,?,?,?)').run(
        s.principal.orgId,
        size,
        previousHash,
        canonical(state),
      )
      authoritySnapshot(state, s.principal, new Date().toISOString(), 'grant_authority')
    }
    authorizeRuntime()
    db.exec('COMMIT')
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK')
    throw error
  } finally {
    db.close()
  }
  const verify = new Slice2Store(name)
  try {
    for (const institution of ['A', 'B'] as const) {
      const read = verify.read(proofOperations(institution).s.principal)
      if (read.version !== size || read.state.decisions.length)
        throw new Error('PERFORMANCE_FIXTURE_REPLAY_FAILED')
    }
  } finally {
    verify.close()
  }
  return {
    generation: 'OFFLINE_SYNTHETIC_NONDECISION_FIXTURE_NOT_PRODUCT_COMMAND_ADMISSIONS',
    sizePerOrg: size,
    orgs: ['SYN-A-ORG', 'SYN-B-ORG'],
    validation: 'ACTUAL_GUARD_AT_SETUP_AND_TRANSACTION_BOUNDARIES_PLUS_FULL_REPLAY',
  }
}
