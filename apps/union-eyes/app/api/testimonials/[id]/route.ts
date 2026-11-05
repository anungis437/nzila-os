/**
 * CRUD item route for testimonials
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { testimonials } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: testimonials,
  pk: 'id',
  tags: ["Marketing"],
  orgScoped: false,
  itemRoute: true,
  // This unscoped item endpoint exposes the raw draft (author, quote, visibility and approval state).
  // It is an editorial management surface, not the public approved-testimonial projection.
  // Ordinary members must never fetch an unpublished or restricted testimonial by a known ID.
  readRole: 'content_manager',
  // testimonials is shared marketing content with no organization column (orgScoped is a no-op), so an organization
  // administrator could change any organization's row by id. Writes need a genuine platform-elevated role, as for the
  // other shared reference tables.
  writeRole: 'content_manager',
  // Approval is stamped here, with the server's clock, and only once: the client's timestamp is not the approval time, and approving an
  // approved testimonial must not move it. Only the approval fields a client may send are interpreted.
  beforeUpdate: (updates, { existing }) => {
    if (updates.approvedAt === undefined) return updates;
    const { approvedAt: _requested, ...rest } = updates;
    return { ...rest, approvedAt: existing.approvedAt ?? new Date() };
  },
});
export { GET, PATCH, DELETE };
