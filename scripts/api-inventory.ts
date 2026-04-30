#!/usr/bin/env node
/**
 * API Inventory — discovers every HTTP surface in the monorepo and writes
 * `governance/api-inventory.json` for governance review.
 *
 * Derived from the Info-Tech "Improve Your API Processes" blueprint, Phase 1
 * (Discover and Document Your APIs). Run regularly (CI or manual) to surface
 * shadow APIs.
 *
 * Sources scanned:
 *   - Next.js app routers:   apps/* /app/api/ ** /route.{ts,tsx,js,mjs}
 *   - Next.js page-API:      apps/* /pages/api/ ** /*.{ts,js}
 *   - Django sidecar:        apps/union-eyes/django/ ** /urls.py (regex pattern)
 *
 * Output schema:
 *   {
 *     generatedAt: ISO date,
 *     totals: { app: number, byMethod: Record<string, number> },
 *     surfaces: Array<{
 *       app: string,
 *       framework: 'next-app' | 'next-pages' | 'django',
 *       path: string,                // URL path (best-effort)
 *       methods: string[],           // ['GET','POST',...] or ['*']
 *       file: string,                // repo-relative source
 *     }>
 *   }
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const REPO_ROOT = join(__dirname, '..');
const OUT_PATH = join(REPO_ROOT, 'governance', 'api-inventory.json');

type Framework = 'next-app' | 'next-pages' | 'django';

interface Surface {
  app: string;
  framework: Framework;
  path: string;
  methods: string[];
  file: string;
}

const NEXT_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name === 'dist' || name === '.turbo') continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function repoRel(p: string): string {
  return relative(REPO_ROOT, p).split(sep).join('/');
}

function appNameFromPath(p: string): string {
  const rel = repoRel(p);
  const parts = rel.split('/');
  if (parts[0] === 'apps' && parts[1]) return parts[1];
  return parts[0] ?? 'unknown';
}

function detectMethods(source: string, framework: Framework): string[] {
  if (framework === 'next-app') {
    const found = NEXT_HTTP_METHODS.filter((m) =>
      new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b`).test(source) ||
      new RegExp(`export\\s+const\\s+${m}\\b`).test(source),
    );
    return found.length ? found : ['*'];
  }
  if (framework === 'next-pages') {
    return ['*']; // pages/api default export handles all methods unless internally branched
  }
  return ['*'];
}

function nextAppRoutePath(file: string): string {
  // apps/<app>/app/api/foo/[id]/route.ts -> /api/foo/[id]
  // apps/<app>/app/(group)/api/foo/route.ts -> /api/foo  (groups stripped)
  const rel = repoRel(file);
  const idx = rel.indexOf('/app/');
  if (idx < 0) return rel;
  const tail = rel.slice(idx + '/app/'.length);
  const noFile = tail.replace(/\/route\.(ts|tsx|js|mjs)$/, '');
  const noGroups = noFile
    .split('/')
    .filter((seg) => !(seg.startsWith('(') && seg.endsWith(')')))
    .join('/');
  return '/' + noGroups;
}

function nextPagesApiPath(file: string): string {
  // apps/<app>/pages/api/foo/[id].ts -> /api/foo/[id]
  const rel = repoRel(file);
  const idx = rel.indexOf('/pages/');
  if (idx < 0) return rel;
  const tail = rel.slice(idx + '/pages/'.length);
  return '/' + tail.replace(/\.(ts|tsx|js|mjs)$/, '').replace(/\/index$/, '');
}

function discoverNext(appsDir: string): Surface[] {
  const surfaces: Surface[] = [];
  const files = walk(appsDir);
  for (const file of files) {
    const rel = repoRel(file);
    // App-router route handlers
    if (/\/app\/.*\/route\.(ts|tsx|js|mjs)$/.test(rel) || /\/app\/api\/.*\/route\.(ts|tsx|js|mjs)$/.test(rel)) {
      // only count files under an api segment OR every route file? Per Next 13+, ANY route.ts is an HTTP endpoint.
      let source = '';
      try {
        source = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      surfaces.push({
        app: appNameFromPath(file),
        framework: 'next-app',
        path: nextAppRoutePath(file),
        methods: detectMethods(source, 'next-app'),
        file: rel,
      });
      continue;
    }
    // Pages-router /pages/api/**
    if (/\/pages\/api\/.*\.(ts|tsx|js|mjs)$/.test(rel) && !rel.includes('.test.') && !rel.includes('.spec.')) {
      surfaces.push({
        app: appNameFromPath(file),
        framework: 'next-pages',
        path: nextPagesApiPath(file),
        methods: ['*'],
        file: rel,
      });
    }
  }
  return surfaces;
}

function discoverDjango(appsDir: string): Surface[] {
  const surfaces: Surface[] = [];
  const files = walk(appsDir).filter((f) => f.endsWith('urls.py'));
  // Match urlpatterns entries like: path('foo/bar/', views.X), re_path(r'^foo/$', ...)
  const pathRe = /(?:^|\s)(?:path|re_path)\s*\(\s*[r]?['"]([^'"]+)['"]/g;
  for (const file of files) {
    let source = '';
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    let m: RegExpExecArray | null;
    while ((m = pathRe.exec(source)) !== null) {
      const raw = m[1];
      if (!raw) continue;
      const cleaned = '/' + raw.replace(/^\^/, '').replace(/\$$/, '').replace(/^\/+/, '');
      surfaces.push({
        app: appNameFromPath(file),
        framework: 'django',
        path: cleaned,
        methods: ['*'],
        file: repoRel(file),
      });
    }
  }
  return surfaces;
}

function main(): void {
  const appsDir = join(REPO_ROOT, 'apps');
  const next = discoverNext(appsDir);
  const django = discoverDjango(appsDir);
  const surfaces = [...next, ...django].sort((a, b) =>
    a.app.localeCompare(b.app) || a.path.localeCompare(b.path),
  );

  const byMethod: Record<string, number> = {};
  for (const s of surfaces) {
    for (const m of s.methods) byMethod[m] = (byMethod[m] ?? 0) + 1;
  }
  const byApp: Record<string, number> = {};
  for (const s of surfaces) byApp[s.app] = (byApp[s.app] ?? 0) + 1;

  const output = {
    generatedAt: new Date().toISOString(),
    totals: { surfaces: surfaces.length, byApp, byMethod },
    surfaces,
  };

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  // eslint-disable-next-line no-console
  console.log(`api-inventory: wrote ${surfaces.length} surfaces across ${Object.keys(byApp).length} apps -> ${repoRel(OUT_PATH)}`);
}

main();
