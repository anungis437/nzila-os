/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * Ratchet: no production ICRA data consumer under app/, actions/, lib/, or
 * components/ may resolve a request-supplied assessmentId into an
 * existing-assessment DB read/mutation without actually CALLING a
 * recognized authorization primitive (or being an explicitly reviewed
 * alternative-authorization exemption below).
 *
 * ARCHITECTURE DECISION (PR #752): ICRA_PSEUDONYMOUS_NO_LOGIN = APPROVED,
 * ASSESSMENT_ID_AS_SOLE_BEARER_AUTHORITY = REJECTED. See
 * lib/icra/assessment-capability.ts.
 *
 * Scope history:
 * - Round 1 scanned only route.ts files under app/api/icra/.
 * - Round 2 widened scanning to app/, actions/, lib/, components/ after
 *   actions/icra/get-profile.ts (a server action, not a route) was found
 *   bypassing every API-level guard via a direct, uncapability-checked
 *   `db` query.
 * - Round 3 (this revision) tightened the pass condition from "imports
 *   the capability guard module" to "calls a recognized authorization
 *   primitive". A bare import proves nothing: a file can import
 *   `@/lib/icra/assessment-capability` for an unrelated export (e.g. a
 *   type, or `capabilityDenialStatus`) and never call `checkCapability()`
 *   before touching the DB, and the old import-only check would have
 *   passed it. See REGRESSION Bug B below.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SCAN_DIRS = ['app', 'actions', 'lib', 'components'];

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
 * Recognized authorization primitives: an actual CALL to one of these
 * proves the file (or a helper it explicitly delegates to) verifies the
 * capability before touching data — not merely imports the module that
 * defines it.
 */
const RECOGNIZED_AUTHORIZATION_CALLS: RegExp[] = [
  /checkCapability\s*\(/,
  /getAuthorizedIcraProfile\s*\(/, // delegates to checkCapability() internally
  /getIcraAdaptiveResolution\s*\(/, // delegates to checkCapability() internally
];

/**
 * Files that legitimately touch ICRA tables by assessmentId WITHOUT a
 * recognized authorization-primitive call, because they use a different,
 * already-reviewed authorization mechanism (or, for the issuance route,
 * because there is no prior capability to verify — the request IS the
 * capability's origin). Each entry must state why. Path is relative to
 * REPO_ROOT.
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
  'app/api/icra/submit/route.ts':
    'Issuance route: creates a brand-new assessment and mints its capability token (generateCapabilityToken + setCapabilityCookie). There is no prior capability to verify at creation time — this request IS the capability\u2019s origin, not a lookup of an existing one.',
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

/**
 * Shared detection logic used both by the real full-surface scan and by
 * the regression fixtures below, so the fixtures prove exactly what the
 * real scan does.
 */
function isUnauthorizedIcraAccess(content: string): boolean {
  const importsIcraTable = new RegExp(
    `from ['"]@/db/schema/icra-schema['"]|\\b(${ICRA_TABLE_EXPORTS.join('|')})\\b`,
  ).test(content);
  const referencesAssessmentId = /assessmentId/.test(content);
  if (!importsIcraTable || !referencesAssessmentId) return false;

  const hasRecognizedAuthorizationCall = RECOGNIZED_AUTHORIZATION_CALLS.some((re) => re.test(content));
  return !hasRecognizedAuthorizationCall;
}

describe('ICRA assessment-capability contract ratchet (full production surface)', () => {
  it('every production file importing an ICRA table export and referencing assessmentId actually calls a recognized authorization primitive, or is a reviewed exemption', () => {
    const allFiles = SCAN_DIRS.flatMap((d) => walk(path.join(REPO_ROOT, d)));
    expect(allFiles.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const file of allFiles) {
      const relative = path.relative(REPO_ROOT, file);
      if (relative.includes('db/schema/icra-schema.ts')) continue; // the declaration file itself
      if (relative === 'lib/icra/assessment-capability.ts') continue; // the guard module itself

      const content = fs.readFileSync(file, 'utf8');
      if (!isUnauthorizedIcraAccess(content)) continue;
      if (REVIEWED_EXEMPTIONS[relative]) continue;

      violations.push(relative);
    }

    if (violations.length > 0) {
      throw new Error(
        `Production file(s) resolve an assessmentId into ICRA table access without calling a recognized ` +
          `authorization primitive (${RECOGNIZED_AUTHORIZATION_CALLS.map((r) => r.source).join(', ')}) and are ` +
          `not in REVIEWED_EXEMPTIONS: ${violations.join(', ')}. Add the capability check, or add a reasoned ` +
          `entry to REVIEWED_EXEMPTIONS in this test.`,
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

  it('REGRESSION Bug A: ICRA table access + assessmentId + no guard import/call at all', () => {
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
    expect(isUnauthorizedIcraAccess(buggyFixture)).toBe(true);
  });

  it('REGRESSION Bug B: imports the capability guard module but never calls checkCapability() (dead import is not authorization evidence)', () => {
    const buggyFixture = `
      import { eq } from 'drizzle-orm'
      import { db } from '@/db'
      import { icraMaturityProfiles } from '@/db/schema/icra-schema'
      import type { CapabilityDenialReason } from '@/lib/icra/assessment-capability'

      export async function getIcraProfile(assessmentId: string): Promise<{ ok: true } | { ok: false; reason: CapabilityDenialReason }> {
        const rows = await db
          .select({ profilePayload: icraMaturityProfiles.profilePayload })
          .from(icraMaturityProfiles)
          .where(eq(icraMaturityProfiles.assessmentId, assessmentId))
          .limit(1)
        return { ok: true } as any
      }
    `;
    expect(isUnauthorizedIcraAccess(buggyFixture)).toBe(true);
  });

  it('a file that actually calls checkCapability() is correctly recognized as authorized', () => {
    const fixedFixture = `
      import { eq } from 'drizzle-orm'
      import { icraMaturityProfiles, icraAssessments } from '@/db/schema/icra-schema'
      import { withSystemContext } from '@/lib/db/with-rls-context'
      import { checkCapability } from '@/lib/icra/assessment-capability'

      export async function getAuthorizedIcraProfile(assessmentId: string, token: string | null) {
        return withSystemContext(async (tx) => {
          const [row] = await tx.select().from(icraAssessments).where(eq(icraAssessments.id, assessmentId)).limit(1)
          const check = checkCapability(token, row)
          if (!check.ok) return { ok: false, reason: check.reason }
          return { ok: true }
        })
      }
    `;
    expect(isUnauthorizedIcraAccess(fixedFixture)).toBe(false);
  });
});


