import { describe, expect, it } from 'vitest';
import { parseScimFilter } from '../filter';
import { handleScim, SCIM_ERROR_SCHEMA, ScimHttpError, scimError, scimErrorFrom, scimJson, scimNoContent } from '../responses';
import { ScimConfigurationNotLiveError } from '../provisioned-members';

const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error as { status: number; scimType?: string };
  }
  throw new Error('expected a refusal');
};

describe('SCIM filter', () => {
  it('reads the two lookups an identity provider makes, in any letter case', () => {
    expect(parseScimFilter('userName eq "Jane@Example.com"')).toEqual({ attribute: 'userName', value: 'Jane@Example.com' });
    expect(parseScimFilter('  USERNAME EQ "a"  ')).toEqual({ attribute: 'userName', value: 'a' });
    expect(parseScimFilter('externalId eq "idp-1"')).toEqual({ attribute: 'externalId', value: 'idp-1' });
    expect(parseScimFilter('userName eq "O\\"Brien"')).toEqual({ attribute: 'userName', value: 'O"Brien' });
  });

  it('is no filter when none is given', () => {
    expect(parseScimFilter(null)).toBeNull();
    expect(parseScimFilter('   ')).toBeNull();
  });

  it('refuses every other filter, so an unsupported one is never read as "nobody matches"', () => {
    for (const filter of ['userName sw "a"', 'userName eq a', 'userName eq ""', 'userName eq "a" and active eq true', 'emails.value eq "a"', 'active eq true', 'userName pr', 'x'.repeat(501)]) {
      expect(refusal(() => parseScimFilter(filter)), filter).toMatchObject({ status: 400, scimType: 'invalidFilter' });
    }
    expect(refusal(() => parseScimFilter(`userName eq "${'a'.repeat(321)}"`))).toMatchObject({ status: 400, scimType: 'invalidFilter' });
  });
});

describe('SCIM responses', () => {
  it('answers a resource as application/scim+json, uncached, with the body as it is', async () => {
    const response = scimJson({ id: '1' }, 201, { Location: 'https://x.test/1' });
    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toBe('application/scim+json; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBe('https://x.test/1');
    expect(await response.json()).toEqual({ id: '1' });
    expect(scimNoContent().status).toBe(204);
  });

  it('answers a refusal as the SCIM error message with the status as a string', async () => {
    const response = scimError(409, 'taken', 'uniqueness');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ schemas: [SCIM_ERROR_SCHEMA], status: '409', scimType: 'uniqueness', detail: 'taken' });
    expect(await scimError(404, 'gone').json()).toEqual({ schemas: [SCIM_ERROR_SCHEMA], status: '404', detail: 'gone' });
  });

  it('reports a refusal it knows and nothing else', async () => {
    expect(scimErrorFrom(new ScimHttpError(400, 'bad', 'invalidPath'))?.status).toBe(400);
    expect(await scimErrorFrom(new ScimConfigurationNotLiveError())?.json()).toMatchObject({ status: '403', detail: expect.stringContaining('not enabled') });
    // The framework's own errors carry a code that maps to a status (and a test double carries the status).
    expect(scimErrorFrom(Object.assign(new Error('x'), { code: 'NOT_FOUND' }))?.status).toBe(404);
    expect(scimErrorFrom(Object.assign(new Error('x'), { status: 409 }))?.status).toBe(409);
    expect(await scimErrorFrom(Object.assign(new Error('dup'), { status: 409 }))?.json()).toMatchObject({ scimType: 'uniqueness' });
    // A fault is not dressed up as a client error.
    expect(scimErrorFrom(new Error('database is down'))).toBeNull();
    expect(scimErrorFrom(Object.assign(new Error('x'), { status: 500 }))).toBeNull();
    expect(scimErrorFrom('boom')).toBeNull();
  });

  it('runs a request, answering a refusal and rethrowing a fault', async () => {
    expect((await handleScim(async () => scimJson({ ok: true }))).status).toBe(200);
    expect((await handleScim(async () => { throw new ScimHttpError(404, 'User not found'); })).status).toBe(404);
    await expect(handleScim(async () => { throw new Error('database is down'); })).rejects.toThrow('database is down');
  });
});
