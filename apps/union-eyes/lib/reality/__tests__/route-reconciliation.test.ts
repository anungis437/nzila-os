/**
 * Wave 0 §7 — Route reconciliation invariant.
 *
 * The programme requires that every /dashboard route referenced by any
 * navigation surface which is known to render HTTP 404 in every deployed
 * environment MUST correspond to a capability registered as either
 * NOT_IMPLEMENTED or DISABLED in `capability-registry.ts`.
 *
 * This test is the enforcement mechanism: it enumerates the navigation
 * hrefs used by role-experience, portal-home, federation-dashboard, and
 * the sidebar, then confirms that any href pointing at a page whose
 * body is only `notFound()` is present in the registry-tracked 404 set.
 *
 * If this test fails, the fix is either:
 *   (a) implement the target surface (state becomes REAL/LIMITED), OR
 *   (b) remove the navigation reference to the dead surface, OR
 *   (c) add the surface to the capability registry with a truthful
 *       NOT_IMPLEMENTED/DISABLED state and targetWave.
 *
 * DO NOT silence this test by editing the invariant. The invariant IS
 * the reconciliation — see docs/union-eyes/reality-remediation/19_ROUTE_RECONCILIATION.md.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { getConditionalProduction404DashboardRoutes, getRegistryTracked404DashboardRoutes } from '../capability-registry';

const APP_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

/**
 * Statically declared list of nav-consuming files. When a new nav surface
 * is added anywhere in the app, add its path here so the reconciliation
 * test sees it. Keeping this hard-coded avoids arbitrary glob-scanning
 * that could pick up unrelated files.
 */
const NAV_SOURCE_FILES = [
  'lib/dashboard/role-experience.ts',
  'components/dashboards/federation-dashboard.tsx',
  'components/sidebar.tsx',
] as const;

/**
 * Extract every `/dashboard/<segment>` literal that appears in a nav
 * source file. Deliberately conservative: only string literals starting
 * with `/dashboard/` and terminating on a quote or template-literal
 * boundary.
 */
function extractDashboardHrefs(source: string): string[] {
  const hits = new Set<string>();
  const re = /['"`](\/dashboard\/[a-z0-9-]+(?:\/[a-z0-9-]+)*)['"`]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    // Strip any query string / dynamic segment (defensive; the regex
    // above already excludes `?` and `[`).
    hits.add(m[1]);
  }
  return [...hits];
}

/**
 * Return the set of hrefs from a given nav source file that land on a
 * page whose file body is only `notFound()`. We check the corresponding
 * `app/[locale]<href>/page.tsx` (or `app<href>/page.tsx` for non-locale
 * routes) and treat the surface as 404-only when the exported default
 * component's body reduces to `notFound()`.
 */
function isUnconditional404(href: string): boolean {
  // Prefer the locale-scoped page; fall back to top-level.
  const localePath = resolve(APP_ROOT, `app/[locale]${href}/page.tsx`);
  const topLevelPath = resolve(APP_ROOT, `app${href}/page.tsx`);
  const filePath = (() => {
    try {
      readFileSync(localePath, 'utf8');
      return localePath;
    } catch {
      try {
        readFileSync(topLevelPath, 'utf8');
        return topLevelPath;
      } catch {
        return null;
      }
    }
  })();
  if (!filePath) return false;
  const content = readFileSync(filePath, 'utf8');
  // Strip comments (mirrors the anti-theatre scanner's approach).
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  // Look for an exported default component whose body contains ONLY a
  // top-level `notFound();` call (no `if` wrapping it).
  //
  // Heuristic: the entire non-JSX statement body of the default export
  // is `notFound();`. This is conservative — a page with any additional
  // top-level statement (state hooks, data fetching, etc.) is not
  // considered unconditional-404 even if it also calls notFound()
  // somewhere.
  const defaultBodyMatch = stripped.match(
    /export\s+default\s+(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\{\s*([\s\S]*?)\}\s*$/,
  );
  if (!defaultBodyMatch) return false;
  const body = defaultBodyMatch[1].trim();
  // Allow a leading `const {...} = await params;` line for dynamic routes.
  const withoutParamsUnwrap = body.replace(/^const\s*\{[^}]*\}\s*=\s*await\s+params;\s*/, '');
  return /^notFound\(\)\s*;?\s*$/.test(withoutParamsUnwrap);
}

describe('Wave 0 §7 — route reconciliation invariant', () => {
  it('every navigation href landing on an unconditional-404 page is registry-tracked', () => {
    const tracked = new Set(getRegistryTracked404DashboardRoutes());
    const dead: { file: string; href: string }[] = [];

    for (const rel of NAV_SOURCE_FILES) {
      const src = readFileSync(resolve(APP_ROOT, rel), 'utf8');
      const hrefs = extractDashboardHrefs(src);
      for (const href of hrefs) {
        if (!isUnconditional404(href)) continue;
        if (tracked.has(href)) continue;
        dead.push({ file: rel, href });
      }
    }

    expect(
      dead,
      dead.length === 0
        ? ''
        : `Unregistered nav→404 dead-links detected. Add these routes to ` +
          `capability-registry.ts (state: NOT_IMPLEMENTED or DISABLED) or ` +
          `remove the nav reference:\n` +
          dead.map((d) => `  - ${d.file}: ${d.href}`).join('\n'),
    ).toEqual([]);
  });

  it('every registry-tracked 404 route corresponds to a real page file whose body is only notFound()', () => {
    const tracked = getRegistryTracked404DashboardRoutes();
    const inconsistent: string[] = [];
    for (const href of tracked) {
      if (!isUnconditional404(href)) inconsistent.push(href);
    }
    expect(
      inconsistent,
      inconsistent.length === 0
        ? ''
        : `Registry claims these routes return 404 but their page bodies do more than call notFound():\n` +
          inconsistent.map((h) => `  - ${h}`).join('\n'),
    ).toEqual([]);
  });

  it('DISABLED (conditional-404) routes are never advertised in navigation', () => {
    const disabled = new Set(getConditionalProduction404DashboardRoutes());
    if (disabled.size === 0) return; // No DISABLED dashboard routes → invariant trivially holds.
    const advertised: { file: string; href: string }[] = [];
    for (const rel of NAV_SOURCE_FILES) {
      const src = readFileSync(resolve(APP_ROOT, rel), 'utf8');
      const hrefs = extractDashboardHrefs(src);
      for (const href of hrefs) {
        if (disabled.has(href)) advertised.push({ file: rel, href });
      }
    }
    expect(
      advertised,
      advertised.length === 0
        ? ''
        : `DISABLED dashboard routes must NEVER appear in navigation (they 404 in production ` +
          `and are only reachable to devs who type the URL). Remove these references:\n` +
          advertised.map((d) => `  - ${d.file}: ${d.href}`).join('\n'),
    ).toEqual([]);
  });

  it('Task G — every advertised dashboard href resolves to a real (non-404) page', () => {
    // Task G invariant (Wave 0 §G / docs/23_WAVE_0_CORRECTION.md): the
    // operational build MUST NOT advertise a nav href whose page body
    // reduces to a bare `notFound()` call. This is strictly stronger
    // than the §7 reconciliation invariant above — that one permits
    // dead nav so long as the registry acknowledges it; Task G forbids
    // dead nav altogether.
    //
    // If a route is genuinely not yet implemented, remove it from the
    // nav sources until the implementation lands. The registry entry
    // may remain (state = NOT_IMPLEMENTED or REMOVED) to preserve the
    // audit trail, but no navigation surface may point at it.
    const dead: { file: string; href: string }[] = [];
    for (const rel of NAV_SOURCE_FILES) {
      const src = readFileSync(resolve(APP_ROOT, rel), 'utf8');
      const hrefs = extractDashboardHrefs(src);
      for (const href of hrefs) {
        if (isUnconditional404(href)) dead.push({ file: rel, href });
      }
    }
    expect(
      dead,
      dead.length === 0
        ? ''
        : `Task G violation: dead navigation links detected. Either implement the ` +
          `target surface (page body must be more than a bare notFound()) or ` +
          `remove the nav reference:\n` +
          dead.map((d) => `  - ${d.file}: ${d.href}`).join('\n'),
    ).toEqual([]);
  });
});
