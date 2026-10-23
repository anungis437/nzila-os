import { sql } from 'drizzle-orm'
import type { RLSTx } from '@/lib/db/with-rls-context'

/** Export only this case's canonical audit records, including its typed intake proof. */
export async function readCanonicalCaseAudit(tx: RLSTx, organizationId: string, caseId: string) {
  return Array.from(await tx.execute(sql`SELECT id, audit_id AS "auditId", created_at AS "createdAt",
    organization_id AS "organizationId", user_id AS "userId", action,
    resource_type AS "resourceType", resource_id AS "resourceId", details,
    content_hash AS "contentHash", previous_hash AS "previousHash"
    FROM public.audit_logs WHERE organization_id=${organizationId}::uuid AND resource_id=${caseId}
      AND (resource_type IN ('claim','claims','case','cases') OR
        (resource_type='grievance' AND action='nar.decision.proof'
          AND details->'narRecord'->>'resourceId'=${caseId}
          AND details->'narRecord'->>'organizationId'=${organizationId}
          AND details->'narRecord'->>'decisionType'='union.grievance.intake.submitted'))
    ORDER BY created_at DESC,id DESC`))
}
