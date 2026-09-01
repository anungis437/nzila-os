/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * Ratchet: no ICRA route under app/api/icra/** may resolve a request-supplied
 * assessmentId straight into withSystemContext()-privileged DB access
 * without also referencing the assessment-capability guard (or one of the
 * explicitly reviewed alternative authorization mechanisms below).
 *
 * ARCHITECTURE DECISION (PR #752): ICRA_PSEUDONYMOUS_NO_LOGIN = APPROVED,
 * ASSESSMENT_ID_AS_SOLE_BEARER_AUTHORITY = REJECTED. See
 * lib/icra/assessment-capability.ts. This test is the enforcement
 * mechanism for that decision going forward — a new ICRA route that
 * touches an existing assessment by id via withSystemContext MUST either
 * import the capability guard, or be added to REVIEWED_EXEMPTIONS below
 * with a reason (never silently exempted).
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const ICRA_API_ROOT = path.resolve(__dirname, '../../../app/api/icra');

const CAPABILITY_GUARD_IMPORT = '@/lib/icra/assessment-capability';

/**
 * Routes that legitimately touch an existing assessment via withSystemContext
 * WITHOUT the assessment-capability guard, because they use a different,
 * already-reviewed authorization mechanism. Each entry must state why.
 */
const REVIEWED_EXEMPTIONS: Record<string, string> = {
  '[assessmentId]/claim/route.ts':
    'Authenticated claim workflow: gated by auth() + single-use claimToken match + expiry/already-claimed checks (not the pseudonymous capability).',
  'report/[assessmentId]/review/route.ts':
    'Internal governance-review mutation: gated by a constant-time CRON_SECRET_KEY/CRON_SECRET check, not end-user authorization.',
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.name === 'route.ts') {
      out.push(full);
    }
  }
  return out;
}

describe('ICRA assessment-capability contract ratchet', () => {
  it('every ICRA route.ts using withSystemContext with an assessmentId param either imports the capability guard or is a reviewed exemption', () => {
    const routeFiles = walk(ICRA_API_ROOT);
    expect(routeFiles.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const file of routeFiles) {
      const relative = path.relative(ICRA_API_ROOT, file);
      const content = fs.readFileSync(file, 'utf8');

      const touchesAssessmentIdParam = /assessmentId/.test(content);
      const usesSystemContext = /withSystemContext\s*\(/.test(content);
      if (!touchesAssessmentIdParam || !usesSystemContext) continue;

      const hasCapabilityGuard = content.includes(CAPABILITY_GUARD_IMPORT);
      if (hasCapabilityGuard) continue;

      if (REVIEWED_EXEMPTIONS[relative]) continue;

      violations.push(relative);
    }

    if (violations.length > 0) {
      throw new Error(
        `ICRA route(s) resolve an assessmentId into withSystemContext-privileged DB access ` +
          `without importing the assessment-capability guard (${CAPABILITY_GUARD_IMPORT}) and are ` +
          `not in REVIEWED_EXEMPTIONS: ${violations.join(', ')}. ` +
          `Add the capability check, or add a reasoned entry to REVIEWED_EXEMPTIONS in this test.`,
      );
    }
    expect(violations).toEqual([]);
  });

  it('every REVIEWED_EXEMPTIONS entry still exists as a real route file', () => {
    for (const relative of Object.keys(REVIEWED_EXEMPTIONS)) {
      const full = path.join(ICRA_API_ROOT, relative);
      expect(fs.existsSync(full), `expected ${relative} to exist`).toBe(true);
    }
  });
});
