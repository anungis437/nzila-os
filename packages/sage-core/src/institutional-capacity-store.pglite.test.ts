import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { SageSqlClient } from './sql-client'
import {
  SqlSageInstitutionalCapacityStore,
  insertInstitutionalConflictAttestation,
  insertInstitutionalOfficeHolding,
} from './institutional-capacity-store'
import { resolveInstitutionalCapacityForAdmission } from './institutional-capacity'
import { executeInstitutionalActionInTransaction } from './institutional-mandate-enforcement'
import { insertInstitutionalMandate } from './institutional-mandate-store'

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

const ORG = 'org-capacity-1'
const WS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const RESOURCE = 'procurement.engagement.beta'
const ACTOR = 'actor-officer-1'
const POSITION = 'position-procurement-officer'
const NOW = '2026-11-23T15:00:00.000Z'

let db: PGlite
let sql: SageSqlClient

async function setTenant(orgId: string) {
  await db.query(`select set_config('app.tenant_id', $1, false)`, [orgId])
}

beforeAll(async () => {
  db = await new PGlite()
  for (const file of sageMigrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'))
  }
  sql = pgliteClient(db)
  expect(sageMigrationFiles()).toContain('0051_sage_institutional_capacity_recusal.sql')
}, 60_000)

beforeEach(async () => {
  await db.exec(`
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
    values ('${WS}', '${ORG}', 'Capacity WS', 'active', 'crown_corporation', 'general_governance', '{}'::jsonb, 'seed');
  `)
})

describe('SqlSageInstitutionalCapacityStore (PGlite)', () => {
  it('fails closed when holding or conflict attestation is missing', async () => {
    const store = new SqlSageInstitutionalCapacityStore(sql, NOW)
    await expect(
      store.resolveActivePosition({ orgId: ORG, workspaceId: WS, actorId: ACTOR }),
    ).resolves.toBeNull()
    await expect(
      store.resolveConflictOrRecusal({
        orgId: ORG,
        workspaceId: WS,
        actorId: ACTOR,
        resourceId: RESOURCE,
        action: 'resource.commit',
      }),
    ).resolves.toBeNull()

    const unresolved = await resolveInstitutionalCapacityForAdmission(store, {
      orgId: ORG,
      workspaceId: WS,
      actorId: ACTOR,
      resourceId: RESOURCE,
      action: 'resource.commit',
      mandateId: 'mandate-x',
      mandatePositionId: POSITION,
    })
    expect(unresolved.resolved).toBe(false)
  })

  it('resolves verified office + clear conflict and admits a commit', async () => {
    await insertInstitutionalOfficeHolding(sql, {
      orgId: ORG,
      workspaceId: WS,
      actorId: ACTOR,
      positionId: POSITION,
      instrumentRef: 'BOARD-HOLDING-1',
      instrumentVersion: 'v1',
      effectiveAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
      createdBy: 'issuer',
    })
    await insertInstitutionalConflictAttestation(sql, {
      orgId: ORG,
      workspaceId: WS,
      actorId: ACTOR,
      resourceId: RESOURCE,
      actionScope: 'resource.commit',
      conflicted: false,
      instrumentRef: 'CONFLICT-CLEAR-1',
      instrumentVersion: 'v1',
      attestedBy: 'ethics-officer',
      attestedAt: NOW,
      effectiveAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
    })

    const mandate = await insertInstitutionalMandate(sql, {
      orgId: ORG,
      workspaceId: WS,
      principalActorId: ACTOR,
      positionId: POSITION,
      resourceId: RESOURCE,
      permittedActions: ['resource.commit'],
      instrumentRef: 'DEL-2026-30K',
      instrumentVersion: 'v2',
      issuerActorId: 'board',
      monetaryLimitMinor: 3_000_000,
      currency: 'CAD',
      verificationStatus: 'verified',
      attestedAt: '2026-11-01T00:00:00.000Z',
      acceptedAt: '2026-11-02T00:00:00.000Z',
      effectiveAt: '2026-11-01T00:00:00.000Z',
      expiresAt: '2027-11-01T00:00:00.000Z',
      status: 'active',
      createdBy: 'issuer',
    })

    const store = new SqlSageInstitutionalCapacityStore(sql, NOW)
    await db.exec('begin')
    try {
      const result = await executeInstitutionalActionInTransaction(sql, {
        actor: {
          orgId: ORG,
          workspaceId: WS,
          actorId: ACTOR,
          actorKind: 'human',
          authenticated: true,
          activeWorkspaceMembership: true,
          applicationPermissionGranted: true,
          claimedPositionId: POSITION,
        },
        mandateId: mandate.id,
        resourceId: RESOURCE,
        action: 'resource.commit',
        evaluatedAt: NOW,
        idempotencyKey: 'capacity-admit-1',
        requestedCommitMinor: 500_000,
        capacityStore: store,
      })
      expect(result.admitted).toBe(true)
    } finally {
      await db.exec('rollback')
    }
  })

  it('refuses when conflict attestation is true', async () => {
    await insertInstitutionalOfficeHolding(sql, {
      orgId: ORG,
      workspaceId: WS,
      actorId: ACTOR,
      positionId: POSITION,
      instrumentRef: 'BOARD-HOLDING-1',
      instrumentVersion: 'v1',
      effectiveAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
      createdBy: 'issuer',
    })
    await insertInstitutionalConflictAttestation(sql, {
      orgId: ORG,
      workspaceId: WS,
      actorId: ACTOR,
      resourceId: RESOURCE,
      actionScope: '*',
      conflicted: true,
      instrumentRef: 'RECUSAL-1',
      instrumentVersion: 'v1',
      attestedBy: 'ethics-officer',
      attestedAt: NOW,
      effectiveAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
    })

    const store = new SqlSageInstitutionalCapacityStore(sql, NOW)
    const capacity = await resolveInstitutionalCapacityForAdmission(store, {
      orgId: ORG,
      workspaceId: WS,
      actorId: ACTOR,
      resourceId: RESOURCE,
      action: 'resource.commit',
      mandateId: 'm1',
      mandatePositionId: POSITION,
    })
    expect(capacity.resolved).toBe(true)
    if (capacity.resolved) expect(capacity.conflictOrRecusal).toBe(true)
  })

  it('fails closed on spoofed position claim against a verified holding', async () => {
    await insertInstitutionalOfficeHolding(sql, {
      orgId: ORG,
      workspaceId: WS,
      actorId: ACTOR,
      positionId: POSITION,
      instrumentRef: 'BOARD-HOLDING-1',
      instrumentVersion: 'v1',
      effectiveAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
      createdBy: 'issuer',
    })
    await insertInstitutionalConflictAttestation(sql, {
      orgId: ORG,
      workspaceId: WS,
      actorId: ACTOR,
      resourceId: RESOURCE,
      actionScope: 'resource.commit',
      conflicted: false,
      instrumentRef: 'CONFLICT-CLEAR-1',
      instrumentVersion: 'v1',
      attestedBy: 'ethics-officer',
      attestedAt: NOW,
      effectiveAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
    })

    const store = new SqlSageInstitutionalCapacityStore(sql, NOW)
    const capacity = await resolveInstitutionalCapacityForAdmission(store, {
      orgId: ORG,
      workspaceId: WS,
      actorId: ACTOR,
      resourceId: RESOURCE,
      action: 'resource.commit',
      mandateId: 'm1',
      mandatePositionId: POSITION,
      claimedPositionId: 'pos-spoofed',
    })
    expect(capacity.resolved).toBe(false)
    if (!capacity.resolved) expect(capacity.reason).toBe('POSITION_CLAIM_MISMATCH')
  })
})
