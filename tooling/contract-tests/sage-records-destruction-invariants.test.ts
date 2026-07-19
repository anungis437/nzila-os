/**
 * Contract Test — SAGE Records Destruction Lifecycle Invariants (Phase 8B)
 *
 * These structural guards protect the closure-hardening invariants so a future
 * refactor cannot silently reopen the merge blockers that were closed in PR #645.
 *
 * Proves that:
 *   1. Migration 0044 exists and adds the durable destruction-attempt table.
 *   2. A DURABLE pre-delete attempt record is persisted BEFORE the external delete.
 *   3. An explicit point of no return (deletion_started) exists with an atomic
 *      no-active-hold check (legal-hold ⇄ execution race is closed).
 *   4. A legal hold placed after the point of no return is rejected.
 *   5. Destruction approval scope binds a canonical digest of active hold ids/versions,
 *      not only the active_hold_count.
 *   6. The storage port exposes deleteObject({storageReference,expectedContentHash,
 *      idempotencyKey}), verifyObjectPresent, and verifyObjectAbsent.
 *   7. Retention assignments carry deterministic basis-source provenance.
 *
 * @invariant SAGE-8B-1: Durable destruction-attempt record precedes external delete
 * @invariant SAGE-8B-2: Explicit point of no return + atomic no-hold check
 * @invariant SAGE-8B-3: Hold-set digest binds approval scope
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const MIGRATION_0044 = 'migrations/0044_sage_phase_8b_destruction_attempts.sql'
const RECORDS_SERVICES = 'packages/sage-core/src/records-services.ts'
const RECORDS_TYPES = 'packages/sage-core/src/records-types.ts'
const RECORDS_LIFECYCLE = 'packages/sage-core/src/records-lifecycle.ts'
const POSTGRES_REPO = 'packages/sage-core/src/postgres-repository.ts'

describe('SAGE records destruction invariants (Phase 8B closure)', () => {
  it('migration 0044 creates the durable destruction-attempt table', () => {
    expect(existsSync(join(ROOT, MIGRATION_0044))).toBe(true)
    const sql = read(MIGRATION_0044)
    expect(sql).toMatch(/create table (if not exists )?sage_export_destruction_attempt/i)
    // The attempt record must exist before the delete: it names the provider
    // idempotency key + execution owner as NOT NULL identity fields.
    expect(sql).toMatch(/provider_idempotency_key[^;]*not null/i)
    expect(sql).toMatch(/execution_owner[^;]*not null/i)
    // Row-level security is enabled on the attempt table.
    expect(sql).toMatch(/alter table sage_export_destruction_attempt enable row level security/i)
  })

  it('migration 0044 introduces the explicit point of no return', () => {
    const sql = read(MIGRATION_0044)
    expect(sql).toMatch(/deletion_started/i)
    expect(sql).toMatch(/executing_preflight/i)
    expect(sql).toMatch(/active_hold_set_digest/i)
  })

  it('the execute flow persists a durable attempt BEFORE calling the storage delete', () => {
    const src = read(RECORDS_SERVICES)
    // Scope to the main execution flow (after the crash-recovery branch, which is
    // reached via the claim step) so ordering reflects the forward path.
    const mainFlow = src.slice(src.indexOf('claimDestructionForExecution'))
    const createIdx = mainFlow.indexOf('createDestructionAttempt')
    const beginIdx = mainFlow.indexOf('beginDeletion')
    const deleteIdx = mainFlow.indexOf('storage.deleteObject')
    expect(createIdx).toBeGreaterThan(-1)
    expect(beginIdx).toBeGreaterThan(-1)
    expect(deleteIdx).toBeGreaterThan(-1)
    // Durable attempt is created, then the point of no return is crossed, then delete.
    expect(createIdx).toBeLessThan(beginIdx)
    expect(beginIdx).toBeLessThan(deleteIdx)
    // A crash-recovery branch reconstructs from the durable attempt.
    expect(src).toMatch(/getLatestDestructionAttemptByRequest/)
    expect(src).toMatch(/status === 'deletion_started'/)
  })

  it('beginDeletion performs an atomic no-active-hold check at the point of no return', () => {
    const repo = read(POSTGRES_REPO)
    const beginBlock = repo.slice(repo.indexOf('async beginDeletion'))
    // The request transitions to deletion_started only when no active hold exists.
    expect(beginBlock).toMatch(/deletion_started/)
    expect(beginBlock).toMatch(/not exists[\s\S]{0,400}sage_export_legal_hold[\s\S]{0,120}status = 'active'/i)
  })

  it('a legal hold cannot be placed after the point of no return', () => {
    const repo = read(POSTGRES_REPO)
    const holdBlock = repo.slice(repo.indexOf('async placeLegalHold'))
    // The hold insert is blocked once the request is past deletion_started/destroyed.
    expect(holdBlock).toMatch(/not exists[\s\S]{0,400}deletion_started/i)
    const services = read(RECORDS_SERVICES)
    expect(services).toMatch(/getOpenDestructionRequestForPackage/)
  })

  it('destruction approval binds the canonical active-hold-set digest, not only a count', () => {
    const services = read(RECORDS_SERVICES)
    expect(services).toMatch(/computeActiveHoldSetDigest/)
    expect(services).toMatch(/activeHoldSetDigest/)
    expect(services).toMatch(/approvedActiveHoldSetDigest/)
    const lifecycle = read(RECORDS_LIFECYCLE)
    // The digest is a stable hash of sorted active hold ids.
    expect(lifecycle).toMatch(/export function computeActiveHoldSetDigest/)
    expect(lifecycle).toMatch(/sage-active-holds:/)
  })

  it('the storage port exposes present/absent verification and an idempotent delete', () => {
    const types = read(RECORDS_TYPES)
    const portBlock = types.slice(types.indexOf('SageExportPackageStorage'))
    expect(portBlock).toMatch(/deleteObject\(/)
    expect(portBlock).toMatch(/idempotencyKey/)
    expect(portBlock).toMatch(/verifyObjectPresent\(/)
    expect(portBlock).toMatch(/verifyObjectAbsent\(/)
  })

  it('retention assignments carry deterministic basis-source provenance', () => {
    const types = read(RECORDS_TYPES)
    expect(types).toMatch(/retentionBasisSourceType/)
    expect(types).toMatch(/retentionBasisSourceId/)
    expect(types).toMatch(/retentionBasisSourceTimestamp/)
    const lifecycle = read(RECORDS_LIFECYCLE)
    // event_date + delivered_at bases require an authoritative source id.
    expect(lifecycle).toMatch(/event_date retention basis requires/i)
    expect(lifecycle).toMatch(/delivered_at retention basis requires/i)
  })
})
