/**
 * Program enrolments do not map to training_courses records. Until a durable
 * program_enrollments model and workflow are qualified, no API method may
 * silently mutate or delete a training course using a program ID.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';
const unavailable = () => {
  throw ApiError.notImplemented('Program enrolment requires its own qualified record and workflow');
};
export const GET = withApi({
  auth: { required: true, minRole: 'member' },
  openapi: { tags: ['Scheduling'], summary: 'Program enrolment unavailable until implemented' },
}, unavailable);
export const PATCH = withApi({
  auth: { required: true, minRole: 'steward' },
  openapi: { tags: ['Scheduling'], summary: 'Program enrolment update unavailable until implemented' },
}, unavailable);
export const DELETE = withApi({
  auth: { required: true, minRole: 'admin' },
  openapi: { tags: ['Scheduling'], summary: 'Program enrolment deletion unavailable until implemented' },
}, unavailable);
