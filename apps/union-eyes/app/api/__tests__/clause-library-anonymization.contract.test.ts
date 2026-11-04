import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clauseSourceProjection } from '@/lib/clause-library/source-projection';
import { formatClause, type ClauseDetailRow } from '@/lib/clause-library/clause-detail';

// Disclosed adaptation: B99 moved the source rule into clauseSourceProjection, and the item projection into formatClause (lib/clause-library/clause-detail.ts), which the route
// calls once the caller may read the clause. An unclassified (not explicitly non-anonymized) clause withholds its employer. Both rules are asserted by behaviour.
const route = (suffix: string) => readFileSync(join(__dirname, '..', 'clause-library', suffix, 'route.ts'), 'utf8');

const clause: ClauseDetailRow = {
  id: '11111111-1111-4111-8111-111111111111',
  sourceOrganizationId: 'org-src',
  clauseNumber: '12.1',
  clauseTitle: 'Overtime',
  clauseText: 'Overtime is paid at double time.',
  clauseType: 'wages',
  sharingLevel: 'private',
  sharedWithOrgIds: ['org-a'],
  isAnonymized: true,
  originalEmployerName: 'Acme Ltd',
  anonymizedEmployerName: 'Employer A',
  sector: 'private',
  province: 'ON',
  effectiveDate: '2025-01-01',
  expiryDate: null,
  viewCount: 0,
  comparisonCount: 0,
  version: 1,
  createdBy: 'user-1',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

describe('Gate 0 anonymized clause sharing', () => {
  it('item projection withholds source employer, source organization and creator from non-owners', () => {
    const other = formatClause(clause, 'org-other', [], 'Local 1');
    expect(other.isOwner).toBe(false);
    expect(other.originalEmployerName).toBeUndefined();
    expect(other.sourceOrganization).toBeUndefined();
    expect(other.createdBy).toBeUndefined();
    expect(other.sharedWithOrgIds).toBeUndefined();

    // A clause that has not been classified is withheld like an anonymized one.
    expect(formatClause({ ...clause, isAnonymized: null }, 'org-other', [], 'Local 1').originalEmployerName).toBeUndefined();

    // Explicitly not anonymized: the employer and its source are named to a reader, the creator and the explicit-share list still belong to the owner.
    const open = formatClause({ ...clause, isAnonymized: false }, 'org-other', [], 'Local 1');
    expect(open.originalEmployerName).toBe('Acme Ltd');
    expect(open.sourceOrganization).toEqual({ id: 'org-src', organizationName: 'Local 1' });
    expect(open.createdBy).toBeUndefined();
    expect(open.sharedWithOrgIds).toBeUndefined();

    const owner = formatClause(clause, 'org-src', [], 'Local 1');
    expect(owner.isOwner).toBe(true);
    expect(owner.originalEmployerName).toBe('Acme Ltd');
    expect(owner.sourceOrganization).toEqual({ id: 'org-src', organizationName: 'Local 1' });
    expect(owner.createdBy).toBe('user-1');
    expect(owner.sharedWithOrgIds).toEqual(['org-a']);

    // The route answers with this projection, and only to a caller who may read the clause.
    const src = route('[id]');
    expect(src).toContain('canReadSharedClause(organizationId, row)');
    expect(src).toContain('formatClause(row, organizationId, tags, ');
    expect(src.indexOf('canReadSharedClause(organizationId, row)')).toBeLessThan(src.indexOf('formatClause(row, organizationId, tags, '));
  });

  it('names a source only to its owner, or when the clause is explicitly not anonymized', () => {
    const row = { sourceOrganizationId: 'org-src', organizationName: 'Local 1' };
    expect(clauseSourceProjection({ ...row, isAnonymized: true }, 'org-other')).toBeUndefined();
    expect(clauseSourceProjection({ ...row, isAnonymized: null }, 'org-other')).toBeUndefined();
    expect(clauseSourceProjection({ ...row, isAnonymized: true }, 'org-src')).toEqual({ id: 'org-src', organizationName: 'Local 1' });
    expect(clauseSourceProjection({ ...row, isAnonymized: false }, 'org-other')).toEqual({ id: 'org-src', organizationName: 'Local 1' });
    expect(clauseSourceProjection({ ...row, isAnonymized: false }, '')).toBeUndefined();
  });

  it('collection checks anonymity before projecting the source organization', () => {
    const src = route('');
    expect(src).toContain('isAnonymized: sharedClauseLibrary.isAnonymized');
    expect(src).toContain('sourceOrganization: clauseSourceProjection({ ...r, organizationName: sourceNames.get(r.sourceOrganizationId) ?? null }, organizationId)');
    expect(src).toContain('sourceNamesFor(rows, organizationId)');
    expect(src).toContain('buildClauseVisibilityCondition(organizationId)');
  });
});
