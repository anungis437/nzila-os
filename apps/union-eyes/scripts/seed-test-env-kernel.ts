import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { runAuthorityTransaction, type SqlExecutor } from '@/lib/authority/store/executor'
import { auditAuthorityMutation } from '@/lib/authority/store/audit'
import { canonicalMembershipSource } from '@/lib/authority/store/identity'
import { issueMandate, requestIssuanceApproval } from '@/lib/authority/store/lifecycle'
import { changeMandateState, insertMandate, insertRelationship, recordApprovalDecision } from '@/lib/authority/store/mutations'
import { UE_TEST_CASES } from '@/tests/fixtures/test-cases'
import { UE_TEST_FINANCE } from '@/tests/fixtures/test-finance'
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
type MandateScopeJson = { unitIds?: string[]; resourceIds?: string[]; accountIds?: string[] }
const RULE_POWERS: Record<string, string[]> = {
  supervisory: ['read', 'assign', 'monitor'],
  financial: ['view', 'prepare', 'approve', 'execute', 'reconcile', 'audit'],
}
const sameSet = (a: readonly string[] | undefined, b: readonly string[] | undefined) => {
  const x = [...(a ?? [])].sort()
  const y = [...(b ?? [])].sort()
  return x.length === y.length && x.every((value, index) => value === y[index])
}

async function seedQaMandate(
  client: pg.Client,
  exec: SqlExecutor,
  principal: { userId: string; orgId: string },
  kind: 'supervisory' | 'financial',
  powers: readonly string[],
  scope: MandateScopeJson,
  purpose: string,
): Promise<number> {
  const organizationId = principal.orgId
  const live = await client.query(
    `SELECT id::text AS id, scope, powers FROM ue_authority_mandates
      WHERE organization_id = $1 AND principal_user_id = $2 AND kind = $3 AND status = 'active' AND revoked_at IS NULL`,
    [organizationId, principal.userId, kind],
  )
  const current = live.rows.some((row) => {
    const held = ((row.powers as string[] | undefined) ?? []).map(String)
    const have = (row.scope as MandateScopeJson | null) ?? {}
    return sameSet(held, powers) && sameSet(have.unitIds, scope.unitIds) && sameSet(have.resourceIds, scope.resourceIds) && sameSet(have.accountIds, scope.accountIds)
  })
  if (current) return 0
  // A fixture mandate with a stale scope is revoked through the application's own mandate-state path before it is reissued.
  for (const stale of live.rows.filter((row) => !current)) {
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
       SELECT $1, $5, 'issue', ARRAY['executive']::text[], $6::text[], 400, false, 0,
          COALESCE((SELECT max(version) FROM ue_authority_issuance_rules WHERE organization_id = $1 AND domain = $5 AND operation = 'issue'), 0) + 1,
          'active', 'SYNTHETIC QA FIXTURE - not an institutional rule', $2, ARRAY[$3, $4]::ue_authority_principal[], now()
       WHERE NOT EXISTS (SELECT 1 FROM ue_authority_issuance_rules WHERE organization_id = $1 AND domain = $5 AND operation = 'issue' AND status = 'active')`,
      [organizationId, UE_TEST_USERS.adminPrimary.userId, UE_TEST_USERS.executivePrimary.userId, UE_TEST_USERS.auditorReadOnly.userId, kind, RULE_POWERS[kind]],
    )
    const rule = (
      await tx.query<{ id: string }>(
        `SELECT id::text AS id FROM ue_authority_issuance_rules WHERE organization_id = $1 AND domain = $2 AND operation = 'issue' AND status = 'active'`,
        [organizationId, kind],
      )
    ).rows[0]
    if (!rule) throw new Error('could not establish the synthetic supervisory issuance rule')
    await insertMandate(tx, {
      organizationId,
      principalUserId: principal.userId,
      kind,
      powers,
      scope,
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

/** Inserts a labelled synthetic issuance rule for the QA organization, audited like every authority event. Idempotent. */
async function ensureQaRule(
  client: pg.Client,
  exec: SqlExecutor,
  organizationId: string,
  rule: { domain: string; powers: string[]; approvals: number; maxTermDays: number },
): Promise<void> {
  const live = await client.query(
    `SELECT 1 FROM ue_authority_issuance_rules WHERE organization_id = $1 AND domain = $2 AND operation = 'issue' AND status = 'active'`,
    [organizationId, rule.domain],
  )
  if (live.rowCount) return
  await runAuthorityTransaction(exec, { organizationId, userId: UE_TEST_USERS.adminPrimary.userId }, async (tx) => {
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO ue_authority_issuance_rules
         (organization_id, domain, operation, issuer_capacities, allowed_powers, max_term_days, requires_acceptance,
          required_independent_approvals, version, status, source_instrument, drafted_by, approved_by, activated_at)
       VALUES ($1, $2, 'issue', ARRAY['executive']::text[], $3::text[], $4, false, $5,
          COALESCE((SELECT max(version) FROM ue_authority_issuance_rules WHERE organization_id = $1 AND domain = $2 AND operation = 'issue'), 0) + 1,
          'active', 'SYNTHETIC QA FIXTURE - not an institutional rule', $6, ARRAY[$7, $8]::ue_authority_principal[], now())
       RETURNING id::text AS id`,
      [organizationId, rule.domain, rule.powers, rule.maxTermDays, rule.approvals, UE_TEST_USERS.adminPrimary.userId, UE_TEST_USERS.executivePrimary.userId, UE_TEST_USERS.auditorReadOnly.userId],
    )
    await auditAuthorityMutation(tx, {
      organizationId,
      action: 'issuance_rule.fixture_activate',
      resourceType: 'ue_authority_issuance_rules',
      resourceId: inserted.rows[0].id,
      details: { domain: rule.domain, operation: 'issue', fixture: true },
    })
  })
}

/**
 * A financial mandate issued through the GOVERNED workflow: the database refuses any financial issuance without an independent
 * approval bound to that exact instrument. The root of trust (the executive_office rule and the approver's mandate) is a labelled
 * synthetic fixture; everything after it is the application's own path: the executive requests the approval, the independent
 * approver decides it as themself, and the mandate is issued against the satisfied request.
 */
async function seedQaFinancialMandate(
  client: pg.Client,
  exec: SqlExecutor,
  holder: { userId: string; orgId: string },
  powers: readonly string[],
  scope: MandateScopeJson,
): Promise<number> {
  const organizationId = holder.orgId
  const issuer = UE_TEST_USERS.executivePrimary.userId
  const approver = UE_TEST_USERS.governanceApprover.userId
  const deps = { memberships: canonicalMembershipSource }

  const live = await client.query(
    `SELECT id::text AS id, scope, powers FROM ue_authority_mandates
      WHERE organization_id = $1 AND principal_user_id = $2 AND kind = 'financial' AND status = 'active' AND revoked_at IS NULL`,
    [organizationId, holder.userId],
  )
  const current = live.rows.some((row) => {
    const have = (row.scope as MandateScopeJson | null) ?? {}
    return sameSet(((row.powers as string[]) ?? []).map(String), powers) && sameSet(have.resourceIds, scope.resourceIds) && sameSet(have.accountIds, scope.accountIds)
  })
  if (current) return 0
  for (const stale of live.rows) {
    await runAuthorityTransaction(exec, { organizationId, userId: UE_TEST_USERS.adminPrimary.userId }, (tx) =>
      changeMandateState(tx, organizationId, String(stale.id), 'revoke', UE_TEST_USERS.adminPrimary.userId),
    )
  }

  await ensureQaRule(client, exec, organizationId, { domain: 'executive_office', powers: ['approve'], approvals: 0, maxTermDays: 400 })
  await ensureQaRule(client, exec, organizationId, { domain: 'financial', powers: RULE_POWERS.financial, approvals: 1, maxTermDays: 400 })

  const approverOffice = await client.query(
    `SELECT 1 FROM ue_authority_mandates WHERE organization_id = $1 AND principal_user_id = $2 AND kind = 'executive_office' AND status = 'active' AND revoked_at IS NULL`,
    [organizationId, approver],
  )
  if (!approverOffice.rowCount) {
    await runAuthorityTransaction(exec, { organizationId, userId: issuer }, (tx) =>
      issueMandate(tx, deps, {
        organizationId,
        issuerUserId: issuer,
        holderUserId: approver,
        kind: 'executive_office',
        powers: ['approve'],
        sourceInstrument: 'SYNTHETIC QA FIXTURE - not an institutional mandate',
        justification: 'Runtime acceptance fixture: independent approver of QA financial issuances. Issues no institutional authority.',
        effectiveAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      }),
    )
  }

  const instrumentId = randomUUID()
  const input = {
    organizationId,
    issuerUserId: issuer,
    holderUserId: holder.userId,
    kind: 'financial' as const,
    powers,
    scope: scope as never,
    // Monetary duties carry an integer limit and a currency (assessMandate); the figures are synthetic.
    monetaryLimitMinor: 10_000_000,
    currency: 'CAD',
    sourceInstrument: 'SYNTHETIC QA FIXTURE - not an institutional mandate',
    justification: 'Runtime acceptance fixture: a segregated financial duty for the QA organization. Issues no institutional authority.',
    effectiveAt: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  }
  const approvalRequestId = await runAuthorityTransaction(exec, { organizationId, userId: issuer }, (tx) =>
    requestIssuanceApproval(tx, deps, { ...input, instrumentId, namedApproverIds: [approver] }),
  )
  await runAuthorityTransaction(exec, { organizationId, userId: approver }, (tx) =>
    recordApprovalDecision(tx, deps, { organizationId, approvalRequestId, approverUserId: approver, decision: 'approved', rationale: 'SYNTHETIC QA FIXTURE' }),
  )
  await runAuthorityTransaction(exec, { organizationId, userId: issuer }, (tx) => issueMandate(tx, deps, { ...input, id: instrumentId, approvalRequestId }))
  return 1
}
/** A synthetic employer for the remittance journey. Idempotent. */
async function seedQaEmployer(client: pg.Client): Promise<number> {
  const result = await client.query(
    `INSERT INTO employers (id, organization_id, name, employer_type, status) VALUES ($1, $2, $3, 'private', 'active') ON CONFLICT (id) DO NOTHING`,
    [UE_TEST_FINANCE.employerId, UE_TEST_FINANCE.organizationId, UE_TEST_FINANCE.employerName],
  )
  return result.rowCount ?? 0
}

export async function seedQaCaseAssignments(connectionString: string): Promise<number> {
  const client = new pg.Client({ connectionString })
  await client.connect()
  const exec = client as unknown as SqlExecutor
  let created = 0
  try {
    // The unit is the organization that owns the case (see the case-facts loader): one organization, never its descendants.
    const unit = { unitIds: [UE_TEST_USERS.chiefStewardPrimary.orgId] }
    created += await seedQaMandate(client, exec, UE_TEST_USERS.chiefStewardPrimary, 'supervisory', ['assign'], unit, 'lets the QA case coordinator route a filing')
    created += await seedQaMandate(client, exec, UE_TEST_USERS.supervisorPrimary, 'supervisory', ['read', 'monitor'], unit, 'lets the QA supervisor oversee cases without routing them')
    created += await seedQaEmployer(client)
    // Two segregated financial duties on one account, each ledger-wide for the organization.
    const ledger = { resourceIds: [UE_TEST_FINANCE.organizationId], accountIds: [UE_TEST_FINANCE.accountId] }
    created += await seedQaFinancialMandate(client, exec, UE_TEST_USERS.financePreparer, ['view', 'prepare'], ledger)
    created += await seedQaFinancialMandate(client, exec, UE_TEST_USERS.financeReconciler, ['view', 'reconcile'], ledger)
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
