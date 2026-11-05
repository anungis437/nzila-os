import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// DEF-0B9-ASM-SMART-DEFAULTS-ARE-A-LITERAL-TABLE-OF-FEATURES-AND-INTEGRATIONS-NO-OTHER-CODE-DEFINES-OR-READS: the route returned a literal table
// keyed by organization type as intelligent defaults, and nothing defines or applies those features, integrations or limits. It answers 501.
describe('onboarding/smart-defaults route', () => {
  const source = readFileSync(resolve(__dirname, '../onboarding/smart-defaults/route.ts'), 'utf8');

  it('answers 501 behind the member floor', () => {
    expect(source).toContain('ApiError.notImplemented');
    expect(source).toContain("minRole: 'member'");
    expect(source).toContain('export const GET = handler');
  });

  it('does not serve the literal table', () => {
    expect(source).not.toContain('getSmartDefaults');
  });
});
