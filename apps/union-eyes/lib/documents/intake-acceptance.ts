/**
 * The one mapping from an intake acceptance check to a response, shared by the create and version routes so both
 * refuse the same way.
 */
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';
import type { AcceptanceCheck } from '@/lib/documents/intake-lifecycle';

export function intakeRefusal(check: Extract<AcceptanceCheck, { ok: false }>) {
  switch (check.kind) {
    case 'not_found':
      return standardErrorResponse(ErrorCode.NOT_FOUND, 'Intake not found');
    case 'not_open':
      return standardErrorResponse(ErrorCode.CONFLICT, `The intake is ${check.status ?? 'no longer open'} and cannot be used`);
    case 'expired':
      return standardErrorResponse(ErrorCode.CONFLICT, 'The intake has expired; upload the file again');
    case 'operation_mismatch':
      return standardErrorResponse(ErrorCode.CONFLICT, 'The intake was opened for a different operation');
    case 'object_missing':
    case 'object_changed':
      return standardErrorResponse(ErrorCode.CONFLICT, 'The uploaded file is no longer the one that was received');
  }
}
