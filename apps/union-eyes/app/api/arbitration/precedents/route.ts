/**
 * CRUD collection route for arbitrationDecisions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { arbitrationDecisions } from '@/db/schema';
import { eq, isNull, or, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: arbitrationDecisions,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  unscopedByDesign: 'shared cross-tenant reference data with no organization discriminator; writes require a platform-elevated role',
  readRole: 'member',
  // The row says whether it may be shared: a decision marked not public, or carrying an access restriction, is not listed
  // or returned to an organization at all (the table has no organization column to scope it by).
  readCondition: and(eq(arbitrationDecisions.isPublic, true), or(isNull(arbitrationDecisions.accessRestrictions), eq(arbitrationDecisions.accessRestrictions, ''))),
  // arbitration_decisions is shared, cross-tenant reference data (no org
  // discriminator - orgScoped is a no-op here). writeRole must therefore be
  // a genuine platform-elevated role, never an ordinary per-tenant role
  // (round 58D fix; same defect class round 52 fixed for dataClassificationPolicy).
  writeRole: 'content_manager',
});
export { GET, POST };
