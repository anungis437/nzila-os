/**
 * Capability Inventory Generator
 *
 * Scans the Union Eyes application surface and produces a machine-readable
 * inventory at `reports/union-eyes-capability-inventory.json`. The
 * inventory is later reconciled against the hand-curated capability
 * registry (`apps/union-eyes/lib/reality/capability-registry.ts`) so
 * that we can guarantee every production surface either has an
 * explicit reality state or is a known gap.
 *
 * The generator is intentionally shallow: it records surface-level facts
 * (path, kind, exports, decorator hints) rather than deep semantics.
 * Deep behavioural claims MUST be recorded in the registry by a human.
 *
 * Surfaces covered:
 *   - Next.js route handlers                → `app/api/**\/route.ts`
 *   - Next.js pages                         → `app/**\/page.tsx`
 *   - Server actions                        → `actions/**\/*.ts`
 *   - Service modules                       → `services/**\/*.ts`
 *   - Cron routes                           → `app/api/cron/**\/route.ts`
 *   - Django task modules                   → `packages/union-eyes-backend/**\/tasks.py`
 *   - Workers                               → `apps/union-eyes/workers/**\/*.ts`
 *
 * A missing directory produces zero entries, not an error.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export type SurfaceKind =
  | 'api-route'
  | 'cron-route'
  | 'page'
  | 'server-action'
  | 'service'
  | 'worker'
  | 'django-task'
  | 'db-schema';

export interface InventoryEntry {
  kind: SurfaceKind;
  path: string;
  registryKey: string;
  exports: string[];
  notes: string[];
}

interface Discovery {
  files: string[];
  root: string;
}

function listGitFiles(root: string): string[] {
  try {
    const out = execSync('git ls-files', {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
      // Suppress "not a git repository" chatter when the caller runs
      // the tool from a tmpdir (unit tests) or a detached checkout.
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function classify(rel: string): SurfaceKind | null {
  const n = rel.split(sep).join('/');
  if (n.startsWith('apps/union-eyes/app/api/cron/') && n.endsWith('/route.ts')) return 'cron-route';
  if (n.startsWith('apps/union-eyes/app/api/') && n.endsWith('/route.ts')) return 'api-route';
  if (n.startsWith('apps/union-eyes/app/') && (n.endsWith('/page.tsx') || n.endsWith('/page.ts'))) return 'page';
  if (n.startsWith('apps/union-eyes/actions/') && n.endsWith('.ts') && !n.endsWith('.test.ts')) return 'server-action';
  if (n.startsWith('apps/union-eyes/services/') && n.endsWith('.ts') && !n.endsWith('.test.ts')) return 'service';
  if (n.startsWith('apps/union-eyes/workers/') && (n.endsWith('.ts') || n.endsWith('.tsx')) && !n.endsWith('.test.ts')) return 'worker';
  if (n.startsWith('packages/union-eyes-backend/') && n.endsWith('/tasks.py')) return 'django-task';
  if (n.startsWith('apps/union-eyes/db/') && n.endsWith('.ts') && !n.endsWith('.test.ts')) return 'db-schema';
  return null;
}

function registryKeyFor(rel: string): string {
  return rel.split(sep).join('/').replace(/^apps\/union-eyes\//, '');
}

async function extractExports(absPath: string): Promise<string[]> {
  try {
    const content = await readFile(absPath, 'utf8');
    const names = new Set<string>();
    for (const m of content.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
    for (const m of content.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
    for (const m of content.matchAll(/export\s+class\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
    return [...names].sort();
  } catch {
    return [];
  }
}

function noteFor(kind: SurfaceKind, exports: readonly string[]): string[] {
  const notes: string[] = [];
  if (kind === 'api-route' || kind === 'cron-route') {
    const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
    const exposed = exports.filter((e) => httpMethods.includes(e));
    if (exposed.length === 0) notes.push('no-http-methods-detected');
    else notes.push(`methods=${exposed.join(',')}`);
  }
  return notes;
}

export async function buildInventory(root: string): Promise<InventoryEntry[]> {
  const files = listGitFiles(root);
  const entries: InventoryEntry[] = [];
  for (const rel of files) {
    const kind = classify(rel);
    if (!kind) continue;
    const abs = resolve(root, rel);
    if (!existsSync(abs)) continue;
    const exports = kind === 'django-task' ? [] : await extractExports(abs);
    entries.push({
      kind,
      path: rel.split(sep).join('/'),
      registryKey: registryKeyFor(rel),
      exports,
      notes: noteFor(kind, exports),
    });
  }
  entries.sort((a, b) => (a.kind + a.path).localeCompare(b.kind + b.path));
  return entries;
}

interface RegistryLoad {
  ownedPaths: Set<string>;
  ids: string[];
}

async function loadRegistry(root: string): Promise<RegistryLoad> {
  const file = resolve(root, 'apps/union-eyes/lib/reality/capability-registry.ts');
  const ownedPaths = new Set<string>();
  const ids: string[] = [];
  if (!existsSync(file)) return { ownedPaths, ids };
  const src = await readFile(file, 'utf8');
  const RE = /\{\s*id:\s*['"`]([A-Z0-9_-]+)['"`][\s\S]*?ownedBy:\s*\[([\s\S]*?)\][\s\S]*?\}/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(src)) !== null) {
    ids.push(m[1]);
    for (const p of m[2].matchAll(/['"`]([^'"`]+)['"`]/g)) ownedPaths.add(p[1]);
  }
  return { ownedPaths, ids };
}

export interface InventoryReport {
  generatedAt: string;
  totals: { entries: number; byKind: Record<string, number> };
  registry: { totalEntries: number; totalOwnedPaths: number };
  coverage: { covered: number; missing: number; unusedRegistryPaths: number };
  entries: InventoryEntry[];
  gaps: {
    surfacesWithoutRegistryEntry: string[];
    registryPathsWithoutSurface: string[];
  };
}

export async function generateReport(root: string): Promise<InventoryReport> {
  const entries = await buildInventory(root);
  const registry = await loadRegistry(root);
  const surfaceKeys = new Set(entries.map((e) => e.registryKey));
  const missing = entries
    .filter((e) => !registry.ownedPaths.has(e.registryKey))
    .map((e) => e.registryKey);
  const unused = [...registry.ownedPaths].filter((p) => !surfaceKeys.has(p));
  const byKind: Record<string, number> = {};
  for (const e of entries) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;

  return {
    generatedAt: new Date().toISOString(),
    totals: { entries: entries.length, byKind },
    registry: {
      totalEntries: registry.ids.length,
      totalOwnedPaths: registry.ownedPaths.size,
    },
    coverage: {
      covered: entries.length - missing.length,
      missing: missing.length,
      unusedRegistryPaths: unused.length,
    },
    entries,
    gaps: {
      surfacesWithoutRegistryEntry: missing.sort(),
      registryPathsWithoutSurface: unused.sort(),
    },
  };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const report = await generateReport(root);
  const reportDir = resolve(root, 'reports');
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    resolve(reportDir, 'union-eyes-capability-inventory.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  );

  const md: string[] = [
    '# Union Eyes Capability Inventory',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Surfaces discovered: **${report.totals.entries}**`,
    `- Registry entries: ${report.registry.totalEntries} (owning ${report.registry.totalOwnedPaths} paths)`,
    `- Coverage: ${report.coverage.covered} / ${report.totals.entries}`,
    `- **Surfaces without a registry entry: ${report.coverage.missing}**`,
    `- Registry paths with no matching surface: ${report.coverage.unusedRegistryPaths}`,
    '',
    '## By kind',
    '',
    ...Object.entries(report.totals.byKind)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, n]) => `- ${k}: ${n}`),
    '',
    '## Surfaces missing from the registry (first 100)',
    '',
    ...report.gaps.surfacesWithoutRegistryEntry.slice(0, 100).map((p) => `- \`${p}\``),
    '',
    '## Registry-owned paths not observed in code (first 50)',
    '',
    ...report.gaps.registryPathsWithoutSurface.slice(0, 50).map((p) => `- \`${p}\``),
  ];
  await writeFile(resolve(reportDir, 'union-eyes-capability-inventory.md'), md.join('\n'), 'utf8');

  console.log(
    `Inventory: ${report.totals.entries} surfaces, ${report.coverage.missing} missing registry entries.`,
  );
}

const isDirect = (() => {
  try {
    return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
