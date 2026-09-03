import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  scanRouteFileExports,
  isAllowlistedPublicExport,
  hasAbuseControl,
  type PublicExportAllowlistEntry,
} from '../lib/api-route-governance-scanner';

const APP_API_PILOT_ROOT = resolve(__dirname, '..', '..', 'app', 'api', 'pilot');

// The ONLY export in the whole app/api/pilot/** tree intentionally reachable
// with no auth wrapper: the public lead-intake form (PR #752 round 19 —
// declared in config/public-api-routes.ts + lib/public-routes.ts +
// scripts/validate-api-governance.ts's PUBLIC_ROUTE_PREFIXES).
const PILOT_PUBLIC_EXPORT_ALLOWLIST: readonly PublicExportAllowlistEntry[] = [
  { routePath: '/api/pilot/apply', method: 'POST' },
];

function walkRouteFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkRouteFiles(full));
    } else if (entry === 'route.ts' || entry === 'route.tsx') {
      results.push(full);
    }
  }
  return results;
}

function routePathFromFile(filePath: string): string {
  const relPath = relative(resolve(__dirname, '..', '..', 'app', 'api'), filePath).replace(/\\/g, '/');
  const withoutRoute = relPath.replace(/\/route\.tsx?$/, '');
  const withStars = withoutRoute.replace(/\[.*?\]/g, '*');
  return `/api/${withStars}`;
}

describe('per-export API route governance scanner (PR #752 round 19)', () => {
  it('REGRESSION FIXTURE: flags a raw exported POST as ungoverned even when the same file has a wrapped GET', () => {
    const fixture = `
import { crudRoutes } from '@/lib/api/crud-factory';
const { GET } = crudRoutes({ table: someTable, readRole: 'system_admin' });
export { GET };

export async function POST(request) {
  const body = await request.json();
  return NextResponse.json({ ok: true });
}
`;
    const results = scanRouteFileExports(fixture);
    const get = results.find((r) => r.method === 'GET');
    const post = results.find((r) => r.method === 'POST');
    expect(get?.governed).toBe(true);
    expect(post?.governed).toBe(false);
  });

  it('POSITIVE FIXTURE: a POST with its own auth reference is governed', () => {
    const fixture = `
export const POST = withApi({ auth: { required: true } }, async (ctx) => {
  return { ok: true };
});
`;
    const results = scanRouteFileExports(fixture);
    expect(results.find((r) => r.method === 'POST')?.governed).toBe(true);
  });

  it('POSITIVE FIXTURE: a raw handler that itself calls hasMinRole is governed (round-19 pilot pattern)', () => {
    const fixture = `
export const GET = async (request, context) => {
  if (!(await hasMinRole('system_admin'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return withSystemContext((_tx) => listSomething(request, context));
};
`;
    const results = scanRouteFileExports(fixture);
    expect(results.find((r) => r.method === 'GET')?.governed).toBe(true);
  });

  it('NEGATIVE FIXTURE (round 20): a handler that ONLY calls rateLimit() before a sensitive operation is NOT governed — rate limiting is not authentication', () => {
    const fixture = `
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req) {
  const rl = rateLimit(req, { maxRequests: 5, windowSeconds: 3600 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  return sensitiveOperation();
}
`;
    const results = scanRouteFileExports(fixture);
    expect(results.find((r) => r.method === 'POST')?.governed).toBe(false);
  });

  it('NEGATIVE FIXTURE (round 20): checkRateLimit()/verifyTurnstileToken() alone also do not count as governance', () => {
    const fixture = `
import { checkRateLimit } from '@/lib/rate-limiter';
import { verifyTurnstileToken } from '@/lib/icra/turnstile';

export async function POST(req) {
  await checkRateLimit('k', { limit: 5, window: 3600, identifier: 'x' });
  await verifyTurnstileToken(req);
  return sensitiveOperation();
}
`;
    const results = scanRouteFileExports(fixture);
    expect(results.find((r) => r.method === 'POST')?.governed).toBe(false);
  });

  it('every exported HTTP method under app/api/pilot/** is either per-export governed or explicitly public-allowlisted', () => {
    const files = walkRouteFiles(APP_API_PILOT_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const routePath = routePathFromFile(file);
      const results = scanRouteFileExports(content);
      for (const result of results) {
        if (result.governed) continue;
        if (isAllowlistedPublicExport(routePath, result.method, PILOT_PUBLIC_EXPORT_ALLOWLIST)) continue;
        violations.push(`${relative(resolve(__dirname, '..', '..'), file)}: ${result.method} (${routePath})`);
      }
    }

    expect(violations, `Ungoverned, non-allowlisted exports found:\n${violations.join('\n')}`).toEqual([]);
  });

  it('the public-export allowlist stays minimal — exactly one entry (the pilot intake POST)', () => {
    expect(PILOT_PUBLIC_EXPORT_ALLOWLIST).toHaveLength(1);
    expect(PILOT_PUBLIC_EXPORT_ALLOWLIST[0]).toEqual({ routePath: '/api/pilot/apply', method: 'POST' });
  });

  it('every allowlisted public export also carries an explicit abuse control (rate limit / anti-bot) — separate from, not substituting for, authentication', () => {
    const files = walkRouteFiles(APP_API_PILOT_ROOT);
    for (const entry of PILOT_PUBLIC_EXPORT_ALLOWLIST) {
      const file = files.find((f) => routePathFromFile(f) === entry.routePath);
      expect(file, `no route.ts found for allowlisted path ${entry.routePath}`).toBeDefined();
      const content = readFileSync(file as string, 'utf8');
      const results = scanRouteFileExports(content);
      const result = results.find((r) => r.method === entry.method);
      expect(result, `no ${entry.method} export found in ${entry.routePath}`).toBeDefined();
      expect(
        hasAbuseControl((result as { span: string }).span),
        `${entry.routePath} ${entry.method} is publicly allowlisted but has no rate-limit/anti-bot control`,
      ).toBe(true);
    }
  });
});
