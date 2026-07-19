import { describe, expect, it } from 'vitest';

describe('services/compliance/audit-analysis', () => {
  it('loads the type-only module without throwing', async () => {
    const mod = await import('../audit-analysis');
    expect(mod).toBeTypeOf('object');
  });
});
