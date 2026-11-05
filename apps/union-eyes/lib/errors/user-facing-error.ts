/**
 * An error whose message is written for the person who caused it and may be shown to them: "Award not found", "Insufficient balance".
 *
 * Anything that is not one of these (a database failure, a driver error, a bug) carries text that is not for a caller: Drizzle puts the SQL
 * and its parameters in `message`. A server action therefore returns the message of a UserFacingError, an ApiError that is operational, or a
 * validation failure, and a generic message with a log reference for everything else (lib/actions/safe-action-error.ts).
 *
 * Throw it for the rules a person can act on, never with text copied from another error.
 */
export class UserFacingError extends Error {
  readonly userFacing = true as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UserFacingError';
  }
}

export function isUserFacingError(error: unknown): error is UserFacingError {
  return error instanceof UserFacingError || (error instanceof Error && (error as { userFacing?: unknown }).userFacing === true);
}
