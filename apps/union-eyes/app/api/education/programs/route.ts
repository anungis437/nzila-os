/**
 * CRUD collection route for trainingPrograms
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { trainingPrograms } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: trainingPrograms,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'officer',
  // The program's content. CLC approval is an accreditation fact and is not set through this generic route.
  writableFields: ['programName', 'programDescription', 'programDuration', 'requiredCourses', 'electiveCourses', 'minimumRequiredCourses', 'minimumElectiveCourses', 'providesCertification', 'certificationName', 'isActive', 'notes'],
});
export { GET, POST };
