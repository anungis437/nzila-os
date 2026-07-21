/**
 * Tests for the anti-theatre scanner.
 *
 * We drive the scanner against a small synthetic filesystem tree under
 * a temp directory, so the assertions do NOT depend on the state of the
 * real repository. Both true-positive detection and false-positive
 * avoidance are covered.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { runScan, isTestOrFixturePath } from '../anti-theatre-scan';

async function seedRoot(): Promise<string> {
  const root = resolve(tmpdir(), `anti-theatre-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(resolve(root, 'apps/union-eyes/app/api/health'), { recursive: true });
  await mkdir(resolve(root, 'apps/union-eyes/app/api/cron/monthly-dues'), { recursive: true });
  await mkdir(resolve(root, 'apps/union-eyes/lib/reality'), { recursive: true });
  await mkdir(resolve(root, 'apps/union-eyes/services'), { recursive: true });
  await mkdir(resolve(root, 'apps/union-eyes/lib/__tests__'), { recursive: true });
  return root;
}

async function cleanup(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

async function seedRegistry(root: string, entries: readonly { id: string; ownedBy: readonly string[] }[]): Promise<void> {
  const body = entries
    .map(
      (e) =>
        `  { id: '${e.id}', title: 't', state: 'NOT_IMPLEMENTED', ownedBy: [${e.ownedBy
          .map((p) => `'${p}'`)
          .join(', ')}], evidence: [], targetWave: 1 },`,
    )
    .join('\n');
  await writeFile(
    resolve(root, 'apps/union-eyes/lib/reality/capability-registry.ts'),
    `export const CAPABILITY_REGISTRY = [\n${body}\n] as const;\n`,
    'utf8',
  );
}

describe('isTestOrFixturePath', () => {
  it('flags __tests__ paths', () => {
    expect(isTestOrFixturePath('apps/union-eyes/lib/__tests__/foo.ts')).toBe(true);
  });
  it('flags *.test.ts', () => {
    expect(isTestOrFixturePath('apps/union-eyes/services/foo.test.ts')).toBe(true);
  });
  it('does not flag production service files', () => {
    expect(isTestOrFixturePath('apps/union-eyes/services/foo.ts')).toBe(false);
  });
});

describe('anti-theatre scanner — R-1 (not_implemented in 2xx)', () => {
  let root: string;
  beforeEach(async () => { root = await seedRoot(); });
  afterEach(async () => { await cleanup(root); });

  it('flags a route that returns 200 with not_implemented body', async () => {
    await seedRegistry(root, [{ id: 'X', ownedBy: ['app/api/health/route.ts'] }]);
    await writeFile(
      resolve(root, 'apps/union-eyes/app/api/health/route.ts'),
      `import { NextResponse } from 'next/server';\nexport async function GET() {\n  return NextResponse.json({ status: 'not_implemented' }, { status: 200 });\n}\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r1 = res.findings.filter((f) => f.rule === 'R-1');
    expect(r1.length).toBeGreaterThan(0);
    expect(r1[0].severity).toBe('error');
  });

  it('does NOT flag a route that throws ApiError.notImplemented', async () => {
    await seedRegistry(root, [{ id: 'X', ownedBy: ['app/api/cron/monthly-dues/route.ts'] }]);
    await writeFile(
      resolve(root, 'apps/union-eyes/app/api/cron/monthly-dues/route.ts'),
      `import { ApiError } from '@/lib/api/errors';\nexport async function GET() { throw ApiError.notImplemented('monthly-dues cron not implemented'); }\n`,
      'utf8',
    );
    const res = await runScan({ root });
    expect(res.findings.filter((f) => f.rule === 'R-1')).toHaveLength(0);
  });
});

describe('anti-theatre scanner — R-2 (hardcoded readiness)', () => {
  let root: string;
  beforeEach(async () => { root = await seedRoot(); });
  afterEach(async () => { await cleanup(root); });

  it('flags a route that constructs PilotConfiguration with true flags', async () => {
    await seedRegistry(root, [{ id: 'PS', ownedBy: ['app/api/admin/pilot-status/route.ts'] }]);
    await mkdir(resolve(root, 'apps/union-eyes/app/api/admin/pilot-status'), { recursive: true });
    await writeFile(
      resolve(root, 'apps/union-eyes/app/api/admin/pilot-status/route.ts'),
      `export async function GET() {\n  const cfg = {\n    vocabularyLoaded: true,\n    orgConfigured: true,\n    slaThresholdsSet: true,\n    auditTrailActive: true,\n  };\n  return cfg;\n}\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r2 = res.findings.filter((f) => f.rule === 'R-2' && f.severity === 'error');
    expect(r2.length).toBe(4);
  });

  it('does NOT flag a test file constructing the same object', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/lib/__tests__/pilot.test.ts'),
      `const baseConfig = { vocabularyLoaded: true, orgConfigured: true };\n`,
      'utf8',
    );
    const res = await runScan({ root });
    expect(res.findings.filter((f) => f.rule === 'R-2')).toHaveLength(0);
  });
});

describe('anti-theatre scanner — R-3 (demo imports in production)', () => {
  let root: string;
  beforeEach(async () => { root = await seedRoot(); });
  afterEach(async () => { await cleanup(root); });

  it('flags a service importing from a demo path', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/services/reporting.ts'),
      `import { fakeData } from '../demo/fixtures/cupe';\nexport function build() { return fakeData; }\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    expect(r3.length).toBe(1);
    expect(r3[0].severity).toBe('error');
  });

  it('does NOT flag a test file importing from fixtures', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/services/reporting.test.ts'),
      `import { fakeData } from '../fixtures/cupe';\n`,
      'utf8',
    );
    const res = await runScan({ root });
    expect(res.findings.filter((f) => f.rule === 'R-3')).toHaveLength(0);
  });
});

describe('anti-theatre scanner — R-4 (demo profile in prod env)', () => {
  let root: string;
  beforeEach(async () => { root = await seedRoot(); });
  afterEach(async () => { await cleanup(root); });

  it('flags cupe4373 in .env.production', async () => {
    await seedRegistry(root, []);
    await mkdir(resolve(root, 'apps/union-eyes'), { recursive: true });
    await writeFile(
      resolve(root, 'apps/union-eyes/.env.production'),
      `UE_FEATURE_PROFILE=cupe4373\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r4 = res.findings.filter((f) => f.rule === 'R-4');
    expect(r4.length).toBe(1);
  });

  it('does NOT flag cupe4373 in .env.development', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/.env.development'),
      `UE_FEATURE_PROFILE=cupe4373\n`,
      'utf8',
    );
    const res = await runScan({ root });
    expect(res.findings.filter((f) => f.rule === 'R-4')).toHaveLength(0);
  });
});

describe('anti-theatre scanner — R-5 (fabricated BOC provenance)', () => {
  let root: string;
  beforeEach(async () => { root = await seedRoot(); });
  afterEach(async () => { await cleanup(root); });

  it('flags a catch block that returns the fresh BOC label', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/services/currency-service.ts'),
      `export async function rate() {\n  try { throw new Error('down'); } catch (e) {\n    return { source: 'Bank of Canada (FXUSDCAD)' };\n  }\n}\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r5 = res.findings.filter((f) => f.rule === 'R-5');
    expect(r5.length).toBe(1);
    expect(r5[0].severity).toBe('error');
  });

  it('does NOT flag a properly-labelled cached fallback', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/services/currency-service.ts'),
      `export async function rate() {\n  try { throw new Error('down'); } catch (e) {\n    return { source: 'bank_of_canada_cached' };\n  }\n}\n`,
      'utf8',
    );
    const res = await runScan({ root });
    expect(res.findings.filter((f) => f.rule === 'R-5')).toHaveLength(0);
  });
});

describe('anti-theatre scanner — R-7 (registry coverage)', () => {
  let root: string;
  beforeEach(async () => { root = await seedRoot(); });
  afterEach(async () => { await cleanup(root); });

  it('flags a production route missing from the registry', async () => {
    await seedRegistry(root, []); // empty registry
    await writeFile(
      resolve(root, 'apps/union-eyes/app/api/health/route.ts'),
      `export async function GET() { return new Response('ok'); }\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r7 = res.findings.filter((f) => f.rule === 'R-7');
    expect(r7.length).toBe(1);
    expect(r7[0].severity).toBe('warning');
  });

  it('does NOT flag a route that is in the registry', async () => {
    await seedRegistry(root, [{ id: 'H', ownedBy: ['app/api/health/route.ts'] }]);
    await writeFile(
      resolve(root, 'apps/union-eyes/app/api/health/route.ts'),
      `export async function GET() { return new Response('ok'); }\n`,
      'utf8',
    );
    const res = await runScan({ root });
    expect(res.findings.filter((f) => f.rule === 'R-7')).toHaveLength(0);
  });
});

describe('anti-theatre scanner — R-8 (empty authoritative success)', () => {
  let root: string;
  beforeEach(async () => { root = await seedRoot(); });
  afterEach(async () => { await cleanup(root); });

  it('flags a route returning `{ data: [] }` as 200', async () => {
    await seedRegistry(root, [{ id: 'R', ownedBy: ['app/api/reports/route.ts'] }]);
    await mkdir(resolve(root, 'apps/union-eyes/app/api/reports'), { recursive: true });
    await writeFile(
      resolve(root, 'apps/union-eyes/app/api/reports/route.ts'),
      `import { NextResponse } from 'next/server';\nexport async function GET() { return NextResponse.json({ data: [] }); }\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r8 = res.findings.filter((f) => f.rule === 'R-8');
    expect(r8.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §6 Anti-theatre scanner expansion — 12 additional R-3 boundary scenarios
//
// These scenarios exercise the concrete evasion paths that a naïve
// static-import regex would miss. Each scenario asserts the scanner's
// current behaviour so any future regression (e.g. someone tightens or
// relaxes one of the four import-form regexes, or the artifact-root
// exemption list drifts) fails CI.
// ---------------------------------------------------------------------------
describe('anti-theatre scanner — R-3 §6 expansion', () => {
  let root: string;
  beforeEach(async () => { root = await seedRoot(); });
  afterEach(async () => { await cleanup(root); });

  // 1. Dynamic import from a demo path in production code.
  it('flags dynamic `await import(...)` from a demo path', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/services/lazy-loader.ts'),
      `export async function load() {\n  const mod = await import('../demo/fixtures/cupe');\n  return mod;\n}\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    expect(r3.length).toBe(1);
    expect(r3[0].severity).toBe('error');
    expect(r3[0].message).toContain('dynamically imports');
  });

  // 2. CJS require from a demo path.
  it('flags a `require(...)` call resolving into a demo path', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/services/cjs-loader.ts'),
      `export function load() {\n  const mod = require('../demo/fixtures/cupe');\n  return mod;\n}\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    expect(r3.length).toBe(1);
    expect(r3[0].message).toContain('requires');
  });

  // 3. Bare side-effect import.
  it('flags a bare side-effect `import "..."` from a demo path', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/lib/side-effect.ts'),
      `import '../demo/register';\nexport const marker = 1;\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    expect(r3.length).toBe(1);
    expect(r3[0].message).toContain('statically imports (bare)');
  });

  // 4. Alias bypass via `@/lib/demo/...`.
  it('flags an `@/lib/demo/...` alias import in a production service', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/services/via-alias.ts'),
      `import { fixture } from '@/lib/demo/cupe';\nexport const f = fixture;\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    expect(r3.length).toBe(1);
    expect(r3[0].evidence).toBe('@/lib/demo/cupe');
  });

  // 5. Artifact-root exemption — union-eyes-demo may import demo freely.
  it('does NOT flag imports from a file that lives under the demo artifact root', async () => {
    await seedRegistry(root, []);
    await mkdir(resolve(root, 'apps/union-eyes-demo/lib'), { recursive: true });
    await writeFile(
      resolve(root, 'apps/union-eyes-demo/lib/demo-only.ts'),
      `import { fixture } from '@/lib/demo/cupe';\nexport const f = fixture;\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    expect(r3.length).toBe(0);
  });

  // 6. Relative traversal `../../demo/...` from a nested `app/` page file
  //    whose directory name (`reports`) collides with the scanner's own
  //    output-dump marker. Prior to §6 this was a silent false-negative
  //    because `${sep}reports${sep}` was in DEFAULT_TEST_PATH_MARKERS and
  //    matched substring-anywhere. §6 tightened that marker to root-only.
  it('flags a relative traversal `../../demo/...` from an app/reports page file', async () => {
    await seedRegistry(root, []);
    await mkdir(resolve(root, 'apps/union-eyes/app/reports'), { recursive: true });
    await writeFile(
      resolve(root, 'apps/union-eyes/app/reports/page.ts'),
      `import { fixture } from '../../demo/cupe';\nexport default function P() { return null; }\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    expect(r3.length).toBe(1);
    expect(r3[0].file).toContain('reports/page.ts');
  });

  // 7. Barrel re-export — `export { X } from '@/lib/demo/...'` must be caught.
  it('flags a barrel `export { X } from "@/lib/demo/..."`', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/lib/barrel.ts'),
      `export { fixture } from '@/lib/demo/cupe';\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    expect(r3.length).toBe(1);
    expect(r3[0].evidence).toBe('@/lib/demo/cupe');
  });

  // 8. Barrel `export * from '...'` re-export.
  it('flags an `export * from` barrel that re-exports a demo path', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/lib/star-barrel.ts'),
      `export * from '@/lib/demo/cupe';\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    expect(r3.length).toBe(1);
  });

  // 9. `fixtures/` (no leading demo) must also be flagged in prod.
  it('flags an import from a bare `fixtures/` path in production', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/services/from-fixtures.ts'),
      `import { seed } from '@/fixtures/currency';\nexport const s = seed;\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    expect(r3.length).toBe(1);
  });

  // 10. `__fixtures__/` inside a production import specifier must be flagged.
  it('flags an import from a `__fixtures__/` path from production code', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/services/from-underscored.ts'),
      `import { seed } from '@/__fixtures__/currency';\nexport const s = seed;\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    expect(r3.length).toBe(1);
  });

  // 11. `__fixtures__/` in the caller's file path is exempt (test scaffolding).
  it('does NOT flag a file under `__fixtures__/` importing from a demo path', async () => {
    await seedRegistry(root, []);
    await mkdir(resolve(root, 'apps/union-eyes/lib/__fixtures__'), { recursive: true });
    await writeFile(
      resolve(root, 'apps/union-eyes/lib/__fixtures__/scaffold.ts'),
      `import { fixture } from '@/lib/demo/cupe';\nexport const f = fixture;\n`,
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    expect(r3.length).toBe(0);
  });

  // 12. Multiple import-forms on the same file should each be flagged
  //     separately — proves the four regexes do not clobber each other.
  it('flags every demo-touching import form on the same production file', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/services/multi-form.ts'),
      [
        `import { a } from '@/lib/demo/one';`,
        `import '@/lib/demo/two';`,
        `export async function load() {`,
        `  const m = await import('@/lib/demo/three');`,
        `  const n = require('@/lib/demo/four');`,
        `  return [m, n];`,
        `}`,
        ``,
      ].join('\n'),
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    // 4 distinct forms → 4 findings.
    expect(r3.length).toBe(4);
    const evidence = r3.map((f) => f.evidence).sort();
    expect(evidence).toEqual([
      '@/lib/demo/four',
      '@/lib/demo/one',
      '@/lib/demo/three',
      '@/lib/demo/two',
    ]);
  });

  // 13. §6 hardening: docstring references to demo paths must NOT be
  //     flagged. Prior to comment-stripping the scanner false-positived
  //     on JSDoc comments that documented removed imports.
  it('does NOT flag a demo path that only appears inside a JSDoc comment', async () => {
    await seedRegistry(root, []);
    await writeFile(
      resolve(root, 'apps/union-eyes/services/documented.ts'),
      [
        `/**`,
        ` * Historical note: this file previously imported`,
        ` * \`Cupe4373ReportsPage\` from \`@/components/demo/*\`. That`,
        ` * import has been removed; the operational surface now returns 404.`,
        ` */`,
        `export const inertMarker = 1;`,
        `// This line comment also mentions @/lib/demo/foo just to be sure.`,
        ``,
      ].join('\n'),
      'utf8',
    );
    const res = await runScan({ root });
    const r3 = res.findings.filter((f) => f.rule === 'R-3');
    expect(r3.length).toBe(0);
  });
});
