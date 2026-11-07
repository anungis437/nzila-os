/**
 * CRUD collection route for trainingPrograms
 */
import { crudRoutes, queryIdMutations, type CrudOptions } from '@/lib/api/crud-factory';
import { trainingPrograms } from '@/db/schema';

export const dynamic = 'force-dynamic';

const programCrudOptions: CrudOptions & { itemRoute?: false } = {
  table: trainingPrograms,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'officer',
  // The program's content. CLC approval is an accreditation fact and is not set through this generic route.
  writableFields: ['programName', 'programDescription', 'programDuration', 'requiredCourses', 'electiveCourses', 'minimumRequiredCourses', 'minimumElectiveCourses', 'providesCertification', 'certificationName', 'isActive', 'notes'],
};

const { GET, POST } = crudRoutes(programCrudOptions);
// No [id]/route.ts exists for programs; the admin screens submit edits and deletes with `?id=` on
// this collection URL instead, so the item-mode handlers (same options, same authorization) are
// exposed here rather than under a path segment.
const { PATCH, DELETE } = queryIdMutations(crudRoutes({ ...programCrudOptions, itemRoute: true }));
export { GET, POST, PATCH, DELETE };
