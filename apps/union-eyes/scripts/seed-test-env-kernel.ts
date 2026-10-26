import pg from 'pg'
import { runAuthorityTransaction, type SqlExecutor } from '@/lib/authority/store/executor'
import { insertRelationship } from '@/lib/authority/store/mutations'
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

export async function seedQaCaseAssignments(connectionString: string): Promise<number> {
  const client = new pg.Client({ connectionString })
  await client.connect()
  const exec = client as unknown as SqlExecutor
  let created = 0
  try {
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
