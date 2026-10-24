import { sql, type SQL } from 'drizzle-orm'
import { grievanceDeadlines } from '@/db/schema/domains/claims/workflows'

/**
 * grievance_deadlines has no organization column: a deadline belongs to its grievance, so organization scope is the
 * owning grievance's. Every consequential write to a deadline puts this predicate in the mutation's own WHERE clause,
 * so a deadline id from another organization matches no row, whatever a preliminary read returned or when.
 */
export const deadlineInOrganization = (organizationId: string): SQL =>
  sql`${grievanceDeadlines.grievanceId} IN (SELECT id FROM grievances WHERE organization_id = ${organizationId})`
