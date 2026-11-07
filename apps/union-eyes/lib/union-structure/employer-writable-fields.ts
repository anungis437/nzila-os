import { ApiError } from '@/lib/api/errors';

/**
 * The body fields a steward may set on an employer (DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT): what the employer form sends
 * (components/union-structure/EmployerManagement.tsx toEmployerPayload) plus parentCompanyId, which the routes check belongs to the
 * caller's organization. The identification numbers beyond the business number, the contacts block, notes-like custom fields and the
 * archive stamp are not written through the generic route.
 */
export const EMPLOYER_WRITABLE_FIELDS: readonly string[] = [
  'name', 'legalName', 'businessNumber', 'employerType', 'status', 'totalEmployees', 'unionizedEmployees',
  'email', 'phone', 'website', 'mainAddress', 'notes', 'parentCompanyId',
];

/**
 * The form sets an employer's working status (active, in bargaining, dispute...), but archiving is the governed archive (DELETE), which
 * checks dependents and stamps archivedAt; and an archived employer is not brought back by a status edit.
 */
export function assertEmployerStatusWritable(values: Record<string, unknown>, currentStatus: unknown): void {
  if (currentStatus === 'archived' && 'status' in values && values.status !== 'archived') {
    throw ApiError.conflict('An archived employer is not restored by editing its status');
  }
  if ('status' in values && values.status === 'archived' && currentStatus !== 'archived') {
    throw ApiError.badRequest('Archive an employer with the archive action, not by setting its status');
  }
}
