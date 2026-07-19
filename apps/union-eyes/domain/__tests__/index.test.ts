import { describe, expect, it } from 'vitest';

describe('domain/index', () => {
  it('loads the domain barrel module without throwing', async () => {
    const mod = await import('../index');
    // The module re-exports only TypeScript types, which are erased at runtime.
    expect(mod).toBeTypeOf('object');
    expect(mod).not.toBeNull();
  });
});
