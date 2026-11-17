import { and, or, sql } from 'drizzle-orm'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { caseReadScope, caseTriageQueueScope, type CaseActor } from './case-authorization'
import { decideCaseCapabilities } from '@/lib/authority/store/route-adapter'
import { claimIdentitySelect } from './claim-identity'
import { projectWorkbenchRow } from './workbench-projection'

/** Candidate discovery is not access. Every returned case still needs a live kernel decision or a live triage designation. */
export async function loadWorkbenchCases(tx: RLSTx, actor: CaseActor, status: string | null) {
  const candidates = sql`EXISTS (SELECT FROM ue_authority_mandates a WHERE a.organization_id=${actor.organizationId}::uuid
    AND a.principal_user_id=${actor.userId} AND a.kind='supervisory' AND a.status='active'
    AND a.revoked_at IS NULL AND a.effective_at<=now() AND a.expires_at>now()
    AND (a.scope->'resourceIds' IS NULL OR a.scope->'resourceIds' ? c.claim_id::text)) OR EXISTS (
      SELECT FROM ue_authority_delegations d WHERE d.organization_id=${actor.organizationId}::uuid
        AND d.delegate_user_id=${actor.userId} AND d.status='active' AND d.revoked_at IS NULL AND d.effective_at<=now() AND d.expires_at>now())`
  const scope = and(sql`c.organization_id=${actor.organizationId}::uuid`,
    or(caseReadScope(actor,'c'),caseTriageQueueScope(actor,'c'),candidates),status ? sql`c.status=${status}` : undefined)
  const result = await tx.execute(sql`SELECT c.claim_id AS "claimId",c.claim_number AS "claimNumber",c.organization_id AS "organizationId",
    c.claim_type AS "claimType",c.status,c.priority,c.created_at AS "createdAt",c.updated_at AS "updatedAt",
    (${caseTriageQueueScope(actor,'c')}) AS "triageEligible",
    (SELECT r.principal_user_id FROM ue_authority_resource_relationships r WHERE r.organization_id=c.organization_id
      AND r.resource_id=c.claim_id AND r.resource_type='case' AND r.relation IN ('owner','assignee') AND r.status='active'
      AND r.revoked_at IS NULL AND r.effective_at<=now() AND (r.expires_at IS NULL OR r.expires_at>now()) ORDER BY r.id LIMIT 1) AS "assignedTo"
    FROM claims c WHERE ${scope} ORDER BY c.created_at DESC,c.claim_id LIMIT 200`)
  const rows = Array.isArray(result) ? result : (result as unknown as { rows: Record<string, unknown>[] }).rows
  const visible = []
  for (const row of rows) {
    const who = { userId: actor.userId, organizationId: actor.organizationId, caseId: String(row.claimId) }
    const capabilities = await decideCaseCapabilities(tx, who)
    const read = capabilities['case:read']
    const canAssign = !row.assignedTo && !['resolved','rejected','closed'].includes(String(row.status)) &&
      capabilities['case:assign'].effect === 'allow'
    if (read.effect === 'allow') {
      const detailResult = await tx.execute(sql`SELECT c.description,c.is_anonymous AS "isAnonymous",${claimIdentitySelect(actor,true)}
        FROM claims c LEFT JOIN organization_members m ON m.organization_id=c.organization_id AND m.user_id=c.member_id
        WHERE c.organization_id=${actor.organizationId}::uuid AND c.claim_id=${String(row.claimId)}::uuid`)
      const details = Array.isArray(detailResult) ? detailResult : (detailResult as unknown as { rows: Record<string, unknown>[] }).rows
      const { triageEligible: _triage, ...metadata } = row
      if (details[0]) {
        const allowed = (action: 'case:comment' | 'case:write_notes' | 'case:transition' | 'case:close' | 'case:export_sealed_evidence') =>
          capabilities[action].effect === 'allow'
        const canAddNote = allowed('case:comment') && (read.scope.visibility === 'member_visible' || allowed('case:write_notes'))
        visible.push(projectWorkbenchRow({ ...metadata,...details[0],canAddNote,
          canTransition: allowed('case:transition'),canClose: allowed('case:close'),
          canExportSealedEvidence: allowed('case:export_sealed_evidence') }, 'case', canAssign))
      }
    } else if (row.triageEligible === true || canAssign) visible.push(projectWorkbenchRow(row, 'triage', canAssign))
  }
  return visible
}
