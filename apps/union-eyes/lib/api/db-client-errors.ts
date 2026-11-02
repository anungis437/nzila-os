import { ApiError } from './errors';

export type WriteAction = 'create' | 'update' | 'delete';

interface PostgresFault {
  code: string;
  column?: string;
}

/**
 * The PostgreSQL error behind a driver or ORM wrapper, if there is one. Drizzle reports a failed statement as an error whose `cause` is the driver's
 * error, and the two drivers name the offending column differently (`column` for node-postgres, `column_name` for postgres-js).
 */
export function postgresFaultOf(error: unknown): PostgresFault | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as Record<string, unknown>;
    if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) {
      const column = candidate.column ?? candidate.column_name;
      return { code: candidate.code, column: typeof column === 'string' ? column : undefined };
    }
    current = candidate.cause;
  }
  return null;
}

/**
 * Answers a database refusal that the client caused as the client error it is, instead of the 500 an unrecognised error becomes: a required column
 * the body left out, a value of the wrong type, format or size, a constraint it breaks, a reference that does not exist, a duplicate.
 *
 * The answer names the field (never a column, a constraint, a value or a statement) and returns null for everything else, so a missing grant, a lost
 * connection or a bug stays a server fault. It is for the statement a generic write issues, not for the audit that commits with it.
 */
export function mapClientDatabaseError(
  error: unknown,
  action: WriteAction,
  fieldOf: (column: string) => string | undefined = () => undefined,
): ApiError | null {
  const fault = postgresFaultOf(error);
  if (!fault) return null;
  switch (fault.code) {
    case '23502': {
      const field = fault.column ? (fieldOf(fault.column) ?? fault.column) : undefined;
      return field ? ApiError.badRequest(`${field} is required`, { field }) : ApiError.badRequest('A required field is missing');
    }
    case '23505':
    case '23P01':
      return ApiError.conflict('A record with the same unique value already exists');
    case '23503':
      return action === 'delete'
        ? ApiError.conflict('This record is still referenced by other records')
        : ApiError.badRequest('A referenced record does not exist');
    case '23514':
      return ApiError.badRequest('A value is outside what this resource allows');
    case '22P02':
    case '22007':
    case '22008':
    case '22003':
    case '22001':
    case '22021':
    case '22P05':
    case '22004':
      return ApiError.badRequest('A field has a value of the wrong type, format or size');
    default:
      return null;
  }
}
