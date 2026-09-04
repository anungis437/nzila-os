/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 36: reward_wallet_ledger append-only authority surface +
 * full reachability census for both round-36 tables.
 *
 * Part 1 proves the negative invariants the round-36 brief required for
 * reward_wallet_ledger: no UPDATE/DELETE anywhere, org-scoped reads, and
 * that the only route exposing wallet reads (app/api/rewards/wallet)
 * derives organizationId/userId from the authenticated session context,
 * never from client-supplied request parameters (so member A cannot read
 * member B's ledger, and org A cannot read org B's wallet rows, by
 * construction rather than by convention).
 *
 * Part 2 is the round-36-mandated census: every real production reference
 * to rewardBudgetEnvelopes/RewardBudgetEnvelopes/RewardBudgetEnvelopesViewSet
 * /reward_budget_envelopes and rewardWalletLedger/RewardWalletLedger/
 * RewardWalletLedgerViewSet/reward_wallet_ledger, scanned via git grep
 * across every tracked *.ts/*.tsx file (not a hand-maintained directory
 * allow-list) so a real caller under any production directory is not
 * invisible to it — same methodology as round 34/35's reachability locks.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_ROOT = resolve(__dirname, '..', '..', '..', '..');

function realImporterFiles(pattern: string, definingFileRelativePath: string): string[] {
  let out = '';
  try {
    out = execFileSync('git', ['grep', '-l', '-E', pattern, '--', '*.ts', '*.tsx'], {
      cwd: APP_ROOT,
      encoding: 'utf8',
    });
  } catch (err: unknown) {
    const execErr = err as { status?: number; stdout?: string };
    if (execErr.status === 1) return [];
    out = execErr.stdout ?? '';
  }
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.includes('__tests__') && !file.includes('.test.') && !file.includes('.spec.'))
    .filter((file) => !file.startsWith('db/rls-storage-authority/'))
    .filter((file) => file !== definingFileRelativePath);
}

describe('round 36: reward_wallet_ledger is append-only (negative tests 9 & 10)', () => {
  it('negative test 9: no .update(rewardWalletLedger) call site exists anywhere', () => {
    const matches = realImporterFiles('\\.update\\(rewardWalletLedger\\)', 'lib/services/rewards/wallet-service.ts');
    expect(matches).toEqual([]);
  });

  it('negative test 10: no .delete(rewardWalletLedger) call site exists anywhere', () => {
    const matches = realImporterFiles('\\.delete\\(rewardWalletLedger\\)', 'lib/services/rewards/wallet-service.ts');
    expect(matches).toEqual([]);
  });

  it('wallet-service.ts itself exposes no UPDATE/DELETE export for the ledger table', () => {
    const source = readFileSync(resolve(APP_ROOT, 'lib/services/rewards/wallet-service.ts'), 'utf8');
    expect(source).not.toMatch(/\.update\(rewardWalletLedger\)/);
    expect(source).not.toMatch(/\.delete\(rewardWalletLedger\)/);
    // Confirms the module genuinely only ever inserts (applyLedgerEntry) or
    // reads (getBalance/listLedger/getLedgerSummary/getBulkBalances).
    expect(source).toMatch(/\.insert\(rewardWalletLedger\)/);
  });
});

describe('round 36: /api/rewards/wallet derives org/user identity from the authenticated session, never from client input (negative tests 7 & 8)', () => {
  it('the wallet route reads organizationId/userId from the withRoleAuth context, not from searchParams/body', () => {
    const source = readFileSync(resolve(APP_ROOT, 'app/api/rewards/wallet/route.ts'), 'utf8');
    expect(source).toMatch(/withRoleAuth\('member',/);
    expect(source).toMatch(/const \{ userId, organizationId \} = context/);
    // Negative proof: no target-user/org override is ever read from the
    // request (no userId/organizationId/orgId key pulled out of
    // searchParams or a parsed body).
    expect(source).not.toMatch(/searchParams\.get\(['"](userId|organizationId|orgId|targetUserId)['"]\)/);
  });

  it('getBalance/listLedger both require an explicit orgId argument scoped in every query (regression lock on the current safe implementation)', () => {
    const source = readFileSync(resolve(APP_ROOT, 'lib/services/rewards/wallet-service.ts'), 'utf8');
    const getBalanceBlock = source.slice(source.indexOf('export async function getBalance'), source.indexOf('export async function listLedger'));
    const listLedgerBlock = source.slice(source.indexOf('export async function listLedger'), source.indexOf('export async function applyLedgerEntry'));

    for (const block of [getBalanceBlock, listLedgerBlock]) {
      expect(block).toMatch(/eq\(rewardWalletLedger\.orgId, orgId\)/);
      expect(block).toMatch(/eq\(rewardWalletLedger\.userId, userId\)/);
    }
  });
});

describe('round 36: full reachability census for reward_budget_envelopes / reward_wallet_ledger', () => {
  it('rewardBudgetEnvelopes table import has no real importers beyond the known service/action/schema files', () => {
    const importers = realImporterFiles('rewardBudgetEnvelopes', 'lib/services/rewards/budget-service.ts').sort();
    const allowed = new Set([
      'actions/rewards-actions.ts',
      'app/[locale]/dashboard/admin/rewards/analytics/page.tsx',
      'db/schema/domains/infrastructure/rewards.ts',
      'db/schema/recognition-rewards-schema.ts',
      'lib/services/rewards/budget-service.ts',
      'lib/services/rewards/export-service.ts',
    ]);
    for (const file of importers) {
      expect(allowed.has(file), `unexpected new rewardBudgetEnvelopes importer: ${file}`).toBe(true);
    }
  });

  it('rewardWalletLedger table import has no real importers beyond the known service/component/action files', () => {
    const importers = realImporterFiles('rewardWalletLedger', 'lib/services/rewards/wallet-service.ts').sort();
    const allowed = new Set([
      'app/[locale]/dashboard/admin/rewards/analytics/page.tsx',
      'app/api/rewards/wallet/route.ts',
      'app/api/rewards/export/route.ts',
      'components/rewards/credit-timeline.tsx',
      'components/rewards/ledger-table.tsx',
      'db/schema/domains/infrastructure/rewards.ts',
      'db/schema/domains/infrastructure/awards.ts',
      'db/schema/domains/infrastructure/index.ts',
      'db/schema/recognition-rewards-schema.ts',
      'db/schema/award-templates-schema.ts',
      'lib/services/rewards/wallet-service.ts',
      'lib/services/rewards/export-service.ts',
      // PRE-EXISTING, already tracked by
      // scripts/__tests__/schema-duplicate-table-ratchet.test.ts:
      // these two import a DIFFERENT (incompatible) rewardWalletLedger
      // schema definition (pointsChange/transactionType/expiresAt) from
      // db/schema/award-templates-schema.ts, not the canonical shape in
      // domains/infrastructure/rewards.ts — a genuine duplicate-schema
      // defect, but out of round-36's authority-convergence scope (not a
      // new caller introduced by this round; consolidating the duplicate
      // schema is a separate future tranche).
      'lib/services/rewards/notification-service.ts',
      'lib/utils/rewards-stats-utils.ts',
    ]);
    for (const file of importers) {
      expect(allowed.has(file), `unexpected new rewardWalletLedger importer: ${file}`).toBe(true);
    }
  });

  it('no TS/TSX file calls the Django reward-wallet-ledger or reward-budget-envelopes REST endpoints', () => {
    const matches = realImporterFiles('reward-wallet-ledger|reward-budget-envelopes', 'lib/services/rewards/budget-service.ts');
    expect(matches).toEqual([]);
  });
});
