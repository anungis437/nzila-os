import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  authorizeRuntime,
  storageDirectory,
  checkpointDirectory,
  adversarialDirectory,
} from './authorization'
import {
  genesis,
  apply,
  authenticate,
  authoritySnapshot as inheritedAuthoritySnapshot,
  brief,
  instant,
  reject,
  type State,
  type Operation,
  type Snapshot,
} from '../slice1/model'

export type Seed = State['seed']
export type { Operation } from '../slice1/model'
export interface InstrumentValidity {
  effectiveAt: string
  expiresAt: string
}
export function authoritySnapshot(
  ...args: Parameters<typeof inheritedAuthoritySnapshot>
): Snapshot {
  const snapshot = inheritedAuthoritySnapshot(...args)
  const instrument = snapshot.instrument as Snapshot['instrument'] & Partial<InstrumentValidity>
  if (instrument.effectiveAt !== undefined || instrument.expiresAt !== undefined) {
    if (
      !instrument.effectiveAt ||
      !instrument.expiresAt ||
      instant(instrument.effectiveAt) >= instant(instrument.expiresAt) ||
      instant(args[2]) < instant(instrument.effectiveAt) ||
      instant(args[2]) >= instant(instrument.expiresAt)
    )
      reject('MISSING_AUTHORITY', 'Instrument is not currently effective')
  }
  return snapshot
}
export type Principal = Parameters<typeof apply>[1]
export type Stage =
  | 'before-lock'
  | 'lock-wait'
  | 'locked'
  | 'before-append'
  | 'after-append'
  | 'precommit'
  | 'committed'
export interface Options {
  denyOnlyGrantFixture?: string
  crashAfterAppend?: boolean
  proofClock?: () => string
  hook?: (stage: Exclude<Stage, 'after-append'>) => void
  adversarialCopy?: boolean
  lockTimeoutMs?: number
}
export interface Receipt {
  sequence: number
  hash: string
  stateDigest: string
  replay?: boolean
}
export interface Event {
  schemaVersion: 2
  orgId: string
  sequence: number
  previousHash: string | null
  commandKey: string
  recordedAt: string
  effectiveAt: string
  expectedAuthorityRevision: number
  actualAuthorityRevision: number
  resultDigest: string
  payload:
    | { kind: 'genesis'; seed: Seed }
    | {
        kind: 'operation'
        principal: Principal
        operation: Operation
        operationSnapshot: Snapshot
        admissionSnapshot: Snapshot
        finalSnapshot: Snapshot
      }
  stateDigest: string
  hash: string
}
type PreparedPayload =
  | Extract<Event['payload'], { kind: 'genesis' }>
  | Omit<Extract<Event['payload'], { kind: 'operation' }>, 'finalSnapshot'>
interface PreparedTransaction {
  append?: {
    orgId: string
    kind: string
    key: string
    requestHash: string
    payload: PreparedPayload
    state: State
    at: string
    expected: number
    actual: number
    recordedAt: string
  }
  prior?: Receipt
  authority?: {
    predecessor: State
    principal: Principal
    operation: Operation
    actualRevision: number
  }
}
export class SyntheticCrashAfterAppend extends Error {
  constructor() {
    super('SYNTHETIC_CRASH_AFTER_APPEND')
    this.name = 'SyntheticCrashAfterAppend'
  }
}
export interface Checkpoint {
  schemaVersion: 2
  classification: 'LOCAL_SYNTHETIC_PROOF_ARTIFACT'
  scenarioId: string
  orgId: string
  sequence: number
  headDigest: string
  stateDigest: string
  authoritySnapshotDigest: string
  createdAt: string
}
export function canonical(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (Array.isArray(v)) return v.map(normalize)
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype)
      return Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, normalize(x)]),
      )
    return reject('INVALID_INPUT', 'Finite plain JSON required')
  }
  return JSON.stringify(normalize(value))
}
export function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex')
}
export function eventDigest(event: Event): string {
  const { hash: _hash, ...material } = event
  return digest(material)
}
function org(value: string): void {
  if (!/^SYN-[AB]-ORG$/.test(value)) reject('NOT_FOUND', 'Synthetic A/B institution required')
}
export function boundedPath(directory: string, name: string): string {
  if (!/^[a-z0-9-]+(?:\.sqlite|\.json)$/.test(name))
    reject('STORAGE_PATH_INVALID', 'Bounded filename required')
  const path = join(directory, name)
  if (existsSync(path) && (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()))
    reject('STORAGE_PATH_INVALID', 'Regular proof file required')
  return path
}
export function action(operation: Operation) {
  return operation.kind === 'decision'
    ? ('decide' as const)
    : ['revoke', 'membership', 'configuration'].includes(operation.kind)
      ? ('grant_authority' as const)
      : operation.kind === 'authorize'
        ? ('authorize_intervention' as const)
        : ('record_evidence' as const)
}

export class Slice2Store {
  private readonly db: DatabaseSync
  private closed = false
  readonly file: string
  readonly boundaryEvidence: {
    orgId: string
    evaluatedAt: string
    actualRevision: number
    stage: string
    sequence: number
    snapshotDigest: string
    persistedEventHash: string
    snapshotPersisted: boolean
  }[] = []
  readonly transactionPhases: {
    lockWaitMs: number
    workMs: number
    finalChecksAndCommitMs: number
    totalMs: number
  }[] = []

  constructor(
    readonly name: string,
    private readonly options: Options = {},
  ) {
    authorizeRuntime(options.denyOnlyGrantFixture)
    if (!name.endsWith('.sqlite')) reject('STORAGE_PATH_INVALID', 'SQLite filename required')
    this.file = boundedPath(options.adversarialCopy ? adversarialDirectory : storageDirectory, name)
    this.db = new DatabaseSync(this.file, { timeout: options.lockTimeoutMs ?? 10_000 })
    const names = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => String(r.name))
    if (
      names.length &&
      (names.length !== 4 ||
        !['journals', 'heads', 'receipts', 'decisions'].every((n) => names.includes(n)))
    ) {
      this.db.close()
      reject('STORAGE_COLLISION', 'Unknown schema; no repair')
    }
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;')
    if (!names.length)
      this.db.exec(`
      PRAGMA journal_mode=DELETE;
      CREATE TABLE IF NOT EXISTS journals (
        org_id TEXT NOT NULL CHECK(org_id IN ('SYN-A-ORG','SYN-B-ORG')),
        sequence INTEGER NOT NULL CHECK(sequence>0), command_key TEXT NOT NULL,
        envelope TEXT NOT NULL, hash TEXT NOT NULL,
        PRIMARY KEY(org_id,sequence), UNIQUE(org_id,command_key));
      CREATE TABLE IF NOT EXISTS heads (
        org_id TEXT PRIMARY KEY, sequence INTEGER NOT NULL, hash TEXT NOT NULL, state TEXT NOT NULL,
        FOREIGN KEY(org_id,sequence) REFERENCES journals(org_id,sequence));
      CREATE TABLE IF NOT EXISTS receipts (
        org_id TEXT NOT NULL, operation TEXT NOT NULL, key TEXT NOT NULL, request_hash TEXT NOT NULL,
        sequence INTEGER NOT NULL, result TEXT NOT NULL,
        PRIMARY KEY(org_id,operation,key), FOREIGN KEY(org_id,sequence) REFERENCES journals(org_id,sequence));
      CREATE TABLE IF NOT EXISTS decisions (
        org_id TEXT NOT NULL, id TEXT NOT NULL, sequence INTEGER NOT NULL, supersedes TEXT, record TEXT NOT NULL,
        PRIMARY KEY(org_id,id), FOREIGN KEY(org_id,sequence) REFERENCES journals(org_id,sequence),
        FOREIGN KEY(org_id,supersedes) REFERENCES decisions(org_id,id));
      CREATE TRIGGER IF NOT EXISTS journal_no_update BEFORE UPDATE ON journals BEGIN SELECT RAISE(ABORT,'immutable journal'); END;
      CREATE TRIGGER IF NOT EXISTS journal_no_delete BEFORE DELETE ON journals BEGIN SELECT RAISE(ABORT,'immutable journal'); END;
      CREATE TRIGGER IF NOT EXISTS receipt_no_update BEFORE UPDATE ON receipts BEGIN SELECT RAISE(ABORT,'immutable receipt'); END;
      CREATE TRIGGER IF NOT EXISTS receipt_no_delete BEFORE DELETE ON receipts BEGIN SELECT RAISE(ABORT,'immutable receipt'); END;
      CREATE TRIGGER IF NOT EXISTS decision_no_update BEFORE UPDATE ON decisions BEGIN SELECT RAISE(ABORT,'immutable decision'); END;
      CREATE TRIGGER IF NOT EXISTS decision_no_delete BEFORE DELETE ON decisions BEGIN SELECT RAISE(ABORT,'immutable decision'); END;
    `)
  }
  close(): void {
    if (!this.closed) {
      this.db.close()
      this.closed = true
    }
  }
  private now(): string {
    const at = this.options.proofClock?.() ?? new Date().toISOString()
    instant(at)
    return at
  }
  private admission(): void {
    if (this.closed) reject('STORAGE_CLOSED', 'Closed store')
    authorizeRuntime(this.options.denyOnlyGrantFixture)
  }
  private key(key: string): void {
    if (!/^[A-Za-z0-9-]{1,100}$/.test(key)) reject('INVALID_INPUT', 'Bounded command key required')
  }
  private transaction(body: () => PreparedTransaction): Receipt {
    this.options.hook?.('before-lock')
    const lockStarted = performance.now()
    try {
      this.db.exec('BEGIN IMMEDIATE')
    } catch (error) {
      if (!String(error).includes('database is locked') || !this.options.hook) throw error
      this.options.hook('lock-wait')
      this.db.exec('BEGIN IMMEDIATE')
    }
    const lockAcquired = performance.now()
    let committed = false
    try {
      this.options.hook?.('locked')
      const prepared = body()
      if (prepared.append) this.options.hook?.('before-append')
      this.options.hook?.('precommit')
      const crashAfterAppend = this.options.crashAfterAppend === true
      const workFinished = performance.now()
      authorizeRuntime(this.options.denyOnlyGrantFixture)
      const finalSnapshot = prepared.authority
        ? authoritySnapshot(
            prepared.authority.predecessor,
            prepared.authority.principal,
            this.now(),
            action(prepared.authority.operation),
          )
        : undefined
      // Only deterministic journal/hash/SQLite work follows final live authority validation.
      const draft = prepared.append
      const payload: Event['payload'] | undefined = draft
        ? draft.payload.kind === 'genesis'
          ? draft.payload
          : { ...draft.payload, finalSnapshot: finalSnapshot! }
        : undefined
      const result: Receipt = draft
        ? {
            ...this.append(
              draft.orgId,
              draft.kind,
              draft.key,
              draft.requestHash,
              payload!,
              draft.state,
              draft.at,
              draft.expected,
              draft.actual,
              finalSnapshot?.evaluatedAt ?? draft.recordedAt,
            ),
            replay: false,
          }
        : prepared.prior!
      if (draft && crashAfterAppend) throw new SyntheticCrashAfterAppend()
      this.db.exec('COMMIT')
      committed = true
      const finished = performance.now()
      if (finalSnapshot && prepared.authority)
        this.boundaryEvidence.push({
          orgId: prepared.authority.principal.orgId,
          evaluatedAt: finalSnapshot.evaluatedAt,
          actualRevision: prepared.authority.actualRevision,
          stage: draft ? 'final-live-validation' : 'retry-live-validation-no-new-event',
          sequence: result.sequence,
          snapshotDigest: digest(finalSnapshot),
          persistedEventHash: result.hash,
          snapshotPersisted: draft?.payload.kind === 'operation',
        })
      this.transactionPhases.push({
        lockWaitMs: lockAcquired - lockStarted,
        workMs: workFinished - lockAcquired,
        finalChecksAndCommitMs: finished - workFinished,
        totalMs: finished - lockStarted,
      })
      this.options.hook?.('committed')
      return result
    } catch (error) {
      if (!committed && !(error instanceof SyntheticCrashAfterAppend)) this.db.exec('ROLLBACK')
      throw error
    }
  }
  private rebuild(orgId: string, cutoff?: number, effectiveAt?: string) {
    org(orgId)
    const rows = this.db
      .prepare('SELECT * FROM journals WHERE org_id=? ORDER BY sequence')
      .all(orgId)
    if (!rows.length) reject('NOT_FOUND', 'No institution')
    const events: Event[] = []
    let state: State | undefined,
      known: State | undefined,
      previous: string | null = null
    for (const [i, row] of rows.entries()) {
      const e: Event = JSON.parse(String(row.envelope))
      if (
        e.schemaVersion !== 2 ||
        e.orgId !== orgId ||
        row.org_id !== orgId ||
        e.sequence !== i + 1 ||
        row.sequence !== e.sequence ||
        row.command_key !== e.commandKey ||
        e.previousHash !== previous ||
        row.hash !== e.hash ||
        eventDigest(e) !== e.hash
      )
        reject('INTEGRITY_FAILED', 'Envelope, sequence, predecessor or hash mismatch')
      instant(e.recordedAt)
      instant(e.effectiveAt)
      if (e.payload.kind === 'genesis') {
        if (i !== 0 || e.expectedAuthorityRevision !== 0 || e.actualAuthorityRevision !== 0)
          reject('INTEGRITY_FAILED', 'Genesis position invalid')
        state = genesis(e.payload.seed)
      } else {
        if (
          !state ||
          e.actualAuthorityRevision !== i ||
          e.expectedAuthorityRevision !== i ||
          e.effectiveAt !== e.payload.operation.at
        )
          reject('INTEGRITY_FAILED', 'Authority predecessor mismatch')
        const p = e.payload
        for (const snapshot of [p.admissionSnapshot, p.finalSnapshot]) {
          const actual = authoritySnapshot(
            state,
            p.principal,
            snapshot.evaluatedAt,
            action(p.operation),
          )
          if (digest(snapshot) !== digest(actual))
            reject('INTEGRITY_FAILED', 'Historical authority mismatch')
        }
        if (instant(p.finalSnapshot.evaluatedAt) < instant(p.admissionSnapshot.evaluatedAt))
          reject('INTEGRITY_FAILED', 'Authority time reordered')
        const replay = apply(state, p.principal, p.operation)
        if (digest(replay.snapshot) !== digest(p.operationSnapshot))
          reject('INTEGRITY_FAILED', 'Operation authority mismatch')
        state = replay.state
      }
      if (
        !state ||
        state.seed.institution.id !== orgId ||
        digest(state) !== e.stateDigest ||
        e.resultDigest !== digest({ sequence: e.sequence, stateDigest: e.stateDigest })
      )
        reject('INTEGRITY_FAILED', 'State or result digest mismatch')
      if (
        (cutoff === undefined || e.sequence <= cutoff) &&
        (effectiveAt === undefined || instant(e.effectiveAt) <= instant(effectiveAt))
      )
        known = structuredClone(state)
      previous = e.hash
      events.push(e)
    }
    const head = this.db.prepare('SELECT * FROM heads WHERE org_id=?').get(orgId)
    if (
      !head ||
      head.sequence !== events.length ||
      head.hash !== previous ||
      head.state !== canonical(state)
    )
      reject('INTEGRITY_FAILED', 'Head projection mismatch')
    const receipts = this.db.prepare('SELECT * FROM receipts WHERE org_id=?').all(orgId)
    if (receipts.length !== events.length) reject('INTEGRITY_FAILED', 'Receipt count mismatch')
    for (const r of receipts) {
      const e = events[Number(r.sequence) - 1]
      if (
        !e ||
        e.commandKey !== canonical([r.operation, r.key]) ||
        r.operation !== (e.payload.kind === 'genesis' ? 'genesis' : e.payload.operation.kind) ||
        r.result !==
          canonical({ sequence: e.sequence, hash: e.hash, stateDigest: e.stateDigest }) ||
        r.request_hash !==
          (e.payload.kind === 'genesis'
            ? digest(e.payload.seed)
            : digest({ principal: e.payload.principal, operation: e.payload.operation }))
      )
        reject('INTEGRITY_FAILED', 'Receipt binding mismatch')
    }
    const decisions = this.db
      .prepare('SELECT * FROM decisions WHERE org_id=? ORDER BY sequence')
      .all(orgId)
    if (
      !state ||
      decisions.length !== state.decisions.length ||
      decisions.some((r, i) => {
        const e = events[Number(r.sequence) - 1]
        return (
          r.record !== canonical(state!.decisions[i]) ||
          r.id !== state!.decisions[i].id ||
          r.supersedes !== state!.decisions[i].supersedes ||
          !e ||
          e.payload.kind !== 'operation' ||
          e.payload.operation.kind !== 'decision' ||
          e.payload.operation.id !== r.id
        )
      })
    )
      reject('INTEGRITY_FAILED', 'Decision correspondence mismatch')
    if (!known) reject('NOT_FOUND', 'No state at cutoff')
    return { state: known, events }
  }
  private append(
    orgId: string,
    kind: string,
    key: string,
    requestHash: string,
    payload: Event['payload'],
    state: State,
    at: string,
    expected: number,
    actual: number,
    recordedAt: string,
  ) {
    const head = this.db.prepare('SELECT sequence,hash FROM heads WHERE org_id=?').get(orgId)
    const sequence = head ? Number(head.sequence) + 1 : 1
    const stateDigest = digest(state)
    const material = {
      schemaVersion: 2 as const,
      orgId,
      sequence,
      previousHash: head ? String(head.hash) : null,
      commandKey: canonical([kind, key]),
      recordedAt,
      effectiveAt: at,
      expectedAuthorityRevision: expected,
      actualAuthorityRevision: actual,
      resultDigest: digest({ sequence, stateDigest }),
      payload,
      stateDigest,
    }
    const event: Event = { ...material, hash: digest(material) }
    const receipt = { sequence, hash: event.hash, stateDigest }
    this.db
      .prepare('INSERT INTO journals VALUES (?,?,?,?,?)')
      .run(orgId, sequence, event.commandKey, canonical(event), event.hash)
    this.db
      .prepare(
        'INSERT INTO heads VALUES (?,?,?,?) ON CONFLICT(org_id) DO UPDATE SET sequence=excluded.sequence,hash=excluded.hash,state=excluded.state',
      )
      .run(orgId, sequence, event.hash, canonical(state))
    this.db
      .prepare('INSERT INTO receipts VALUES (?,?,?,?,?,?)')
      .run(orgId, kind, key, requestHash, sequence, canonical(receipt))
    if (payload.kind === 'operation' && payload.operation.kind === 'decision') {
      const d = state.decisions.at(-1)!
      this.db
        .prepare('INSERT INTO decisions VALUES (?,?,?,?,?)')
        .run(orgId, d.id, sequence, d.supersedes, canonical(d))
    }
    return receipt
  }
  create(seed: Seed, key = 'genesis'): Receipt {
    this.admission()
    this.key(key)
    const state = genesis(seed)
    org(seed.institution.id)
    return this.transaction(() => {
      if (this.db.prepare('SELECT org_id FROM heads WHERE org_id=?').get(seed.institution.id))
        reject('INVALID_WORKFLOW_STATE', 'Genesis already exists; no reseeding')
      return {
        append: {
          orgId: seed.institution.id,
          kind: 'genesis',
          key,
          requestHash: digest(seed),
          payload: { kind: 'genesis', seed: structuredClone(seed) },
          state,
          at: '2026-01-01T00:00:00Z',
          expected: 0,
          actual: 0,
          recordedAt: new Date().toISOString(),
        },
      }
    })
  }
  submit(
    principal: Principal,
    operation: Operation,
    key: string,
    expectedVersion: number,
  ): Receipt {
    this.admission()
    this.key(key)
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
      reject('INVALID_INPUT', 'Expected revision required')
    const actor = structuredClone(principal)
    const command = structuredClone(operation)
    return this.transaction(() => {
      const rebuilt = this.rebuild(actor.orgId)
      const lockedState = rebuilt.state
      const revision = rebuilt.events.length
      const admissionSnapshot = authoritySnapshot(lockedState, actor, this.now(), action(command))
      authoritySnapshot(lockedState, actor, command.at, action(command))
      const requestHash = digest({ principal: actor, operation: command })
      const authority = {
        predecessor: lockedState,
        principal: actor,
        operation: command,
        actualRevision: revision,
      }
      const prior = this.db
        .prepare('SELECT * FROM receipts WHERE org_id=? AND operation=? AND key=?')
        .get(actor.orgId, command.kind, key)
      if (prior) {
        if (prior.request_hash !== requestHash)
          reject('IDEMPOTENCY_CONFLICT', 'Same key with different payload')
        return {
          prior: { ...JSON.parse(String(prior.result)), replay: true } as Receipt,
          authority,
        }
      }
      if (revision !== expectedVersion) reject('STALE_STATE', 'Reload latest revision')
      const last = rebuilt.events.at(-1)!
      if (instant(command.at) < instant(last.effectiveAt))
        reject('STALE_TEMPORAL_WRITE', 'Cannot backdate transition')
      const changed = apply(lockedState, actor, command)
      return {
        authority,
        append: {
          orgId: actor.orgId,
          kind: command.kind,
          key,
          requestHash,
          payload: {
            kind: 'operation',
            principal: actor,
            operation: command,
            operationSnapshot: changed.snapshot,
            admissionSnapshot,
          },
          state: changed.state,
          at: command.at,
          expected: expectedVersion,
          actual: revision,
          recordedAt: new Date().toISOString(),
        },
      }
    })
  }
  read(principal: Principal, cutoff?: number, effectiveAt?: string) {
    this.admission()
    if (cutoff !== undefined && (!Number.isSafeInteger(cutoff) || cutoff < 1))
      reject('INVALID_INPUT', 'Positive cutoff')
    if (effectiveAt !== undefined) instant(effectiveAt)
    this.db.exec('BEGIN')
    try {
      const current = this.rebuild(principal.orgId)
      authenticate(current.state, principal, this.now())
      const reconstructed =
        cutoff === undefined && effectiveAt === undefined
          ? current
          : this.rebuild(principal.orgId, cutoff, effectiveAt)
      this.db.exec('COMMIT')
      return {
        state: reconstructed.state,
        events: current.events,
        version: current.events.length,
        brief: brief(reconstructed.state, effectiveAt ?? current.events.at(-1)!.effectiveAt),
      }
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
  checkpoint(principal: Principal, name: string, scenarioId: string): Checkpoint {
    const read = this.read(principal),
      last = read.events.at(-1)!
    if (!/^SYN-[A-Z0-9-]+$/.test(scenarioId)) reject('INVALID_INPUT', 'Synthetic scenario required')
    const checkpoint: Checkpoint = {
      schemaVersion: 2,
      classification: 'LOCAL_SYNTHETIC_PROOF_ARTIFACT',
      scenarioId,
      orgId: principal.orgId,
      sequence: last.sequence,
      headDigest: last.hash,
      stateDigest: digest(read.state),
      authoritySnapshotDigest: digest(
        last.payload.kind === 'operation' ? last.payload.finalSnapshot : null,
      ),
      createdAt: new Date().toISOString(),
    }
    authorizeRuntime()
    writeFileSync(boundedPath(checkpointDirectory, name), canonical(checkpoint) + '\n', {
      flag: 'wx',
    })
    return checkpoint
  }
  verifyCheckpoint(principal: Principal, checkpoint: Checkpoint): void {
    const read = this.read(principal),
      e = read.events[checkpoint.sequence - 1]
    if (
      checkpoint.schemaVersion !== 2 ||
      checkpoint.classification !== 'LOCAL_SYNTHETIC_PROOF_ARTIFACT' ||
      checkpoint.orgId !== principal.orgId ||
      !e ||
      checkpoint.headDigest !== e.hash ||
      checkpoint.stateDigest !== e.stateDigest ||
      checkpoint.authoritySnapshotDigest !==
        digest(e.payload.kind === 'operation' ? e.payload.finalSnapshot : null)
    )
      reject('INTEGRITY_FAILED', 'Checkpoint mismatch or truncation')
  }
  checkpointFrom(name: string): Checkpoint {
    this.admission()
    return JSON.parse(readFileSync(boundedPath(checkpointDirectory, name), 'utf8')) as Checkpoint
  }
}
