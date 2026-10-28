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
  readRole: 'member',
  // testimonials is shared marketing content with no organization column (orgScoped is a no-op), so an organization
  // administrator could change any organization's row by id. Writes need a genuine platform-elevated role, as for the
  // other shared reference tables.
  writeRole: 'content_manager',
});
export { GET, PATCH, DELETE };
