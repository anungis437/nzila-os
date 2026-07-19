import { describe, it, expect } from 'vitest';
import { CASE_STUDIES_VISIBLE } from '../marketing-feature-flags';

describe('lib/marketing-feature-flags', () => {
  it('keeps public case studies hidden by default', () => {
    expect(CASE_STUDIES_VISIBLE).toBe(false);
  });
});
