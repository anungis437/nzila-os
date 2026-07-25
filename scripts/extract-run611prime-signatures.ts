/**
 * scripts/extract-run611prime-signatures.ts
 *
 * §7 register rebuild helper — Phase 0C.2R Run 6.1''' (runId 20260725153606_a6491d).
 *
 * Parses the Playwright JSON reporter output and emits:
 *  1. A JSON file with every failed/timedOut/skipped result, categorized by root cause
 *     using the §3.5 corrected root-cause taxonomy.
 *  2. A CSV file (one row per test result) suitable for spreadsheet review.
 *  3. A stdout summary counting each category.
 *
 * The taxonomy classifier is intentionally conservative: any signature it cannot
 * classify with high confidence goes into `unknown` for human review — we never
 * silently over-fit to a smaller number of buckets.
 *
 * Invocation:
 *   tsx scripts/extract-run611prime-signatures.ts \
 *     --input reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260725153606_a6491d/test-results/results-20260725153606_a6491d.json \
 *     --out-json reports/audits/cupe-national-phase-0/phase-0c/phase-0c2r-run611prime-failures.json \
 *     --out-csv reports/audits/cupe-national-phase-0/phase-0c/phase-0c2r-run611prime-failures.csv
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv } from 'node:process';

interface PlaywrightError {
  message?: string;
  stack?: string;
  value?: string;
}

interface PlaywrightResult {
  status:
    | 'passed'
    | 'failed'
    | 'timedOut'
    | 'skipped'
    | 'interrupted'
    | (string & {});
  duration?: number;
  errors?: PlaywrightError[];
  error?: PlaywrightError;
}

interface PlaywrightTest {
  projectId?: string;
  projectName?: string;
  results?: PlaywrightResult[];
}

interface PlaywrightSpec {
  title?: string;
  file?: string;
  line?: number;
  column?: number;
  tests?: PlaywrightTest[];
}

interface PlaywrightSuite {
  title?: string;
  file?: string;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  suites?: PlaywrightSuite[];
  stats?: {
    expected?: number;
    unexpected?: number;
    skipped?: number;
    flaky?: number;
  };
}

interface FlatRecord {
  project: string;
  file: string;
  test: string;
  status: string;
  durationMs: number;
  errorMessage: string;
  errorStack: string;
  rootCauseCategory: string;
  rootCauseConfidence: 'high' | 'medium' | 'low';
}

const args = new Map<string, string>();
for (let i = 2; i < argv.length; i += 2) {
  args.set(argv[i]!, argv[i + 1] ?? '');
}

const inputPath =
  args.get('--input') ??
  'reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260725153606_a6491d/test-results/results-20260725153606_a6491d.json';
const outJson =
  args.get('--out-json') ??
  'reports/audits/cupe-national-phase-0/phase-0c/phase-0c2r-run611prime-failures.json';
const outCsv =
  args.get('--out-csv') ??
  'reports/audits/cupe-national-phase-0/phase-0c/phase-0c2r-run611prime-failures.csv';

const raw = readFileSync(resolve(inputPath), 'utf8');
const report: PlaywrightReport = JSON.parse(raw);

const records: FlatRecord[] = [];

function walk(suite: PlaywrightSuite, projectFile: string | undefined): void {
  const fileHere = suite.file ?? projectFile;
  for (const spec of suite.specs ?? []) {
    const specFile = spec.file ?? fileHere ?? '';
    const specTitle = spec.title ?? '';
    for (const test of spec.tests ?? []) {
      const project = test.projectName ?? test.projectId ?? 'unknown';
      for (const result of test.results ?? []) {
        const status = result.status;
        // Only record non-passed outcomes; passed is captured only by summary counts.
        if (status === 'passed') continue;
        const err = result.errors?.[0] ?? result.error ?? {};
        const message = err.message ?? '';
        const stack = err.stack ?? '';
        const classification = classifyRootCause({
          status,
          message,
          stack,
          file: specFile,
          test: specTitle,
        });
        records.push({
          project,
          file: specFile,
          test: specTitle,
          status,
          durationMs: result.duration ?? 0,
          errorMessage: message.slice(0, 800),
          errorStack: stack.slice(0, 800),
          rootCauseCategory: classification.category,
          rootCauseConfidence: classification.confidence,
        });
      }
    }
  }
  for (const child of suite.suites ?? []) {
    walk(child, fileHere);
  }
}

interface Classification {
  category: string;
  confidence: 'high' | 'medium' | 'low';
}

function classifyRootCause(input: {
  status: string;
  message: string;
  stack: string;
  file: string;
  test: string;
}): Classification {
  const { status, message, stack } = input;
  const blob = `${message}\n${stack}`.toLowerCase();

  // Skipped-with-no-error is DNR (dependency did not run).
  if (status === 'skipped' && message === '' && stack === '') {
    return { category: 'dnr-dependency-skipped', confidence: 'high' };
  }
  // Skipped WITH a message usually means test.skip() was called intentionally.
  if (status === 'skipped') {
    return { category: 'intentional-skip', confidence: 'medium' };
  }

  // §3.5 taxonomy — ordered from most specific to least.
  // NOTE: After §8 helper repair (commits 010c6e367 + bd7bca79c) the timeoutMs
  // is 180_000, so a beforeAll hook timeout of 180000ms is by construction
  // `ensureServerReady` consuming its full budget (that is the ONLY awaitable
  // in the helper's beforeAll wrapper).
  if (blob.includes('ensureserverready')) {
    return { category: 'ensureServerReady-180s', confidence: 'high' };
  }
  if (
    blob.includes('beforeall') &&
    (blob.includes('hook timeout of 180000ms') ||
      blob.includes('hook timeout of 180 000ms'))
  ) {
    return { category: 'ensureServerReady-180s', confidence: 'high' };
  }
  if (
    blob.includes('page.goto') &&
    (blob.includes('timeout') || blob.includes('45000ms') || blob.includes('45 000 ms'))
  ) {
    return { category: 'page.goto-45s-timeout', confidence: 'high' };
  }
  if (blob.includes('page.goto') && blob.includes('exceeded')) {
    return { category: 'page.goto-45s-timeout', confidence: 'medium' };
  }
  // `apiGet` / `apiPost` helpers wrap `apiRequestContext.get` / `.post`
  // with a 20 000 ms timeout in _helpers.ts — surfaces as this literal.
  if (blob.includes('apirequestcontext.get') || blob.includes('apiget') || blob.includes('api get')) {
    return { category: 'apiGet-20s-timeout', confidence: 'high' };
  }
  if (blob.includes('apirequestcontext.post') || blob.includes('apipost') || blob.includes('api post')) {
    return { category: 'apiPost-20s-timeout', confidence: 'high' };
  }
  if (
    blob.includes('expect(page).tohaveurl') ||
    blob.includes('expected url') ||
    blob.includes('tohaveurl')
  ) {
    return { category: 'url-mismatch', confidence: 'high' };
  }
  if (blob.includes('tobevisible') || blob.includes('visible: true')) {
    return { category: 'locator-visible', confidence: 'high' };
  }
  if (blob.includes('tocontaintext') || blob.includes('tocontain')) {
    return { category: 'assertion-toContain', confidence: 'high' };
  }
  if (blob.includes('tomatch') || blob.includes('to match')) {
    return { category: 'assertion-toMatch', confidence: 'high' };
  }
  if (blob.includes('test timeout') || blob.includes('timed out')) {
    return { category: 'test-timeout-generic', confidence: 'medium' };
  }
  if (status === 'timedOut') {
    return { category: 'timedOut-hook-or-body', confidence: 'medium' };
  }

  return { category: 'unknown-review-needed', confidence: 'low' };
}

for (const root of report.suites ?? []) {
  walk(root, root.file);
}

// Category counts.
const byCategory = new Map<string, number>();
const byProject = new Map<string, Map<string, number>>();
for (const r of records) {
  byCategory.set(r.rootCauseCategory, (byCategory.get(r.rootCauseCategory) ?? 0) + 1);
  if (!byProject.has(r.project)) byProject.set(r.project, new Map());
  const pm = byProject.get(r.project)!;
  pm.set(r.rootCauseCategory, (pm.get(r.rootCauseCategory) ?? 0) + 1);
}

const output = {
  runId: '20260725153606_a6491d',
  sourceReport: inputPath,
  taxonomyVersion: 'phase-0c2r §3.5 (corrected)',
  aggregate: report.stats,
  totals: {
    recorded: records.length,
    byCategory: Object.fromEntries(byCategory.entries()),
  },
  byProject: Object.fromEntries(
    Array.from(byProject.entries()).map(([p, m]) => [p, Object.fromEntries(m.entries())]),
  ),
  records,
};

writeFileSync(resolve(outJson), JSON.stringify(output, null, 2), 'utf8');

// CSV emit.
const csvHeader =
  'project,file,test,status,durationMs,rootCauseCategory,rootCauseConfidence,errorMessage,errorStack';
const csvRows = records.map((r) =>
  [
    r.project,
    r.file,
    r.test,
    r.status,
    String(r.durationMs),
    r.rootCauseCategory,
    r.rootCauseConfidence,
    r.errorMessage,
    r.errorStack,
  ]
    .map((c) => `"${String(c).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`)
    .join(','),
);
writeFileSync(resolve(outCsv), [csvHeader, ...csvRows].join('\n'), 'utf8');

// stdout summary.
console.log('---aggregate stats (from report.stats)---');
console.log(JSON.stringify(report.stats, null, 2));
console.log('');
console.log('---totals by category---');
for (const [cat, count] of Array.from(byCategory.entries()).sort(
  (a, b) => b[1] - a[1],
)) {
  console.log(`${count.toString().padStart(4)}  ${cat}`);
}
console.log('');
console.log(`total non-passed records recorded: ${records.length}`);
console.log(`json written to: ${outJson}`);
console.log(`csv  written to: ${outCsv}`);
