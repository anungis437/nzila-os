/**
 * F06 final hardening on real PostgreSQL — what is kept when a commercial transition is refused on an unverified acceptance.
 *
 * Runs lib/pilot/acceptance-denial.ts under the SYSTEM role (the principal the commercial-transition route runs as), with the canonical audit
 * ledger. Proves: the contract can be read and its metadata updated by that role (the manifest now declares SELECT), the claim is kept as a
 * claim and nothing else on the contract moves (status, signer), a repeated claim is not duplicated, another organization's contract is not
 * touched, the audit entry holds no name, and a failing audit write takes the claim with it.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const holder = vi.hoisted(() => ({ client: null as unknown }))

vi.mock('@/db', () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      drizzle(holder.client as never).transaction(async (tx) => {
        await tx.execute(sql.raw('SET LOCAL ROLE union_eyes_system'))
        return fn(tx)
      }),
  },
}))
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: async <T,>(fn: () => Promise<T>) => fn() }))

describe.skipIf(!URL)('commercial acceptance denial on real PostgreSQL as the system role', () => {
  let admin: pg.Client
  let client: ReturnType<typeof postgres>
  const orgA = randomUUID()
  const orgB = randomUUID()
  const contractA = randomUUID()
  const contractB = randomUUID()
  const appId = randomUUID()
  const claim = { acceptedByName: 'Pat Counterpart', acceptedByRole: 'President', channel: 'countersigned_document' as const, evidenceReference: 'doc-123' }

  const blocked = (operation = 'pilot.commercial.contract_signed') => ({
    operation,
    requires: 'provider_verified_acceptance' as const,
    policyVersion: 'ue-pilot-acceptance/provisional-2',
    policyApprovedBy: null,
    evidence: 'operator_recorded_unverified' as const,
  })
  const contract = async (id: string) => (await admin.query('SELECT status::text AS status, signed_by, metadata FROM commercial_contracts WHERE id = $1', [id])).rows[0]
  const auditRows = async (action: string, resource: string) =>
    (await admin.query('SELECT details FROM public.audit_logs WHERE action = $1 AND resource_id = $2', [action, resource])).rows
  const loadModule = () => import('@/lib/pilot/acceptance-denial')

  beforeAll(async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    client = postgres(URL as string, { max: 2, onnotice: () => undefined })
    holder.client = client
    for (const [org, contractId] of [[orgA, contractA], [orgB, contractB]] as const) {
      const slug = `ad-${org.slice(0, 8)}`
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1) ON CONFLICT (id) DO NOTHING`,
        [org, slug, slug],
      )
      const billing = (await admin.query(`INSERT INTO billing_accounts (organization_id, display_name, billing_email) VALUES ($1, 'B', 'b@example.test') RETURNING id`, [org])).rows[0].id
      await admin.query(
        `INSERT INTO commercial_contracts (id, organization_id, billing_account_id, contract_number, name, status, effective_date, expiration_date, metadata)
         VALUES ($1, $2, $3, $4, 'Pilot', 'pending_approval', now(), now() + interval '90 days', '{"source":"pilot-commercial-transition"}'::jsonb)`,
        [contractId, org, billing, `ADN-${contractId.slice(0, 8)}`],
      )
    }
    // What the manifest now declares for the system role on this table.
    await admin.query('GRANT SELECT ON commercial_contracts TO union_eyes_system')
  }, 120_000)

  afterAll(async () => {
    delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    await admin?.query('DROP TRIGGER IF EXISTS ue_test_refuse_audit ON public.audit_logs').catch(() => undefined)
    await admin?.query('DROP FUNCTION IF EXISTS ue_test_refuse_audit()').catch(() => undefined)
    await client?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('keeps the claim on the contract as a claim, leaves status and signer untouched, and writes an audit entry with no name', async () => {
    const { recordAcceptanceDenial } = await loadModule()

    const recorded = await recordAcceptanceDenial(
      { organizationId: orgA, applicationId: appId, fromState: 'contract_sent', targetState: 'contract_signed', blocked: blocked(), contractId: contractA, claim },
      'platform-admin-1',
      new Date('2026-11-01T00:00:00Z'),
    )

    expect(recorded).toBe(true)
    const row = await contract(contractA)
    expect(row.status).toBe('pending_approval')
    expect(row.signed_by).toBeNull()
    expect(row.metadata.counterpartAcceptance).toBeUndefined()
    expect(row.metadata.source).toBe('pilot-commercial-transition')
    expect(row.metadata.acceptanceClaims).toEqual([
      expect.objectContaining({ standing: 'unverified_claim', channelClaimed: 'countersigned_document', evidenceReference: 'doc-123', claimedByRole: 'President', recordedBy: 'platform-admin-1' }),
    ])
    expect(JSON.stringify(row.metadata.acceptanceClaims)).not.toContain('Pat Counterpart')
    const audits = await auditRows('pilot.commercial_transition.acceptance_refused', appId)
    expect(audits).toHaveLength(1)
    expect(audits[0].details).toMatchObject({ blockedOperation: 'pilot.commercial.contract_signed', evidence: 'operator_recorded_unverified', claimRecorded: true, policyApprovedBy: null })
    expect(JSON.stringify(audits[0].details)).not.toContain('Pat Counterpart')
  })

  it('does not duplicate the same claim when the request is repeated, but records every refusal', async () => {
    const { recordAcceptanceDenial } = await loadModule()
    await recordAcceptanceDenial(
      { organizationId: orgA, applicationId: appId, fromState: 'contract_sent', targetState: 'contract_signed', blocked: blocked(), contractId: contractA, claim },
      'platform-admin-1',
    )

    expect((await contract(contractA)).metadata.acceptanceClaims).toHaveLength(1)
    expect(await auditRows('pilot.commercial_transition.acceptance_refused', appId)).toHaveLength(2)
  })

  it('records only the refusal when no claim was made, as for a pilot state that rests on a missing acceptance', async () => {
    const { recordAcceptanceDenial } = await loadModule()
    const other = randomUUID()
    expect(
      await recordAcceptanceDenial(
        { organizationId: orgA, applicationId: other, fromState: 'invoice_issued', targetState: 'pilot_active', blocked: { ...blocked('pilot.commercial.pilot_active'), evidence: 'none' }, contractId: null },
        'platform-admin-1',
      ),
    ).toBe(true)
    expect((await auditRows('pilot.commercial_transition.acceptance_refused', other))[0].details).toMatchObject({ evidence: 'none', claimRecorded: false, contractId: null })
  })

  it('does not touch another organization\'s contract named under this organization', async () => {
    const { recordAcceptanceDenial } = await loadModule()
    const recorded = await recordAcceptanceDenial(
      { organizationId: orgA, applicationId: randomUUID(), fromState: 'contract_sent', targetState: 'contract_signed', blocked: blocked(), contractId: contractB, claim },
      'platform-admin-1',
    )

    expect(recorded).toBe(true)
    expect((await contract(contractB)).metadata.acceptanceClaims).toBeUndefined()
  })

  it('reports a refusal that could not be recorded and keeps no claim when the audit write fails', async () => {
    await admin.query(`CREATE OR REPLACE FUNCTION ue_test_refuse_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit refused'; END $$`)
    await admin.query(`CREATE TRIGGER ue_test_refuse_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW WHEN (NEW.action = 'pilot.commercial_transition.acceptance_refused') EXECUTE FUNCTION ue_test_refuse_audit()`)
    try {
      const { recordAcceptanceDenial } = await loadModule()
      const fresh = { ...claim, evidenceReference: 'doc-456' }
      const recorded = await recordAcceptanceDenial(
        { organizationId: orgA, applicationId: randomUUID(), fromState: 'contract_sent', targetState: 'contract_signed', blocked: blocked(), contractId: contractA, claim: fresh },
        'platform-admin-1',
      )

      expect(recorded).toBe(false)
      expect(JSON.stringify((await contract(contractA)).metadata.acceptanceClaims)).not.toContain('doc-456')
    } finally {
      await admin.query('DROP TRIGGER IF EXISTS ue_test_refuse_audit ON public.audit_logs')
    }
  })
})
