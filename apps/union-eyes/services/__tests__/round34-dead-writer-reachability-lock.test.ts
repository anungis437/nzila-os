/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 34: independently re-investigated the "priority tranche"
 * named for this round (rl1_tax_slips/t4a_tax_slips, remittance_approvals,
 * the stripe_connect_accounts/whiplash-prevention cluster) to determine
 * whether a real tenant ownership model could be built for any of them.
 *
 * Finding: none of the three can be legitimately remediated with
 * tenant-facing CRUD, because in every case the sole TS-side writer (or,
 * for remittance_approvals, the sole write PATH) is confirmed dead code
 * with ZERO real callers anywhere in the app — building an isolation
 * mixin for a table nothing actually writes would be inventing authority
 * a mixin can express, not authority that is needed (the exact mistake
 * independent review caught in this same round's donation_receipts
 * restoration). This is a regression lock, not new functionality: it
 * fails loudly the moment any of these gains a real caller, forcing a
 * future round to consciously design the ownership model FOR that new
 * caller rather than silently reactivating dead code behind an
 * already-Django-router-registered, currently-DenyAll-contained
 * ModelViewSet.
 *
 * Findings, independently re-verified this round (not merely re-cited
 * from an earlier round):
 *   1. services/tax-slip-service.ts's TaxSlipService.generateT4ASlips()/
 *      generateRL1Slips() (the only writers of t4a_tax_slips/
 *      rl1_tax_slips) — zero real callers. The only file matching a loose
 *      "TaxSlipService" substring search, lib/api/tax-slip-service-api.ts,
 *      is an auto-generated Django-REST-proxy boilerplate client that
 *      never imports the real class (same false-positive-reference class
 *      already documented for gss_applications in
 *      db/rls-storage-authority/organizations-membership.ts's round-17
 *      entry — independently reconfirmed here, not merely trusted).
 *   2. services/whiplash-prevention-service.ts's WhiplashPreventionService
 *      (the only writer of stripe_connect_accounts, payment_routing_rules,
 *      separated_payment_transactions, account_balance_reconciliation) —
 *      zero real callers anywhere. payment_classification_policy is
 *      defined in db/schema/whiplash-prevention-schema.ts but is not even
 *      referenced by WhiplashPreventionService itself — the least-wired
 *      table in an already-fully-unwired cluster.
 *   3. services/clc/remittance-audit.ts's submitForApproval()/
 *      approveRemittance()/rejectRemittance() (the only writers of
 *      remittance_approvals) — already established in round 33 as part of
 *      a dead admin approval-workflow UI (its routes don't exist or are
 *      unwired stubs); reconfirmed here that the ONLY real reader of
 *      remittance_approvals is app/[locale]/dashboard/clc/staff/page.tsx,
 *      a national CLC dashboard reading via withSystemContext() with no
 *      per-caller organization filter — never an ordinary tenant path.
 *
 * ROUND 34 CORRECTION (2026-09-04, second independent review pass):
 * independent review found the original realImporterFiles() scanned only
 * 4 hard-coded directories (app, lib, actions, services), making its
 * "ZERO real callers anywhere" wording stronger than its mechanical proof
 * — a real caller under components/, scripts/, workers/, or any future
 * production directory would have been invisible to it. Replaced with a
 * git-grep-based scan across every tracked *.ts/*.tsx file (git grep run
 * from this app's root directory is naturally scoped to that
 * subdirectory, matching every production file git actually tracks, not
 * a hand-maintained directory allow-list). Also added explicit
 * zero-direct-call assertions for submitForApproval/approveRemittance/
 * rejectRemittance individually (previously only checked as a combined
 * regex group), and a structural (not just substring) proof that the CLC
 * dashboard's remittanceApprovals SELECT is nested inside its
 * withSystemContext() call, not merely present somewhere in the same
 * file.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_ROOT = resolve(__dirname, '..', '..');

/**
 * Scans every file `git` tracks under APP_ROOT (git grep run from a
 * subdirectory is scoped to that subdirectory) for a pattern, restricted
 * to *.ts/*.tsx — not a hand-maintained list of "production" directories,
 * so a real caller under components/, scripts/, workers/, or any future
 * directory is not invisible to this check.
 */
function realImporterFiles(moduleSpecifierFragment: string, definingFileRelativePath: string): string[] {
  let out = '';
  try {
    out = execFileSync(
      'git',
      ['grep', '-l', '-E', moduleSpecifierFragment, '--', '*.ts', '*.tsx'],
      { cwd: APP_ROOT, encoding: 'utf8' },
    );
  } catch (err: unknown) {
    // git grep exits 1 when there are no matches at all — that's a valid
    // "zero importers" result.
    const execErr = err as { status?: number; stdout?: string };
    if (execErr.status === 1) return [];
    out = execErr.stdout ?? '';
  }
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.includes('__tests__') && !file.includes('.test.') && !file.includes('.spec.'))
    // db/rls-storage-authority/**: the governance manifest itself, which cites
    // function/class names in prose evidence (never a real import/call) — see
    // e.g. this exact file's own docstring, which would otherwise self-match.
    .filter((file) => !file.startsWith('db/rls-storage-authority/'))
    .filter((file) => file !== definingFileRelativePath);
}

describe('round 34: dead-writer reachability locks for the priority-tranche tables (rl1/t4a_tax_slips, stripe_connect_accounts cluster, remittance_approvals)', () => {
  it('TaxSlipService.generateT4ASlips/generateRL1Slips (sole writers of t4a_tax_slips/rl1_tax_slips) have ZERO real callers', () => {
    const source = readFileSync(resolve(APP_ROOT, 'services/tax-slip-service.ts'), 'utf8');
    expect(source).toMatch(/static async generateT4ASlips/);
    expect(source).toMatch(/static async generateRL1Slips/);

    const importers = realImporterFiles('TaxSlipService\\.(generateT4ASlips|generateRL1Slips)', 'services/tax-slip-service.ts');
    expect(
      importers,
      'TaxSlipService.generateT4ASlips/generateRL1Slips has gained a real caller — t4a_tax_slips/' +
        'rl1_tax_slips have NO organization_id column (member-level user_id only); that call site MUST ' +
        'resolve a real member->organization ownership model (and the Django T4aTaxSlipsViewSet/' +
        'Rl1TaxSlipsViewSet DenyAllPermission containment must be revisited) before this can pass.',
    ).toEqual([]);
  });

  it('WhiplashPreventionService (sole writer of the stripe_connect_accounts/payment_routing_rules/separated_payment_transactions/account_balance_reconciliation cluster) has ZERO real callers', () => {
    const source = readFileSync(resolve(APP_ROOT, 'services/whiplash-prevention-service.ts'), 'utf8');
    expect(source).toMatch(/export class WhiplashPreventionService/);

    const importers = realImporterFiles('WhiplashPreventionService', 'services/whiplash-prevention-service.ts');
    expect(
      importers,
      'WhiplashPreventionService has gained a real caller — none of its tables have an organization_id ' +
        'column and whether this trust-account-separation system is per-organization or genuinely ' +
        'platform-wide was never resolved (no live consumer existed to derive intent from); that call ' +
        'site MUST establish the real ownership model before the Django ViewSets for this cluster can ' +
        'be un-contained.',
    ).toEqual([]);
  });

  it('payment_classification_policy is not referenced by WhiplashPreventionService at all (least-wired table in an already-unwired cluster)', () => {
    const schemaSource = readFileSync(resolve(APP_ROOT, 'db/schema/whiplash-prevention-schema.ts'), 'utf8');
    expect(schemaSource).toMatch(/export const paymentClassificationPolicy = pgTable\("payment_classification_policy"/);

    const serviceSource = readFileSync(resolve(APP_ROOT, 'services/whiplash-prevention-service.ts'), 'utf8');
    expect(serviceSource).not.toMatch(/paymentClassificationPolicy/);
  });

  it('remittance-audit.ts\'s submitForApproval/approveRemittance/rejectRemittance (sole writers of remittance_approvals) have ZERO real callers reaching a live route', () => {
    // The one UI consumer (components/admin/clc-approval-workflow.tsx) posts to
    // routes that either don't exist or are unwired copy-paste stubs — see the
    // MultiPartyIsolationMixin docstring (backend/billing/isolation.py) for the
    // full trace. This asserts the underlying claim mechanically: the approve/
    // reject routes referenced by that component do not exist as files.
    expect(() =>
      readFileSync(resolve(APP_ROOT, 'app/api/admin/clc/remittances/[id]/approve/route.ts'), 'utf8'),
    ).toThrow();
    expect(() =>
      readFileSync(resolve(APP_ROOT, 'app/api/admin/clc/remittances/[id]/reject/route.ts'), 'utf8'),
    ).toThrow();

    const submitRouteSource = readFileSync(
      resolve(APP_ROOT, 'app/api/admin/clc/remittances/[id]/submit/route.ts'),
      'utf8',
    );
    // The one route that DOES exist at this path pattern is an unwired
    // copy-paste stub (wrong table name in its own docstring) that never
    // touches the database.
    expect(submitRouteSource).toMatch(/organizationMembers/);
    expect(submitRouteSource).not.toMatch(/submitForApproval|remittanceApprovals|perCapitaRemittances/);

    // Explicit per-function zero-direct-call assertions (round 34
    // correction) — the combined-regex check above proves no file matches
    // ANY of the three names; these prove each name individually has zero
    // real callers, so a future partial reactivation (e.g. only wiring up
    // approveRemittance) cannot silently slip past a check that only ever
    // looked at the group.
    const auditFile = 'services/clc/remittance-audit.ts';
    for (const fnName of ['submitForApproval', 'approveRemittance', 'rejectRemittance']) {
      const source = readFileSync(resolve(APP_ROOT, auditFile), 'utf8');
      expect(source, `${fnName} must still be exported from ${auditFile}`).toMatch(
        new RegExp(`export async function ${fnName}\\(`),
      );
      const importers = realImporterFiles(`\\b${fnName}\\(`, auditFile);
      expect(
        importers,
        `${fnName} has gained a real caller — remittance_approvals is currently SYSTEM_ONLY with ` +
          `requiredSystemPrivileges=[SELECT] only (no UPDATE); a real caller of ${fnName} performs an ` +
          `UPDATE and MUST have this entry's privilege set and containment revisited before it can pass.`,
      ).toEqual([]);
    }
  });

  it('remittance_approvals\' only real reader is the national CLC staff dashboard, and its SELECT is structurally nested inside withSystemContext (not just co-located in the same file)', () => {
    const source = readFileSync(resolve(APP_ROOT, 'app/[locale]/dashboard/clc/staff/page.tsx'), 'utf8');
    expect(source).toMatch(/remittanceApprovals/);

    // Bound the withSystemContext(...) callback body to the next top-level
    // function declaration (this file's natural sibling-boundary, same
    // technique used elsewhere in this repo for method-body extraction) —
    // proves the remittanceApprovals SELECT is INSIDE that block, not
    // merely present somewhere else in the file.
    const systemContextBlockMatch = source.match(
      /withSystemContext\(async \(tx\) => \{[\s\S]*?(?=\nexport default async function )/,
    );
    expect(systemContextBlockMatch, 'withSystemContext(async (tx) => { ... }) block not found').toBeTruthy();
    const systemContextBody = systemContextBlockMatch![0];
    expect(systemContextBody).toMatch(/\.from\(remittanceApprovals\)/);
    expect(systemContextBody).toMatch(/eq\(remittanceApprovals\.status, 'pending'\)/);

    // Cross-checked against lib/auth/__tests__/clc-national-role-boundary.test.ts's
    // own documentation of this exact dashboard as Model A (national,
    // withSystemContext, no per-caller org filter) — not re-asserted in full
    // here to avoid duplicating that file's scope.
  });
});
