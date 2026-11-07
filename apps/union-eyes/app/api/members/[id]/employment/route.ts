/**
 * CRUD item route for memberEmployment
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { memberEmployment } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: memberEmployment,
  pk: 'id',
  tags: ["Members"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
  writableFields: ['employerId', 'worksiteId', 'bargainingUnitId', 'employmentStatus', 'employmentType', 'hireDate', 'seniorityDate', 'terminationDate', 'expectedReturnDate', 'jobTitle', 'jobCode', 'jobClassification', 'jobLevel', 'department', 'division', 'shiftType', 'shiftStartTime', 'shiftEndTime', 'operatesWeekends', 'operates24Hours', 'supervisorName', 'supervisorId', 'isProbationary', 'probationEndDate', 'customFields', 'notes'],
});
export { GET, PATCH, DELETE };
