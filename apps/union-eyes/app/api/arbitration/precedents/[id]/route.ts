/**
 * CRUD item route for arbitrationDecisions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { containedStorageHandlers } from '@/lib/reality/contained-storage';
import { arbitrationDecisions } from '@/db/schema';
import { WITHHELD_DECISION_COLUMNS } from '@/lib/precedents/public-decision-view';
import { PRECEDENT_WRITABLE_FIELDS } from '@/lib/precedents/precedent-writable-fields';
import { eq, isNull, or, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const factory = crudRoutes({
  table: arbitrationDecisions,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  unscopedByDesign: 'shared cross-tenant reference data with no organization discriminator; writes require a platform-elevated role',
  itemRoute: true,
  readRole: 'member',
  // The row says whether it may be shared: a decision marked not public, or carrying an access restriction, is not listed
  // or returned to an organization at all (the table has no organization column to scope it by).
  readCondition: and(eq(arbitrationDecisions.isPublic, true), or(isNull(arbitrationDecisions.accessRestrictions), eq(arbitrationDecisions.accessRestrictions, ''))),
  // One decision is read with the projection /api/precedents serves plus its reasoning, facts and dates
  // (lib/precedents/public-decision-view.ts): never the grievor, the monetary remedy, the full text, the embedding, import provenance
  // or the access-control metadata. The write responses carry the same projection.
  omitFromResponse: [...WITHHELD_DECISION_COLUMNS],
  // arbitration_decisions is shared, cross-tenant reference data (no org
  // discriminator - orgScoped is a no-op here). writeRole must therefore be
  // a genuine platform-elevated role, never an ordinary per-tenant role
  // (round 58D fix; same defect class round 52 fixed for dataClassificationPolicy).
  writeRole: 'content_manager',
  // The decision's own content; counters, embedding, import provenance and the supplying organization are server-owned.
  writableFields: PRECEDENT_WRITABLE_FIELDS,
});
// Canonical V2 contains arbitration_decisions (CONTAINED_NO_AUTHORITY: no application role may read or write it), so a canonical
// deployment answers 501 NOT_IMPLEMENTED before the factory handler, or any statement, runs (lib/reality/contained-storage.ts).
const { GET, PATCH, DELETE } = containedStorageHandlers('arbitration_decisions', { GET: factory.GET, PATCH: factory.PATCH, DELETE: factory.DELETE });
export { GET, PATCH, DELETE };
