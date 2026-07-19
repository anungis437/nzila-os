import { describe, expect, it } from 'vitest';

describe('case-intelligence/types', () => {
  it('loads the type-only module without throwing', async () => {
    const mod = await import('../types');
    expect(mod).toBeTypeOf('object');
  });
});
