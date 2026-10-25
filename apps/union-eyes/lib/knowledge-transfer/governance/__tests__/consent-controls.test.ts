import { describe, expect, it } from 'vitest';
import {
  SENSITIVITY_LEVELS,
  SENSITIVITY_MIN_ROLE,
  isIndexingAllowed,
  isPublishAllowed,
  describeAccessRestriction,
  readableSensitivityLevels,
} from '../consent-controls';

describe('lib/knowledge-transfer/governance/consent-controls', () => {
  it('exposes sensitivity level and role tables', () => {
    expect(SENSITIVITY_LEVELS.public_internal.indexingAllowed).toBe(true);
    expect(SENSITIVITY_LEVELS.legal_sensitive.indexingAllowed).toBe(false);
    expect(SENSITIVITY_MIN_ROLE.public_internal).toBe('member');
    expect(SENSITIVITY_MIN_ROLE.executive_confidential).toBe('admin');
  });

  it('isIndexingAllowed requires consent and an indexable level', () => {
    expect(isIndexingAllowed('public_internal', false)).toBe(false);
    expect(isIndexingAllowed('public_internal', true)).toBe(true);
    expect(isIndexingAllowed('restricted', true)).toBe(true);
    expect(isIndexingAllowed('privileged', true)).toBe(false);
    expect(isIndexingAllowed('legal_sensitive', true)).toBe(false);
  });

  it('isPublishAllowed blocks legal_sensitive without consent', () => {
    expect(isPublishAllowed('legal_sensitive', false)).toBe(false);
    expect(isPublishAllowed('legal_sensitive', true)).toBe(true);
    expect(isPublishAllowed('public_internal', false)).toBe(true);
    expect(isPublishAllowed('privileged', false)).toBe(true);
  });

  it('readableSensitivityLevels leaves out every level above the caller\'s role', async () => {
    const roleLevel: Record<string, number> = { member: 1, steward: 2, officer: 3, admin: 4 };
    const at = (held: string) => async (role: string) => roleLevel[held] >= roleLevel[role];
    expect(await readableSensitivityLevels(at('member'))).toEqual(['public_internal']);
    expect(await readableSensitivityLevels(at('steward'))).toEqual(['public_internal', 'restricted']);
    expect(await readableSensitivityLevels(at('officer'))).toEqual(['public_internal', 'restricted', 'privileged']);
    expect(await readableSensitivityLevels(at('admin'))).toHaveLength(5);
  });

  it('describeAccessRestriction reflects indexing status', () => {
    expect(describeAccessRestriction('public_internal', true)).toContain('Semantic search: enabled');
    expect(describeAccessRestriction('public_internal', false)).toContain('Semantic search: disabled');
    expect(describeAccessRestriction('privileged', true)).toContain('Semantic search: disabled');
  });
});
