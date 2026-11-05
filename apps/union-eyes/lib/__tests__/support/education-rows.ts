import { getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { courseRegistrations, courseSessions, memberCertifications, trainingCourses } from '@/db/schema/domains/scheduling/training';

export const STAMP = '2026-03-04T00:00:00.000Z';

/**
 * A row exactly as a CRUD-factory list route sends it: every column of the table by its property name except the ones the route omits,
 * each null unless the test gives a value. A value for a name the route does not send is a mistake in the test, so it is refused.
 */
function routeRow(table: PgTable, name: string, omitted: string[], values: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(getTableColumns(table))) if (!omitted.includes(key)) row[key] = null;
  for (const key of Object.keys(values)) {
    if (!(key in row)) throw new Error(`${key} is not a field /api/${name} sends`);
  }
  return { ...row, ...values };
}

const ORG = '5b0e1a70-2c43-4a53-8b8d-4d1d7a9d0a11';

export const COURSE_A = '0a1b2c3d-1111-4111-8111-000000000001';
export const COURSE_B = '0a1b2c3d-2222-4222-8222-000000000002';
export const SESSION_A1 = '5e55a000-1111-4111-8111-000000000001';
export const SESSION_A2 = '5e55a000-2222-4222-8222-000000000002';
export const SESSION_B1 = '5e55a000-3333-4333-8333-000000000003';

export const courseRow = (values: Record<string, unknown> = {}) =>
  routeRow(trainingCourses, 'education/courses', [], {
    id: COURSE_A,
    organizationId: ORG,
    courseCode: 'STW-101',
    courseName: 'Steward Fundamentals',
    courseDescription: 'Learn the grievance process.',
    courseCategory: 'steward_training',
    deliveryMethod: 'in_person',
    courseDifficulty: 'beginner',
    durationHours: '8.00',
    durationDays: 2,
    minEnrollment: 5,
    maxEnrollment: 30,
    providesCertification: true,
    certificationName: 'Certified Steward',
    clcApproved: true,
    courseFee: '150.00',
    isActive: true,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...values,
  });

export const sessionRow = (values: Record<string, unknown> = {}) =>
  routeRow(courseSessions, 'education/sessions', ['sessionBudget', 'actualCost', 'virtualMeetingUrl', 'virtualMeetingAccessCode', 'accommodationHotel', 'notes'], {
    id: SESSION_A1,
    organizationId: ORG,
    courseId: COURSE_A,
    sessionCode: 'STW-101-A',
    sessionName: 'Spring cohort',
    startDate: '2099-11-02',
    endDate: '2099-11-03',
    deliveryMethod: 'in_person',
    venueName: 'Union Hall',
    registrationCount: 3,
    maxEnrollment: 30,
    sessionStatus: 'scheduled',
    createdAt: STAMP,
    updatedAt: STAMP,
    ...values,
  });

export const registrationRow = (values: Record<string, unknown> = {}) =>
  routeRow(courseRegistrations, 'education/registrations', [], {
    id: 'ee000000-1111-4111-8111-000000000001',
    organizationId: ORG,
    memberId: 'user_alex',
    courseId: COURSE_A,
    sessionId: SESSION_A1,
    registrationStatus: 'registered',
    attended: false,
    completed: false,
    completionPercentage: '0.00',
    courseFee: '150.00',
    createdAt: STAMP,
    updatedAt: STAMP,
    ...values,
  });

export const certificationRow = (values: Record<string, unknown> = {}) =>
  routeRow(memberCertifications, 'education/certifications', [], {
    id: 'cc000000-1111-4111-8111-000000000001',
    organizationId: ORG,
    memberId: 'user_alex',
    certificationName: 'Certified Steward',
    certificationType: 'course_completion',
    certificationNumber: 'CERT-0001',
    issueDate: '2024-05-01',
    certificationStatus: 'active',
    verified: true,
    revoked: false,
    renewalRequired: false,
    clcRegistered: false,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...values,
  });

/** What a CRUD-factory list sends: { data: rows, pagination } inside withApi's { success, data, timestamp } envelope. */
export const crudList = (rows: unknown[], page = 1, totalPages = 1) => ({
  success: true,
  data: { data: rows, pagination: { page, limit: 100, total: rows.length, totalPages } },
  timestamp: STAMP,
});

/** What a CRUD-factory item route sends for a create. */
export const crudItem = (row: unknown) => ({ success: true, data: { data: row }, timestamp: STAMP });

export const failure = (status: number, message: string) => ({ status, body: { code: 'ERROR', message } });
export const ok = (body: unknown) => ({ status: 200, body });
