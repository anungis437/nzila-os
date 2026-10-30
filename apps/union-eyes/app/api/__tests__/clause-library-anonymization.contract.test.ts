import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const route = (suffix: string) => readFileSync(join(__dirname, '..', 'clause-library', suffix, 'route.ts'), 'utf8');

describe('Gate 0 anonymized clause sharing', () => {
  it('item projection withholds source employer, source organization and creator from non-owners', () => {
    const src = route('[id]');
    expect(src).toContain('originalEmployerName: isOwner || !r!.isAnonymized ? r!.originalEmployerName : undefined');
    expect(src).toContain('sourceOrganization: isOwner || !r!.isAnonymized ?');
    expect(src).toContain('createdBy: isOwner ? r!.createdBy : undefined');
    expect(src).toContain('sharedWithOrgIds: isOwner ? r!.sharedWithOrgIds : undefined');
    expect(src).toContain('canReadSharedClause(organizationId, row)');
  });

  it('collection checks anonymity before projecting the source organization', () => {
    const src = route('');
    expect(src).toContain('isAnonymized: sharedClauseLibrary.isAnonymized');
    expect(src).toContain('r.isAnonymized && r.sourceOrganizationId !== organizationId');
    expect(src).toContain('sourceOrganization: r.isAnonymized');
    expect(src).toContain('buildClauseVisibilityCondition(organizationId)');
  });
});
