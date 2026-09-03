import { describe, it, expect } from 'vitest';
import { SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { enforceCreateSecurityInvariants, stripBlockedPatchFields, buildMergeSetValues } from '../crud-factory';

describe('crud-factory enforceCreateSecurityInvariants', () => {
  it('applies organizationId/createdBy when a hook returns a clean object without them', () => {
    const result = enforceCreateSecurityInvariants(
      { description: 'a hazard' },
      { organizationId: 'org-real', userId: 'user-real', hasOrgColumn: true, hasCreatedByColumn: true },
    );
    expect(result.organizationId).toBe('org-real');
    expect(result.createdBy).toBe('user-real');
  });

  it('cannot have organizationId removed by a hostile beforeCreate result', () => {
    const hostileResult: Record<string, unknown> = { description: 'a hazard' };
    delete hostileResult.organizationId;
    const result = enforceCreateSecurityInvariants(hostileResult, {
      organizationId: 'org-real',
      userId: 'user-real',
      hasOrgColumn: true,
      hasCreatedByColumn: true,
    });
    expect(result.organizationId).toBe('org-real');
  });

  it('cannot have organizationId replaced by a hostile beforeCreate result', () => {
    const hostileResult = { description: 'a hazard', organizationId: 'attacker-controlled-org' };
    const result = enforceCreateSecurityInvariants(hostileResult, {
      organizationId: 'org-real',
      userId: 'user-real',
      hasOrgColumn: true,
      hasCreatedByColumn: true,
    });
    expect(result.organizationId).toBe('org-real');
    expect(result.organizationId).not.toBe('attacker-controlled-org');
  });

  it('cannot have createdBy removed by a hostile beforeCreate result', () => {
    const hostileResult: Record<string, unknown> = { description: 'a hazard' };
    delete hostileResult.createdBy;
    const result = enforceCreateSecurityInvariants(hostileResult, {
      organizationId: 'org-real',
      userId: 'user-real',
      hasOrgColumn: true,
      hasCreatedByColumn: true,
    });
    expect(result.createdBy).toBe('user-real');
  });

  it('cannot have createdBy replaced by a hostile beforeCreate result', () => {
    const hostileResult = { description: 'a hazard', createdBy: 'attacker-controlled-user' };
    const result = enforceCreateSecurityInvariants(hostileResult, {
      organizationId: 'org-real',
      userId: 'user-real',
      hasOrgColumn: true,
      hasCreatedByColumn: true,
    });
    expect(result.createdBy).toBe('user-real');
    expect(result.createdBy).not.toBe('attacker-controlled-user');
  });

  it('cannot have both organizationId and createdBy stripped and replaced simultaneously', () => {
    const hostileResult = {
      description: 'a hazard',
      organizationId: 'attacker-controlled-org',
      createdBy: 'attacker-controlled-user',
    };
    const result = enforceCreateSecurityInvariants(hostileResult, {
      organizationId: 'org-real',
      userId: 'user-real',
      hasOrgColumn: true,
      hasCreatedByColumn: true,
    });
    expect(result).toMatchObject({
      description: 'a hazard',
      organizationId: 'org-real',
      createdBy: 'user-real',
    });
  });

  it('preserves other transformed business fields untouched', () => {
    const result = enforceCreateSecurityInvariants(
      { hazardCategory: 'fire', hazardLevel: 'high', organizationId: 'attacker-org' },
      { organizationId: 'org-real', userId: 'user-real', hasOrgColumn: true, hasCreatedByColumn: true },
    );
    expect(result.hazardCategory).toBe('fire');
    expect(result.hazardLevel).toBe('high');
    expect(result.organizationId).toBe('org-real');
  });

  it('does not set organizationId when the table is not org-scoped, even if the context has one', () => {
    const result = enforceCreateSecurityInvariants(
      { organizationId: 'attacker-org' },
      { organizationId: 'org-real', userId: 'user-real', hasOrgColumn: false, hasCreatedByColumn: true },
    );
    // hasOrgColumn: false means this resource isn't org-scoped; the hook's
    // value passes through unchanged rather than being forcibly overwritten.
    expect(result.organizationId).toBe('attacker-org');
  });

  it('does not set createdBy when there is no authenticated userId in context', () => {
    const result = enforceCreateSecurityInvariants(
      { createdBy: 'client-supplied-value' },
      { organizationId: 'org-real', userId: undefined, hasOrgColumn: true, hasCreatedByColumn: true },
    );
    expect(result.createdBy).toBe('client-supplied-value');
  });
});

describe('crud-factory stripBlockedPatchFields (PR #752 round 21)', () => {
  it('strips the primary key so it can never be reassigned via PATCH', () => {
    const result = stripBlockedPatchFields(
      { id: 'attacker-controlled-id', name: 'ok' },
      { pk: 'id', orgScoped: false, blockedPatchFields: [] },
    );
    expect(result.id).toBeUndefined();
    expect(result.name).toBe('ok');
  });

  it('strips organizationId when the table is org-scoped', () => {
    const result = stripBlockedPatchFields(
      { organizationId: 'attacker-org', name: 'ok' },
      { pk: 'id', orgScoped: true, blockedPatchFields: [] },
    );
    expect(result.organizationId).toBeUndefined();
  });

  it('leaves organizationId untouched when the table is not org-scoped', () => {
    const result = stripBlockedPatchFields(
      { organizationId: 'some-value' },
      { pk: 'id', orgScoped: false, blockedPatchFields: [] },
    );
    expect(result.organizationId).toBe('some-value');
  });

  it('strips every field listed in blockedPatchFields, e.g. server-controlled verified-org columns', () => {
    const result = stripBlockedPatchFields(
      {
        notes: 'legitimate steward note',
        verifiedOrganizationId: 'attacker-org',
        verifiedBy: 'attacker-controlled-actor',
        verifiedAt: '2020-01-01T00:00:00.000Z',
        status: 'approved',
        reviewedAt: '2020-01-01T00:00:00.000Z',
        approvedAt: '2020-01-01T00:00:00.000Z',
      },
      {
        pk: 'id',
        orgScoped: false,
        blockedPatchFields: ['verifiedOrganizationId', 'verifiedBy', 'verifiedAt', 'status', 'reviewedAt', 'approvedAt'],
      },
    );
    expect(result).toEqual({ notes: 'legitimate steward note' });
  });

  it('returns an empty object for a non-object body instead of throwing', () => {
    expect(stripBlockedPatchFields(null, { pk: 'id', orgScoped: false, blockedPatchFields: [] })).toEqual({});
    expect(stripBlockedPatchFields('a string', { pk: 'id', orgScoped: false, blockedPatchFields: [] })).toEqual({});
    expect(stripBlockedPatchFields(['array', 'body'], { pk: 'id', orgScoped: false, blockedPatchFields: [] })).toEqual({});
  });

  it('does not mutate the original body object', () => {
    const body = { id: 'x', verifiedOrganizationId: 'y', name: 'z' };
    const result = stripBlockedPatchFields(body, { pk: 'id', orgScoped: false, blockedPatchFields: ['verifiedOrganizationId'] });
    expect(body.id).toBe('x');
    expect(body.verifiedOrganizationId).toBe('y');
    expect(result.id).toBeUndefined();
    expect(result.verifiedOrganizationId).toBeUndefined();
  });
});

describe('crud-factory buildMergeSetValues (PR #752 round 24)', () => {
  const fakeTable = { responses: {}, notes: {} } as unknown as PgTable;

  it('converts a plain-object value for a merge column into a SQL fragment', () => {
    const result = buildMergeSetValues({ responses: { readinessNotes: 'ok' } }, fakeTable, ['responses']);
    expect(result.responses).toBeInstanceOf(SQL);
  });

  it('leaves non-merge columns as plain values', () => {
    const result = buildMergeSetValues(
      { responses: { readinessNotes: 'ok' }, notes: 'plain text' },
      fakeTable,
      ['responses'],
    );
    expect(result.notes).toBe('plain text');
  });

  it('leaves a merge column absent when the PATCH does not include it', () => {
    const result = buildMergeSetValues({ notes: 'plain text' }, fakeTable, ['responses']);
    expect(result.responses).toBeUndefined();
  });

  it('leaves a merge column as a plain value when it is not a plain object (null, array)', () => {
    expect(buildMergeSetValues({ responses: null }, fakeTable, ['responses']).responses).toBeNull();
    expect(buildMergeSetValues({ responses: ['x'] }, fakeTable, ['responses']).responses).toEqual(['x']);
  });

  it('does not mutate the input updates object', () => {
    const updates = { responses: { readinessNotes: 'ok' } };
    buildMergeSetValues(updates, fakeTable, ['responses']);
    expect(updates.responses).toEqual({ readinessNotes: 'ok' });
  });
});
