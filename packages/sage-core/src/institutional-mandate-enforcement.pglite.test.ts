// PGlite proof: institutional mandate enforcement against real PostgreSQL.
// Covers P01 procurement ceiling, revocation race serialization, idempotency,
// cross-tenant refusal, and append-only action evidence.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { SageSqlClient } from './sql-client'
import {
  insertInstitutionalMandate,
  revokeInstitutionalMandate,
  sumResourceCommitmentsMinor,
} from './institutional-mandate-store'
import {
  executeInstitutionalActionInTransaction,
  publicInstitutionalRefusal,
} from './institutional-mandate-enforcement'

const MIGRATIONS_DIR = resolve(__dirname, '../../../migrations')

function sageMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^00(3[2-9]|4\d|5\d)_sage_.*\.sql$/.test(f))
    .sort()
}

function pgliteClient(db: PGlite): SageSqlClient {
  return {
    async query<T = unknown>(text: string, params: readonly unknown[] = []) {
      const res = await db.query<T>(text, params as unknown[])
      return { rows: res.rows }
    },
  }
}

const ORG = 'org-mandate-1'
const ORG_B = 'org-mandate-b'
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const RESOURCE = 'procurement.engagement.alpha'
const ACTOR = 'actor-delegate-1'
const POSITION = 'position-procurement-officer'
const NOW = '2026-11-23T14:00:00.000Z'

let db: PGlite
let sql: SageSqlClient

async function begin() {
  await db.exec('begin')
}
async function commit() {
  await db.exec('commit')
}
async function rollback() {
  await db.exec('rollback')
}

async function setTenant(orgId: string) {
  await db.query(`select set_config('app.tenant_id', $1, false)`, [orgId])
}

beforeAll(async () => {
  db = await new PGlite()
  for (const file of sageMigrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'))
  }
  sql = pgliteClient(db)
  expect(sageMigrationFiles()).toContain('0050_sage_institutional_mandate_authority.sql')
  expect(sageMigrationFiles()).toContain('0051_sage_institutional_capacity_recusal.sql')
}, 60_000)

beforeEach(async () => {
  await db.exec(`
    truncate table sage_accountability_adoption cascade;
    truncate table sage_institutional_action cascade;
    truncate table sage_resource_commitment cascade;
    truncate table sage_institutional_mandate cascade;
    truncate table sage_institutional_conflict_attestation cascade;
    truncate table sage_institutional_office_holding cascade;
    truncate table sage_workspace cascade;
  `)
  await setTenant(ORG)
  await db.exec(`
    insert into sage_workspace (id, org_id, name, status, institution_type, risk_surface, boundary_profile, created_by)
    values
      ('${WS}', '${ORG}', 'Mandate WS', 'active', 'crown_corporation', 'general_governance', '{}'::jsonb, 'seed'),
      ('${WS_B}', '${ORG_B}', 'Other WS', 'active', 'regulator', 'regulatory_boundary', '{}'::jsonb, 'seed');
  `)
})

function actorFacts(overrides: Partial<Parameters<typeof executeInstitutionalActionInTransaction>[1]['actor']> = {}) {
  return {
    orgId: ORG,
    workspaceId: WS,
    actorId: ACTOR,
    actorKind: 'human' as const,
    claimedPositionId: POSITION,
    authenticated: true,
    activeWorkspaceMembership: true,
    applicationPermissionGranted: true,
    conflictOrRecusal: false as boolean | null,
    ...overrides,
  }
}

async function seedMandate(overrides: Partial<Parameters<typeof insertInstitutionalMandate>[1]> = {}) {
  return insertInstitutionalMandate(sql, {
    orgId: ORG,
    workspaceId: WS,
    principalActorId: ACTOR,
    positionId: POSITION,
    resourceId: RESOURCE,
    permittedActions: ['resource.commit', 'decision.ratify'],
    instrumentRef: 'DEL-2026-PROC-30K',
    instrumentVersion: 'v2',
    issuerActorId: 'issuer-board-1',
    monetaryLimitMinor: 3_000_000,
    currency: 'CAD',
    verificationStatus: 'verified',
    attestedAt: '2026-01-01T00:00:00.000Z',
    acceptedAt: '2026-01-02T00:00:00.000Z',
    effectiveAt: '2026-01-03T00:00:00.000Z',
    expiresAt: '2027-01-01T00:00:00.000Z',
    status: 'active',
    createdBy: 'attestor-1',
    ...overrides,
  })
}

describe('institutional mandate enforcement (PGlite)', () => {
  it('admits an authorized CAD commitment under the current 30k ceiling (P01 positive)', async () => {
    const mandate = await seedMandate()
    await begin()
    const result = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts(),
      mandateId: mandate.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: NOW,
      idempotencyKey: 'commit-15k-1',
      requestedCommitMinor: 1_500_000,
    })
    await commit()
    expect(result.admitted).toBe(true)
    if (!result.admitted) return
    expect(result.totalCommittedMinorAfterAction).toBe(1_500_000)
    expect(await sumResourceCommitmentsMinor(sql, { orgId: ORG, resourceId: RESOURCE, currency: 'CAD' })).toBe(
      1_500_000,
    )
  })

  it('rejects a CAD 15k extension that would exceed a CAD 30k ceiling after prior spend (P01 cumulative)', async () => {
    const mandate = await seedMandate()
    await begin()
    const first = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts(),
      mandateId: mandate.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: NOW,
      idempotencyKey: 'commit-20k',
      requestedCommitMinor: 2_000_000,
    })
    await commit()
    expect(first.admitted).toBe(true)

    await begin()
    const second = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts(),
      mandateId: mandate.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: '2026-11-23T14:05:00.000Z',
      idempotencyKey: 'commit-15k-over',
      requestedCommitMinor: 1_500_000,
    })
    await commit()
    expect(second.admitted).toBe(false)
    if (second.admitted) return
    expect(second.decision.reason).toBe('MONETARY_LIMIT_EXCEEDED')
    expect(publicInstitutionalRefusal(second.decision).code).toBe('INSTITUTIONAL_AUTHORITY_DENIED')
    expect(await sumResourceCommitmentsMinor(sql, { orgId: ORG, resourceId: RESOURCE, currency: 'CAD' })).toBe(
      2_000_000,
    )
  })

  it('keeps a historical CAD 40k instrument historically accurate while refusing it for a new action', async () => {
    const historic = await seedMandate({
      instrumentRef: 'DEL-2025-PROC-40K',
      instrumentVersion: 'v1',
      monetaryLimitMinor: 4_000_000,
      effectiveAt: '2025-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T00:00:00.000Z',
      acceptedAt: '2025-01-02T00:00:00.000Z',
      attestedAt: '2025-01-01T00:00:00.000Z',
    })
    const current = await seedMandate({
      instrumentRef: 'DEL-2026-PROC-30K',
      instrumentVersion: 'v2',
      monetaryLimitMinor: 3_000_000,
    })

    // Historic mandate remains readable with its original ceiling.
    expect(historic.monetaryLimitMinor).toBe(4_000_000)
    expect(historic.instrumentRef).toBe('DEL-2025-PROC-40K')

    await begin()
    const denied = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts(),
      mandateId: historic.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: NOW,
      idempotencyKey: 'historic-reuse',
      requestedCommitMinor: 100_000,
    })
    await commit()
    expect(denied.admitted).toBe(false)
    if (denied.admitted) return
    expect(denied.decision.reason).toBe('MANDATE_NOT_EFFECTIVE')

    await begin()
    const ok = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts(),
      mandateId: current.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: NOW,
      idempotencyKey: 'current-ok',
      requestedCommitMinor: 100_000,
    })
    await commit()
    expect(ok.admitted).toBe(true)
  })

  it('refuses revoked mandates and does not write a commitment', async () => {
    const mandate = await seedMandate()
    await revokeInstitutionalMandate(sql, {
      orgId: ORG,
      workspaceId: WS,
      mandateId: mandate.id,
      revokedAt: '2026-11-23T13:59:00.000Z',
    })
    await begin()
    const denied = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts(),
      mandateId: mandate.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: NOW,
      idempotencyKey: 'revoked-1',
      requestedCommitMinor: 100_000,
    })
    await commit()
    expect(denied.admitted).toBe(false)
    if (denied.admitted) return
    expect(denied.decision.reason).toBe('MANDATE_INACTIVE')
    expect(await sumResourceCommitmentsMinor(sql, { orgId: ORG, resourceId: RESOURCE, currency: 'CAD' })).toBe(0)
  })

  it('is idempotent for duplicate resource.commit requests', async () => {
    const mandate = await seedMandate()
    await begin()
    const first = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts(),
      mandateId: mandate.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: NOW,
      idempotencyKey: 'same-key',
      requestedCommitMinor: 250_000,
    })
    await commit()
    expect(first.admitted).toBe(true)

    await begin()
    const second = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts(),
      mandateId: mandate.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: '2026-11-23T14:10:00.000Z',
      idempotencyKey: 'same-key',
      requestedCommitMinor: 250_000,
    })
    await commit()
    expect(second.admitted).toBe(true)
    if (!second.admitted) return
    expect(second.reusedExisting).toBe(true)
    expect(second.authorizationStatus).toBe('HISTORICALLY_RECORDED_NO_NEW_AUTHORIZATION')
    expect(await sumResourceCommitmentsMinor(sql, { orgId: ORG, resourceId: RESOURCE, currency: 'CAD' })).toBe(
      250_000,
    )
  })

  it('refuses cross-tenant mandate use (wrong org binding)', async () => {
    const mandate = await seedMandate()
    await begin()
    await expect(
      executeInstitutionalActionInTransaction(sql, {
        actor: actorFacts({ orgId: ORG_B, workspaceId: WS_B }),
        mandateId: mandate.id,
        resourceId: RESOURCE,
        action: 'resource.commit',
        evaluatedAt: NOW,
        idempotencyKey: 'x-tenant',
        requestedCommitMinor: 100_000,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await rollback()
  })

  it('enforces RLS under a non-superuser role', async () => {
    const mandate = await seedMandate()
    await db.exec(`do $$ begin create role sage_app nologin; exception when duplicate_object then null; end $$;`)
    await db.exec(`grant select, insert, update on sage_institutional_mandate to sage_app;`)
    await db.exec(`grant select, insert on sage_resource_commitment to sage_app;`)
    await db.exec(`grant select, insert on sage_institutional_action to sage_app;`)
    await db.exec(`grant usage on type sage_mandate_status, sage_mandate_verification, sage_institutional_action_kind to sage_app;`)
    await db.exec(`set role sage_app;`)
    await db.exec(`select set_config('app.tenant_id', '${ORG_B}', false);`)
    const visible = await db.query<{ id: string }>(
      `select id from sage_institutional_mandate where id = '${mandate.id}'`,
    )
    expect(visible.rows).toHaveLength(0)
    await db.exec(`reset role;`)
    await setTenant(ORG)
  })

  it('refuses recusal, non-human actors and unverified instruments', async () => {
    const unverified = await seedMandate({ verificationStatus: 'unverified' })
    await begin()
    const u = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts(),
      mandateId: unverified.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: NOW,
      idempotencyKey: 'unverified',
      requestedCommitMinor: 100_000,
    })
    await commit()
    expect(u.admitted).toBe(false)
    if (!u.admitted) expect(u.decision.reason).toBe('UNVERIFIED_INSTRUMENT')

    const verified = await seedMandate({
      instrumentRef: 'DEL-2026-B',
      instrumentVersion: 'v1',
    })
    await begin()
    const recusal = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts({ conflictOrRecusal: true }),
      mandateId: verified.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: NOW,
      idempotencyKey: 'recusal',
      requestedCommitMinor: 100_000,
    })
    await commit()
    expect(recusal.admitted).toBe(false)
    if (!recusal.admitted) expect(recusal.decision.reason).toBe('CONFLICT_OR_RECUSAL')

    await begin()
    const bot = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts({ actorKind: 'service' }),
      mandateId: verified.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: NOW,
      idempotencyKey: 'bot',
      requestedCommitMinor: 100_000,
    })
    await commit()
    expect(bot.admitted).toBe(false)
    if (!bot.admitted) expect(bot.decision.reason).toBe('NON_HUMAN')
  })

  it('keeps institutional_action append-only', async () => {
    const mandate = await seedMandate()
    await begin()
    const result = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts(),
      mandateId: mandate.id,
      resourceId: RESOURCE,
      action: 'decision.ratify',
      evaluatedAt: NOW,
      idempotencyKey: 'ratify-1',
    })
    await commit()
    expect(result.admitted).toBe(true)
    if (!result.admitted) return
    await expect(
      db.query(`update sage_institutional_action set decision_reason = 'tamper' where id = $1`, [
        result.actionId,
      ]),
    ).rejects.toThrow(/append-only/i)
  })

  it('fails closed when conflict/recusal data is unavailable (no default clear)', async () => {
    const mandate = await seedMandate()
    await begin()
    const denied = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts({ conflictOrRecusal: null }),
      mandateId: mandate.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: NOW,
      idempotencyKey: 'conflict-unavailable',
      requestedCommitMinor: 100_000,
    })
    await commit()
    expect(denied.admitted).toBe(false)
    if (!denied.admitted) expect(denied.decision.reason).toBe('CONFLICT_DATA_UNAVAILABLE')
  })

  it('rejects a spoofed position claim that does not match the locked mandate office', async () => {
    const mandate = await seedMandate()
    await begin()
    const denied = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts({ claimedPositionId: 'pos-spoofed-other-office' }),
      mandateId: mandate.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: NOW,
      idempotencyKey: 'spoofed-position',
      requestedCommitMinor: 100_000,
    })
    await commit()
    expect(denied.admitted).toBe(false)
    if (!denied.admitted) expect(denied.decision.reason).toBe('MANDATE_SCOPE_MISMATCH')
  })

  it('rejects idempotent replay when the commitment amount or durable payload differs', async () => {
    const mandate = await seedMandate()
    await begin()
    const first = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts(),
      mandateId: mandate.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: NOW,
      idempotencyKey: 'payload-strict-1',
      requestedCommitMinor: 100_000,
      safePayload: { note: 'original' },
    })
    await commit()
    expect(first.admitted).toBe(true)

    await begin()
    await expect(
      executeInstitutionalActionInTransaction(sql, {
        actor: actorFacts(),
        mandateId: mandate.id,
        resourceId: RESOURCE,
        action: 'resource.commit',
        evaluatedAt: NOW,
        idempotencyKey: 'payload-strict-1',
        requestedCommitMinor: 200_000,
        safePayload: { note: 'original' },
      }),
    ).rejects.toThrow(/payload does not match|commitment amount/)
    await rollback()

    await begin()
    await expect(
      executeInstitutionalActionInTransaction(sql, {
        actor: actorFacts(),
        mandateId: mandate.id,
        resourceId: RESOURCE,
        action: 'resource.commit',
        evaluatedAt: NOW,
        idempotencyKey: 'payload-strict-1',
        requestedCommitMinor: 100_000,
        safePayload: { note: 'mutated' },
      }),
    ).rejects.toThrow(/payload does not match/)
    await rollback()
  })

  it('re-checks authority on idempotent replay and refuses after revocation without disclosing the historic action', async () => {
    const mandate = await seedMandate()
    await begin()
    const first = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts(),
      mandateId: mandate.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: NOW,
      idempotencyKey: 'replay-after-revoke',
      requestedCommitMinor: 100_000,
    })
    await commit()
    expect(first.admitted).toBe(true)
    if (!first.admitted) return
    expect(first.authorizationStatus).toBe('NEWLY_ADMITTED')

    await revokeInstitutionalMandate(sql, {
      orgId: ORG,
      workspaceId: WS,
      mandateId: mandate.id,
      revokedAt: '2026-11-23T14:30:00.000Z',
    })

    await begin()
    const replay = await executeInstitutionalActionInTransaction(sql, {
      actor: actorFacts(),
      mandateId: mandate.id,
      resourceId: RESOURCE,
      action: 'resource.commit',
      evaluatedAt: '2026-11-23T14:35:00.000Z',
      idempotencyKey: 'replay-after-revoke',
      requestedCommitMinor: 100_000,
    })
    await commit()
    expect(replay.admitted).toBe(false)
    if (!replay.admitted) expect(replay.decision.reason).toBe('MANDATE_INACTIVE')
    expect(replay).not.toHaveProperty('actionId')
  })
})
