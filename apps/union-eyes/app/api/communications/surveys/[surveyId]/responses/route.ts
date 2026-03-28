/**
 * Survey responses collection route
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { surveyResponses } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: surveyResponses,
  pk: 'id',
  tags: ["Surveys"],
  orgScoped: true,
  readRole: 'steward',
  writeRole: 'member',
});
export { GET, POST };
