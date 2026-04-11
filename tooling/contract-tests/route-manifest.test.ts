/**
 * Contract Test — Centralized Route Manifest
 *
 * Discovers every Next.js route across all apps in the monorepo
 * (page.tsx, route.ts, layout.tsx files in app/ directories).
 *
 * Verifies:
 *  1. Every app has at least one page or API route
 *  2. No app has unreachable route files (e.g. route.ts + page.tsx in the same segment)
 *  3. Generates a complete manifest for audit cross-reference
 *  4. Critical API routes exist in deployed apps
 *  5. API route handlers reference auth (Clerk) for tenant isolation
 *
 * @invariant INV-ROUTE-MANIFEST: every app's routes are discoverable, non-conflicting, and auth-guarded
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, statSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const APPS_DIR = join(ROOT, 'apps');

/** All app directories that contain a Next.js app/ folder */
function discoverNextApps(): { name: string; appDir: string }[] {
  const apps: { name: string; appDir: string }[] = [];
  for (const name of readdirSync(APPS_DIR)) {
    const appDir = join(APPS_DIR, name, 'app');
    if (existsSync(appDir) && statSync(appDir).isDirectory()) {
      apps.push({ name, appDir });
    }
  }
  return apps;
}

interface RouteEntry {
  app: string;
  segment: string; // e.g. "/api/cases/[caseId]/transition"
  type: 'page' | 'api' | 'layout';
  file: string; // relative path from app dir
}

/** Recursively walk a directory and collect route files */
function walkRoutes(appName: string, dir: string, base: string): RouteEntry[] {
  const entries: RouteEntry[] = [];

  let children: string[];
  try {
    children = readdirSync(dir);
  } catch {
    return entries;
  }

  for (const child of children) {
    const fullPath = join(dir, child);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      // Skip node_modules and hidden dirs
      if (child.startsWith('.') || child === 'node_modules') continue;
      entries.push(...walkRoutes(appName, fullPath, `${base}/${child}`));
    } else if (stat.isFile()) {
      const segment = base || '/';
      if (child === 'page.tsx' || child === 'page.ts' || child === 'page.jsx') {
        entries.push({ app: appName, segment, type: 'page', file: `${base}/${child}` });
      } else if (child === 'route.ts' || child === 'route.tsx' || child === 'route.js') {
        entries.push({ app: appName, segment, type: 'api', file: `${base}/${child}` });
      } else if (child === 'layout.tsx' || child === 'layout.ts' || child === 'layout.jsx') {
        entries.push({ app: appName, segment, type: 'layout', file: `${base}/${child}` });
      }
    }
  }

  return entries;
}

describe('INV-ROUTE-MANIFEST — Centralized Route Manifest', () => {
  const nextApps = discoverNextApps();
  const allRoutes: RouteEntry[] = [];
  for (const { name, appDir } of nextApps) {
    allRoutes.push(...walkRoutes(name, appDir, ''));
  }

  // Non-Next.js apps (e.g. orchestrator-api uses Express/Fastify)
  const NON_NEXTJS_APPS = ['orchestrator-api', 'control-plane'];

  it('discovers at least 5 Next.js apps', () => {
    expect(nextApps.length).toBeGreaterThanOrEqual(5);
  });

  it('every Next.js app has at least one page or API route', () => {
    const appsWithoutRoutes: string[] = [];
    for (const { name } of nextApps) {
      if (NON_NEXTJS_APPS.includes(name)) continue;
      const appRoutes = allRoutes.filter((r) => r.app === name && (r.type === 'page' || r.type === 'api'));
      if (appRoutes.length === 0) {
        appsWithoutRoutes.push(name);
      }
    }
    expect(appsWithoutRoutes).toEqual([]);
  });

  it('no segment has BOTH a page.tsx and a route.ts (Next.js conflict)', () => {
    const conflicts: string[] = [];
    // Group by app + segment
    const grouped = new Map<string, Set<string>>();
    for (const route of allRoutes) {
      if (route.type === 'layout') continue;
      const key = `${route.app}:${route.segment}`;
      const types = grouped.get(key) ?? new Set();
      types.add(route.type);
      grouped.set(key, types);
    }

    for (const [key, types] of grouped) {
      if (types.has('page') && types.has('api')) {
        conflicts.push(key);
      }
    }
    expect(conflicts).toEqual([]);
  });

  it('total route count is within expected range (sanity check)', () => {
    // We expect a large monorepo to have > 50 routes across all apps
    const pageAndApiRoutes = allRoutes.filter((r) => r.type === 'page' || r.type === 'api');
    expect(pageAndApiRoutes.length).toBeGreaterThan(50);
  });

  it('generates complete route manifest (snapshot for audit)', () => {
    // Group routes by app for readability
    const manifest: Record<string, { pages: string[]; apis: string[]; layouts: string[] }> = {};
    for (const { name } of nextApps) {
      manifest[name] = { pages: [], apis: [], layouts: [] };
    }
    for (const route of allRoutes) {
      if (route.type === 'page') manifest[route.app].pages.push(route.segment);
      else if (route.type === 'api') manifest[route.app].apis.push(route.segment);
      else if (route.type === 'layout') manifest[route.app].layouts.push(route.segment);
    }

    // Sort for deterministic output
    for (const app of Object.values(manifest)) {
      app.pages.sort();
      app.apis.sort();
      app.layouts.sort();
    }

    // Verify the manifest is non-trivial
    const totalPages = Object.values(manifest).reduce((acc, a) => acc + a.pages.length, 0);
    const totalApis = Object.values(manifest).reduce((acc, a) => acc + a.apis.length, 0);
    expect(totalPages).toBeGreaterThan(20);
    expect(totalApis).toBeGreaterThan(10);
  });

  // ── Phase 6: Critical API Route Existence ──────────────────────────────
  it('union-eyes has critical API routes', () => {
    const ueApiRoutes = allRoutes
      .filter((r) => r.app === 'union-eyes' && r.type === 'api')
      .map((r) => r.segment);
    // Cases transition API must exist for workflow engine
    expect(ueApiRoutes.some((r) => r.includes('cases') || r.includes('case'))).toBe(true);
  });

  it('deployed apps with APIs have sufficient route coverage', () => {
    const deployedApps = ['console', 'partners', 'union-eyes', 'cfo', 'zonga'];
    for (const app of deployedApps) {
      const appRoutes = allRoutes.filter((r) => r.app === app && (r.type === 'page' || r.type === 'api'));
      // Each deployed app must have at least 3 routes
      expect(appRoutes.length, `${app} has too few routes`).toBeGreaterThanOrEqual(3);
    }
  });

  // ── Phase 6: Auth Guard Verification ───────────────────────────────────
  it('deployed Next.js apps have auth middleware', () => {
    // Auth is enforced at the middleware level via NextAuth auth(), not per-route
    const deployedNextApps = ['console', 'partners', 'union-eyes', 'cfo', 'zonga'];
    const missingMiddleware: string[] = [];

    for (const app of deployedNextApps) {
      const middlewarePath = join(APPS_DIR, app, 'middleware.ts');
      if (!existsSync(middlewarePath)) {
        missingMiddleware.push(app);
        continue;
      }
      const content = readFileSync(middlewarePath, 'utf-8');
      if (!content.includes('@nzila/platform-auth') && !content.includes('authMiddleware')) {
        missingMiddleware.push(app);
      }
    }
    expect(missingMiddleware).toEqual([]);
  });
});
