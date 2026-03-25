/**
 * CRUD collection route for case studies
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { caseStudies } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: caseStudies,
  pk: 'id',
  tags: ["Marketing"],
  orgScoped: false,
  readRole: 'member',
  writeRole: 'admin',
});
export { GET, POST };
