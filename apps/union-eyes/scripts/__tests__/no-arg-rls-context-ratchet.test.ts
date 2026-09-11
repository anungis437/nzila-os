/**
 * Ratchet test for the `withRLSContext(() => ...)` no-arg-ignoring-tx
 * pattern (PR #752 round 16 review).
 *
 * The AsyncLocalStorage fix in db/tenant-context-storage.ts + db/db.ts
 * makes this pattern FUNCTIONALLY SAFE (the module-level `db` import
 * resolves to the active tenant transaction inside withRLSContext(), even
 * when the callback ignores its `tx` parameter) — see
 * db/__tests__/tenant-context-routing.test.ts and
 * lib/db/__tests__/with-rls-context.test.ts. This mirrors
 * no-arg-system-context-ratchet.test.ts exactly, for the tenant side: it
 * does not exist because the pattern is unsafe, but because threading
 * `tx` explicitly is the clearer, more auditable style going forward, and
 * a static guard prevents the count silently growing while the existing
 * baseline is migrated over time.
 *
 * 73 existing call sites use this pattern today (recorded 2026-09-02) —
 * rewriting all of them in one pass would be an unreviewed, large-blast-
 * radius change outside this test's scope. This is a RATCHET: it fails if
 * the count goes UP from the recorded baseline, but does not fail CI
 * today for the existing baseline. Lower BASELINE_COUNT as call sites are
 * migrated to accept and use `tx` explicitly; never raise it without an
 * explicit, reviewed reason in the same change.
 *
 * withExplicitUserContext() is NOT covered here — its signature never
 * offers a `tx` parameter at all (`operation: () => Promise<T>`), so
 * there is no "ignoring tx" pattern to ratchet against; it is covered by
 * the same tenant-context-storage ALS fix regardless (see
 * with-rls-context.test.ts's dedicated test for it).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const SCAN_DIRS = ['app', 'lib', 'actions', 'services'];
const NO_ARG_PATTERN = /withRLSContext\(\s*(async\s*)?\(\s*\)\s*=>/g;

// Recorded 2026-09-02 — see file header. Only lower this as call sites are
// migrated to thread `tx` explicitly; raising it silently defeats the
// point of the ratchet.
const BASELINE_COUNT = 73;

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
    // Safe: `dir` originates only from ROOT + the fixed SCAN_DIRS list
    // below, and `entry` is enumerated by readdirSync on that same fixed
    // tree — no external/user input reaches this path at any point.
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(p);
  }
  return out;
}

describe('withRLSContext no-arg-ignoring-tx pattern (ratchet, PR #752 round 16)', () => {
  it('does not exceed the recorded baseline count of occurrences', () => {
    let total = 0;
    const matches: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        // __tests__ files intentionally exercise this pattern to prove the
        // ALS fix handles it safely — excluded from the ratchet, which is
        // about production code style, not test fixtures.
        if (file.includes(`${join('', '__tests__')}`) || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
          continue;
        }
        const src = readFileSync(file, 'utf8');
        const found = src.match(NO_ARG_PATTERN);
        if (found) {
          total += found.length;
          matches.push(`${relative(ROOT, file)} (${found.length})`);
        }
      }
    }

    expect(
      total,
      total > BASELINE_COUNT
        ? `New withRLSContext(() => ...) no-arg call sites detected beyond the recorded baseline of ${BASELINE_COUNT}. ` +
          `Prefer withRLSContext((tx) => ...) and query through tx explicitly instead of the module-level db import. ` +
          `Current matches:\n${matches.join('\n')}`
        : undefined,
    ).toBeLessThanOrEqual(BASELINE_COUNT);
  });
});
