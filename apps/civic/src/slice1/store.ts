import { DatabaseSync, type SQLOutputValue } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { authorizeRuntime, storageDirectory, checkpointDirectory } from './authorization'
import {
  genesis,
  apply,
  authenticate,
  authoritySnapshot,
  brief,
  instant,
  reject,
  type State,
  type Operation,
  type Snapshot,
} from './model'
import type { Seed, Principal } from '../kernel'

export function canonical(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input === 'string' || typeof input === 'boolean') return input
    if (typeof input === 'number' && Number.isFinite(input)) return input
    if (Array.isArray(input)) return input.map(normalize)
    if (input && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype)
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, normalize(item)]),
      )
    return reject('INVALID_INPUT', 'Canonical payload must contain finite plain JSON values')
  }
  return JSON.stringify(normalize(value))
}
export function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex')
}
type Payload =
  | { kind: 'genesis'; seed: Seed }
  | {
      kind: 'operation'
      principal: Principal
      operation: Operation
      snapshot: Snapshot
      admittedSnapshot: Snapshot
    }
export interface Event {
  orgId: string
  sequence: number
  commandKey: string
  recordedAt: string
  effectiveAt: string
  previousHash: string | null
  payload: Payload
  stateDigest: string
  hash: string
}
export interface Checkpoint {
  classification: 'LOCAL_SYNTHETIC_PROOF_ARTIFACT'
  checkpointId: string
  syntheticInstitution: string
  proofStage: string
  position: number
  stateDigest: string
  authoritySnapshotDigest: string
  auditHead: string
  createdAt: string
  proofScenarioId: string
  formatVersion: 1
}
function stringColumn(row: Record<string, SQLOutputValue>, key: string): string {
  const value = row[key]
  if (typeof value !== 'string') reject('INTEGRITY_FAILED', `Invalid ${key} column`)
  return value
}
function sequenceColumn(row: Record<string, SQLOutputValue>): number {
  const value = row.sequence
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    reject('INTEGRITY_FAILED', 'Invalid event sequence')
  return value
}
function parseEvent(row: Record<string, SQLOutputValue>): Event {
  const text = stringColumn(row, 'envelope')
  let value: Event
  try {
    value = JSON.parse(text)
  } catch (error) {
    return reject('INTEGRITY_FAILED', `Invalid journal JSON: ${String(error)}`)
  }
  if (
    value.orgId !== stringColumn(row, 'org_id') ||
    value.sequence !== sequenceColumn(row) ||
    value.commandKey !== stringColumn(row, 'command_key') ||
    digestWithoutHash(value) !== stringColumn(row, 'hash') ||
    value.hash !== row.hash
  )
    reject('INTEGRITY_FAILED', 'Event binding or hash mismatch')
  if (
    value.payload.kind !== 'genesis' &&
    (value.payload.kind !== 'operation' ||
      !value.payload.admittedSnapshot ||
      !value.payload.snapshot)
  )
    reject('INTEGRITY_FAILED', 'Unsupported journal authority snapshot version')
  return value
}
function digestWithoutHash(event: Event): string {
  const { hash: _hash, ...material } = event
  return digest(material)
}
function orgIdentifier(value: string): void {
  if (!/^SYN-[AB]-ORG$/.test(value))
    reject('SYNTHETIC_SCOPE_INVALID', 'Only fictional A/B institutions')
}

export class DurableCivic {
  private readonly db: DatabaseSync
  private closed = false
  readonly file: string

  constructor(name: string) {
    authorizeRuntime()
    if (!/^[a-z0-9-]+\.sqlite$/.test(name))
      reject('STORAGE_PATH_INVALID', 'Bounded local filename required')
    this.file = join(storageDirectory, name)
    if (
      existsSync(this.file) &&
      (!lstatSync(this.file).isFile() || lstatSync(this.file).isSymbolicLink())
    )
      reject('STORAGE_PATH_INVALID', 'Regular local database required')
    this.db = new DatabaseSync(this.file, { timeout: 5000 })
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
    if (
      tables.length &&
      (tables.some(
        (row) => !['journals', 'heads', 'receipts', 'decisions'].includes(String(row.name)),
      ) ||
        !['journals', 'heads', 'receipts', 'decisions'].every((name) =>
          tables.some((row) => row.name === name),
        ))
    ) {
      this.db.close()
      reject(
        'CIVIC_SLICE_1_STORAGE_COLLISION',
        'Existing file is not the bounded CIVIC proof schema',
      )
    }
    this.db.exec(`
      PRAGMA foreign_keys=ON;
      PRAGMA journal_mode=DELETE;
      PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS journals (
        org_id TEXT NOT NULL CHECK(org_id IN ('SYN-A-ORG','SYN-B-ORG')),
        sequence INTEGER NOT NULL CHECK(sequence>0),
        command_key TEXT NOT NULL,
        envelope TEXT NOT NULL, hash TEXT NOT NULL,
        PRIMARY KEY(org_id,sequence), UNIQUE(org_id,command_key));
      CREATE TABLE IF NOT EXISTS heads (
        org_id TEXT PRIMARY KEY, sequence INTEGER NOT NULL, hash TEXT NOT NULL, state TEXT NOT NULL,
        FOREIGN KEY(org_id,sequence) REFERENCES journals(org_id,sequence));
      CREATE TABLE IF NOT EXISTS receipts (
        org_id TEXT NOT NULL, operation TEXT NOT NULL, key TEXT NOT NULL, request_hash TEXT NOT NULL,
        sequence INTEGER NOT NULL, result TEXT NOT NULL,
        PRIMARY KEY(org_id,operation,key),
        FOREIGN KEY(org_id,sequence) REFERENCES journals(org_id,sequence));
      CREATE TABLE IF NOT EXISTS decisions (
        org_id TEXT NOT NULL, id TEXT NOT NULL, sequence INTEGER NOT NULL,
        supersedes TEXT, record TEXT NOT NULL,
        PRIMARY KEY(org_id,id),
        FOREIGN KEY(org_id,sequence) REFERENCES journals(org_id,sequence),
        FOREIGN KEY(org_id,supersedes) REFERENCES decisions(org_id,id));
      CREATE TRIGGER IF NOT EXISTS journal_no_update BEFORE UPDATE ON journals BEGIN
        SELECT RAISE(ABORT,'immutable institutional journal'); END;
      CREATE TRIGGER IF NOT EXISTS journal_no_delete BEFORE DELETE ON journals BEGIN
        SELECT RAISE(ABORT,'immutable institutional journal'); END;
      CREATE TRIGGER IF NOT EXISTS receipt_no_update BEFORE UPDATE ON receipts BEGIN
        SELECT RAISE(ABORT,'immutable command receipt'); END;
      CREATE TRIGGER IF NOT EXISTS receipt_no_delete BEFORE DELETE ON receipts BEGIN
        SELECT RAISE(ABORT,'immutable command receipt'); END;
      CREATE TRIGGER IF NOT EXISTS decision_no_update BEFORE UPDATE ON decisions BEGIN
        SELECT RAISE(ABORT,'immutable consequential decision'); END;
      CREATE TRIGGER IF NOT EXISTS decision_no_delete BEFORE DELETE ON decisions BEGIN
        SELECT RAISE(ABORT,'immutable consequential decision'); END;
    `)
  }
  close(): void {
    if (!this.closed) {
      this.db.close()
      this.closed = true
    }
  }
  private admission(): void {
    if (this.closed) reject('STORAGE_CLOSED', 'Database instance closed')
    authorizeRuntime()
  }
  private transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = action()
      authorizeRuntime()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
  private events(orgId: string): Event[] {
    orgIdentifier(orgId)
    return this.db
      .prepare('SELECT * FROM journals WHERE org_id=? ORDER BY sequence')
      .all(orgId)
      .map(parseEvent)
  }
  private rebuild(
    orgId: string,
    cutoff?: number,
    effectiveAt?: string,
  ): { state: State; events: Event[] } {
    const events = this.events(orgId)
    if (!events.length) reject('NOT_FOUND', 'Institution unavailable')
    let state: State | undefined
    let known: State | undefined
    let previous: string | null = null
    for (const [index, event] of events.entries()) {
      if (
        event.sequence !== index + 1 ||
        event.previousHash !== previous ||
        event.orgId !== orgId ||
        (event.payload.kind === 'genesis' && index !== 0)
      )
        reject('INTEGRITY_FAILED', 'Missing/reordered predecessor or institutional scope mismatch')
      instant(event.recordedAt)
      instant(event.effectiveAt)
      if (event.payload.kind === 'genesis') state = genesis(event.payload.seed)
      else {
        if (!state) reject('INTEGRITY_FAILED', 'Missing genesis')
        const admitted = authoritySnapshot(
          state,
          event.payload.principal,
          event.payload.admittedSnapshot.evaluatedAt,
          this.action(event.payload.operation),
        )
        if (digest(admitted) !== digest(event.payload.admittedSnapshot))
          reject('INTEGRITY_FAILED', 'Admission-time authority snapshot mismatch')
        const replay = apply(state, event.payload.principal, event.payload.operation)
        if (digest(replay.snapshot) !== digest(event.payload.snapshot))
          reject('INTEGRITY_FAILED', 'Decision-time authority snapshot mismatch')
        state = replay.state
      }
      if (!state || state.seed.institution.id !== orgId || digest(state) !== event.stateDigest)
        reject('INTEGRITY_FAILED', 'Reconstructed state digest mismatch')
      if (
        (cutoff === undefined || event.sequence <= cutoff) &&
        (effectiveAt === undefined || instant(event.effectiveAt) <= instant(effectiveAt))
      )
        known = structuredClone(state)
      previous = event.hash
    }
    const head = this.db.prepare('SELECT * FROM heads WHERE org_id=?').get(orgId)
    if (
      !head ||
      head.sequence !== events.length ||
      head.hash !== previous ||
      head.state !== canonical(state)
    )
      reject('INTEGRITY_FAILED', 'Projection/head mismatch')
    // Receipts and consequential records are checked against their journal origin.
    const receipts = this.db.prepare('SELECT * FROM receipts WHERE org_id=?').all(orgId)
    if (receipts.length !== events.length) reject('INTEGRITY_FAILED', 'Receipt history incomplete')
    for (const receipt of receipts) {
      const event = events.find((e) => e.sequence === receipt.sequence)
      if (
        !event ||
        event.commandKey !== canonical([receipt.operation, receipt.key]) ||
        receipt.result !==
          canonical({ sequence: event.sequence, stateDigest: event.stateDigest, hash: event.hash })
      )
        reject('INTEGRITY_FAILED', 'Receipt binding mismatch')
      const expectedRequest =
        event.payload.kind === 'genesis'
          ? digest(event.payload.seed)
          : digest({ principal: event.payload.principal, operation: event.payload.operation })
      if (receipt.request_hash !== expectedRequest)
        reject('INTEGRITY_FAILED', 'Receipt request mismatch')
    }
    const decisions = this.db
      .prepare('SELECT * FROM decisions WHERE org_id=? ORDER BY sequence')
      .all(orgId)
    if (
      !state ||
      decisions.length !== state.decisions.length ||
      decisions.some(
        (row, i) =>
          row.record !== canonical(state!.decisions[i]) ||
          row.id !== state!.decisions[i].id ||
          row.supersedes !== state!.decisions[i].supersedes,
      )
    )
      reject('INTEGRITY_FAILED', 'Decision history mismatch')
    if (!known) reject('NOT_FOUND', 'No state known at this cutoff')
    this.verifyCheckpointPrefix(orgId, events)
    return { state: known, events }
  }
  private append(
    orgId: string,
    kind: string,
    key: string,
    requestHash: string,
    payload: Payload,
    state: State,
    effectiveAt: string,
  ) {
    const head = this.db.prepare('SELECT sequence,hash FROM heads WHERE org_id=?').get(orgId)
    const sequence = head ? Number(head.sequence) + 1 : 1
    const previousHash = head ? stringColumn(head, 'hash') : null
    const material = {
      orgId,
      sequence,
      commandKey: canonical([kind, key]),
      recordedAt: new Date().toISOString(),
      effectiveAt,
      previousHash,
      payload,
      stateDigest: digest(state),
    }
    const event: Event = { ...material, hash: digest(material) }
    const result = { sequence, stateDigest: event.stateDigest, hash: event.hash }
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
      .run(orgId, kind, key, requestHash, sequence, canonical(result))
    if (payload.kind === 'operation' && payload.operation.kind === 'decision') {
      const decision = state.decisions.at(-1)!
      this.db
        .prepare('INSERT INTO decisions VALUES (?,?,?,?,?)')
        .run(orgId, decision.id, sequence, decision.supersedes, canonical(decision))
    }
    return result
  }
  create(seed: Seed, key: string) {
    this.admission()
    const state = genesis(seed),
      orgId = seed.institution.id
    orgIdentifier(orgId)
    this.key(key)
    return this.transaction(() => {
      const prior = this.db
        .prepare(
          'SELECT request_hash,result FROM receipts WHERE org_id=? AND operation=? AND key=?',
        )
        .get(orgId, 'genesis', key)
      if (prior) {
        this.rebuild(orgId)
        if (prior.request_hash !== digest(seed))
          reject('IDEMPOTENCY_CONFLICT', 'Genesis payload differs')
        return JSON.parse(stringColumn(prior, 'result')) as {
          sequence: number
          stateDigest: string
          hash: string
        }
      }
      if (this.db.prepare('SELECT org_id FROM heads WHERE org_id=?').get(orgId))
        reject('INVALID_WORKFLOW_STATE', 'Institution genesis exists')
      return this.append(
        orgId,
        'genesis',
        key,
        digest(seed),
        { kind: 'genesis', seed },
        state,
        '2026-01-01T00:00:00Z',
      )
    })
  }
  private key(key: string): void {
    if (!/^[A-Za-z0-9-]{1,100}$/.test(key))
      reject('INVALID_INPUT', 'Bounded idempotency key required')
  }
  private action(operation: Operation) {
    return operation.kind === 'decision'
      ? ('decide' as const)
      : ['revoke', 'membership', 'configuration'].includes(operation.kind)
        ? ('grant_authority' as const)
        : operation.kind === 'authorize'
          ? ('authorize_intervention' as const)
          : ('record_evidence' as const)
  }
  submit(
    principal: Principal,
    operation: Operation,
    key: string,
    expectedVersion: number,
    fault?: 'before-append' | 'after-append' | (() => void),
  ) {
    this.admission()
    this.key(key)
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
      reject('INVALID_INPUT', 'Expected version required')
    return this.transaction(() => {
      const { state, events } = this.rebuild(principal.orgId)
      const admittedSnapshot = authoritySnapshot(
        state,
        principal,
        new Date().toISOString(),
        this.action(operation),
      )
      authoritySnapshot(state, principal, operation.at, this.action(operation))
      const hash = digest({ principal, operation })
      const prior = this.db
        .prepare(
          'SELECT request_hash,result FROM receipts WHERE org_id=? AND operation=? AND key=?',
        )
        .get(principal.orgId, operation.kind, key)
      if (prior) {
        if (prior.request_hash !== hash)
          reject('IDEMPOTENCY_CONFLICT', 'Same key, different request')
        return {
          ...(JSON.parse(stringColumn(prior, 'result')) as {
            sequence: number
            stateDigest: string
            hash: string
          }),
          replay: true,
        }
      }
      if (events.length !== expectedVersion)
        reject('STALE_STATE', 'Reload state before a consequential write')
      const lastTime = events.filter((e) => e.payload.kind === 'operation').at(-1)?.effectiveAt
      if (lastTime && instant(operation.at) < instant(lastTime))
        reject('STALE_TEMPORAL_WRITE', 'Operational event time cannot rewrite prior transitions')
      const changed = apply(state, principal, operation)
      if (fault === 'before-append') reject('INJECTED_FAILURE', 'Before atomic append')
      const result = this.append(
        principal.orgId,
        operation.kind,
        key,
        hash,
        { kind: 'operation', principal, operation, snapshot: changed.snapshot, admittedSnapshot },
        changed.state,
        operation.at,
      )
      if (fault === 'after-append') reject('INJECTED_FAILURE', 'After append but before commit')
      if (typeof fault === 'function') fault()
      return { ...result, replay: false }
    })
  }
  read(principal: Principal, cutoff?: number, effectiveAt?: string) {
    this.admission()
    if (cutoff !== undefined && (!Number.isSafeInteger(cutoff) || cutoff < 1))
      reject('INVALID_INPUT', 'Positive known-at sequence required')
    if (effectiveAt !== undefined) instant(effectiveAt)
    this.db.exec('BEGIN')
    try {
      const current = this.rebuild(principal.orgId)
      authenticate(current.state, principal, new Date().toISOString())
      const reconstructed = this.rebuild(principal.orgId, cutoff, effectiveAt)
      this.verifyCheckpointPrefix(principal.orgId, current.events)
      this.db.exec('COMMIT')
      return {
        state: reconstructed.state,
        version: current.events.length,
        events: current.events,
        brief: brief(reconstructed.state, effectiveAt ?? current.events.at(-1)!.effectiveAt),
      }
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
  private checkpointPath(orgId: string): string {
    orgIdentifier(orgId)
    return join(checkpointDirectory, `${this.file.split(/[\\/]/).at(-1)}-${orgId}-checkpoint.json`)
  }
  private verifyCheckpointPrefix(orgId: string, events: Event[]): void {
    const path = this.checkpointPath(orgId)
    if (!existsSync(path)) return
    if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
      reject('INTEGRITY_FAILED', 'Checkpoint must be regular local file')
    const checkpoint: Checkpoint = JSON.parse(readFileSync(path, 'utf8'))
    const event = events.find((e) => e.sequence === checkpoint.position)
    if (
      checkpoint.classification !== 'LOCAL_SYNTHETIC_PROOF_ARTIFACT' ||
      checkpoint.syntheticInstitution !== orgId ||
      !event ||
      checkpoint.auditHead !== event.hash ||
      checkpoint.stateDigest !== event.stateDigest
    )
      reject('INTEGRITY_FAILED', 'Checkpoint-relative truncation/rewrite detected')
    const authority = event.payload.kind === 'operation' ? event.payload.snapshot : null
    if (checkpoint.authoritySnapshotDigest !== digest(authority))
      reject('INTEGRITY_FAILED', 'Checkpoint authority digest differs')
  }
  checkpoint(principal: Principal, stage: string, scenarioId: string): Checkpoint {
    const read = this.read(principal)
    if (!/^[a-z0-9-]+$/.test(stage) || !/^SYN-[A-Z0-9-]+$/.test(scenarioId))
      reject('INVALID_INPUT', 'Synthetic bounded checkpoint metadata required')
    const last = read.events.at(-1)!
    const checkpoint: Checkpoint = {
      classification: 'LOCAL_SYNTHETIC_PROOF_ARTIFACT',
      checkpointId: `${scenarioId}-${last.sequence}`,
      syntheticInstitution: principal.orgId,
      proofStage: stage,
      position: last.sequence,
      stateDigest: digest(read.state),
      authoritySnapshotDigest: digest(
        last.payload.kind === 'operation' ? last.payload.snapshot : null,
      ),
      auditHead: last.hash,
      createdAt: new Date().toISOString(),
      proofScenarioId: scenarioId,
      formatVersion: 1,
    }
    const path = this.checkpointPath(principal.orgId)
    if (existsSync(path))
      reject('CHECKPOINT_EXISTS', 'Do not overwrite a retained proof checkpoint')
    authorizeRuntime()
    writeFileSync(path, canonical(checkpoint) + '\n', { flag: 'wx' })
    return checkpoint
  }
}
