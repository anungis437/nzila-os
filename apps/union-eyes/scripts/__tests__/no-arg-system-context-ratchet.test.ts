/**
 * Ratchet test for the `withSystemContext(() => ...)` no-arg-ignoring-tx
 * pattern (PR #752 review Item #12).
 *
 * The AsyncLocalStorage fix in db/system-context-storage.ts + db/db.ts
 * makes this pattern FUNCTIONALLY SAFE (the module-level `db` import
 * resolves to the active system connection inside withSystemContext(),
 * even when the callback ignores its `tx` parameter) — see
 * db/__tests__/system-context-routing.test.ts. This test does not exist
 * because the pattern is unsafe; it exists because the review explicitly
 * asked for a static guard against a KNOWN historical escape-hatch class
 * reappearing, and because threading `tx` explicitly (rather than relying
 * on ALS routing implicitly) is the clearer, more auditable style going
 * forward.
 *
 * ~90 existing call sites use this pattern today — rewriting all of them
 * in one pass would be an unreviewed, large-blast-radius change outside
 * this test's scope. Instead this is a RATCHET: it fails if the count of
 * matches goes UP from the recorded baseline (new code adding the
 * discouraged pattern), but does not fail CI today for the existing
 * baseline. Lower BASELINE_COUNT as call sites are migrated to accept and
 * use `tx` explicitly; never raise it without an explicit, reviewed reason
 * in the same change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const SCAN_DIRS = ['app', 'lib', 'actions', 'services'];
const NO_ARG_PATTERN = /withSystemContext\(\s*(async\s*)?\(\s*\)\s*=>/g;

// Recorded 2026-09-01 — see file header. Only lower this as call sites are
// migrated to thread `tx` explicitly; raising it silently defeats the
// point of the ratchet.
const BASELINE_COUNT = 105;

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

describe('withSystemContext no-arg-ignoring-tx pattern (ratchet, PR #752 Item #12)', () => {
  it('does not exceed the recorded baseline count of occurrences', () => {
    let total = 0;
    const matches: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        // __tests__ files intentionally exercise this pattern to prove the
        // ALS fix handles it safely (system-context-routing.test.ts,
        // with-rls-context.test.ts) — excluded from the ratchet, which is
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
        ? `New withSystemContext(() => ...) no-arg call sites detected beyond the recorded baseline of ${BASELINE_COUNT}. ` +
          `Prefer withSystemContext((tx) => ...) and query through tx explicitly instead of the module-level db import. ` +
          `Current matches:\n${matches.join('\n')}`
        : undefined,
    ).toBeLessThanOrEqual(BASELINE_COUNT);
  });
});
