import { readSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import {
  Slice2Store,
  SyntheticCrashAfterAppend,
  authoritySnapshot,
  type Stage,
  type Operation,
  type Principal,
} from './store'
import { proofOperations } from '../slice1/scenario'
import { authorizationCalls } from './authorization'
import { retain } from './harness'

interface Job {
  file: string
  institution: 'A' | 'B'
  mode: 'read' | 'submit' | 'race'
  operation?: Operation
  key?: string
  version?: number
  pause?: Stage | 'preliminary'
  crash?: Stage
  observeBusy?: boolean
  proofClock?: string
  principal?: Principal
  reloadOnStale?: boolean
}
const job: Job = JSON.parse(process.argv[2])
let clock = job.proofClock
const started = performance.now()
let tracePosition = 0
const invocation = `${Date.now()}-${process.hrtime.bigint()}`
const emit = (value: unknown) => {
  retain(`${job.file.slice(0, -7)}-worker-${process.pid}-${invocation}-${tracePosition++}.json`, {
    classification: 'LOCAL_SYNTHETIC_PROOF_ARTIFACT',
    job,
    message: value,
    authorizationCalls,
    createdAt: new Date().toISOString(),
  })
  process.stdout.write(JSON.stringify(value) + '\n')
}
function barrier(stage: string): void {
  emit({ type: 'barrier', stage, pid: process.pid, at: new Date().toISOString() })
  let line = ''
  const byte = Buffer.alloc(1)
  while (!line.endsWith('\n')) {
    if (readSync(0, byte, 0, 1, null) !== 1) throw new Error('BARRIER_PIPE_CLOSED')
    line += byte.toString()
    if (line.length > 1000) throw new Error('BARRIER_INPUT_INVALID')
  }
  const command = JSON.parse(line)
  if (command.clock) clock = command.clock
  if (command.continue !== true) throw new Error('BARRIER_CONTINUE_REQUIRED')
}
let store: Slice2Store | undefined
try {
  const { s } = proofOperations(job.institution)
  const principal = job.principal ?? s.principal
  store = new Slice2Store(job.file, {
    crashAfterAppend: job.crash === 'after-append',
    proofClock: () => clock ?? new Date().toISOString(),
    lockTimeoutMs: job.observeBusy ? 0 : 10_000,
    hook: (stage) => {
      if (stage === job.crash) {
        emit({ type: 'crash', stage, pid: process.pid })
        process.exit(73)
      }
      if (stage === job.pause || (stage === 'lock-wait' && job.observeBusy)) barrier(stage)
    },
  })
  const opened = performance.now()
  if (job.mode === 'race') barrier('start')
  if (job.pause === 'preliminary') {
    const state = store.read(principal).state
    authoritySnapshot(state, principal, clock ?? new Date().toISOString(), 'decide')
    barrier('preliminary')
  }
  let result: unknown
  const retryEvidence: { error: string; reloadedRevision: number }[] = []
  try {
    result =
      job.mode === 'read'
        ? store.read(principal)
        : store.submit(principal, job.operation!, job.key!, job.version!)
  } catch (error) {
    if (error instanceof SyntheticCrashAfterAppend) {
      emit({ type: 'crash', stage: 'after-append', pid: process.pid })
      process.exit(73)
    }
    if (!job.reloadOnStale || !String(error).includes('STALE_STATE')) throw error
    const revision = store.read(principal).version
    retryEvidence.push({ error: String(error), reloadedRevision: revision })
    result = store.submit(principal, job.operation!, job.key!, revision)
  }
  emit({
    type: 'result',
    ok: true,
    result,
    pid: process.pid,
    boundary: store.boundaryEvidence,
    transactionPhases: store.transactionPhases,
    retryEvidence,
    authorizationCalls,
    openedMs: opened - started,
    operationMs: performance.now() - opened,
  })
} catch (error) {
  emit({ type: 'result', ok: false, error: String(error), pid: process.pid, authorizationCalls })
  process.exitCode = 1
} finally {
  store?.close()
}
