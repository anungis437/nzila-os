import { sql, type SQL } from 'drizzle-orm'
import { caseReadScope, type CaseActor } from './case-authorization'

/**
 * Single-case read for the claims detail endpoint. The WHERE clause always includes the
 * canonical case read scope, so a row is returned only when the actor may read that case.
 */
export function claimDetailQuery(actor: CaseActor, reference: string): SQL {
  return sql`
      SELECT c.claim_id        AS "claimId",
             c.claim_number    AS "claimNumber",
             c.organization_id AS "organizationId",
             c.member_id       AS "memberId",
             c.is_anonymous    AS "isAnonymous",
             c.claim_type      AS "claimType",
             c.status,
             c.priority,
             c.incident_date   AS "incidentDate",
             c.location,
             c.description,
             c.desired_outcome AS "desiredOutcome",
             c.attachments,
             c.witnesses_present AS "witnessesPresent",
             c.witness_details AS "witnessDetails",
             c.filed_date      AS "filedDate",
             c.created_at      AS "createdAt",
             c.updated_at      AS "updatedAt",
             c.assigned_to     AS "assignedTo",
             c.assigned_at     AS "assignedAt",
             c.ai_score        AS "aiScore",
             c.ai_analysis     AS "aiAnalysis",
             c.merit_confidence  AS "meritConfidence",
             c.precedent_match   AS "precedentMatch",
             c.complexity_score  AS "complexityScore",
             c.claim_amount      AS "claimAmount",
             c.settlement_amount AS "settlementAmount",
             c.legal_costs       AS "legalCosts",
             c.court_costs       AS "courtCosts",
             c.resolution_outcome AS "resolutionOutcome",
             c.resolved_at       AS "resolvedAt",
             c.progress,
             m.name   AS "memberName",
             m.email  AS "memberEmail",
             m.phone  AS "memberPhone"
      FROM claims c
      LEFT JOIN organization_members m
        ON m.user_id = c.member_id
       AND m.organization_id::text = c.organization_id::text
      WHERE (c.claim_number = ${reference} OR c.claim_id::text = ${reference})
        AND ${caseReadScope(actor, 'c')}
      LIMIT 1
    `
}
