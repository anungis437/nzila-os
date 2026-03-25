/**
 * CRUD item route for case studies (by slug)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { caseStudies } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: caseStudies,
  pk: 'slug',
  paramName: 'slug',
  tags: ["Marketing"],
  orgScoped: false,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'admin',
});
export { GET, PATCH, DELETE };
