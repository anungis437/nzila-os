/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * Ratchet: no production ICRA data consumer under app/, actions/, lib/, or
 * components/ may resolve a request-supplied assessmentId into an
 * existing-assessment DB read/mutation without also referencing the
 * assessment-capability guard (or one of the explicitly reviewed
 * alternative authorization mechanisms below).
 *
 * ARCHITECTURE DECISION (PR #752): ICRA_PSEUDONYMOUS_NO_LOGIN = APPROVED,
 * ASSESSMENT_ID_AS_SOLE_BEARER_AUTHORITY = REJECTED. See
 * lib/icra/assessment-capability.ts.
 *
 * Scope was widened after an independent review found the original
 * app/api/icra/**-only ratchet had a blind spot: actions/icra/get-profile.ts
 * (a server action, not a route) queried icra_maturity_profiles by
 * assessmentId alone through the ordinary imported `db`, with zero
 * capability check — the results page called it directly, bypassing every
 * API-level guard entirely. See the REGRESSION test below, which proves
 * this exact bug class would be caught.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SCAN_DIRS = ['app', 'actions', 'lib', 'components'];

const CAPABILITY_GUARD_IMPORT = '@/lib/icra/assessment-capability';

const ICRA_TABLE_EXPORTS = [
  'icraAssessments',
  'icraAssessmentAnswers',
  'icraMaturityProfiles',
  'icraContinuityScores',
  'icraGovernanceFlags',
  'icraFollowupRecommendations',
  'icraOrganizations',
  'icraOperationalIndicators',
  'icraBenchmarkGroups',
  'icraAnonymizedMetrics',
];

/**
 * Files that legitimately touch ICRA tables by assessmentId WITHOUT the
 * pseudonymous capability guard, because they use a different,
 * already-reviewed authorization mechanism. Each entry must state why.
 * Path is relative to REPO_ROOT.
 */
const REVIEWED_EXEMPTIONS: Record<string, string> = {
  'app/api/icra/[assessmentId]/claim/route.ts':
    'Authenticated claim workflow: gated by auth() + single-use claimToken match + expiry/already-claimed checks (not the pseudonymous capability).',
  'app/api/icra/report/[assessmentId]/review/route.ts':
    'Internal governance-review mutation: gated by a constant-time CRON_SECRET_KEY/CRON_SECRET check, not end-user authorization.',
  'app/api/payments/webhooks/stripe/route.ts':
    'Stripe webhook handler: the entire POST handler is gated by verifyStripeSignature() (HMAC signature check against STRIPE_WEBHOOK_SECRET) before any DB access, including the ICRA tier-fulfillment branch (now wrapped in withSystemContext).',
  'lib/hubspot/syncIcraPurchase.ts':
    'System-to-system CRM sync, invoked only from the signature-verified Stripe webhook (checkout.session.completed) after a real payment event — not reachable from any user-facing, unauthenticated path.',
};

function walk(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name === '.next') continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('ICRA assessment-capability contract ratchet (full production surface)', () => {
  it('every production file importing an ICRA table export and referencing assessmentId either imports the capability guard or is a reviewed exemption', () => {
    const allFiles = SCAN_DIRS.flatMap((d) => walk(path.join(REPO_ROOT, d)));
    expect(allFiles.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const file of allFiles) {
      const relative = path.relative(REPO_ROOT, file);
      if (relative.includes('db/schema/icra-schema.ts')) continue; // the declaration file itself
      if (relative === 'lib/icra/assessment-capability.ts') continue; // the guard module itself

      const content = fs.readFileSync(file, 'utf8');

      const importsIcraTable = new RegExp(
        `from ['"]@/db/schema/icra-schema['"]|\\b(${ICRA_TABLE_EXPORTS.join('|')})\\b`,
      ).test(content);
      const referencesAssessmentId = /assessmentId/.test(content);
      if (!importsIcraTable || !referencesAssessmentId) continue;

      const hasCapabilityGuard = content.includes(CAPABILITY_GUARD_IMPORT);
      if (hasCapabilityGuard) continue;

      if (REVIEWED_EXEMPTIONS[relative]) continue;

      violations.push(relative);
    }

    if (violations.length > 0) {
      throw new Error(
        `Production file(s) resolve an assessmentId into ICRA table access without importing the ` +
          `assessment-capability guard (${CAPABILITY_GUARD_IMPORT}) and are not in REVIEWED_EXEMPTIONS: ` +
          `${violations.join(', ')}. Add the capability check, or add a reasoned entry to ` +
          `REVIEWED_EXEMPTIONS in this test.`,
      );
    }
    expect(violations).toEqual([]);
  });

  it('every REVIEWED_EXEMPTIONS entry still exists as a real file', () => {
    for (const relative of Object.keys(REVIEWED_EXEMPTIONS)) {
      const full = path.join(REPO_ROOT, relative);
      expect(fs.existsSync(full), `expected ${relative} to exist`).toBe(true);
    }
  });

  it('REGRESSION: would have caught the actions/icra/get-profile.ts bug (ICRA table + assessmentId + no capability import)', () => {
    // Reconstruct the exact pre-fix content shape as a synthetic fixture,
    // rather than depending on the real (now-fixed) file, so this
    // regression proof survives future refactors of get-profile.ts itself.
    const buggyFixture = `
      import { eq } from 'drizzle-orm'
      import { db } from '@/db'
      import { icraMaturityProfiles } from '@/db/schema/icra-schema'

      export async function getIcraProfile(assessmentId: string) {
        const rows = await db
          .select({ profilePayload: icraMaturityProfiles.profilePayload })
          .from(icraMaturityProfiles)
          .where(eq(icraMaturityProfiles.assessmentId, assessmentId))
          .limit(1)
        return rows[0]?.profilePayload ?? null
      }
    `;

    const importsIcraTable = new RegExp(
      `from ['"]@/db/schema/icra-schema['"]|\\b(${ICRA_TABLE_EXPORTS.join('|')})\\b`,
    ).test(buggyFixture);
    const referencesAssessmentId = /assessmentId/.test(buggyFixture);
    const hasCapabilityGuard = buggyFixture.includes(CAPABILITY_GUARD_IMPORT);

    expect(importsIcraTable).toBe(true);
    expect(referencesAssessmentId).toBe(true);
    expect(hasCapabilityGuard).toBe(false); // this is exactly the violation condition
  });
});

