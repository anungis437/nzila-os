import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clauseSourceProjection } from '@/lib/clause-library/source-projection';

// Disclosed adaptation: B99 moved the source rule into clauseSourceProjection and withholds the employer of an unclassified (not explicitly
// non-anonymized) clause. The pins below follow that implementation, and the rule itself is now asserted by behaviour.
const route = (suffix: string) => readFileSync(join(__dirname, '..', 'clause-library', suffix, 'route.ts'), 'utf8');

describe('Gate 0 anonymized clause sharing', () => {
  it('item projection withholds source employer, source organization and creator from non-owners', () => {
    const src = route('[id]');
    expect(src).toContain('originalEmployerName: isOwner || r!.isAnonymized === false ? r!.originalEmployerName : undefined');
    expect(src).toContain('sourceOrganization: clauseSourceProjection(r!, callerOrgId ?? \'\')');
    expect(src).toContain('createdBy: isOwner ? r!.createdBy : undefined');
    expect(src).toContain('sharedWithOrgIds: isOwner ? r!.sharedWithOrgIds : undefined');
    expect(src).toContain('canReadSharedClause(organizationId, row)');
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
    expect(src).toContain('sourceOrganization: clauseSourceProjection(r, organizationId)');
    expect(src).toContain('buildClauseVisibilityCondition(organizationId)');
  });
});
