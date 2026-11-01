import { describe, it, expect } from 'vitest';
import { SQL, getTableName } from 'drizzle-orm';
import { analyticsMetrics } from '@/db/schema';
import type { PgTable } from 'drizzle-orm/pg-core';
import { bindCreatePathIdentifier, enforceCreateSecurityInvariants, assertGenericWritePayload, parseCrudPagination, stripBlockedPatchFields, buildMergeSetValues, validateMergeJsonColumnValues, shapeCrudResponseRow } from '../crud-factory';

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

describe('crud-factory validateMergeJsonColumnValues (PR #752 round 25)', () => {
  it('passes for a plain-object merge column value', () => {
    expect(() => validateMergeJsonColumnValues({ responses: { note: 'ok' } }, ['responses'])).not.toThrow();
  });

  it('passes when the merge column is absent from the PATCH body entirely', () => {
    expect(() => validateMergeJsonColumnValues({ notes: 'unrelated' }, ['responses'])).not.toThrow();
  });

  it('rejects an array value — the direct reserved-state destruction bypass this closes', () => {
    expect(() => validateMergeJsonColumnValues({ responses: [] }, ['responses'])).toThrow(/must be a JSON object/);
  });

  it('rejects a non-empty array value', () => {
    expect(() => validateMergeJsonColumnValues({ responses: ['x', 'y'] }, ['responses'])).toThrow(/must be a JSON object/);
  });

  it('rejects an explicit null value', () => {
    expect(() => validateMergeJsonColumnValues({ responses: null }, ['responses'])).toThrow(/must be a JSON object/);
  });

  it('rejects a scalar (string/number) value', () => {
    expect(() => validateMergeJsonColumnValues({ responses: 'not-an-object' }, ['responses'])).toThrow(/must be a JSON object/);
    expect(() => validateMergeJsonColumnValues({ responses: 42 }, ['responses'])).toThrow(/must be a JSON object/);
  });

  it('only validates columns actually listed in mergeJsonColumns', () => {
    expect(() => validateMergeJsonColumnValues({ notes: [] }, ['responses'])).not.toThrow();
  });
});


describe('generic CRUD mass-assignment gate', () => {
  const table = { id: { name: 'id' }, name: { name: 'name' }, organizationId: { name: 'organization_id' }, createdBy: { name: 'created_by' }, status: { name: 'status' } } as unknown as PgTable;
  const options = { primaryKey: 'id', blockedFields: ['status'] };
  it('accepts only ordinary schema-backed business fields', () => {
    expect(assertGenericWritePayload({ name: 'Valid' }, table, options)).toEqual({ name: 'Valid' });
  });
  it.each(['id', 'organizationId', 'createdBy', 'createdAt', 'updatedAt', 'approvedBy', 'verifiedAt', 'status', 'unknownField'])('rejects caller-controlled %s', (field) => {
    expect(() => assertGenericWritePayload({ [field]: 'attacker' }, table, options)).toThrow();
  });
  it('rejects non-object payloads', () => {
    expect(() => assertGenericWritePayload([], table, options)).toThrow();
    expect(() => assertGenericWritePayload(null, table, options)).toThrow();
  });
});


describe('generic CRUD pagination boundaries', () => {
  it('uses default pagination with safe offsets', () => {
    expect(parseCrudPagination(new URLSearchParams())).toEqual({ page: 1, limit: 50, offset: 0 });
    expect(parseCrudPagination(new URLSearchParams('page=3&limit=20'))).toEqual({ page: 3, limit: 20, offset: 40 });
  });
  it.each(['page=0', 'page=-1', 'page=1.5', 'page=NaN', 'page=10001', 'page=9007199254740993', 'limit=0', 'limit=101', 'limit=Infinity', 'limit=2junk'])('rejects malformed or excessive pagination %s', (query) => {
    expect(() => parseCrudPagination(new URLSearchParams(query))).toThrow();
  });
});


describe('generic analytics metric read confidentiality', () => {
  it('uses the canonical Drizzle table name for the generic analytics aliases', () => {
    expect(getTableName(analyticsMetrics)).toBe('analytics_metrics');
  });

  it('redacts historical case identifiers and other metadata on every analytics_metrics read', () => {
    const stored = {
      id: 'metric-1',
      organizationId: 'org-1',
      metricType: 'claims_volume',
      metricValue: '2',
      metadata: { claimIds: ['case-private-1', 'case-private-2'], internalNotes: 'restricted' },
    };
    const projected = shapeCrudResponseRow(stored, 'analytics_metrics');
    expect(projected).toEqual({
      id: 'metric-1', organizationId: 'org-1', metricType: 'claims_volume', metricValue: '2',
    });
    expect(JSON.stringify(projected)).not.toContain('case-private');
    expect(stored.metadata.claimIds).toHaveLength(2); // Projection never modifies stored evidence.
  });

  it('enforces the analytics redaction even if an alias provides an empty omit list', () => {
    expect(shapeCrudResponseRow({ metadata: { claimIds: ['secret'] }, metricValue: '1' }, 'analytics_metrics', []))
      .toEqual({ metricValue: '1' });
  });

  it('preserves explicit credential redactions for other tables and leaves ordinary fields intact', () => {
    expect(shapeCrudResponseRow({ id: 'x', accessToken: 'secret', name: 'calendar' }, 'external_calendar_connections', ['accessToken']))
      .toEqual({ id: 'x', name: 'calendar' });
    expect(shapeCrudResponseRow({ id: 'x', metadata: { public: true } }, 'other_table'))
      .toEqual({ id: 'x', metadata: { public: true } });
    expect(shapeCrudResponseRow(undefined, 'analytics_metrics')).toBeUndefined();
  });
});


describe('nested collection POST parent binding (DEF-0B5-SURVEY-RESPONSES-ROUTE-IGNORES-SURVEY-ID)', () => {
  const binding = { paramName: 'surveyId', field: 'surveyId' };
  it('derives surveyId from the URL when omitted from JSON', () => {
    const values: Record<string, unknown> = {};
    expect(bindCreatePathIdentifier(values, { surveyId: 'survey-A' }, binding)).toBe('survey-A');
    expect(values.surveyId).toBe('survey-A');
  });
  it('permits a matching legacy body surveyId', () => {
    expect(bindCreatePathIdentifier({ surveyId: 'survey-A' }, { surveyId: 'survey-A' }, binding)).toBe('survey-A');
  });
  it('rejects a mismatched body identifier without changing the body', () => {
    const values = { surveyId: 'survey-B' };
    expect(() => bindCreatePathIdentifier(values, { surveyId: 'survey-A' }, binding)).toThrow();
    expect(values.surveyId).toBe('survey-B');
  });
  it('rejects a missing or blank path identifier instead of trusting JSON', () => {
    expect(() => bindCreatePathIdentifier({ surveyId: 'survey-B' }, {}, binding)).toThrow();
    expect(() => bindCreatePathIdentifier({}, { surveyId: ' ' }, binding)).toThrow();
  });
});
