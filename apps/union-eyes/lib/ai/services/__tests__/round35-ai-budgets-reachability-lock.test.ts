/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 35: ai_budgets authority convergence. Independently
 * re-derived TypeScript reachability for every real `aiBudgets` read
 * (db/schema aiBudgets export, imported by cost-tracking-wrapper.ts and
 * rate-limiter.ts). Both reads are organization-filtered
 * (`eq(aiBudgets.organizationId, organizationId)`), but that alone does
 * not prove the supplied organizationId is trusted, or even that the
 * read is ever executed in production.
 *
 * Finding: neither read is reachable today.
 *   - CostTrackingWrapper.trackLLMCall() (checkBudgetAlerts internally)
 *     and .getUsageSummary() are the only two methods that touch
 *     aiBudgets. trackLLMCall's only callers anywhere are this service's
 *     own unit tests; getUsageSummary has ZERO callers anywhere,
 *     including tests.
 *   - The only production import of the costTrackingWrapper singleton is
 *     lib/ai/template-engine.ts's GovernanceAuditLayer.logRequest(),
 *     which calls `this.costTracker?.trackCost?.(...)` — but
 *     CostTrackingWrapper has no `trackCost` method (only `trackLLMCall`/
 *     `getUsageSummary`/the private `checkBudgetAlerts`), so this
 *     optional-chained call is permanently a no-op. logRequest() being
 *     called for real requests does not make trackLLMCall/
 *     getUsageSummary reachable.
 *   - AIRateLimiter.checkLimit() (the other real aiBudgets reader, via
 *     rate-limiter.ts) is called only by trackLLMCall and by its own
 *     unit test — same dead-end.
 *
 * Because the TS read path is unreachable, organizationId provenance for
 * it is moot today (there is no live call site to trace it from) — but
 * this test exists precisely so that changes ever making the no-op call
 * real (e.g. renaming trackCost to trackLLMCall, or adding a real
 * trackCost method) are caught, forcing a future round to trace
 * organizationId provenance from that new real call site before treating
 * this table as tenant-safe.
 *
 * This is a regression lock, not new functionality.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_ROOT = resolve(__dirname, '..', '..', '..', '..');

/**
 * Scans every file `git` tracks under APP_ROOT (git grep run from a
 * subdirectory is scoped to that subdirectory) for a pattern, restricted
 * to *.ts/*.tsx — matches the round-34 methodology (git grep over a
 * hand-maintained directory allow-list catches real callers under any
 * production directory).
 */
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

describe('round 35: ai_budgets TypeScript reachability lock', () => {
  it('CostTrackingWrapper.trackLLMCall (the only path to checkBudgetAlerts, an aiBudgets reader) has ZERO real production callers', () => {
    const source = readFileSync(resolve(APP_ROOT, 'lib/ai/services/cost-tracking-wrapper.ts'), 'utf8');
    expect(source).toMatch(/async trackLLMCall/);

    const importers = realImporterFiles('\\.trackLLMCall\\(', 'lib/ai/services/cost-tracking-wrapper.ts');
    expect(
      importers,
      'trackLLMCall has gained a real production caller — organizationId provenance for its ' +
        'checkBudgetAlerts()/aiBudgets read MUST be traced from that new call site before ai_budgets ' +
        'can be treated as tenant-safe on the TypeScript side.',
    ).toEqual([]);
  });

  it('CostTrackingWrapper.getUsageSummary (an aiBudgets reader) has ZERO callers anywhere, including tests', () => {
    const source = readFileSync(resolve(APP_ROOT, 'lib/ai/services/cost-tracking-wrapper.ts'), 'utf8');
    expect(source).toMatch(/async getUsageSummary/);

    // Deliberately does NOT exclude __tests__ here: this method has no
    // callers at all, not even its own unit test.
    let out = '';
    try {
      out = execFileSync(
        'git',
        ['grep', '-l', '-E', '\\.getUsageSummary\\(', '--', '*.ts', '*.tsx'],
        { cwd: APP_ROOT, encoding: 'utf8' },
      );
    } catch (err: unknown) {
      const execErr = err as { status?: number; stdout?: string };
      if (execErr.status !== 1) out = execErr.stdout ?? '';
    }
    const callers = out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      // rewardsService.getBudgetUsageSummary is an unrelated rewards-budget
      // system with a similarly-named method — exclude its known call sites.
      .filter((f) => f !== 'actions/rewards-actions.ts' && f !== 'lib/services/rewards/budget-service.ts')
      // the governance manifest itself cites this method name in prose
      // evidence (never a real call) — see this exact file's own docstring.
      .filter((f) => !f.startsWith('db/rls-storage-authority/'));

    expect(
      callers,
      'getUsageSummary has gained a caller — trace organizationId provenance before treating ' +
        'ai_budgets as tenant-safe on the TypeScript side.',
    ).toEqual([]);
  });

  it('AIRateLimiter.checkLimit (the other real aiBudgets reader) is called only by trackLLMCall and its own test', () => {
    const source = readFileSync(resolve(APP_ROOT, 'lib/ai/services/rate-limiter.ts'), 'utf8');
    expect(source).toMatch(/async checkLimit/);

    const importers = realImporterFiles('\\.checkLimit\\(', 'lib/ai/services/rate-limiter.ts');
    expect(importers).toEqual(['lib/ai/services/cost-tracking-wrapper.ts']);
  });

  it('template-engine.ts GovernanceAuditLayer.logRequest calls costTracker via a method name (trackCost) that does not exist on CostTrackingWrapper — the call is a permanent no-op', () => {
    const wrapperSource = readFileSync(resolve(APP_ROOT, 'lib/ai/services/cost-tracking-wrapper.ts'), 'utf8');
    // Confirms CostTrackingWrapper genuinely has no trackCost method today —
    // if this ever changes, the "permanent no-op" premise below is void and
    // the new real call site must be evaluated for organizationId provenance.
    expect(wrapperSource).not.toMatch(/\btrackCost\s*[:(]/);

    const engineSource = readFileSync(resolve(APP_ROOT, 'lib/ai/template-engine.ts'), 'utf8');
    expect(engineSource).toMatch(/\(this\.costTracker as unknown as \{/);
    expect(engineSource).toMatch(/\}\)\?\.\s*trackCost\?\.\(/);
  });
});
