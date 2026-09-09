import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('financial-insights strike fund query (Round 58 Phase 0)', () => {
  const src = readFileSync(resolve(__dirname, '../financial-insights.ts'), 'utf8');

  it('filters directly on organization_id, not a user_id join (multi-org fan-out fix)', () => {
    expect(src).toMatch(/FROM strike_fund_disbursements sfd\s*\n\s*WHERE sfd\.organization_id = \$\{orgIdCast\}/);
    expect(src).not.toMatch(/JOIN organization_members om ON om\.user_id = sfd\.user_id/);
  });
});
