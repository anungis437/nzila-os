import { describe, expect, it } from 'vitest';
import { toExternalMatterProjection } from '../external-matter-projection-service';

describe('external matter projection', () => {
  it('emits only the external-safe matter shape', () => {
    const projected = toExternalMatterProjection({
      id: 'matter-a',
      caseNumber: 'G-001',
      title: 'External appeal',
      status: 'investigation',
      step: 'triage',
      filedDate: new Date('2026-09-15T00:00:00.000Z'),
      responseDeadline: new Date('2026-09-30T00:00:00.000Z'),
      summary: 'External-safe summary',
      internalUnionNotes: 'do not leak',
      internalAssignmentRationale: 'do not leak',
      financialReserve: 1000,
      tenantAdminMetadata: { secret: true },
    } as never);

    expect(projected).toEqual({
      id: 'matter-a',
      caseNumber: 'G-001',
      title: 'External appeal',
      status: 'investigation',
      step: 'triage',
      filedDate: '2026-09-15T00:00:00.000Z',
      responseDeadline: '2026-09-30T00:00:00.000Z',
      summary: 'External-safe summary',
    });
    expect(projected).not.toHaveProperty('internalUnionNotes');
    expect(projected).not.toHaveProperty('internalAssignmentRationale');
    expect(projected).not.toHaveProperty('financialReserve');
    expect(projected).not.toHaveProperty('tenantAdminMetadata');
  });
});
