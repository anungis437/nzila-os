/**
 * CRUD collection route for surveys
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { ne } from 'drizzle-orm';
import { surveys } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: surveys,
  pk: 'id',
  tags: ["Surveys"],
  orgScoped: true,
  readRole: 'member',
  // A draft survey is unpublished work; a member reads only surveys that have left draft.
  belowStaffReadCondition: ne(surveys.status, 'draft'),
  writeRole: 'steward',
  // A new survey is a draft: publication, counters and completion figures are the server's.
  writableFields: ['title', 'description', 'surveyType', 'closesAt', 'allowAnonymous', 'allowMultipleResponses', 'requireAuthentication', 'shuffleQuestions', 'showResults', 'welcomeMessage', 'thankYouMessage'],
});
export { GET, POST };
