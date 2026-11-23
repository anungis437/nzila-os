import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { SageSqlClient } from './sql-client'
import { persistSageAccountabilityAdoptionInTransaction } from './accountability-adoption-persist'
import {
  buildSageAccountabilityDraft,
  type SageAccountabilityEvidenceRef,
} from './accountability-draft'
import {
  buildAuthorizedEvidenceContextPayload,
  type SageEvidenceContextCandidate,
  type SageSynthesisPrincipal,
} from './synthesis-context'
import { insertInstitutionalMandate } from './institutional-mandate-store'
import {
  SqlSageInstitutionalCapacityStore,
  insertInstitutionalConflictAttestation,
  insertInstitutionalOfficeHolding,
} from './institutional-capacity-store'

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

const ORG = 'org-adopt-1'
const WS = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const RESOURCE = 'engagement.accountability.t01'
const ACTOR = 'actor-accountable-1'
const POSITION = 'position-programme-lead'
const NOW = '2026-11-23T16:00:00.000Z'

let db: PGlite
let sql: SageSqlClient

const principal: SageSynthesisPrincipal = {
  actorId: ACTOR,
  orgId: ORG,
  workspaceId: WS,
  access: {
    hasMembership: true,
    activeRoles: ['internal_reviewer'],
    evidenceAuthorizations: ['sensitive'],
  },
}

function evidence(name: string): SageEvidenceContextCandidate {
  return {
    evidenceItemId: `ev-${name}`,
    sourceId: `src-${name}`,
    orgId: ORG,
    workspaceId: WS,
    authorizationLevel: 'internal',
  }
}

function ref(e: SageEvidenceContextCandidate): SageAccountabilityEvidenceRef {
  return {
    evidenceItemId: e.evidenceItemId,
    sourceId: e.sourceId,
    authorizationLevel: e.authorizationLevel,
  }
}

const expectedEv = evidence('expected')
const observedEv = evidence('observed')
const moneyEv = evidence('money')
const deliveryEv = evidence('delivery')
const interpA = evidence('interp-a')
const interpB = evidence('interp-b')
const authorized = [expectedEv, observedEv, moneyEv, deliveryEv, interpA, interpB]

beforeAll(async () => {
  db = await new PGlite()
  for (const file of sageMigrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'))
  }
  sql = pgliteClient(db)
  expect(sageMigrationFiles()).toContain('0052_sage_accountability_adoption.sql')
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
  await db.query(`select set_config('app.tenant_id', $1, false)`, [ORG])
  await db.exec(`
    insert into sage_workspace (id, org_id, name, status, institution_type, risk_surface, boundary_profile, created_by)
    values ('${WS}', '${ORG}', 'Adoption WS', 'active', 'crown_corporation', 'general_governance', '{}'::jsonb, 'seed');
  `)
})

describe('persistSageAccountabilityAdoptionInTransaction (PGlite)', () => {
  it('refuses adoption when capacity/conflict attestation is missing', async () => {
    const mandate = await insertInstitutionalMandate(sql, {
      orgId: ORG,
      workspaceId: WS,
      principalActorId: ACTOR,
      positionId: POSITION,
      resourceId: RESOURCE,
      permittedActions: ['decision.ratify'],
      instrumentRef: 'ADOPT-MANDATE-1',
      instrumentVersion: 'v1',
      issuerActorId: 'board',
      verificationStatus: 'verified',
      attestedAt: '2026-01-01T00:00:00.000Z',
      acceptedAt: '2026-01-02T00:00:00.000Z',
      effectiveAt: '2026-01-03T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
      status: 'active',
      createdBy: 'attestor',
    })
    const draft = buildSageAccountabilityDraft(
      buildAuthorizedEvidenceContextPayload(principal, authorized),
      {
        orgId: ORG,
        workspaceId: WS,
        resourceId: RESOURCE,
        objective: 'Close T01 engagement honestly',
        accountableActorId: ACTOR,
        intervention: 'Handover',
        reviewDueAt: '2026-12-01T00:00:00.000Z',
        expected: {
          value: 10,
          unit: 'working_days',
          window: 'engagement',
          evidence: ref(expectedEv),
        },
        observed: {
          value: 14,
          unit: 'working_days',
          window: 'engagement',
          evidence: ref(observedEv),
        },
        differingInterpretations: [
          { id: 'a', statement: 'Vendor delay', evidence: [ref(interpA)] },
          { id: 'b', statement: 'Internal handoff lag', evidence: [ref(interpB)] },
        ],
      },
    )

    await db.exec('begin')
    try {
      const result = await persistSageAccountabilityAdoptionInTransaction({
        sql,
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
        draft,
        choice: 'adopt',
        rationale: 'Accept the draft as the institutional record',
        adoptedAt: NOW,
        idempotencyKey: 'adopt-1',
        capacityStore: new SqlSageInstitutionalCapacityStore(sql, NOW),
      })
      expect(result.admitted).toBe(false)
    } finally {
      await db.exec('rollback')
    }
  })

  it('persists an authorized adoption and preserves draft facts without inventing spend', async () => {
    await insertInstitutionalOfficeHolding(sql, {
      orgId: ORG,
      workspaceId: WS,
      actorId: ACTOR,
      positionId: POSITION,
      instrumentRef: 'HOLD-1',
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
      actionScope: 'decision.ratify',
      conflicted: false,
      instrumentRef: 'CLEAR-1',
      instrumentVersion: 'v1',
      attestedBy: 'ethics',
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
      permittedActions: ['decision.ratify'],
      instrumentRef: 'ADOPT-MANDATE-1',
      instrumentVersion: 'v1',
      issuerActorId: 'board',
      verificationStatus: 'verified',
      attestedAt: '2026-01-01T00:00:00.000Z',
      acceptedAt: '2026-01-02T00:00:00.000Z',
      effectiveAt: '2026-01-03T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
      status: 'active',
      createdBy: 'attestor',
    })

    const draft = buildSageAccountabilityDraft(
      buildAuthorizedEvidenceContextPayload(principal, authorized),
      {
        orgId: ORG,
        workspaceId: WS,
        resourceId: RESOURCE,
        objective: 'Close T01 engagement honestly',
        accountableActorId: ACTOR,
        intervention: 'Handover',
        reviewDueAt: '2026-12-01T00:00:00.000Z',
        commitment: {
          monetaryCeilingMinor: 8_000_000,
          currency: 'CAD',
          expectedDeliverables: 4,
          evidence: ref(moneyEv),
        },
        execution: {
          receivedDeliverables: 3,
          evidence: ref(deliveryEv),
        },
        expected: {
          value: 10,
          unit: 'working_days',
          window: 'engagement',
          evidence: ref(expectedEv),
        },
        observed: {
          value: 14,
          unit: 'working_days',
          window: 'engagement',
          evidence: ref(observedEv),
        },
        differingInterpretations: [
          { id: 'a', statement: 'Vendor delay', evidence: [ref(interpA)] },
          { id: 'b', statement: 'Internal handoff lag', evidence: [ref(interpB)] },
        ],
      },
    )
    expect(draft.commitment.actualSpendMinor).toBeNull()
    expect(draft.executionDisposition).toBe('RECEIVED_ACCEPTANCE_UNPROVEN')

    await db.exec('begin')
    const result = await persistSageAccountabilityAdoptionInTransaction({
      sql,
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
      draft,
      choice: 'adopt',
      rationale: 'Adopt the incomplete record as the institutional baseline',
      adoptedAt: NOW,
      idempotencyKey: 'adopt-ok-1',
      capacityStore: new SqlSageInstitutionalCapacityStore(sql, NOW),
    })
    await db.exec('commit')

    expect(result.admitted).toBe(true)
    if (!result.admitted) return
    expect(result.adoption.status).toBe('ADOPTED')
    expect(result.adoption.preservesDraftFacts).toBe(true)
    expect(result.adoption.draftStatusPreserved).toBe('DRAFT_REQUIRES_HUMAN_ADOPTION')

    const rows = await db.query<{
      status: string
      draft_snapshot_json: { commitment: { actualSpendMinor: null } }
    }>(`select status, draft_snapshot_json from sage_accountability_adoption`)
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0]?.status).toBe('ADOPTED')
    expect(rows.rows[0]?.draft_snapshot_json.commitment.actualSpendMinor).toBeNull()
  })
})
