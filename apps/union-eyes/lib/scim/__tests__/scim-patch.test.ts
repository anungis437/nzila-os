import { describe, expect, it } from 'vitest';
import { parseScimPatch, parseScimUserResource } from '../patch';

const PATCH = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
const patch = (...Operations: unknown[]) => ({ schemas: [PATCH], Operations });
const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error as { status: number; scimType?: string; message: string };
  }
  throw new Error('expected a refusal');
};

describe('SCIM PATCH, as each identity provider spells it', () => {
  it('reads Entra: a capitalized op and active as a string', () => {
    expect(parseScimPatch(patch({ op: 'Replace', path: 'active', value: 'False' }))).toEqual({ active: false });
    expect(parseScimPatch(patch({ op: 'Replace', path: 'active', value: 'True' }))).toEqual({ active: true });
  });

  it('reads Okta: an operation with no path and an object of attributes', () => {
    expect(parseScimPatch(patch({ op: 'replace', value: { active: false } }))).toEqual({ active: false });
    expect(parseScimPatch(patch({ op: 'replace', value: { active: true, externalId: 'idp-9', name: { givenName: 'Jane', familyName: 'Doe' } } }))).toEqual({
      active: true,
      externalId: 'idp-9',
      givenName: 'Jane',
      familyName: 'Doe',
    });
  });

  it('reads the attribute paths an identity provider uses for the name, the address and the external id', () => {
    expect(
      parseScimPatch(
        patch(
          { op: 'replace', path: 'name.givenName', value: 'Jane' },
          { op: 'replace', path: 'name.familyName', value: 'Doe' },
          { op: 'replace', path: 'displayName', value: 'Jane Doe' },
          { op: 'replace', path: 'emails[type eq "work"].value', value: 'jane@example.com' },
          { op: 'add', path: 'externalId', value: 'idp-1' },
          { op: 'replace', path: 'urn:ietf:params:scim:schemas:core:2.0:User:active', value: true },
        ),
      ),
    ).toEqual({ givenName: 'Jane', familyName: 'Doe', displayName: 'Jane Doe', email: 'jane@example.com', externalId: 'idp-1', active: true });
    expect(parseScimPatch(patch({ op: 'replace', path: 'emails', value: [{ value: 'a@example.com' }, { value: 'b@example.com', primary: true }] }))).toEqual({ email: 'b@example.com' });
  });

  it('removes only the external id, and refuses to remove anything else', () => {
    expect(parseScimPatch(patch({ op: 'remove', path: 'externalId' }))).toEqual({ externalId: null });
    expect(refusal(() => parseScimPatch(patch({ op: 'remove', path: 'emails' })))).toMatchObject({ status: 400, scimType: 'mutability' });
    expect(refusal(() => parseScimPatch(patch({ op: 'remove' })))).toMatchObject({ status: 400, scimType: 'noTarget' });
  });

  it('refuses an attribute it does not change instead of accepting an operation that is then not applied', () => {
    for (const path of ['roles', 'groups', 'title', 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:department', 'emails[type eq "home"].value', 'id', 'meta']) {
      expect(refusal(() => parseScimPatch(patch({ op: 'replace', path, value: 'x' })))).toMatchObject({ status: 400, scimType: 'invalidPath' });
    }
    expect(refusal(() => parseScimPatch(patch({ op: 'replace', value: { roles: ['admin'] } })))).toMatchObject({ status: 400, scimType: 'invalidPath' });
  });

  it('refuses values of the wrong kind', () => {
    expect(refusal(() => parseScimPatch(patch({ op: 'replace', path: 'active', value: 'maybe' })))).toMatchObject({ status: 400, scimType: 'invalidValue' });
    expect(refusal(() => parseScimPatch(patch({ op: 'replace', path: 'active', value: 1 })))).toMatchObject({ status: 400, scimType: 'invalidValue' });
    expect(refusal(() => parseScimPatch(patch({ op: 'replace', path: 'externalId', value: '   ' })))).toMatchObject({ status: 400, scimType: 'invalidValue' });
    expect(refusal(() => parseScimPatch(patch({ op: 'replace', path: 'emails.value', value: 'not-an-address' })))).toMatchObject({ status: 400, scimType: 'invalidValue' });
    expect(refusal(() => parseScimPatch(patch({ op: 'replace', path: 'name.givenName', value: 'x'.repeat(101) })))).toMatchObject({ status: 400, scimType: 'invalidValue' });
    expect(refusal(() => parseScimPatch(patch({ op: 'replace', value: 'active' })))).toMatchObject({ status: 400, scimType: 'invalidValue' });
  });

  it('refuses a message that is not a PatchOp', () => {
    for (const body of [null, 'x', [], {}, { schemas: [PATCH] }, { schemas: [PATCH], Operations: [] }, { schemas: ['urn:other'], Operations: [{ op: 'replace', path: 'active', value: true }] }]) {
      expect(refusal(() => parseScimPatch(body))).toMatchObject({ status: 400, scimType: 'invalidSyntax' });
    }
    expect(refusal(() => parseScimPatch(patch({ path: 'active', value: true })))).toMatchObject({ status: 400, scimType: 'invalidSyntax' });
    expect(refusal(() => parseScimPatch(patch({ op: 'copy', path: 'active', value: true })))).toMatchObject({ status: 400, scimType: 'invalidSyntax' });
    expect(refusal(() => parseScimPatch(patch(...Array.from({ length: 21 }, () => ({ op: 'replace', path: 'active', value: true })))))).toMatchObject({ status: 400, scimType: 'invalidSyntax' });
  });

  it('lets the last operation on an attribute win', () => {
    expect(parseScimPatch(patch({ op: 'replace', path: 'active', value: false }, { op: 'replace', path: 'active', value: true }))).toEqual({ active: true });
  });
});

describe('SCIM PUT of the user resource', () => {
  it('states the attributes to update and ignores the read-only ones the provider echoes back', () => {
    expect(
      parseScimUserResource({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: 'whatever',
        meta: { resourceType: 'User' },
        groups: [{ value: 'g1' }],
        userName: 'jane@example.com',
        externalId: 'idp-1',
        active: false,
        name: { givenName: 'Jane', familyName: 'Doe' },
        emails: [{ value: 'jane@example.com', primary: true }],
        title: 'Steward',
      }),
    ).toEqual({ userName: 'jane@example.com', externalId: 'idp-1', active: false, givenName: 'Jane', familyName: 'Doe', email: 'jane@example.com' });
  });

  it('leaves an omitted attribute out, so it is left as it is', () => {
    expect(parseScimUserResource({ userName: 'jane@example.com' })).toEqual({ userName: 'jane@example.com' });
  });

  it('requires a userName and refuses roles, which provisioning never confers', () => {
    expect(refusal(() => parseScimUserResource({}))).toMatchObject({ status: 400, scimType: 'invalidValue' });
    expect(refusal(() => parseScimUserResource('x'))).toMatchObject({ status: 400, scimType: 'invalidSyntax' });
    expect(refusal(() => parseScimUserResource({ userName: 'a', roles: [{ value: 'admin' }] }))).toMatchObject({ status: 400, scimType: 'invalidValue' });
    expect(parseScimUserResource({ userName: 'a', roles: [] })).toEqual({ userName: 'a' });
  });
});
