import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clauseSourceProjection } from '../source-projection';

const source = { sourceOrganizationId: 'union-a', organizationName: 'Confidential Union A' };

describe('shared-clause source attribution', () => {
  it('never reveals an anonymized source to another organization', () => {
    expect(clauseSourceProjection({ ...source, isAnonymized: true }, 'union-b')).toBeUndefined();
    expect(clauseSourceProjection({ ...source, isAnonymized: null }, 'union-b')).toBeUndefined();
    expect(clauseSourceProjection({ ...source }, 'union-b')).toBeUndefined();
  });

  it('allows the source owner to see its own attribution', () => {
    expect(clauseSourceProjection({ ...source, isAnonymized: true }, 'union-a'))
      .toEqual({ id: 'union-a', organizationName: 'Confidential Union A' });
  });

  it('preserves explicitly non-anonymized attribution for an authorized reader', () => {
    expect(clauseSourceProjection({ ...source, isAnonymized: false }, 'union-b'))
      .toEqual({ id: 'union-a', organizationName: 'Confidential Union A' });
  });

  it('fails closed when the acting organization is missing', () => {
    expect(clauseSourceProjection({ ...source, isAnonymized: false }, '')).toBeUndefined();
  });

  it('requires list, search and compare to project attribution through the same rule', () => {
    const root = process.cwd();
    for (const path of [
      'app/api/clause-library/route.ts',
      'app/api/clause-library/search/route.ts',
      'app/api/clause-library/compare/route.ts',
    ]) {
      const route = readFileSync(join(root, path), 'utf8');
      expect(route).toContain('sourceOrganization: clauseSourceProjection(r, organizationId)');
    }
    for (const path of [
      'app/api/clause-library/search/route.ts',
      'app/api/clause-library/compare/route.ts',
    ]) {
      const route = readFileSync(join(root, path), 'utf8');
      expect(route).toContain('isAnonymized: sharedClauseLibrary.isAnonymized');
    }
  });
});
