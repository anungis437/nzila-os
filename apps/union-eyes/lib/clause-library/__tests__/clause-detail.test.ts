import { describe, expect, it } from 'vitest';
import { formatClause, type ClauseDetailRow } from '../clause-detail';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const row = (overrides: Partial<ClauseDetailRow> = {}): ClauseDetailRow => ({
  id: '33333333-3333-4333-8333-333333333333',
  clauseNumber: '12.01',
  clauseTitle: 'Overtime',
  clauseText: 'The employer shall pay overtime.',
  clauseType: 'overtime',
  sharingLevel: 'public',
  sharedWithOrgIds: [OTHER],
  isAnonymized: true,
  originalEmployerName: 'Acme Ltd',
  anonymizedEmployerName: 'A manufacturer',
  sector: 'private',
  province: 'ON',
  effectiveDate: '2024-01-01',
  expiryDate: '2026-12-31',
  viewCount: 7,
  comparisonCount: 3,
  version: 2,
  sourceOrganizationId: OWNER,
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-02-01T00:00:00Z'),
  ...overrides,
});

describe('formatClause', () => {
  it('carries the comparison count the compare route keeps, so the viewer does not show every clause as never compared', () => {
    expect(formatClause(row({ comparisonCount: 3 }), OWNER, [], 'Local 1').comparisonCount).toBe(3);
  });

  it('gives the owner what is the owner\'s: the explicit-share list, the creator and the real employer', () => {
    const clause = formatClause(row(), OWNER, [{ id: 't1', tagName: 'wages' }], 'Local 1');
    expect(clause.isOwner).toBe(true);
    expect(clause.sharedWithOrgIds).toEqual([OTHER]);
    expect(clause.createdBy).toBe('user-1');
    expect(clause.originalEmployerName).toBe('Acme Ltd');
    expect(clause.sourceOrganization).toEqual({ id: OWNER, organizationName: 'Local 1' });
    expect(clause.tags).toEqual([{ id: 't1', tagName: 'wages' }]);
  });

  it('leaves out, rather than blanks, what an anonymized clause keeps from another organization', () => {
    const clause = formatClause(row(), OTHER, [], 'Local 1');
    expect(clause.isOwner).toBe(false);
    expect(clause).not.toHaveProperty('sharedWithOrgIds', [OTHER]);
    expect(clause.sharedWithOrgIds).toBeUndefined();
    expect(clause.createdBy).toBeUndefined();
    expect(clause.originalEmployerName).toBeUndefined();
    expect(clause.sourceOrganization).toBeUndefined();
    expect(clause.anonymizedEmployerName).toBe('A manufacturer');
  });

  it('names the employer and the source of a clause its owner chose not to anonymize', () => {
    const clause = formatClause(row({ isAnonymized: false }), OTHER, [], 'Local 1');
    expect(clause.originalEmployerName).toBe('Acme Ltd');
    expect(clause.sourceOrganization).toEqual({ id: OWNER, organizationName: 'Local 1' });
  });
});
