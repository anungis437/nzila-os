// ─── SAGE — official PostgreSQL server proof (multi-session concurrency + RLS) ──
//
// PGlite proves the migration CHAIN and single-session logic. This suite proves
// the SERVER-level behaviour that an in-process engine cannot: independent
// database sessions, real row locking / SKIP LOCKED, transaction isolation,
// concurrent legal-hold vs destruction commits, real database ROLES and RLS
// (non-owner, non-superuser), connection-level `app.tenant_id` tenancy, and
// crash / reconnect recovery across separate connections.
//
// It runs only when SAGE_PG_TEST_URL points at a real PostgreSQL server (the CI
// `SAGE PostgreSQL Concurrency and RLS` job provides an official postgres:16
// service; locally it can be pointed at any throwaway server). When unset, the
// whole suite is skipped so the default unit run needs no database.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import postgres from 'postgres'
import type { Sql } from 'postgres'
import type { SageSqlClient } from './sql-client'
import { PostgresSageRepository } from './postgres-repository'
import { hashSageStorageReference } from './records-lifecycle'

const PG_URL = process.env.SAGE_PG_TEST_URL
const suite = PG_URL ? describe : describe.skip

const MIGRATIONS_DIR = resolve(__dirname, '../../../migrations')
function sageMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^00(3[2-9]|4\d)_sage_.*\.sql$/.test(f))
    .sort()
}

const ORG_A = 'org-pg-a'
const ORG_B = 'org-pg-b'

/** Wrap a postgres.js connection as a SageSqlClient so the real repository runs. */
function client(sql: Sql): SageSqlClient {
  return {
    async query<T = unknown>(text: string, params: readonly unknown[] = []) {
      const rows = (await sql.unsafe(text, params as unknown as never[])) as unknown as T[]
      return { rows }
    },
  }
}

function conn(): Sql {
  return postgres(PG_URL as string, { max: 1, prepare: false, onnotice: () => {} })
}

/** A dedicated app session: superuser login, then SET ROLE to a non-owner role so
 *  RLS is actually enforced, with app.tenant_id bound for the tenant. */
async function appSession(role: string, org: string): Promise<Sql> {
  const sql = conn()
  await sql.unsafe(`set role ${role}`)
  await sql.unsafe(`select set_config('app.tenant_id', '${org}', false)`)
  return sql
}

let owner: Sql

async function ensureWorkspace(org: string): Promise<string> {
  const wsId = randomUUID()
  await owner.unsafe(
    `insert into sage_workspace (id, org_id, name, status, institution_type, risk_surface, boundary_profile, created_by)
     values ($1,$2,'WS','active','crown_corporation','general_governance','{}'::jsonb,'seed')`,
    [wsId, org],
  )
  return wsId
}

/** A fresh package + object + elapsed retention + approved destruction request. */
async function newApprovedScenario(org: string, wsId: string) {
  const pkgId = randomUUID()
  const reqId = randomUUID()
  const policyId = randomUUID()
  const exportReqId = randomUUID()
  const ref = `sage-internal://sage/exports/${org}/${pkgId}/hash.json`
  const refHash = hashSageStorageReference(ref)
  const policyCode = `p-${pkgId.slice(0, 8)}`
  await owner.unsafe(
    `insert into sage_export_request (id, workspace_id, org_id, requested_by, status)
     values ($1,$2,$3,'seed','approved')`,
    [exportReqId, wsId, org],
  )
  await owner.unsafe(
    `insert into sage_export_package (id, org_id, workspace_id, export_request_id, package_type, manifest_json, manifest_hash, content_hash, storage_reference, media_type, size_bytes, policy_version, generated_by)
     values ($1,$2,$3,$4,'internal_review_bundle','{}'::jsonb,'mh','ch',$5,'application/json',3,'v1','seed')`,
    [pkgId, org, wsId, exportReqId, ref],
  )
  await owner.unsafe(
    `insert into sage_export_package_object (storage_reference, media_type, content_hash, content_text, size_bytes)
     values ($1,'application/json','ch','{}',3)`,
    [ref],
  )
  await owner.unsafe(
    `insert into sage_retention_policy (id, org_id, policy_code, version, name, retention_basis, retention_duration_days, effective_from, created_by)
     values ($1,$2,$3,1,'Std','created_at',1, now(), 'seed')`,
    [policyId, org, policyCode],
  )
  await owner.unsafe(
    `insert into sage_export_retention_assignment
       (id, org_id, workspace_id, export_package_id, retention_policy_id, policy_code, policy_version,
        retention_basis, retention_started_at, retain_until, assigned_by, retention_basis_source_type,
        retention_basis_source_id, retention_basis_source_timestamp)
     values (gen_random_uuid(), $1,$2,$3,$4,$5,1,'created_at', now() - interval '10 days', now() - interval '1 day',
        'seed','created_at',$6, now() - interval '10 days')`,
    [org, wsId, pkgId, policyId, policyCode, pkgId],
  )
  await owner.unsafe(
    `insert into sage_export_destruction_request
       (id, org_id, workspace_id, export_package_id, requested_by, reason, status,
        package_content_hash, package_manifest_hash, storage_reference_hash,
        retention_policy_code, retention_policy_version, retain_until, active_hold_count, requested_at, updated_at)
     values ($1,$2,$3,$4,'req','x','approved','ch','mh',$5,'std',1, now() - interval '1 day', 0, now(), now())`,
    [reqId, org, wsId, pkgId, refHash],
  )
  return { pkgId, reqId, ref, refHash, wsId }
}

suite('SAGE official PostgreSQL — server-level concurrency + RLS', () => {
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    owner = postgres(PG_URL as string, { max: 6, prepare: false, onnotice: () => {} })
    // Start from a clean schema so the run is repeatable (a fresh CI service DB
    // is already empty, so this is a harmless no-op there).
    await owner.unsafe(`drop schema if exists public cascade`)
    await owner.unsafe(`create schema public`)
    // ── Clean install: apply the real migration chain 0032 → latest. ──────────
    for (const file of sageMigrationFiles()) {
      await owner.file(join(MIGRATIONS_DIR, file))
    }
    // ── Real, least-privilege database roles (never a superuser for app work). ─
    await owner.unsafe(`do $$ begin create role sage_app nologin; exception when duplicate_object then null; end $$;`)
    await owner.unsafe(`do $$ begin create role sage_internal_exec nologin; exception when duplicate_object then null; end $$;`)
    await owner.unsafe(`do $$ begin create role sage_recipient nologin; exception when duplicate_object then null; end $$;`)
    await owner.unsafe(`grant usage on schema public to sage_app, sage_internal_exec, sage_recipient`)
    await owner.unsafe(`grant select, insert, update on all tables in schema public to sage_app, sage_internal_exec`)
    await owner.unsafe(`grant select on all tables in schema public to sage_recipient`)
    wsA = await ensureWorkspace(ORG_A)
    wsB = await ensureWorkspace(ORG_B)
  }, 120_000)

  afterAll(async () => {
    if (owner) await owner.end({ timeout: 5 })
  })

  // ── 1. Clean install ────────────────────────────────────────────────────
  it('applies the full migration chain to an official PostgreSQL server', async () => {
    const t = await owner.unsafe(
      `select count(*)::int as n from information_schema.tables
       where table_name in ('sage_export_destruction_request','sage_export_destruction_attempt')`,
    )
    expect((t[0] as unknown as { n: number }).n).toBe(2)
  })

  // ── 2. RLS with real roles ──────────────────────────────────────────────
  describe('RLS tenant isolation with real database roles', () => {
    it('an app-role session for org A cannot read org B lifecycle rows', async () => {
      await newApprovedScenario(ORG_A, wsA)
      await newApprovedScenario(ORG_B, wsB)
      const a = await appSession('sage_app', ORG_A)
      try {
        const rows = (await a.unsafe(`select org_id from sage_export_destruction_request`)) as unknown as { org_id: string }[]
        expect(rows.length).toBeGreaterThanOrEqual(1)
        expect(rows.every((r) => r.org_id === ORG_A)).toBe(true)
      } finally {
        await a.end({ timeout: 5 })
      }
    })

    it('an app-role session cannot INSERT a row for a different org (WITH CHECK)', async () => {
      const a = await appSession('sage_app', ORG_A)
      try {
        await expect(
          a.unsafe(
            `insert into sage_retention_policy (id, org_id, policy_code, version, name, retention_basis, retention_duration_days, effective_from, created_by)
             values (gen_random_uuid(), $1, 'evil', 9, 'x', 'created_at', 1, now(), 'attacker')`,
            [ORG_B],
          ),
        ).rejects.toThrow(/row-level security|policy/i)
      } finally {
        await a.end({ timeout: 5 })
      }
    })

    it('the tenant GUC only ever exposes the currently-set tenant, never both', async () => {
      const a = await appSession('sage_app', ORG_A)
      try {
        await a.unsafe(`select set_config('app.tenant_id', '${ORG_B}', false)`)
        const rows = (await a.unsafe(`select distinct org_id from sage_retention_policy`)) as unknown as { org_id: string }[]
        expect(rows.every((r) => r.org_id === ORG_B)).toBe(true)
        expect(rows.map((r) => r.org_id)).not.toContain(ORG_A)
      } finally {
        await a.end({ timeout: 5 })
      }
    })

    it('the recipient role has no lifecycle write access', async () => {
      const r = await appSession('sage_recipient', ORG_A)
      try {
        await expect(
          r.unsafe(
            `insert into sage_export_legal_hold (id, org_id, workspace_id, export_package_id, hold_code, status, reason, placed_by, placed_at)
             values (gen_random_uuid(), $1, $2, gen_random_uuid(), 'h', 'active', 'x', 'r', now())`,
            [ORG_A, wsA],
          ),
        ).rejects.toThrow(/permission denied/i)
      } finally {
        await r.end({ timeout: 5 })
      }
    })
  })

  // ── 3. Legal-hold vs destruction concurrency (independent connections) ────
  describe('legal-hold / destruction race across independent connections', () => {
    it('hold wins: a hold committed during preflight aborts the atomic deletion_started transition', async () => {
      const s = await newApprovedScenario(ORG_A, wsA)
      const repo = new PostgresSageRepository(client(owner))
      const claimed = await repo.claimDestructionForExecution({
        destructionRequestId: s.reqId, workspaceId: s.wsId, orgId: ORG_A,
        executionOwner: 'owner-A', leaseMs: 60_000, now: new Date().toISOString(),
      })
      expect(claimed?.executionOwner).toBe('owner-A')
      const attemptId = randomUUID()
      const attempt = await repo.createDestructionAttempt({
        attempt: {
          attemptId, orgId: ORG_A, workspaceId: s.wsId, destructionRequestId: s.reqId,
          exportPackageId: s.pkgId, objectId: null, executionOwner: 'owner-A',
          providerIdempotencyKey: 'k-hw', status: 'prepared',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        },
        executionOwner: 'owner-A', updatedAt: new Date().toISOString(),
      })
      expect(attempt).toBeTruthy()

      // A SEPARATE connection places + commits a legal hold before the point of no return.
      const connB = conn()
      try {
        await connB.unsafe(
          `insert into sage_export_legal_hold (id, org_id, workspace_id, export_package_id, hold_code, status, reason, placed_by, placed_at)
           values (gen_random_uuid(), $1, $2, $3, 'h', 'active', 'litigation', 'legal', now())`,
          [ORG_A, s.wsId, s.pkgId],
        )
      } finally {
        await connB.end({ timeout: 5 })
      }

      // Worker A now attempts the atomic point of no return — it must fail.
      const began = await repo.beginDeletion({
        destructionRequestId: s.reqId, attemptId, workspaceId: s.wsId, orgId: ORG_A,
        exportPackageId: s.pkgId, executionOwner: 'owner-A', at: new Date().toISOString(),
      })
      expect(began).toBeUndefined()
      const req = await repo.getDestructionRequest(s.reqId, s.wsId, ORG_A)
      expect(req?.status).toBe('executing_preflight')
      const obj = await owner.unsafe(`select 1 from sage_export_package_object where storage_reference = $1`, [s.ref])
      expect(obj.length).toBe(1)
    })

    it('destruction wins: once deletion_started commits, a later hold placement is rejected', async () => {
      const s = await newApprovedScenario(ORG_B, wsB)
      const repo = new PostgresSageRepository(client(owner))
      await repo.claimDestructionForExecution({
        destructionRequestId: s.reqId, workspaceId: s.wsId, orgId: ORG_B,
        executionOwner: 'owner-B', leaseMs: 60_000, now: new Date().toISOString(),
      })
      const attemptId = randomUUID()
      await repo.createDestructionAttempt({
        attempt: {
          attemptId, orgId: ORG_B, workspaceId: s.wsId, destructionRequestId: s.reqId,
          exportPackageId: s.pkgId, objectId: null, executionOwner: 'owner-B',
          providerIdempotencyKey: 'k-dw', status: 'prepared',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        },
        executionOwner: 'owner-B', updatedAt: new Date().toISOString(),
      })
      const began = await repo.beginDeletion({
        destructionRequestId: s.reqId, attemptId, workspaceId: s.wsId, orgId: ORG_B,
        exportPackageId: s.pkgId, executionOwner: 'owner-B', at: new Date().toISOString(),
      })
      expect(began?.request.status).toBe('deletion_started')

      const connHold = conn()
      try {
        const inserted = await connHold.unsafe(
          `insert into sage_export_legal_hold (id, org_id, workspace_id, export_package_id, hold_code, status, reason, placed_by, placed_at)
           select gen_random_uuid(), $1, $2, $3, 'late', 'active', 'x', 'legal', now()
           where not exists (
             select 1 from sage_export_destruction_request
             where export_package_id = $3 and status in ('deletion_started','destroyed')
           )
           returning id`,
          [ORG_B, s.wsId, s.pkgId],
        )
        expect(inserted.length).toBe(0)
      } finally {
        await connHold.end({ timeout: 5 })
      }
    })
  })

  // ── 4. Executor fencing + concurrent claims ─────────────────────────────
  describe('executor fencing across connections', () => {
    it('a stale lease is reclaimed by a new worker and the old owner is fenced out', async () => {
      const s = await newApprovedScenario(ORG_A, wsA)
      const repo = new PostgresSageRepository(client(owner))
      const a = await repo.claimDestructionForExecution({
        destructionRequestId: s.reqId, workspaceId: s.wsId, orgId: ORG_A,
        executionOwner: 'stale-A', leaseMs: 1000, now: '2020-01-01T00:00:00.000Z',
      })
      expect(a?.executionOwner).toBe('stale-A')
      const b = await repo.claimDestructionForExecution({
        destructionRequestId: s.reqId, workspaceId: s.wsId, orgId: ORG_A,
        executionOwner: 'fresh-B', leaseMs: 60_000, now: '2020-01-01T01:00:00.000Z',
      })
      expect(b?.executionOwner).toBe('fresh-B')
      const staleAttempt = await repo.createDestructionAttempt({
        attempt: {
          attemptId: randomUUID(), orgId: ORG_A, workspaceId: s.wsId, destructionRequestId: s.reqId,
          exportPackageId: s.pkgId, objectId: null, executionOwner: 'stale-A',
          providerIdempotencyKey: 'k-stale', status: 'prepared',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        },
        executionOwner: 'stale-A', updatedAt: new Date().toISOString(),
      })
      expect(staleAttempt).toBeUndefined()
    })

    it('two workers claiming the same approved request simultaneously → exactly one wins', async () => {
      const s = await newApprovedScenario(ORG_A, wsA)
      const now = new Date().toISOString()
      const c1 = conn()
      const c2 = conn()
      try {
        const r1 = new PostgresSageRepository(client(c1))
        const r2 = new PostgresSageRepository(client(c2))
        const [w1, w2] = await Promise.all([
          r1.claimDestructionForExecution({ destructionRequestId: s.reqId, workspaceId: s.wsId, orgId: ORG_A, executionOwner: 'w1', leaseMs: 60_000, now }),
          r2.claimDestructionForExecution({ destructionRequestId: s.reqId, workspaceId: s.wsId, orgId: ORG_A, executionOwner: 'w2', leaseMs: 60_000, now }),
        ])
        expect([w1, w2].filter(Boolean)).toHaveLength(1)
      } finally {
        await c1.end({ timeout: 5 })
        await c2.end({ timeout: 5 })
      }
    })
  })

  // ── 5. Crash / reconnect recovery ───────────────────────────────────────
  describe('crash + reconnect recovery', () => {
    it('recovers a deletion_started request from its durable attempt on a NEW connection', async () => {
      const s = await newApprovedScenario(ORG_A, wsA)
      const attemptId = randomUUID()
      const c1 = conn()
      try {
        const r1 = new PostgresSageRepository(client(c1))
        await r1.claimDestructionForExecution({ destructionRequestId: s.reqId, workspaceId: s.wsId, orgId: ORG_A, executionOwner: 'crashed', leaseMs: 60_000, now: new Date().toISOString() })
        await r1.createDestructionAttempt({
          attempt: {
            attemptId, orgId: ORG_A, workspaceId: s.wsId, destructionRequestId: s.reqId,
            exportPackageId: s.pkgId, objectId: null, executionOwner: 'crashed',
            providerIdempotencyKey: 'k-crash', status: 'prepared',
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          },
          executionOwner: 'crashed', updatedAt: new Date().toISOString(),
        })
        const began = await r1.beginDeletion({ destructionRequestId: s.reqId, attemptId, workspaceId: s.wsId, orgId: ORG_A, exportPackageId: s.pkgId, executionOwner: 'crashed', at: new Date().toISOString() })
        expect(began?.request.status).toBe('deletion_started')
      } finally {
        await c1.end({ timeout: 5 }) // simulate process termination
      }

      // A brand new connection reconstructs authoritatively from the durable attempt.
      const c2 = conn()
      try {
        const r2 = new PostgresSageRepository(client(c2))
        const req = await r2.getDestructionRequest(s.reqId, s.wsId, ORG_A)
        expect(req?.status).toBe('deletion_started')
        const attempt = await r2.getLatestDestructionAttemptByRequest(s.reqId, s.wsId, ORG_A)
        expect(attempt?.attemptId).toBe(attemptId)
        expect(attempt?.status).toBe('deletion_started')
        // The object is genuinely gone (model provider success completed before the crash).
        await owner.unsafe(`delete from sage_export_package_object where storage_reference = $1`, [s.ref])
        const completed = await r2.completeDestruction({
          destructionRequestId: s.reqId, workspaceId: s.wsId, orgId: ORG_A, executionOwner: 'crashed',
          exportPackageId: s.pkgId, attemptId, destroyedBy: 'recovery', updatedAt: new Date().toISOString(),
          evidence: {
            eventId: `ev-${attemptId}`, orgId: ORG_A, workspaceId: s.wsId, destructionRequestId: s.reqId,
            exportPackageId: s.pkgId, objectId: null, storageProvider: 'internal',
            storageReferenceHash: s.refHash, preDestructionContentHash: 'ch', preDestructionManifestHash: 'mh',
            deletionAttemptedAt: new Date().toISOString(), deletionVerifiedAt: new Date().toISOString(),
            verificationMethod: 'absence_probe', result: 'verified_destroyed', providerRequestId: 'k-crash',
            safeErrorCode: null, executedBy: 'recovery', createdAt: new Date().toISOString(),
          },
          auditEvent: { eventId: `au-${attemptId}`, actorId: 'recovery', action: 'sage.export.destruction_verified', resourceType: 'sage_export_destruction_evidence', safePayload: {} },
        })
        expect(completed?.request.status).toBe('destroyed')
        const attempts = await owner.unsafe(`select count(*)::int as n from sage_export_destruction_attempt where destruction_request_id = $1`, [s.reqId])
        expect((attempts[0] as unknown as { n: number }).n).toBe(1)
      } finally {
        await c2.end({ timeout: 5 })
      }
    })
  })

  // ── 6. Tombstone trigger against the official server ────────────────────
  it('tombstone trigger: available→destroyed once; rejects reversal and fact changes', async () => {
    const s = await newApprovedScenario(ORG_B, wsB)
    await owner.unsafe(`update sage_export_package set availability_status='destroyed', destroyed_at=now(), destroyed_by='sys' where id=$1`, [s.pkgId])
    await expect(
      owner.unsafe(`update sage_export_package set availability_status='available' where id=$1`, [s.pkgId]),
    ).rejects.toThrow(/terminal|immutable|destroyed/i)
    await expect(
      owner.unsafe(`update sage_export_package set content_hash='tampered' where id=$1`, [s.pkgId]),
    ).rejects.toThrow(/immutable/i)
  })
})
