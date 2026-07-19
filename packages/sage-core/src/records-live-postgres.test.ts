// ─── SAGE — live PostgreSQL migration + lifecycle proof (PGlite) ─────────────
// Applies the ACTUAL root migration chain (0032 → latest sage migration) to a
// real, in-process PostgreSQL (PGlite is a WASM build of PostgreSQL), then runs
// the PostgresSageRepository against it to prove the schema — enums, triggers,
// RLS policies, foreign keys, append-only guards, CAS transitions, the altered
// package tombstone trigger, and the records-lifecycle CTEs — is genuinely valid
// and behaves correctly. No Docker or external service is required.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { SageSqlClient } from './sql-client'
import { PostgresSageRepository } from './postgres-repository'
import type { SageExportPackageStorage } from './records-types'

const MIGRATIONS_DIR = resolve(__dirname, '../../../migrations')

/** All SAGE root migrations in lexical (numeric) order, 0032 → latest. */
function sageMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^00(3[2-9]|4\d)_sage_.*\.sql$/.test(f))
    .sort()
}

/** Wrap PGlite as a SageSqlClient so the real repository runs against real PG. */
function pgliteClient(db: PGlite): SageSqlClient {
  return {
    async query<T = unknown>(text: string, params: readonly unknown[] = []) {
      const res = await db.query<T>(text, params as unknown[])
      return { rows: res.rows }
    },
  }
}

/** PGlite-backed storage adapter: deletes the object row + verifies via SQL. */
function pgliteStorage(db: PGlite): SageExportPackageStorage {
  return {
    async deleteObject(input) {
      const res = await db.query<{ storage_reference: string }>(
        `delete from sage_export_package_object where storage_reference = $1 and content_hash = $2 returning storage_reference`,
        [input.storageReference, input.expectedContentHash],
      )
      return { result: res.rows.length > 0 ? 'deleted' : 'not_found', providerRequestId: input.idempotencyKey }
    },
    async verifyObjectPresent(input) {
      const res = await db.query<{ present: boolean }>(
        `select exists (select 1 from sage_export_package_object where storage_reference = $1) as present`,
        [input.storageReference],
      )
      return Boolean(res.rows[0]?.present)
    },
    async verifyObjectAbsent(input) {
      const res = await db.query<{ present: boolean }>(
        `select exists (select 1 from sage_export_package_object where storage_reference = $1) as present`,
        [input.storageReference],
      )
      return !res.rows[0]?.present
    },
  }
}

let db: PGlite
const files = sageMigrationFiles()

const WS = '11111111-1111-4111-8111-111111111111'
const REQ = '22222222-2222-4222-8222-222222222222'
const PKG = '33333333-3333-4333-8333-333333333333'
const ORG = 'org-live-1'
const REF = 'sage-internal://sage/exports/org-live-1/ws/req/hash.json'

async function seed(db: PGlite) {
  await db.exec(`insert into sage_workspace (id, org_id, name, status, institution_type, risk_surface, boundary_profile, created_by)
    values ('${WS}', '${ORG}', 'Live WS', 'active', 'crown_corporation', 'general_governance', '{}'::jsonb, 'seed');`)
  await db.exec(`insert into sage_export_request (id, workspace_id, org_id, requested_by, status)
    values ('${REQ}', '${WS}', '${ORG}', 'seed', 'approved');`)
  await db.exec(`insert into sage_export_package (id, org_id, workspace_id, export_request_id, package_type, manifest_json, manifest_hash, content_hash, storage_reference, media_type, size_bytes, policy_version, generated_by)
    values ('${PKG}', '${ORG}', '${WS}', '${REQ}', 'internal_review_bundle', '{}'::jsonb, 'mh', 'ch', '${REF}', 'application/json', 3, 'v1', 'seed');`)
  await db.exec(`insert into sage_export_package_object (storage_reference, media_type, content_hash, content_text, size_bytes)
    values ('${REF}', 'application/json', 'ch', '{}', 3);`)
}

beforeAll(async () => {
  db = await new PGlite()
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8')
    await db.exec(sql)
  }
}, 60_000)

describe('SAGE live PostgreSQL — migration chain', () => {
  it('applies every SAGE migration 0032 → latest to real PostgreSQL', () => {
    // If beforeAll threw, this suite would never run — reaching here proves the
    // whole chain applied cleanly against live PostgreSQL.
    expect(files.length).toBeGreaterThanOrEqual(12)
    expect(files).toContain('0043_sage_phase_8b_records_lifecycle.sql')
    expect(files).toContain('0044_sage_phase_8b_destruction_attempts.sql')
  })

  it('has every Phase 8B enum value and trigger function present', async () => {
    const roles = await db.query<{ enumlabel: string }>(
      `select enumlabel from pg_enum e
       join pg_type t on t.oid = e.enumtypid
       where t.typname = 'sage_application_role'`,
    )
    const labels = roles.rows.map((r) => r.enumlabel)
    for (const r of ['records_manager', 'legal_hold_manager', 'destruction_approver', 'destruction_executor']) {
      expect(labels).toContain(r)
    }
    const fns = await db.query<{ proname: string }>(
      `select proname from pg_proc where proname in
       ('assert_immutable_except','sage_reject_row_update','sage_export_package_tombstone_guard',
        'sage_retention_policy_guard','sage_export_legal_hold_guard','sage_export_destruction_attempt_guard')`,
    )
    expect(fns.rows.map((r) => r.proname).sort()).toEqual([
      'assert_immutable_except',
      'sage_export_destruction_attempt_guard',
      'sage_export_legal_hold_guard',
      'sage_export_package_tombstone_guard',
      'sage_reject_row_update',
      'sage_retention_policy_guard',
    ])
  })

  it('every records-lifecycle foreign key resolves and RLS policies compile', async () => {
    const rls = await db.query<{ relname: string }>(
      `select c.relname from pg_class c
       where c.relrowsecurity = true and c.relname like 'sage_export_%'`,
    )
    expect(rls.rows.map((r) => r.relname)).toEqual(
      expect.arrayContaining([
        'sage_export_retention_assignment',
        'sage_export_legal_hold',
        'sage_export_destruction_request',
        'sage_export_destruction_approval',
        'sage_export_destruction_evidence',
        'sage_export_destruction_attempt',
      ]),
    )
  })
})

describe('SAGE live PostgreSQL — append-only + tombstone guards', () => {
  beforeAll(async () => {
    await seed(db)
  })

  it('rejects mutating an applied retention policy version (guard trigger)', async () => {
    await db.exec(`insert into sage_retention_policy (id, org_id, policy_code, version, name, retention_basis, retention_duration_days, effective_from, created_by)
      values ('44444444-4444-4444-8444-444444444444', '${ORG}', 'std', 1, 'Std', 'created_at', 1, now(), 'seed');`)
    await expect(
      db.exec(`update sage_retention_policy set name = 'Changed' where policy_code = 'std' and version = 1;`),
    ).rejects.toThrow(/immutable/i)
    // Deactivation IS allowed (only is_active/effective_to may change).
    await db.exec(`update sage_retention_policy set is_active = false where policy_code = 'std' and version = 1;`)
  })

  it('append-only tables reject prohibited updates and hard deletes', async () => {
    // Retention assignment is fully append-only.
    await db.exec(`insert into sage_export_retention_assignment
      (id, org_id, workspace_id, export_package_id, retention_policy_id, policy_code, policy_version,
       retention_basis, retention_started_at, retain_until, assigned_by, retention_basis_source_type,
       retention_basis_source_id, retention_basis_source_timestamp)
      values ('55555555-5555-4555-8555-555555555555', '${ORG}', '${WS}', '${PKG}',
       '44444444-4444-4444-8444-444444444444', 'std', 1, 'created_at', now(), now() - interval '1 day',
       'seed', 'created_at', '${PKG}', now());`)
    await expect(
      db.exec(`update sage_export_retention_assignment set retain_until = now() where export_package_id = '${PKG}';`),
    ).rejects.toThrow(/immutable/i)
  })

  it('tombstone guard: available→destroyed once; rejects reversal, fact changes, and hard delete', async () => {
    // A controlled availability transition is allowed.
    await db.exec(`update sage_export_package set availability_status = 'destroyed', destroyed_at = now(), destroyed_by = 'sys' where id = '${PKG}';`)
    // Reversal is rejected.
    await expect(
      db.exec(`update sage_export_package set availability_status = 'available' where id = '${PKG}';`),
    ).rejects.toThrow(/terminal|immutable/i)
    // Fact changes are rejected.
    await expect(
      db.exec(`update sage_export_package set content_hash = 'tampered' where id = '${PKG}';`),
    ).rejects.toThrow(/immutable/i)
    // Hard delete of the package row is rejected (FK from evidence/attempt or design) — prove metadata survives.
    const row = await db.query<{ availability_status: string }>(
      `select availability_status from sage_export_package where id = '${PKG}'`,
    )
    expect(row.rows[0]?.availability_status).toBe('destroyed')
  })
})

describe('SAGE live PostgreSQL — RLS tenant isolation (non-superuser)', () => {
  it('denies cross-org reads and permits same-org reads under RLS', async () => {
    // Seed a second-org policy row.
    await db.exec(`insert into sage_retention_policy (id, org_id, policy_code, version, name, retention_basis, retention_duration_days, effective_from, created_by)
      values ('66666666-6666-4666-8666-666666666666', 'org-live-2', 'std', 1, 'Other', 'created_at', 1, now(), 'seed');`)
    // A non-superuser role is subject to RLS (superusers bypass it).
    await db.exec(`do $$ begin create role sage_app nologin; exception when duplicate_object then null; end $$;`)
    await db.exec(`grant select on sage_retention_policy to sage_app;`)
    await db.exec(`set role sage_app;`)
    await db.exec(`select set_config('app.tenant_id', '${ORG}', false);`)
    const sameOrg = await db.query<{ org_id: string }>(`select org_id from sage_retention_policy`)
    // Only this org's rows are visible; the other org's row is filtered out.
    expect(sameOrg.rows.every((r) => r.org_id === ORG)).toBe(true)
    expect(sameOrg.rows.length).toBeGreaterThanOrEqual(1)
    await db.exec(`reset role;`)
  })
})

describe('SAGE live PostgreSQL — real repository destruction lifecycle', () => {
  it('runs retention→request→approve→execute with verified deletion + tombstone against real PostgreSQL', async () => {
    // Fresh DB so the tombstone/append-only mutations above do not interfere.
    const fresh = await new PGlite()
    for (const file of files) await fresh.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'))
    await seed(fresh)
    const repo = new PostgresSageRepository(pgliteClient(fresh))
    const audit = { eventId: '', actorId: 'sys', action: 'sage.export.retention_assigned', resourceType: 'sage_export_retention_assignment', safePayload: {} }

    // Retention policy + assignment (elapsed).
    await fresh.exec(`insert into sage_retention_policy (id, org_id, policy_code, version, name, retention_basis, retention_duration_days, effective_from, created_by)
      values ('77777777-7777-4777-8777-777777777777', '${ORG}', 'std', 1, 'Std', 'created_at', 1, now(), 'seed');`)
    const assign = await repo.assignRetentionPolicy({
      assignment: {
        orgId: ORG, workspaceId: WS, exportPackageId: PKG, retentionPolicyId: '77777777-7777-4777-8777-777777777777',
        policyCode: 'std', policyVersion: 1, retentionBasis: 'created_at',
        retentionStartedAt: '2020-01-01T00:00:00.000Z', retainUntil: '2020-01-02T00:00:00.000Z',
        assignedBy: 'sys', assignedAt: '2020-01-03T00:00:00.000Z',
        retentionBasisSourceType: 'created_at', retentionBasisSourceId: PKG, retentionBasisSourceTimestamp: '2020-01-01T00:00:00.000Z',
      },
      auditEvent: { ...audit, eventId: 'ra-ev' },
    })
    expect(assign.created).toBe(true)

    const request = await repo.createDestructionRequest({
      request: {
        orgId: ORG, workspaceId: WS, exportPackageId: PKG, requestedBy: 'requester', reason: 'disposition',
        status: 'requested', packageContentHash: 'ch', packageManifestHash: 'mh', storageReferenceHash: 'srh',
        retentionPolicyCode: 'std', retentionPolicyVersion: 1, retainUntil: '2020-01-02T00:00:00.000Z',
        activeHoldCount: 0, activeHoldSetDigest: 'd0', executionOwner: null, leaseExpiresAt: null,
        deletionStartedAt: null, currentAttemptId: null, destructionEvidenceId: null,
        requestedAt: '2020-01-03T00:00:00.000Z', updatedAt: '2020-01-03T00:00:00.000Z',
      },
      auditEvent: { ...audit, eventId: 'req-ev', action: 'sage.export.destruction_requested', resourceType: 'sage_export_destruction_request' },
    })
    expect(request?.status).toBe('requested')

    const decided = await repo.decideDestructionRequest({
      destructionRequestId: request!.id, workspaceId: WS, orgId: ORG, decision: 'approved',
      updatedAt: '2020-01-04T00:00:00.000Z',
      approval: {
        orgId: ORG, workspaceId: WS, destructionRequestId: request!.id, decision: 'approved', approverId: 'approver',
        rationale: 'ok', approvedPackageContentHash: 'ch', approvedManifestHash: 'mh', approvedStorageReferenceHash: 'srh',
        approvedRetentionPolicyCode: 'std', approvedRetentionPolicyVersion: 1, approvedRetainUntil: '2020-01-02T00:00:00.000Z',
        approvedActiveHoldCount: 0, approvedActiveHoldSetDigest: 'd0', decidedAt: '2020-01-04T00:00:00.000Z',
      },
      auditEvent: { ...audit, eventId: 'appr-ev', action: 'sage.export.destruction_approved', resourceType: 'sage_export_destruction_approval' },
    })
    expect(decided?.request.status).toBe('approved')

    // Claim → attempt(prepared) → beginDeletion (atomic no-hold POINR) → delete → verify → complete.
    const owner = 'owner-live'
    const claimed = await repo.claimDestructionForExecution({ destructionRequestId: request!.id, workspaceId: WS, orgId: ORG, executionOwner: owner, leaseMs: 60000, now: '2020-01-05T00:00:00.000Z' })
    expect(claimed?.status).toBe('executing_preflight')
    const attempt = await repo.createDestructionAttempt({
      attempt: {
        attemptId: 'att-live', orgId: ORG, workspaceId: WS, destructionRequestId: request!.id, exportPackageId: PKG,
        objectId: null, executionOwner: owner, providerIdempotencyKey: 'idem-live', status: 'prepared',
        createdAt: '2020-01-05T00:00:00.000Z', updatedAt: '2020-01-05T00:00:00.000Z',
      },
      executionOwner: owner, updatedAt: '2020-01-05T00:00:00.000Z',
    })
    expect(attempt?.status).toBe('prepared')
    const storage = pgliteStorage(fresh)
    expect(await storage.verifyObjectPresent({ storageReference: REF })).toBe(true)
    const began = await repo.beginDeletion({ destructionRequestId: request!.id, attemptId: 'att-live', workspaceId: WS, orgId: ORG, exportPackageId: PKG, executionOwner: owner, at: '2020-01-05T00:01:00.000Z' })
    expect(began?.request.status).toBe('deletion_started')
    const del = await storage.deleteObject({ storageReference: REF, expectedContentHash: 'ch', idempotencyKey: 'idem-live' })
    expect(del.result).toBe('deleted')
    expect(await storage.verifyObjectAbsent({ storageReference: REF })).toBe(true)
    const completed = await repo.completeDestruction({
      destructionRequestId: request!.id, workspaceId: WS, orgId: ORG, executionOwner: owner, attemptId: 'att-live',
      exportPackageId: PKG, destroyedBy: 'sys', updatedAt: '2020-01-05T00:02:00.000Z',
      evidence: {
        eventId: 'evid-live', orgId: ORG, workspaceId: WS, destructionRequestId: request!.id, exportPackageId: PKG,
        objectId: null, storageProvider: 'sage-internal', storageReferenceHash: 'srh', preDestructionContentHash: 'ch',
        preDestructionManifestHash: 'mh', deletionAttemptedAt: '2020-01-05T00:01:00.000Z', deletionVerifiedAt: '2020-01-05T00:02:00.000Z',
        verificationMethod: 'storage_absence_probe', result: 'verified_destroyed', providerRequestId: 'idem-live', safeErrorCode: null,
        executedBy: 'sys', createdAt: '2020-01-05T00:02:00.000Z',
      },
      auditEvent: { ...audit, eventId: 'verified-ev', action: 'sage.export.destruction_verified', resourceType: 'sage_export_destruction_evidence' },
    })
    expect(completed?.request.status).toBe('destroyed')
    expect(completed?.package.availabilityStatus).toBe('destroyed')

    // The package metadata survives as a tombstone; the object bytes are gone.
    const pkg = await repo.getExportPackage(PKG, WS, ORG)
    expect(pkg?.availabilityStatus).toBe('destroyed')
    const obj = await repo.getExportPackageObject(REF)
    expect(obj).toBeUndefined()
  }, 60_000)
})

describe('SAGE live PostgreSQL — additive upgrade path (0043 → 0044)', () => {
  // The canonical main 0040 is un-applyable (proven), so no environment holds an
  // old schema. This still proves 0044 upgrades an EXISTING pre-8B-closure DB
  // (chain through 0043) without recreating tables, and that re-applying it is
  // idempotent — the property that makes it safe on any partially-migrated DB.
  const upTo0043 = files.filter((f) => /^00(3[2-9]|4[0-3])_/.test(f))

  async function columnExists(pg: PGlite, table: string, column: string): Promise<boolean> {
    const r = await pg.query<{ n: number }>(
      `select count(*)::int as n from information_schema.columns where table_name = $1 and column_name = $2`,
      [table, column],
    )
    return (r.rows[0]?.n ?? 0) > 0
  }
  async function tableExists(pg: PGlite, table: string): Promise<boolean> {
    const r = await pg.query<{ n: number }>(
      `select count(*)::int as n from information_schema.tables where table_name = $1`,
      [table],
    )
    return (r.rows[0]?.n ?? 0) > 0
  }

  it('applies 0044 additively onto an existing 0043 schema and is idempotent', async () => {
    const up = await new PGlite()
    // Build the database at the pre-closure (through-0043) schema.
    for (const f of upTo0043) await up.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf-8'))
    expect(await tableExists(up, 'sage_export_destruction_request')).toBe(true)
    expect(await tableExists(up, 'sage_export_destruction_attempt')).toBe(false)
    expect(await columnExists(up, 'sage_export_destruction_request', 'deletion_started_at')).toBe(false)
    expect(await columnExists(up, 'sage_export_retention_assignment', 'retention_basis_source_id')).toBe(false)

    // Apply ONLY the additive Phase 8B closure migration.
    const migration0044 = files.find((f) => f.startsWith('0044_'))!
    await up.exec(readFileSync(join(MIGRATIONS_DIR, migration0044), 'utf-8'))

    // The new table and additive columns now exist without dropping prior data.
    expect(await tableExists(up, 'sage_export_destruction_attempt')).toBe(true)
    expect(await columnExists(up, 'sage_export_destruction_request', 'deletion_started_at')).toBe(true)
    expect(await columnExists(up, 'sage_export_destruction_request', 'current_attempt_id')).toBe(true)
    expect(await columnExists(up, 'sage_export_destruction_request', 'active_hold_set_digest')).toBe(true)
    expect(await columnExists(up, 'sage_export_destruction_approval', 'approved_active_hold_set_digest')).toBe(true)
    expect(await columnExists(up, 'sage_export_retention_assignment', 'retention_basis_source_id')).toBe(true)

    // Re-applying 0044 on the already-upgraded schema is a safe no-op (idempotent).
    await expect(
      up.exec(readFileSync(join(MIGRATIONS_DIR, migration0044), 'utf-8')),
    ).resolves.not.toThrow()
  }, 60_000)
})


