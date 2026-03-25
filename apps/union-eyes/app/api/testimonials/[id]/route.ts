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
  writeRole: 'admin',
});
export { GET, PATCH, DELETE };
