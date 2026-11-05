import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => ({ loggerError: vi.fn() }));

vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError, warn: vi.fn(), info: vi.fn() } }));

import { ApiError, ErrorCode } from '@/lib/api/errors';
import { UserFacingError, isUserFacingError } from '@/lib/errors/user-facing-error';
import { GENERIC_ACTION_ERROR, describeValidationError, safeActionError, safeActionMessage } from '../safe-action-error';

const SQL_ERROR_MESSAGE =
  'Failed query: insert into "recognition_programs" ("id", "org_id", "name") values (default, $1, $2) returning "id"\nparams: 4f0d6b5e-8a52-4c5e-9d0e-2f3b8d9a1c11,Secret Program';

beforeEach(() => vi.clearAllMocks());

describe('what reaches the caller', () => {
  it('shows the message of an error written for the caller, with no reference and nothing logged', () => {
    expect(safeActionError(new UserFacingError('Award not found'), { action: 'approveAward' })).toEqual({ message: 'Award not found', reference: null });
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it('recognises a user-facing error by its marker as well as by its class', () => {
    const foreign = Object.assign(new Error('Insufficient balance'), { userFacing: true });

    expect(isUserFacingError(foreign)).toBe(true);
    expect(safeActionMessage(foreign, { action: 'redeem' })).toBe('Insufficient balance');
    expect(isUserFacingError(new Error('Insufficient balance'))).toBe(false);
  });

  it('shows a validation failure as the fields and reasons, not as the library JSON', () => {
    const parsed = z.object({ name: z.string().min(1), credits: z.number().int().positive() }).safeParse({ name: '', credits: -1 });
    if (parsed.success) throw new Error('expected a validation failure');

    const message = safeActionMessage(parsed.error, { action: 'createProgram' });

    expect(message).toBe(describeValidationError(parsed.error));
    expect(message).toMatch(/^Invalid input\. name: /);
    expect(message).toContain('credits: ');
    expect(message).not.toContain('[');
    expect(message).not.toContain('"code"');
  });

  it('names at most three issues', () => {
    const parsed = z.object({ a: z.string(), b: z.string(), c: z.string(), d: z.string() }).safeParse({});
    if (parsed.success) throw new Error('expected a validation failure');

    expect(describeValidationError(parsed.error).split(';')).toHaveLength(3);
  });

  it('shows an operational ApiError, and not a server-class one', () => {
    expect(safeActionMessage(ApiError.forbidden(), { action: 'x' })).toBe('Insufficient permissions');
    expect(safeActionMessage(ApiError.notFound('Program'), { action: 'x' })).toBe('Program not found');

    const internal = new ApiError(ErrorCode.DATABASE_ERROR, 'relation "recognition_programs" does not exist');
    const shown = safeActionMessage(internal, { action: 'x' });
    expect(shown).not.toContain('relation');
    expect(shown).toMatch(/^Something went wrong\. Please try again\. \(reference [0-9a-f]{8}\)$/);

    const bug = new ApiError(ErrorCode.NOT_FOUND, 'a bug', undefined, false);
    expect(safeActionMessage(bug, { action: 'x' })).not.toContain('a bug');
  });

  it('shows the message of an error class the action names safe, and only that class', () => {
    class BoundaryError extends Error {}
    const isSafe = (error: unknown) => error instanceof BoundaryError;

    expect(safeActionMessage(new BoundaryError('Cannot move a member across organizations'), { action: 'move', isSafe })).toBe('Cannot move a member across organizations');
    expect(safeActionMessage(new Error('Cannot move a member across organizations'), { action: 'move', isSafe })).not.toContain('Cannot move');
  });

  it('tells a caller with no organization so, without the user id and the environment hint the resolver wrote for the log', () => {
    const resolver = Object.assign(
      new Error('No verified organization membership for user 4f0d6b5e. Refusing silent Default Organization fallback (BR-6). Set UE_ALLOW_DEFAULT_ORG=true in a non-production environment to allow it.'),
      { code: 'ORG_CONTEXT_REQUIRED', name: 'OrgContextRequiredError' },
    );

    const result = safeActionError(resolver, { action: 'listMyAwards' });

    expect(result).toEqual({ message: 'You do not belong to an organization', reference: null });
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it.each([
    ['UNAUTHENTICATED', 'Unauthorized'],
    ['SESSION_AUTHORITY_REQUIRED', 'Unauthorized'],
    ['ACTOR_MISMATCH', 'Unauthorized'],
    ['INVALID_ORGANIZATION', 'You do not belong to an organization'],
    ['MEMBERSHIP_REQUIRED', 'You do not belong to an organization'],
    ['ROLE_REQUIRED', 'Insufficient permissions'],
  ])('turns the binding failure %s into a sentence the caller can act on', (code, expected) => {
    const binding = Object.assign(new Error(code), { code, name: 'AuthOrgBindingError' });

    expect(safeActionMessage(binding, { action: 'x' })).toBe(expected);
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it('does not mistake another error that happens to carry a code for an identity failure', () => {
    const driver = Object.assign(new Error('permission denied for table recognition_programs'), { code: '42501' });

    expect(safeActionMessage(driver, { action: 'x' })).not.toContain('permission denied');
  });
});

describe('what never reaches the caller', () => {
  it('turns a database error, SQL and parameters included, into a generic message with a reference', () => {
    const { message, reference } = safeActionError(new Error(SQL_ERROR_MESSAGE), { action: 'createRecognitionProgram' });

    expect(reference).toMatch(/^[0-9a-f]{8}$/);
    expect(message).toBe(`${GENERIC_ACTION_ERROR} (reference ${reference})`);
    for (const fragment of ['Failed query', 'insert into', 'recognition_programs', 'params', 'Secret Program', '$1', '4f0d6b5e']) {
      expect(message, fragment).not.toContain(fragment);
    }
  });

  it('logs the whole error under the reference, with the action and its context, for support to find', () => {
    const error = new Error(SQL_ERROR_MESSAGE);
    const { reference } = safeActionError(error, { action: 'createRecognitionProgram', context: { organizationId: 'org-1' } });

    expect(mocks.loggerError).toHaveBeenCalledTimes(1);
    const [logMessage, logged, context] = mocks.loggerError.mock.calls[0];
    expect(logMessage).toBe('Server action failed: createRecognitionProgram');
    expect(logged).toBe(error);
    expect(context).toMatchObject({ reference, organizationId: 'org-1', errorName: 'Error' });
  });

  it('logs the error code a driver error carries', () => {
    const { reference } = safeActionError(Object.assign(new Error('boom'), { code: '42501' }), { action: 'x' });

    expect(mocks.loggerError.mock.calls[0][2]).toMatchObject({ reference, errorCode: '42501' });
  });

  it('keeps even the log free of the text when the action asks it to', () => {
    safeActionError(new Error(SQL_ERROR_MESSAGE), { action: 'updateMemberEmployment', redactLog: true });

    const logged = mocks.loggerError.mock.calls[0][1] as Error;
    expect(logged.message).toBe('updateMemberEmployment failed');
    expect(JSON.stringify(mocks.loggerError.mock.calls[0])).not.toContain('Secret Program');
  });

  it('logs nothing, and gives no reference, when the caller has already logged the failure', () => {
    const result = safeActionError(new Error(SQL_ERROR_MESSAGE), { action: 'x', fallback: 'Failed to update', log: false });

    expect(result).toEqual({ message: 'Failed to update', reference: null });
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it('uses the message of the action for what may not be shown', () => {
    expect(safeActionMessage(new Error('x'), { action: 'save', fallback: 'Failed to save the record' })).toMatch(/^Failed to save the record \(reference [0-9a-f]{8}\)$/);
  });

  it('is generic for a thrown value that is no Error, and gives each failure its own reference', () => {
    const first = safeActionError('SELECT * FROM members', { action: 'x' });
    const second = safeActionError(undefined, { action: 'x' });

    expect(first.message).not.toContain('SELECT');
    expect(first.reference).not.toBe(second.reference);
    expect(mocks.loggerError).toHaveBeenCalledTimes(2);
  });
});
