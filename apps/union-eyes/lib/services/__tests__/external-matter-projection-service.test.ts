import { describe, expect, it } from 'vitest';
import { toExternalMatterProjection } from '../external-matter-projection-service';

describe('external matter projection', () => {
  it('emits only the external-safe matter shape', () => {
    const internalSentinels = [
      'INTERNAL_SECRET_SENTINEL_DESCRIPTION',
      'INTERNAL_SECRET_SENTINEL_NOTES',
      'INTERNAL_SECRET_SENTINEL_ASSIGNMENT',
      'INTERNAL_SECRET_SENTINEL_FINANCIAL',
      'INTERNAL_SECRET_SENTINEL_ADMIN',
    ];
    const projected = toExternalMatterProjection({
      id: 'matter-a',
      caseNumber: 'G-001',
      title: 'External appeal',
      status: 'investigation',
      step: 'triage',
      filedDate: new Date('2026-09-15T00:00:00.000Z'),
      responseDeadline: new Date('2026-09-30T00:00:00.000Z'),
      summary: 'External-safe summary',
      description: internalSentinels[0],
      internalUnionNotes: internalSentinels[1],
      internalAssignmentRationale: internalSentinels[2],
      financialReserve: internalSentinels[3],
      tenantAdminMetadata: { secret: internalSentinels[4] },
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

    const serialized = JSON.stringify(projected);
    for (const sentinel of internalSentinels) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  it('does not fall back to internal description when external summary is absent', () => {
    const projected = toExternalMatterProjection({
      id: 'matter-a',
      title: 'External appeal',
      description: 'INTERNAL_SECRET_SENTINEL',
      summary: null,
    });

    expect(projected.summary).toBeNull();
    expect(JSON.stringify(projected)).not.toContain('INTERNAL_SECRET_SENTINEL');
  });
});
