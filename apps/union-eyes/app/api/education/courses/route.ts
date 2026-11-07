/**
 * CRUD collection route for trainingCourses
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { eq } from 'drizzle-orm';
import { trainingCourses } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: trainingCourses,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  readRole: 'member',
  // The table holds drafts and archived courses (isActive false) beside the live catalogue; a member reads only the live ones.
  belowStaffReadCondition: eq(trainingCourses.isActive, true),
  writeRole: 'steward',
  // The course's description, delivery and catalogue facts. CLC approval is an accreditation fact, and making a course mandatory for roles
  // is a policy decision, so neither is set through this generic route.
  writableFields: ['courseCode', 'courseName', 'courseDescription', 'courseCategory', 'deliveryMethod', 'courseDifficulty', 'durationHours', 'durationDays', 'hasPrerequisites', 'prerequisiteCourses', 'prerequisiteCertifications', 'learningObjectives', 'courseOutline', 'courseMaterialsUrl', 'presentationSlidesUrl', 'workbookUrl', 'additionalResources', 'primaryInstructorName', 'instructorIds', 'minEnrollment', 'maxEnrollment', 'providesCertification', 'certificationName', 'certificationValidYears', 'courseFee', 'materialsFee', 'travelSubsidyAvailable', 'isActive', 'notes'],
});
export { GET, POST };
