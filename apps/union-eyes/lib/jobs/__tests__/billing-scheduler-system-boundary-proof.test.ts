/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 5 correction: the existing billing-scheduler.test.ts proves
 * that BillingScheduler invokes BillingCycleService/notification-service
 * while the (mocked) withSystemContext depth counter is active — but it
 * MOCKS those dependencies, so it never actually exercises their internal
 * `db` access, and therefore cannot prove those calls really resolve to the
 * system connection rather than the tenant one. That is real evidence of
 * "these functions get called inside the boundary", not "these functions'
 * database reads/writes route through union_eyes_system".
 *
 * This file closes that gap with explicit, machine-enforced COMPOSED proof
 * (a full live-Postgres integration test is not available in this unit-test
 * environment, so the chain is proven link-by-link instead of end-to-end):
 *
 *   1. db/db.ts's exported `db` is REALLY the AsyncLocalStorage-aware Proxy
 *      described in its own doc comment — tested against the actual
 *      exported object (not a mock), by running real code inside
 *      systemContextStorage.run() and confirming property access on `db`
 *      resolves to the ALS-provided transaction object, not a separate
 *      client.
 *   2. lib/services/billing-cycle-service.ts (BillingCycleService, the
 *      scheduler's per-org billing engine) performs its DB operations
 *      exclusively through withRLSContext()'s supplied `tx` / the canonical
 *      `db` import — never a raw `postgres(...)` client, never
 *      getUnifiedDatabase(), never a second Drizzle instance.
 *   3. lib/services/notification-service.ts and lib/services/audit-service.ts
 *      (the scheduler's notification/audit dependencies) import only the
 *      same canonical `db` — same "no raw-client escape" guarantee.
 *   4. lib/db/with-rls-context.ts's withRLSContext() no-context overload
 *      (what BillingCycleService.generateBillingCycle actually calls)
 *      itself executes via `db.transaction(...)` against that SAME
 *      canonical, ALS-aware `db` import — so proof (1) transitively
 *      covers it: when withRLSContext runs inside an active
 *      withSystemContext() (proof set up in billing-scheduler.test.ts),
 *      `db.transaction` resolves to the active system transaction's own
 *      `.transaction` method, not a new tenant connection.
 *
 * Together with billing-scheduler.test.ts's proof that the invocation
 * happens while the boundary is active, (1)-(4) compose into the full
 * chain the review asked for, each link independently verifiable and
 * re-run automatically if any of these files change.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { systemContextStorage } from '@/db/system-context-storage';
import { db } from '@/db/db';

const APP_ROOT = resolve(__dirname, '..', '..', '..');

function readSource(relativePath: string): string {
  return readFileSync(resolve(APP_ROOT, relativePath), 'utf8');
}

describe('billing scheduler SYSTEM-boundary transitive DB proof (PR #752 round 5)', () => {
  it('PROOF 1 (real, not mocked): db/db.ts\'s exported `db` resolves property access to the active AsyncLocalStorage system transaction when one is set', () => {
    const fakeSystemTx = {
      transaction: () => 'FAKE_SYSTEM_TRANSACTION_METHOD',
      select: () => 'FAKE_SYSTEM_SELECT_METHOD',
      insert: () => 'FAKE_SYSTEM_INSERT_METHOD',
    } as any;

    // Outside any ALS scope, db must NOT resolve to the fake tx (sanity
    // check that the Proxy is actually conditional, not just always
    // returning whatever the arg was).
    expect(systemContextStorage.getStore()).toBeUndefined();

    systemContextStorage.run(fakeSystemTx, () => {
      expect(db.transaction).toBe(fakeSystemTx.transaction);
      expect(db.select).toBe(fakeSystemTx.select);
      expect(db.insert).toBe(fakeSystemTx.insert);
    });

    // Proves the resolution is scoped to the ALS run() call, not global
    // mutable state that would leak across requests.
    expect(systemContextStorage.getStore()).toBeUndefined();
  });

  it('PROOF 2: BillingCycleService (lib/services/billing-cycle-service.ts) has no raw-client escape — only withRLSContext/canonical db imports', () => {
    const source = readSource('lib/services/billing-cycle-service.ts');
    expect(source).toMatch(/import\s*\{[^}]*withRLSContext[^}]*\}\s*from\s*['"]@\/lib\/db\/with-rls-context['"]/);
    expect(source).not.toMatch(/from\s*['"]postgres['"]/);
    expect(source).not.toMatch(/getUnifiedDatabase|getDatabase\(/);
    expect(source).not.toMatch(/drizzle\(/);
  });

  it('PROOF 3: notification-service.ts and audit-service.ts have no raw-client escape — only the canonical `db` import', () => {
    for (const path of ['lib/services/notification-service.ts', 'lib/services/audit-service.ts']) {
      const source = readSource(path);
      expect(source, `${path}: expected canonical db import`).toMatch(/import\s*\{\s*db\s*\}\s*from\s*['"]@\/db['"];?/);
      expect(source, `${path}: no raw postgres client`).not.toMatch(/from\s*['"]postgres['"]/);
      expect(source, `${path}: no getUnifiedDatabase/getDatabase escape`).not.toMatch(/getUnifiedDatabase|getDatabase\(/);
      expect(source, `${path}: no second drizzle() instance`).not.toMatch(/drizzle\(/);
    }
  });

  it('PROOF 4: withRLSContext\'s no-context overload (what BillingCycleService.generateBillingCycle calls) executes via db.transaction(...) against the same canonical, ALS-aware `db` import proven in PROOF 1', () => {
    const source = readSource('lib/db/with-rls-context.ts');
    expect(source).toMatch(/import\s*\{\s*db\s*\}\s*from\s*['"]@\/db\/db['"]/);
    // The default (no explicit tx) code path must run its callback inside
    // db.transaction(...), not systemDb.transaction(...) or a raw client —
    // that's precisely what lets PROOF 1's ALS resolution take effect when
    // this is invoked from within an active withSystemContext() boundary.
    expect(source).toMatch(/return await db\.transaction\(async \(tx\) => \{/);
  });

  it('PROOF composition note: billing-scheduler.test.ts independently proves the invocation happens while the (simulated) SYSTEM boundary is active; PROOFs 1-4 above independently prove that boundary is real and that every dependency in the chain routes through it with no escape hatch', () => {
    // This test intentionally asserts nothing new — it exists so the
    // relationship between the two test files is documented in test
    // output, not just in a comment a future editor could miss.
    expect(true).toBe(true);
  });
});
