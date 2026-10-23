import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import type { DecisionProofAdapterRequest, DecisionRecord } from '@nzila/decision-core'
import { verifyNarRecord, type NarRecord } from '@nzila/nar'

const state = vi.hoisted(() => ({ execute: undefined as unknown,
  tenant: '11111111-1111-4111-8111-111111111111' }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (context: { organizationId: string }, operation: (tx: unknown) => unknown) => {
    if (context.organizationId !== state.tenant) throw new Error('MEMBERSHIP_REQUIRED')
    return (state.execute as (op: typeof operation) => unknown)(operation)
  },
}))
vi.mock('@nzila/nar', async (original) => ({
  ...(await original<typeof import('@nzila/nar')>()),
  getNarSigningSecret: async () => 'test-only-canonical-nar-secret',
}))

import { canonicalNarProofAdapter, createCanonicalNarProofAdapter } from '../canonical-nar-proof'
import type { RLSTx } from '@/lib/db/with-rls-context'

const org = '11111111-1111-4111-8111-111111111111'
const otherOrg = '22222222-2222-4222-8222-222222222222'
const decision: DecisionRecord = {
  id: 'decision-1', organizationId: org, domain: 'labour', resourceType: 'claim', resourceId: 'pending',
  actor: { id: 'platform-member', type: 'user' }, input: { memberId: 'platform-member' },
  policy: { id: 'labour.grievance.intake', version: '1.0.0', domain: 'labour' },
  outcome: { status: 'approved' }, createdAt: '2026-10-22T00:00:00Z',
}
const context = { decisionType: 'union.grievance.intake.submitted', actionType: 'claim:intake' } as DecisionProofAdapterRequest
let pg: PGlite

beforeAll(async () => {
  pg = new PGlite()
  // Isolated PostgreSQL fixture: tenant filtering and append-only runtime grants.
  // Live signed-binding policies are separately exercised by the staging verifier.
  await pg.exec(`CREATE ROLE nar_runtime;
    CREATE TABLE audit_logs (id uuid PRIMARY KEY, audit_id uuid NOT NULL UNIQUE,
      created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, organization_id uuid NOT NULL,
      action text, resource_type text, resource_id text, user_id text, ip_address inet,
      user_agent text, details jsonb, changes jsonb, content_hash text, previous_hash text);
    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT ON audit_logs TO nar_runtime;
    CREATE POLICY tenant ON audit_logs USING
      (organization_id::text = current_setting('test.tenant', true))
      WITH CHECK (organization_id::text = current_setting('test.tenant', true));
    CREATE TABLE business_write_fixture (id text);
    GRANT INSERT ON business_write_fixture TO nar_runtime;`)
  const db = drizzle(pg)
  state.execute = (operation: Parameters<typeof db.transaction>[0]) => db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE nar_runtime`)
    await tx.execute(sql`SELECT set_config('test.tenant', ${state.tenant}, true)`)
    // Production uses postgres-js row arrays; PGlite's driver wraps them in { rows }.
    // Adapt only that driver result envelope, retaining real SQL and transaction errors.
    const postgresJsTx = new Proxy(tx, {
      get(target, property) {
        if (property === 'execute') return async (query: Parameters<typeof tx.execute>[0]) =>
          (await target.execute(query)).rows
        return Reflect.get(target, property)
      },
    })
    return operation(postgresJsTx)
  })
})
beforeEach(async () => {
  state.tenant = org
  await pg.exec('TRUNCATE audit_logs')
})
afterAll(async () => { await pg?.close() })

describe('canonical signed decision proof persistence', () => {
  it('reads back a real signed record and chains subsequent decisions without audit_records or blob storage', async () => {
    const first = await canonicalNarProofAdapter.createProof(decision, context)
    const second = await canonicalNarProofAdapter.createProof({ ...decision, id: 'decision-2' }, context)
    const rows = (await pg.query<{ id: string; details: { narRecord: NarRecord }; previous_hash: string; content_hash: string }>(
      'SELECT * FROM audit_logs ORDER BY created_at, id')).rows
    expect(rows).toHaveLength(2)
    expect(first.auditRecordId).toBe(rows[0].id)
    expect(second.auditRecordId).toBe(rows[1].id)
    expect(second.previousHash).toBe(first.hash)
    expect(rows[1].previous_hash).toBe(rows[0].content_hash)
    for (const row of rows) {
      expect((await verifyNarRecord(row.details.narRecord, 'test-only-canonical-nar-secret')).valid).toBe(true)
      expect(row.details.narRecord.storage).toBeUndefined()
    }
  })

  it('refuses a tampered head and rolls back without appending', async () => {
    await canonicalNarProofAdapter.createProof(decision, context)
    await pg.exec(`UPDATE audit_logs SET details=jsonb_set(details, '{narRecord,resourceId}', '"tampered"')`)
    await expect(canonicalNarProofAdapter.createProof(decision, context)).rejects.toThrow('UE_NAR_INVALID_CANONICAL_HEAD')
    expect((await pg.query('SELECT * FROM audit_logs')).rows).toHaveLength(1)
  })

  it('rejects a foreign organization before entering a tenant transaction', async () => {
    await expect(canonicalNarProofAdapter.createProof({ ...decision, organizationId: otherOrg }, context))
      .rejects.toThrow('MEMBERSHIP_REQUIRED')
    expect((await pg.query('SELECT * FROM audit_logs')).rows).toHaveLength(0)
  })

  it('preserves tenant boundaries and denies runtime updates/deletes of proofs', async () => {
    await canonicalNarProofAdapter.createProof(decision, context)
    await pg.exec(`BEGIN; SET LOCAL ROLE nar_runtime; SET LOCAL test.tenant='${otherOrg}'`)
    expect((await pg.query('SELECT * FROM audit_logs')).rows).toHaveLength(0)
    await pg.exec('ROLLBACK')
    for (const mutation of ['UPDATE audit_logs SET action=\'changed\'', 'DELETE FROM audit_logs']) {
      await pg.exec(`BEGIN; SET LOCAL ROLE nar_runtime; SET LOCAL test.tenant='${org}'`)
      await expect(pg.exec(mutation)).rejects.toMatchObject({ code: '42501' })
      await pg.exec('ROLLBACK')
    }
    await pg.exec('BEGIN; SET LOCAL ROLE nar_runtime')
    expect((await pg.query('SELECT * FROM audit_logs')).rows).toHaveLength(0)
    await pg.exec('ROLLBACK')
  })

  it('rolls back if INSERT succeeds but persisted proof readback is altered', async () => {
    await pg.exec(`CREATE FUNCTION alter_nar_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN NEW.details=jsonb_set(NEW.details,'{narRecord,resourceId}','"altered"'); RETURN NEW; END $$;
      CREATE TRIGGER alter_nar_fixture BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION alter_nar_fixture();`)
    try {
      const transaction = state.execute as (operation: (tx: RLSTx) => Promise<unknown>) => Promise<unknown>
      await expect(transaction(async (tx) => {
        await tx.execute(sql`INSERT INTO business_write_fixture VALUES ('must-roll-back')`)
        return createCanonicalNarProofAdapter(tx).createProof(decision, context)
      })).rejects.toThrow('UE_NAR_CANONICAL_READBACK_FAILED')
      expect((await pg.query('SELECT * FROM audit_logs')).rows).toHaveLength(0)
      expect((await pg.query('SELECT * FROM business_write_fixture')).rows).toHaveLength(0)
    } finally { await pg.exec('DROP TRIGGER alter_nar_fixture ON audit_logs; DROP FUNCTION alter_nar_fixture()') }
  })
})
