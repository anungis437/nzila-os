/**
 * CRUD item route for surveys
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { ne } from 'drizzle-orm';
import { lifecycleBeforeUpdate } from '@/lib/communications/lifecycle';
import { surveys } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: surveys,
  pk: 'id',
  tags: ["Surveys"],
  orgScoped: true,
  itemRoute: true,
  // The path segment is [surveyId]: the factory read params.id, which this route never has, so no item could be found.
  paramName: 'surveyId',
  readRole: 'member',
  // A draft survey is unpublished work; a member reads only surveys that have left draft.
  belowStaffReadCondition: ne(surveys.status, 'draft'),
  writeRole: 'steward',
  blockedPatchFields: ['publishedAt', 'responseCount', 'viewCount', 'completionRate'],
  beforeUpdate: lifecycleBeforeUpdate('survey'),
});
export { GET, PATCH, DELETE };
