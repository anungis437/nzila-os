// PGlite: Pattern-A decision ratification under institutional mandate.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { SageSqlClient } from './sql-client'
import { PostgresSageRepository } from './postgres-repository'
import { insertInstitutionalMandate, revokeInstitutionalMandate } from './institutional-mandate-store'
import { ratifySageDecisionUnderMandate } from './services'
import type { SageServiceContext } from './service-context'
import type { SageServiceDeps } from './services'
import { SAGE_PERMISSIONS } from './permissions'
import { deriveSageBoundaryProfile } from './boundary-profile'

const BOUNDARY = JSON.stringify(
  deriveSageBoundaryProfile('crown_corporation', 'general_governance'),
).replace(/'/g, "''")

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

const ORG = 'org-ratify-1'
const WS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const RESOURCE = 'programme.decision.alpha'
const ACTOR = 'actor-officer-1'
const POSITION = 'pos-accountable-officer'
const NOW = '2026-11-23T17:00:00.000Z'

let db: PGlite
let sql: SageSqlClient
let repo: PostgresSageRepository

const auditEvents: unknown[] = []
const deps = (): SageServiceDeps => ({
  repo,
  audit: {
    async record(payload) {
      auditEvents.push(payload)
    },
  },
})

function ctx(): SageServiceContext {
  return {
    actor: {
      actorId: ACTOR,
      orgId: ORG,
      actorKind: 'human',
      permissions: [SAGE_PERMISSIONS.DECISION_RECORD, SAGE_PERMISSIONS.WORKSPACE_READ],
    },
    now: () => new Date(NOW),
  }
}

beforeAll(async () => {
  db = await new PGlite()
  for (const file of sageMigrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'))
  }
  sql = pgliteClient(db)
  repo = new PostgresSageRepository(sql)
}, 60_000)

beforeEach(async () => {
  auditEvents.length = 0
  await db.exec(`
    truncate table sage_audit_outbox cascade;
    truncate table sage_institutional_action cascade;
    truncate table sage_resource_commitment cascade;
    truncate table sage_institutional_mandate cascade;
    truncate table sage_decision_record cascade;
    truncate table sage_role_assignment cascade;
    truncate table sage_workspace_member cascade;
    truncate table sage_workspace cascade;
  `)
  await db.exec(`select set_config('app.tenant_id', '${ORG}', false);`)
  await db.exec(`
    insert into sage_workspace (id, org_id, name, status, institution_type, risk_surface, boundary_profile, created_by)
    values ('${WS}', '${ORG}', 'Ratify WS', 'active', 'crown_corporation', 'general_governance', '${BOUNDARY}'::jsonb, 'seed');
    insert into sage_workspace_member (workspace_id, org_id, actor_id, created_by)
    values ('${WS}', '${ORG}', '${ACTOR}', 'seed');
    insert into sage_role_assignment
      (workspace_id, org_id, actor_id, sage_application_role, workspace_scope, created_at)
    values ('${WS}', '${ORG}', '${ACTOR}', 'decision_record_approver', 'workspace', '${NOW}');
  `)
})

async function seedMandate() {
  return insertInstitutionalMandate(sql, {
    orgId: ORG,
    workspaceId: WS,
    principalActorId: ACTOR,
    positionId: POSITION,
    resourceId: RESOURCE,
    permittedActions: ['decision.ratify'],
    instrumentRef: 'DEL-RATIFY-1',
    instrumentVersion: 'v1',
    issuerActorId: 'issuer-1',
    verificationStatus: 'verified',
    attestedAt: '2026-01-01T00:00:00.000Z',
    acceptedAt: '2026-01-02T00:00:00.000Z',
    effectiveAt: '2026-01-03T00:00:00.000Z',
    expiresAt: '2027-01-01T00:00:00.000Z',
    status: 'active',
    createdBy: 'attestor-1',
  })
}

describe('ratifySageDecisionUnderMandate (PGlite Pattern A)', () => {
  it('admits a decision and writes decision + institutional action + outbox together', async () => {
    const mandate = await seedMandate()
    const result = await ratifySageDecisionUnderMandate(deps(), ctx(), {
      workspaceId: WS,
      mandateId: mandate.id,
      positionId: POSITION,
      resourceId: RESOURCE,
      decision: 'Proceed with the recommended option',
      uncertainty: 'Evidence coverage is partial for Q4 outcomes',
      idempotencyKey: 'ratify-1',
    })
    expect(result.admitted).toBe(true)
    if (!result.admitted) return
    expect(result.record.humanReviewerId).toBe(ACTOR)
    expect(result.actionId).toBeTruthy()

    const actions = await db.query<{ action: string; decision_reason: string }>(
      `select action::text as action, decision_reason from sage_institutional_action`,
    )
    expect(actions.rows).toHaveLength(1)
    expect(actions.rows[0]?.action).toBe('decision.ratify')

    const outbox = await db.query<{ action: string }>(
      `select action from sage_audit_outbox`,
    )
    expect(outbox.rows.some((r) => r.action === 'sage.decision.ratified_under_mandate')).toBe(true)
  })

  it('refuses a revoked mandate without inserting a decision', async () => {
    const mandate = await seedMandate()
    await revokeInstitutionalMandate(sql, {
      orgId: ORG,
      workspaceId: WS,
      mandateId: mandate.id,
      revokedAt: '2026-11-23T16:59:00.000Z',
    })
    const result = await ratifySageDecisionUnderMandate(deps(), ctx(), {
      workspaceId: WS,
      mandateId: mandate.id,
      positionId: POSITION,
      resourceId: RESOURCE,
      decision: 'Should not persist',
      uncertainty: 'n/a',
      idempotencyKey: 'ratify-revoked',
    })
    expect(result.admitted).toBe(false)
    const decisions = await db.query(`select id from sage_decision_record`)
    expect(decisions.rows).toHaveLength(0)
  })

  it('is idempotent for the same ratification key', async () => {
    const mandate = await seedMandate()
    const first = await ratifySageDecisionUnderMandate(deps(), ctx(), {
      workspaceId: WS,
      mandateId: mandate.id,
      positionId: POSITION,
      resourceId: RESOURCE,
      decision: 'Adopt option B',
      uncertainty: 'Residual delivery risk',
      idempotencyKey: 'same-ratify',
    })
    const second = await ratifySageDecisionUnderMandate(deps(), ctx(), {
      workspaceId: WS,
      mandateId: mandate.id,
      positionId: POSITION,
      resourceId: RESOURCE,
      decision: 'Adopt option B',
      uncertainty: 'Residual delivery risk',
      idempotencyKey: 'same-ratify',
    })
    expect(first.admitted && second.admitted).toBe(true)
    if (!first.admitted || !second.admitted) return
    expect(second.reusedExisting).toBe(true)
    expect(second.record.id).toBe(first.record.id)
    const decisions = await db.query(`select id from sage_decision_record`)
    expect(decisions.rows).toHaveLength(1)
  })
})
