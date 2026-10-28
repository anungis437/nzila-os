import pg from 'pg'
import { runAuthorityTransaction, type SqlExecutor } from '@/lib/authority/store/executor'
import { auditAuthorityMutation } from '@/lib/authority/store/audit'
import { changeMandateState, insertMandate, insertRelationship } from '@/lib/authority/store/mutations'
import { UE_TEST_CASES } from '@/tests/fixtures/test-cases'
import { UE_TEST_USERS } from '@/tests/fixtures/test-users'

/**
 * Synthetic QA fixture only (called by seed-test-env.ts, which refuses to run outside QA_TEST_ENV and on a
 * production-like database). Case authority comes from governed relationships, never from a role, so the signed-in
 * journeys need a case handler who actually holds the case. The QA steward is made the live assignee of the two QA
 * cases of the primary organization through the same relationship store the application uses, audited by the same
 * canonical audit chain. Nothing here is an institutional policy: it records no issuance rule, mandate or office.
 *
 * Idempotent: a live relationship that already exists is left alone (authority records are append-only).
 */
const HANDLER_PERMISSIONS = ['read', 'read_internal', 'comment', 'write_notes', 'draft_action', 'upload_evidence', 'modify_document'] as const

/**
 * A synthetic supervisory mandate so the QA case coordinator can hand a filing to a steward. It is labelled in its own
 * source instrument as a fixture, names no issuance rule, and is issued by the QA administrator: it proves the application
 * honours a mandate when one exists, and records no institutional decision.
 */
async function seedQaSupervisoryMandate(
  client: pg.Client,
  exec: SqlExecutor,
  principal: { userId: string; orgId: string },
  powers: readonly string[],
  purpose: string,
): Promise<number> {
  const organizationId = principal.orgId
  const live = await client.query(
    `SELECT id::text AS id, scope, powers FROM ue_authority_mandates
      WHERE organization_id = $1 AND principal_user_id = $2 AND kind = 'supervisory' AND status = 'active' AND revoked_at IS NULL`,
    [organizationId, principal.userId],
  )
  const wanted = organizationId
  const current = live.rows.some((row) => {
    const ids: unknown = (row.scope as { unitIds?: unknown } | null)?.unitIds
    const held = ((row.powers as string[] | undefined) ?? []).map(String)
    return Array.isArray(ids) && ids.includes(wanted) && powers.length === held.length && powers.every((power) => held.includes(power))
  })
  if (current) return 0
  // A fixture mandate with a stale scope is revoked through the application's own mandate-state path before it is reissued.
  for (const stale of live.rows) {
    await runAuthorityTransaction(exec, { organizationId, userId: UE_TEST_USERS.adminPrimary.userId }, (tx) =>
      changeMandateState(tx, organizationId, String(stale.id), 'revoke', UE_TEST_USERS.adminPrimary.userId),
    )
  }
  // The database refuses any mandate without an active issuance rule and binds each write to the authenticated principal. This
  // fixture rule is labelled synthetic in its own source instrument and its two "approvers" are fixture identities: it exists
  // only in the QA database, which the seed refuses to touch if it looks like production, and it adopts no institutional policy.
  await runAuthorityTransaction(exec, { organizationId, userId: UE_TEST_USERS.adminPrimary.userId }, async (tx) => {
    await tx.query(
      `INSERT INTO ue_authority_issuance_rules
         (organization_id, domain, operation, issuer_capacities, allowed_powers, max_term_days, requires_acceptance,
          required_independent_approvals, version, status, source_instrument, drafted_by, approved_by, activated_at)
       SELECT $1, 'supervisory', 'issue', ARRAY['executive']::text[], ARRAY['read','assign','monitor']::text[], 400, false, 0,
          COALESCE((SELECT max(version) FROM ue_authority_issuance_rules WHERE organization_id = $1 AND domain = 'supervisory' AND operation = 'issue'), 0) + 1,
          'active', 'SYNTHETIC QA FIXTURE - not an institutional rule', $2, ARRAY[$3, $4]::ue_authority_principal[], now()
       WHERE NOT EXISTS (SELECT 1 FROM ue_authority_issuance_rules WHERE organization_id = $1 AND domain = 'supervisory' AND operation = 'issue' AND status = 'active')`,
      [organizationId, UE_TEST_USERS.adminPrimary.userId, UE_TEST_USERS.executivePrimary.userId, UE_TEST_USERS.auditorReadOnly.userId],
    )
    const rule = (
      await tx.query<{ id: string }>(
        `SELECT id::text AS id FROM ue_authority_issuance_rules WHERE organization_id = $1 AND domain = 'supervisory' AND operation = 'issue' AND status = 'active'`,
        [organizationId],
      )
    ).rows[0]
    if (!rule) throw new Error('could not establish the synthetic supervisory issuance rule')
    await insertMandate(tx, {
      organizationId,
      principalUserId: principal.userId,
      kind: 'supervisory',
      powers,
      // The unit is the organization that owns the case (see the case-facts loader): one organization, never its descendants.
      scope: { unitIds: [organizationId] },
      sourceInstrument: 'SYNTHETIC QA FIXTURE - not an institutional mandate',
      grantedBy: UE_TEST_USERS.adminPrimary.userId,
      justification: `Runtime acceptance fixture: ${purpose}. Issues no institutional authority.`,
      effectiveAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      issuanceRuleId: rule.id,
    })
  })
  return 1
}

/**
 * Synthetic case-assignment issuance rules (issue and revoke) for the QA organization. Assigning or reassigning a case needs a
 * live rule for that operation. Their capacities and powers mirror the platform's reference catalog; they are labelled as a
 * fixture in their source instrument and adopt no institutional policy.
 */
async function seedQaCaseAssignmentRules(client: pg.Client, exec: SqlExecutor): Promise<number> {
  const organizationId = UE_TEST_USERS.chiefStewardPrimary.orgId
  const powers = ['read', 'read_internal', 'comment', 'write_notes', 'draft_action', 'upload_evidence', 'modify_document', 'process_ocr', 'read_third_party_restricted']
  let added = 0
  for (const [operation, allowed] of [['issue', powers], ['revoke', []]] as const) {
    const live = await client.query(
      `SELECT 1 FROM ue_authority_issuance_rules WHERE organization_id = $1 AND domain = 'case_assignment' AND operation = $2 AND status = 'active'`,
      [organizationId, operation],
    )
    if (live.rowCount) continue
    await runAuthorityTransaction(exec, { organizationId, userId: UE_TEST_USERS.adminPrimary.userId }, async (tx) => {
      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO ue_authority_issuance_rules
           (organization_id, domain, operation, issuer_capacities, allowed_powers, max_term_days, requires_acceptance,
            required_independent_approvals, version, status, source_instrument, drafted_by, approved_by, activated_at)
         VALUES ($1, 'case_assignment', $2, ARRAY['steward','chief_steward','officer']::text[], $3::text[], NULL, false, 0,
            COALESCE((SELECT max(version) FROM ue_authority_issuance_rules WHERE organization_id = $1 AND domain = 'case_assignment' AND operation = $2), 0) + 1,
            'active', 'SYNTHETIC QA FIXTURE - not an institutional rule', $4, ARRAY[$5, $6]::ue_authority_principal[], now())
         RETURNING id::text AS id`,
        [organizationId, operation, allowed, UE_TEST_USERS.adminPrimary.userId, UE_TEST_USERS.executivePrimary.userId, UE_TEST_USERS.auditorReadOnly.userId],
      )
      // Every authority event needs its canonical audit record in the same transaction.
      await auditAuthorityMutation(tx, {
        organizationId,
        action: 'issuance_rule.fixture_activate',
        resourceType: 'ue_authority_issuance_rules',
        resourceId: inserted.rows[0].id,
        details: { domain: 'case_assignment', operation, fixture: true },
      })
    })
    added += 1
  }
  return added
}

export async function seedQaCaseAssignments(connectionString: string): Promise<number> {
  const client = new pg.Client({ connectionString })
  await client.connect()
  const exec = client as unknown as SqlExecutor
  let created = 0
  try {
    created += await seedQaSupervisoryMandate(client, exec, UE_TEST_USERS.chiefStewardPrimary, ['assign'], 'lets the QA case coordinator route a filing')
    created += await seedQaSupervisoryMandate(client, exec, UE_TEST_USERS.supervisorPrimary, ['read', 'monitor'], 'lets the QA supervisor oversee cases without routing them')
    created += await seedQaCaseAssignmentRules(client, exec)
    const cases = [UE_TEST_CASES.primarySubmitted, UE_TEST_CASES.primaryAssigned]
    for (const qaCase of cases) {
      const live = await client.query(
        `SELECT 1 FROM ue_authority_resource_relationships
          WHERE organization_id = $1 AND principal_user_id = $2 AND resource_type = 'case' AND resource_id = $3
            AND relation = 'assignee' AND status = 'active' AND revoked_at IS NULL`,
        [qaCase.organizationId, UE_TEST_USERS.stewardPrimary.userId, qaCase.claimId],
      )
      if (live.rowCount) continue
      await runAuthorityTransaction(exec, { organizationId: qaCase.organizationId, userId: UE_TEST_USERS.adminPrimary.userId }, (tx) =>
        insertRelationship(tx, {
          organizationId: qaCase.organizationId,
          principalUserId: UE_TEST_USERS.stewardPrimary.userId,
          resourceType: 'case',
          resourceId: qaCase.claimId,
          relation: 'assignee',
          permissions: HANDLER_PERMISSIONS,
          origin: 'derived',
          effectiveAt: new Date(Date.now() - 60_000),
          auditDetails: { fixture: 'synthetic QA seed', claimNumber: qaCase.claimNumber },
        }),
      )
      created += 1
    }
  } finally {
    await client.end()
  }
  return created
}
