/**
 * Durable inbound case execution (INT-01..16).
 *
 * authorized source -> tenant binding -> claim -> versioned mapping -> schema validation -> identity reconciliation ->
 * case write, identity link, mandatory audit, authoritative receipt and outbox event in ONE transaction -> publication
 * after commit (inbound-outbox.ts).
 *
 * The claim is a database fact, not a check followed by a later record: INSERT ... ON CONFLICT DO NOTHING on the unique
 * (organization, source, idempotency key) of ue_integration_inbound_receipts. Of two workers inserting the same key,
 * exactly one gets the row; the other observes it. Each claim carries a fencing token and a lease. The domain write and
 * the receipt's completion commit together and are fenced on the token, so:
 *   - a claimed receipt never has a committed effect: when its lease runs out (the worker died, or its transaction failed
 *     and it could not record why), the next delivery takes it over with a new token and runs it again;
 *   - a worker whose lease was taken over cannot complete: its fenced statements find no row and it rolls back;
 *   - a replay returns the persisted status (completed, rejected, quarantined, failed, or still claimed), never a success
 *     it did not record.
 *
 * Every statement runs through `inTenantTx`, which opens one transaction bound to the organization (row-level security
 * on the tenant runtime role in production: withRLSContext). The organization therefore never comes from the payload.
 * Nothing here is reachable from an HTTP route yet.
 */
import { createHash, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { MappingRuleDefinition } from '@nzila/platform-integrations-types'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import type { CanonicalAuditEntry } from '@/lib/audit/canonical-audit-chain'
import { validateInboundCase, type InboundCase } from './inbound-case-contract'
import { applyInboundMapping } from './inbound-mapping'
import { redactFailure, type RedactedFailure } from './redaction'

export const INBOUND_ACTOR = 'system:integration-inbound'
export const CASE_ENTITY = 'case'
export const MEMBER_ENTITY = 'member'
export const CASE_COMPLETED_EVENT = 'integration.inbound.case_completed'

export type InTenantTx = <T>(organizationId: string, work: (tx: RLSTx) => Promise<T>) => Promise<T>

export interface InboundDelivery {
  readonly organizationId: string
  readonly sourceKey: string
  readonly idempotencyKey: string
  readonly sourceSchemaVersion: string
  readonly payload: Record<string, unknown>
}

export type ReceiptStatus = 'claimed' | 'completed' | 'rejected' | 'quarantined' | 'failed'

/** What the caller is told. `persisted` is true only when it reads a receipt row that exists. */
export type InboundOutcome =
  | { readonly kind: 'denied'; readonly code: 'SOURCE_NOT_AUTHORIZED' | 'SOURCE_REVOKED' | 'MAPPING_NOT_PUBLISHED' | 'INVALID_DELIVERY'; readonly persisted: false }
  | { readonly kind: 'conflict'; readonly code: 'IDEMPOTENCY_KEY_REUSED'; readonly receiptId: string; readonly persisted: true }
  | {
      readonly kind: 'receipt'
      readonly receiptId: string
      readonly status: ReceiptStatus
      readonly replayed: boolean
      readonly caseId: string | null
      readonly effect: 'created' | 'existing' | null
      readonly reasonCode: string | null
      readonly retryable: boolean
      readonly persisted: true
    }

export interface DurableInboundOptions {
  readonly inTenantTx: InTenantTx
  readonly leaseMs?: number
  readonly maxAttempts?: number
  readonly now?: () => Date
  /** Fault injection for tests only: runs inside the work transaction, after the case write, before the audit. */
  readonly beforeAudit?: (tx: RLSTx) => Promise<void>
}

interface ReceiptRow {
  id: string
  source_id: string
  payload_digest: string
  mapping_version: number
  status: ReceiptStatus
  claim_token: string
  lease_expired: boolean
  attempts: number
  retryable: boolean
  reason_code: string | null
  effect: 'created' | 'existing' | null
  case_id: string | null
}

interface MappingRow {
  version: number
  source_schema_version: string
  rule: MappingRuleDefinition
}

interface Owned {
  organizationId: string
  receipt: ReceiptRow
  token: string
  mapping: MappingRow
  sourceId: string
}

class FencedOut extends Error {
  constructor() {
    super('UE_INTEGRATION_CLAIM_FENCED')
  }
}

class StepFailure extends Error {
  constructor(readonly code: string, readonly original: unknown) {
    super(code)
  }
}

type Settlement =
  | { status: 'completed'; caseId: string; linkId: string; effect: 'created' | 'existing' }
  | { status: 'rejected' | 'quarantined'; failure: RedactedFailure }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  const rows = (result as { rows?: unknown } | null)?.rows
  return Array.isArray(rows) ? (rows as T[]) : []
}

/** Key order never changes the digest: the same event is the same payload however it was serialized. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

function caseNumber(organizationId: string, sourceId: string, externalCaseId: string): string {
  return `INT-${sha256(`${organizationId}|${sourceId}|${externalCaseId}`).slice(0, 16)}`
}

const RECEIPT_COLUMNS = sql`id::text, source_id::text, payload_digest, mapping_version, status, claim_token::text,
  (lease_expires_at < now()) AS lease_expired, attempts, retryable, reason_code, effect, case_id::text`

export class DurableInboundCaseExecutor {
  private readonly inTenantTx: InTenantTx
  private readonly leaseMs: number
  private readonly maxAttempts: number
  private readonly now: () => Date
  private readonly beforeAudit?: (tx: RLSTx) => Promise<void>

  constructor(options: DurableInboundOptions) {
    this.inTenantTx = options.inTenantTx
    this.leaseMs = options.leaseMs ?? 120_000
    this.maxAttempts = options.maxAttempts ?? 5
    this.now = options.now ?? (() => new Date())
    this.beforeAudit = options.beforeAudit
  }

  async execute(delivery: InboundDelivery): Promise<InboundOutcome> {
    if (!UUID.test(delivery.organizationId) || !delivery.sourceKey?.trim() || !delivery.idempotencyKey?.trim()
        || delivery.idempotencyKey.length > 255 || !delivery.sourceSchemaVersion?.trim()
        || !delivery.payload || typeof delivery.payload !== 'object' || Array.isArray(delivery.payload)) {
      return { kind: 'denied', code: 'INVALID_DELIVERY', persisted: false }
    }
    const digest = sha256(canonicalJson(delivery.payload))
    const claim = await this.claim(delivery, digest)
    if ('kind' in claim) return claim
    return this.run(delivery, claim)
  }

  // ─── Claim: insert-or-observe, then (for an observed receipt) fenced takeover ─────────────────────────────────────────

  private async claim(delivery: InboundDelivery, digest: string): Promise<Owned | InboundOutcome> {
    return this.inTenantTx(delivery.organizationId, async (tx) => {
      const [source] = rowsOf<{ id: string; status: string }>(await tx.execute(sql`
        SELECT id::text, status FROM ue_integration_sources
        WHERE organization_id = ${delivery.organizationId}::uuid AND source_key = ${delivery.sourceKey}`))
      // Under row-level security another organization's source is not visible: it is "not authorized", not "elsewhere".
      if (!source) return { kind: 'denied', code: 'SOURCE_NOT_AUTHORIZED', persisted: false } as const

      const existing = await this.readReceipt(tx, delivery, source.id)
      if (existing) return this.observe(tx, delivery, digest, existing, source)
      if (source.status !== 'active') return { kind: 'denied', code: 'SOURCE_REVOKED', persisted: false } as const

      const [mapping] = rowsOf<MappingRow>(await tx.execute(sql`
        SELECT version, source_schema_version, rule FROM ue_integration_mapping_versions
        WHERE organization_id = ${delivery.organizationId}::uuid AND source_id = ${source.id}::uuid
        ORDER BY version DESC LIMIT 1`))
      if (!mapping) return { kind: 'denied', code: 'MAPPING_NOT_PUBLISHED', persisted: false } as const

      const token = randomUUID()
      const [inserted] = rowsOf<ReceiptRow>(await tx.execute(sql`
        INSERT INTO ue_integration_inbound_receipts
          (organization_id, source_id, idempotency_key, payload_digest, mapping_version, status, claim_token, lease_expires_at)
        VALUES (${delivery.organizationId}::uuid, ${source.id}::uuid, ${delivery.idempotencyKey}, ${digest}, ${mapping.version},
          'claimed', ${token}::uuid, now() + ${`${this.leaseMs} milliseconds`}::interval)
        ON CONFLICT (organization_id, source_id, idempotency_key) DO NOTHING
        RETURNING ${RECEIPT_COLUMNS}`))
      if (inserted) return { organizationId: delivery.organizationId, receipt: inserted, token, mapping, sourceId: source.id }

      // Another worker's claim committed between our read and our insert (the insert waited for it): observe it.
      const raced = await this.readReceipt(tx, delivery, source.id)
      if (!raced) throw new Error('UE_INTEGRATION_CLAIM_NOT_OBSERVABLE')
      return this.observe(tx, delivery, digest, raced, source)
    })
  }

  private async readReceipt(tx: RLSTx, delivery: InboundDelivery, sourceId: string): Promise<ReceiptRow | undefined> {
    return rowsOf<ReceiptRow>(await tx.execute(sql`
      SELECT ${RECEIPT_COLUMNS} FROM ue_integration_inbound_receipts
      WHERE organization_id = ${delivery.organizationId}::uuid AND source_id = ${sourceId}::uuid
        AND idempotency_key = ${delivery.idempotencyKey}`))[0]
  }

  private async observe(
    tx: RLSTx,
    delivery: InboundDelivery,
    digest: string,
    receipt: ReceiptRow,
    source: { id: string; status: string },
  ): Promise<Owned | InboundOutcome> {
    // The same key with a different payload is a different event: it is never treated as a replay of the first.
    if (receipt.payload_digest !== digest) return { kind: 'conflict', code: 'IDEMPOTENCY_KEY_REUSED', receiptId: receipt.id, persisted: true }
    const takeover = receipt.status === 'claimed' ? receipt.lease_expired
      : receipt.status === 'failed' && receipt.retryable && receipt.attempts < this.maxAttempts
    if (!takeover) return replay(receipt)
    if (source.status !== 'active') return { kind: 'denied', code: 'SOURCE_REVOKED', persisted: false }

    const token = randomUUID()
    // Fenced on the token we observed: of two workers taking over the same receipt, one updates it and the other finds
    // no row (the row lock serializes them; the second re-checks the predicate against the first's committed token).
    const [taken] = rowsOf<ReceiptRow>(await tx.execute(sql`
      UPDATE ue_integration_inbound_receipts
      SET status = 'claimed', claim_token = ${token}::uuid, lease_expires_at = now() + ${`${this.leaseMs} milliseconds`}::interval,
          attempts = attempts + 1, retryable = false, reason_code = NULL, reason_detail = NULL, finished_at = NULL
      WHERE id = ${receipt.id}::uuid AND claim_token = ${receipt.claim_token}::uuid AND status = ${receipt.status}
        AND (status = 'failed' OR lease_expires_at < now())
      RETURNING ${RECEIPT_COLUMNS}`))
    if (!taken) {
      const current = await this.readReceipt(tx, delivery, source.id)
      return replay(current ?? receipt)
    }
    // A retry runs the mapping version the receipt pinned, not whatever is newest now: replay is deterministic.
    const [mapping] = rowsOf<MappingRow>(await tx.execute(sql`
      SELECT version, source_schema_version, rule FROM ue_integration_mapping_versions
      WHERE organization_id = ${delivery.organizationId}::uuid AND source_id = ${source.id}::uuid AND version = ${taken.mapping_version}`))
    if (!mapping) throw new Error('UE_INTEGRATION_MAPPING_VERSION_UNKNOWN')
    return { organizationId: delivery.organizationId, receipt: taken, token, mapping, sourceId: source.id }
  }

  // ─── Work ────────────────────────────────────────────────────────────────────────────────────────────────────────────

  private async run(delivery: InboundDelivery, owned: Owned): Promise<InboundOutcome> {
    const prepared = await this.prepare(delivery, owned)
    try {
      const settlement = await this.inTenantTx(delivery.organizationId, (tx) =>
        'failure' in prepared ? this.settleUnsuccessful(tx, owned, 'rejected', prepared.failure) : this.write(tx, delivery, owned, prepared.value))
      return {
        kind: 'receipt', receiptId: owned.receipt.id, status: settlement.status, replayed: false,
        caseId: settlement.status === 'completed' ? settlement.caseId : null,
        effect: settlement.status === 'completed' ? settlement.effect : null,
        reasonCode: settlement.status === 'completed' ? null : settlement.failure.code,
        retryable: false, persisted: true,
      }
    } catch (error) {
      if (error instanceof FencedOut) return this.current(delivery, owned)
      const code = error instanceof StepFailure ? error.code : 'PERSISTENCE_FAILED'
      const failure = redactFailure(code, error instanceof StepFailure ? error.original : error)
      const retryable = owned.receipt.attempts < this.maxAttempts
      try {
        const [failed] = rowsOf<{ id: string }>(await this.inTenantTx(delivery.organizationId, (tx) => tx.execute(sql`
          UPDATE ue_integration_inbound_receipts
          SET status = 'failed', retryable = ${retryable}, reason_code = ${failure.code}, reason_detail = ${JSON.stringify(failure)}::jsonb,
              finished_at = now()
          WHERE id = ${owned.receipt.id}::uuid AND claim_token = ${owned.token}::uuid AND status = 'claimed'
          RETURNING id::text`)))
        if (!failed) return this.current(delivery, owned)
      } catch {
        // The failure could not be recorded either: the receipt stays claimed and its lease expiry hands it to the next delivery.
        return this.current(delivery, owned)
      }
      return {
        kind: 'receipt', receiptId: owned.receipt.id, status: 'failed', replayed: false, caseId: null, effect: null,
        reasonCode: failure.code, retryable, persisted: true,
      }
    }
  }

  /** Mapping and validation need no database: their outcome is decided before the work transaction opens. */
  private async prepare(delivery: InboundDelivery, owned: Owned): Promise<{ value: InboundCase } | { failure: RedactedFailure }> {
    if (delivery.sourceSchemaVersion !== owned.mapping.source_schema_version) return { failure: redactFailure('SCHEMA_VERSION_DRIFT') }
    const result = applyInboundMapping(delivery.payload, owned.mapping.rule)
    if (!result.success || !result.data) return { failure: redactFailure('MAPPING_REJECTED', undefined, result.errors.map((e) => `${e.field}:${e.code}`)) }
    const mapped = result.data
    const checked = validateInboundCase(mapped, this.now())
    if (!checked.ok) return { failure: redactFailure('SCHEMA_REJECTED', undefined, checked.issues.map((i) => `${i.field}:${i.code}`)) }
    return { value: checked.value }
  }

  private async fence(tx: RLSTx, owned: Owned): Promise<void> {
    const [held] = rowsOf<{ id: string }>(await tx.execute(sql`
      SELECT id::text FROM ue_integration_inbound_receipts
      WHERE id = ${owned.receipt.id}::uuid AND claim_token = ${owned.token}::uuid AND status = 'claimed'
      FOR UPDATE`))
    if (!held) throw new FencedOut()
  }

  private async settleUnsuccessful(tx: RLSTx, owned: Owned, status: 'rejected' | 'quarantined', failure: RedactedFailure): Promise<Settlement> {
    await this.fence(tx, owned)
    await step('AUDIT_WRITE_FAILED', () => persistAtomicAudit(tx,
      this.auditEntry(owned, `integration.inbound.${status}`, null, { reasonCode: failure.code }), 'failure'))
    await this.complete(tx, owned, sql`status = ${status}, reason_code = ${failure.code}, reason_detail = ${JSON.stringify(failure)}::jsonb`)
    return { status, failure }
  }

  private async write(tx: RLSTx, delivery: InboundDelivery, owned: Owned, value: InboundCase): Promise<Settlement> {
    await this.fence(tx, owned)
    // Revocation and this write cannot interleave: revoking updates the source row, which this share lock holds.
    const [source] = rowsOf<{ status: string; source_key: string }>(await tx.execute(sql`
      SELECT status, source_key FROM ue_integration_sources WHERE id = ${owned.sourceId}::uuid FOR SHARE`))
    if (!source || source.status !== 'active') return this.settleUnsuccessful(tx, owned, 'rejected', redactFailure('SOURCE_REVOKED'))

    const org = delivery.organizationId
    const [link] = rowsOf<{ id: string; internal_id: string; stale: boolean }>(await tx.execute(sql`
      SELECT id::text, internal_id::text, stale_at IS NOT NULL AS stale FROM ue_integration_identity_links
      WHERE organization_id = ${org}::uuid AND source_id = ${owned.sourceId}::uuid AND entity_type = ${CASE_ENTITY}
        AND external_id = ${value.externalCaseId}
      FOR UPDATE`))

    let caseId: string
    let linkId: string
    let effect: 'created' | 'existing'
    if (link) {
      // A known external case resolves to its case; a stale link or a missing case is never silently relinked.
      if (link.stale) return this.settleUnsuccessful(tx, owned, 'quarantined', redactFailure('IDENTITY_LINK_STALE'))
      const [target] = rowsOf<{ id: string }>(await tx.execute(sql`
        SELECT id::text FROM grievances WHERE id = ${link.internal_id}::uuid AND organization_id = ${org}::uuid`))
      if (!target) return this.settleUnsuccessful(tx, owned, 'quarantined', redactFailure('IDENTITY_TARGET_MISSING'))
      caseId = target.id
      linkId = link.id
      effect = 'existing'
    } else {
      let grievantId: string | null = null
      if (value.memberExternalId) {
        const [member] = rowsOf<{ internal_id: string; stale: boolean }>(await tx.execute(sql`
          SELECT internal_id::text, stale_at IS NOT NULL AS stale FROM ue_integration_identity_links
          WHERE organization_id = ${org}::uuid AND source_id = ${owned.sourceId}::uuid AND entity_type = ${MEMBER_ENTITY}
            AND external_id = ${value.memberExternalId}`))
        // A member is resolved through a governed identity link or not at all: never by name, e-mail or a raw id.
        if (!member || member.stale) return this.settleUnsuccessful(tx, owned, 'quarantined', redactFailure('MEMBER_IDENTITY_UNRESOLVED', undefined, ['memberExternalId']))
        grievantId = member.internal_id
      }
      const created = await step('DOMAIN_WRITE_FAILED', () => tx.execute(sql`
        INSERT INTO grievances (
          grievance_number, external_case_id, source_system, organization_id, type, status, priority,
          title, description, grievant_id, filed_date, created_at, updated_at
        ) VALUES (
          ${caseNumber(org, owned.sourceId, value.externalCaseId)}, ${value.externalCaseId}, ${source.source_key}, ${org}::uuid,
          ${value.type}, 'filed', ${value.priority}, ${value.title}, ${value.description}, ${grievantId}::uuid,
          ${value.filedDate}::timestamptz, now(), now()
        )
        ON CONFLICT DO NOTHING
        RETURNING id::text`))
      const [row] = rowsOf<{ id: string }>(created)
      // A case with this source and external id that no link names (an earlier batch import, a manual entry) is not
      // taken over: it needs an approved reconciliation.
      if (!row) return this.settleUnsuccessful(tx, owned, 'quarantined', redactFailure('UNLINKED_ENTITY_EXISTS'))
      caseId = row.id
      const [newLink] = rowsOf<{ id: string }>(await step('IDENTITY_LINK_FAILED', () => tx.execute(sql`
        INSERT INTO ue_integration_identity_links (organization_id, source_id, entity_type, external_id, internal_id, created_by_receipt_id)
        VALUES (${org}::uuid, ${owned.sourceId}::uuid, ${CASE_ENTITY}, ${value.externalCaseId}, ${caseId}::uuid, ${owned.receipt.id}::uuid)
        RETURNING id::text`)))
      linkId = newLink.id
      effect = 'created'
    }

    if (this.beforeAudit) await this.beforeAudit(tx)
    await step('AUDIT_WRITE_FAILED', () => persistAtomicAudit(tx,
      this.auditEntry(owned, effect === 'created' ? 'integration.inbound.case_created' : 'integration.inbound.case_matched', caseId, { effect, identityLinkId: linkId })))
    await this.complete(tx, owned, sql`status = 'completed', case_id = ${caseId}::uuid, identity_link_id = ${linkId}::uuid, effect = ${effect}`)
    // The event is a row in this transaction: it exists only if the case and the receipt committed, and it names
    // identifiers only, never case content.
    await step('OUTBOX_WRITE_FAILED', () => tx.execute(sql`
      INSERT INTO ue_integration_outbox (organization_id, receipt_id, event_type, payload)
      VALUES (${org}::uuid, ${owned.receipt.id}::uuid, ${CASE_COMPLETED_EVENT},
        ${JSON.stringify({ receiptId: owned.receipt.id, caseId, sourceId: owned.sourceId, effect })}::jsonb)`))
    return { status: 'completed', caseId, linkId, effect }
  }

  private auditEntry(owned: Owned, action: string, caseId: string | null, details: Record<string, unknown>): CanonicalAuditEntry {
    return {
      organizationId: owned.organizationId,
      action,
      resourceType: caseId ? 'grievance' : 'integration_inbound_receipt',
      resourceId: caseId ?? owned.receipt.id,
      userId: INBOUND_ACTOR,
      details: { receiptId: owned.receipt.id, sourceId: owned.sourceId, mappingVersion: owned.mapping.version, attempt: owned.receipt.attempts, ...details },
    }
  }

  private async complete(tx: RLSTx, owned: Owned, assignments: ReturnType<typeof sql>): Promise<void> {
    const [done] = rowsOf<{ id: string }>(await tx.execute(sql`
      UPDATE ue_integration_inbound_receipts SET ${assignments}, finished_at = now()
      WHERE id = ${owned.receipt.id}::uuid AND claim_token = ${owned.token}::uuid AND status = 'claimed'
      RETURNING id::text`))
    if (!done) throw new FencedOut()
  }

  private async current(delivery: InboundDelivery, owned: Owned): Promise<InboundOutcome> {
    const row = await this.inTenantTx(delivery.organizationId, (tx) => this.readReceipt(tx, delivery, owned.sourceId))
    return replay(row ?? owned.receipt)
  }
}

async function step<T>(code: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (error instanceof FencedOut || error instanceof StepFailure) throw error
    throw new StepFailure(code, error)
  }
}

function replay(receipt: ReceiptRow): InboundOutcome {
  return {
    kind: 'receipt', receiptId: receipt.id, status: receipt.status, replayed: true, caseId: receipt.case_id,
    effect: receipt.effect, reasonCode: receipt.reason_code, retryable: receipt.status === 'failed' && receipt.retryable, persisted: true,
  }
}
