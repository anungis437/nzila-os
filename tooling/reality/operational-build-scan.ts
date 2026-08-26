/**
 * Operational-Build Customer-Fixture Scanner
 *
 * Wave 0 §8 of the Union Eyes Reality & World-Class Remediation
 * Programme (Task E — allowlist retirement).
 *
 * POLICY
 * ------
 * The operational `@nzila/union-eyes` package is a control-plane
 * product. Customer-specific fixtures, personas, local numbers, or
 * demo profile tokens are FORBIDDEN in operational source. The demo
 * experience now lives in the separate `@nzila/union-eyes-demo`
 * package.
 *
 * The prior allowlist model (`operational-build-demo-allowlist.json`,
 * 28 classified entries) was retired at Wave 0 Task E. It was created
 * during a stage where operational and demo code shared the same
 * bundle; that architecture no longer exists. Any residual token in
 * operational source is now a HARD FAILURE except for a tiny, static
 * audit-trail permit inside this file. The permit exists ONLY to
 * preserve forensic evidence of what was removed.
 *
 * SCOPE
 * -----
 *   1. Scan every git-tracked file under `apps/union-eyes/` (tests,
 *      fixtures, snapshots, scripts and per-app reports/ are excluded
 *      by path filter — they are not shipped and their contents are
 *      irrelevant to the runtime surface).
 *   2. Match customer-fixture patterns (see PATTERNS below).
 *   3. Any hit not covered by PERMITTED_AUDIT_TRAIL below is a HARD
 *      FAILURE (exit 1). Any permit entry that yields zero real hits
 *      is ALSO a HARD FAILURE — it means the audit trail moved and
 *      the permit is dead.
 *   4. Emit machine-readable `reports/operational-build-demo-scan.json`
 *      and human-readable `reports/operational-build-demo-scan.md`.
 *   5. Optionally (`--build-dir=<path>`) count matches under the built
 *      output. Bundle counts are INFORMATIONAL — they are still
 *      surfaced in the report but do not affect the exit code, since
 *      the source-side gate is authoritative.
 *
 * DESIGN
 * ------
 * - Deterministic ordering; JSON is stable; text output is stable.
 * - Fail-closed: unpermitted source hits → exit 1.
 * - No JSON allowlist file. The permit is a hardcoded constant.
 * - Uses `git ls-files apps/union-eyes` for source discovery, falling
 *   back to a filesystem walk if git isn't available.
 * - Uses ripgrep (`rg`) when present for build-dir scans; refuses to
 *   scan a bundle without it (Node walk on 20k+ Next.js files is
 *   too slow to be useful).
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PermitClassification =
  | 'registry-evidence'; // capability-registry.ts audit-trail entries documenting removed CUPE code.

export interface PermitEntry {
  file: string;
  classification: PermitClassification;
  reason: string;
  /** Hard ceiling. Overflow = HARD FAILURE. */
  maxHits: number;
}

export interface SourceHit {
  file: string;
  line: number;
  match: string;
  preview: string;
}

export interface FileSummary {
  file: string;
  hits: number;
  classification: PermitClassification | 'UNPERMITTED';
  reason: string;
  overMaxHits?: boolean;
  allowedMaxHits?: number;
}

export interface BuildScanSummary {
  scannedFiles: number;
  filesWithHits: number;
  totalHits: number;
  buildDir: string;
}

export interface ScanReport {
  generatedAt: string;
  workspace: string;
  patterns: readonly string[];
  policy: 'hardcoded-audit-trail-permit';
  source: {
    scannedFiles: number;
    filesWithHits: number;
    totalHits: number;
    files: readonly FileSummary[];
  };
  build: BuildScanSummary | null;
  errors: readonly string[];
}

// ---------------------------------------------------------------------------
// Configuration — hardcoded pattern & permit
// ---------------------------------------------------------------------------

/**
 * Customer-fixture patterns forbidden in operational source.
 *
 * Extend this list only for customer-specific tokens whose presence in
 * operational source would constitute a hardcoded reference to a
 * particular buyer or pilot participant.
 */
const CUSTOMER_FIXTURE_PATTERNS: readonly string[] = [
  'cupe\\s*[-_]?\\s*4373',
  'cupe\\s*local\\s*4373',
  'CUPE4373_',
];

/**
 * Hardcoded audit-trail permit. The ONLY reason a customer-fixture
 * token may appear in operational source is to document — inside the
 * capability registry evidence arrays — WHICH files were removed
 * during the Wave 0 physical-remediation pass. This is forensic
 * accounting, not runtime code.
 *
 * If the count in the permitted file changes, update `maxHits` in the
 * same commit that changes the evidence text. Any addition of a NEW
 * permit entry requires explicit ownership by Aubert Nungisa and a
 * capability-registry entry justifying it.
 */
const PERMITTED_AUDIT_TRAIL: readonly PermitEntry[] = [
  {
    file: 'apps/union-eyes/lib/reality/capability-registry.ts',
    classification: 'registry-evidence',
    reason:
      'Forensic evidence for UE-DEMO-SEPARATE-PACKAGE / UE-BUILD-OPERATIONAL-ISOLATION: ' +
      'evidence arrays cite the paths of the CUPE4373 files that were physically deleted ' +
      'from the operational package during Wave 0 Task D. Not runtime code.',
    maxHits: 6,
  },
];

const REPORT_JSON_PATH = 'reports/operational-build-demo-scan.json';
const REPORT_MD_PATH = 'reports/operational-build-demo-scan.md';

// ---------------------------------------------------------------------------
// Source discovery
// ---------------------------------------------------------------------------

function listUnionEyesSources(root: string): string[] {
  try {
    const out = execSync('git ls-files apps/union-eyes', {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split(/\r?\n/)
      .filter(Boolean)
      .map((p) => resolve(root, p));
  } catch {
    return walkSync(resolve(root, 'apps/union-eyes'));
  }
}

function walkSync(dir: string): string[] {
  const fs = require('node:fs') as typeof import('node:fs');
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dist') continue;
      out.push(...walkSync(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

const SCANNABLE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.mdx',
  '.bicep', '.tf',
  '.yml', '.yaml',
  '.sh', '.ps1',
]);

/**
 * True for paths that are not part of the operational runtime surface:
 * tests, mocks, fixtures, snapshots, e2e specs, scripts, coverage
 * dumps, and per-app / root report directories. These naturally
 * reference customer names for regression coverage and audit trails
 * and are not shipped by the build.
 */
function isTestOrFixturePath(relPath: string): boolean {
  const p = relPath.replace(/\\/g, '/');
  const markers = [
    '/__tests__/',
    '/__mocks__/',
    '/__fixtures__/',
    '/__snapshots__/',
    '/tests/',
    '/test/',
    '/e2e/',
    '/fixtures/',
    '/scripts/',
    '/coverage/',
  ];
  if (markers.some((m) => p.includes(m))) return true;
  const suffixes = [
    '.test.ts', '.test.tsx', '.test.js', '.test.jsx',
    '.spec.ts', '.spec.tsx', '.spec.js', '.spec.jsx',
    '.stories.ts', '.stories.tsx',
  ];
  if (suffixes.some((s) => p.endsWith(s))) return true;
  const rootOnly = ['reports/', 'artifacts/', 'proof-artifacts/', 'apps/union-eyes/reports/'];
  return rootOnly.some((m) => p.startsWith(m));
}

async function scanSourceFile(root: string, abs: string, pattern: RegExp): Promise<SourceHit[]> {
  const rel = relative(root, abs).split(sep).join('/');
  const dotIdx = rel.lastIndexOf('.');
  const ext = dotIdx >= 0 ? rel.slice(dotIdx) : '';
  if (!SCANNABLE_EXTS.has(ext)) return [];
  if (isTestOrFixturePath(rel)) return [];
  let content: string;
  try {
    content = await readFile(abs, 'utf8');
  } catch {
    return [];
  }
  const hits: SourceHit[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    pattern.lastIndex = 0;
    const m = pattern.exec(line);
    if (m) {
      hits.push({
        file: rel,
        line: i + 1,
        match: m[0],
        preview: line.length > 200 ? `${line.slice(0, 200)}…` : line,
      });
    }
  }
  return hits;
}

async function scanSource(root: string, patternSrc: string): Promise<{ files: string[]; hits: SourceHit[] }> {
  const pattern = new RegExp(patternSrc, 'gi');
  const files = listUnionEyesSources(root);
  const hits: SourceHit[] = [];
  for (const abs of files) {
    hits.push(...(await scanSourceFile(root, abs, pattern)));
  }
  hits.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
  return { files, hits };
}

// ---------------------------------------------------------------------------
// Build-dir scan (optional, informational)
// ---------------------------------------------------------------------------

function findRipgrep(): string | null {
  const which = process.platform === 'win32' ? 'where' : 'which';
  try {
    const out = execSync(`${which} rg`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const first = out.split(/\r?\n/).find(Boolean);
    return first ? first.trim() : null;
  } catch {
    return null;
  }
}

async function scanBuildDir(buildDir: string, patternSrc: string): Promise<BuildScanSummary> {
  const rg = findRipgrep();
  if (!rg) {
    throw new Error(
      `[operational-build-scan] Ripgrep (\`rg\`) is required to scan the build directory efficiently. ` +
      `Install ripgrep or invoke this tool without --build-dir.`,
    );
  }
  const res = spawnSync(rg, ['-i', '-c', patternSrc, buildDir], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  if (res.status !== 0 && res.status !== 1) {
    throw new Error(
      `[operational-build-scan] rg exited with status ${res.status}: ${res.stderr}`,
    );
  }
  const lines = (res.stdout ?? '').split(/\r?\n/).filter(Boolean);
  let filesWithHits = 0;
  let totalHits = 0;
  for (const line of lines) {
    const idx = line.lastIndexOf(':');
    if (idx < 0) continue;
    const count = Number.parseInt(line.slice(idx + 1), 10);
    if (Number.isFinite(count) && count > 0) {
      filesWithHits += 1;
      totalHits += count;
    }
  }
  let scannedFiles = 0;
  const filesRes = spawnSync(rg, ['--files', buildDir], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  if (filesRes.status === 0) {
    scannedFiles = (filesRes.stdout ?? '').split(/\r?\n/).filter(Boolean).length;
  }
  return { scannedFiles, filesWithHits, totalHits, buildDir };
}

// ---------------------------------------------------------------------------
// Enforcement — hardcoded permit only
// ---------------------------------------------------------------------------

function enforce(hits: readonly SourceHit[]): {
  files: FileSummary[];
  errors: string[];
} {
  const byFile = new Map<string, SourceHit[]>();
  for (const h of hits) {
    const list = byFile.get(h.file) ?? [];
    list.push(h);
    byFile.set(h.file, list);
  }
  const permitByFile = new Map<string, PermitEntry>();
  for (const p of PERMITTED_AUDIT_TRAIL) {
    permitByFile.set(p.file, p);
  }
  const summaries: FileSummary[] = [];
  const errors: string[] = [];

  for (const [file, fhits] of [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const permit = permitByFile.get(file);
    if (!permit) {
      summaries.push({
        file,
        hits: fhits.length,
        classification: 'UNPERMITTED',
        reason: '(no audit-trail permit — customer fixtures are forbidden in operational source)',
      });
      errors.push(
        `[operational-build-scan] Customer-fixture token in operational source: ` +
        `${file} (${fhits.length} hit(s)). Operational code MUST NOT contain customer names, ` +
        `personas, local numbers, or demo profile tokens. Move the content to ` +
        `apps/union-eyes-demo/ or delete it.`,
      );
      continue;
    }
    const over = fhits.length > permit.maxHits;
    summaries.push({
      file,
      hits: fhits.length,
      classification: permit.classification,
      reason: permit.reason,
      overMaxHits: over || undefined,
      allowedMaxHits: permit.maxHits,
    });
    if (over) {
      errors.push(
        `[operational-build-scan] ${file}: ${fhits.length} hit(s) exceeds permitted maxHits=${permit.maxHits}. ` +
        `The audit-trail permit is a strict ceiling — reduce the evidence-text references or, if the count ` +
        `legitimately grew, raise maxHits in tooling/reality/operational-build-scan.ts:PERMITTED_AUDIT_TRAIL ` +
        `in the same commit that adds the evidence.`,
      );
    }
  }

  // Dead permit entries (zero real hits) = HARD FAIL. Prevents the
  // permit list from ossifying past its usefulness.
  for (const p of PERMITTED_AUDIT_TRAIL) {
    if (!byFile.has(p.file)) {
      errors.push(
        `[operational-build-scan] Dead audit-trail permit: ${p.file} has zero customer-fixture hits. ` +
        `Remove the entry from tooling/reality/operational-build-scan.ts:PERMITTED_AUDIT_TRAIL.`,
      );
    }
  }

  return { files: summaries, errors };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function renderMarkdown(report: ScanReport): string {
  const lines: string[] = [];
  lines.push('# Operational Build Customer-Fixture Scan (Wave 0 §8, Task E)');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Policy: **${report.policy}** (JSON allowlist retired; only the hardcoded audit-trail permit is honoured).`);
  lines.push(`- Patterns: ${report.patterns.map((p) => `\`${p}\``).join(', ')}`);
  lines.push(`- Source files scanned: ${report.source.scannedFiles}`);
  lines.push(`- Source files with hits: ${report.source.filesWithHits}`);
  lines.push(`- Total source hits: ${report.source.totalHits}`);
  if (report.build) {
    lines.push(`- Build directory: \`${report.build.buildDir}\``);
    lines.push(`- Build files scanned: ${report.build.scannedFiles}`);
    lines.push(`- Build files with hits: ${report.build.filesWithHits}`);
    lines.push(`- Total build hits: ${report.build.totalHits}`);
  } else {
    lines.push('- Build directory: (not scanned this run)');
  }
  lines.push(`- Errors: **${report.errors.length}**`);
  lines.push('');
  lines.push('## Source hits by file');
  lines.push('');
  if (report.source.files.length === 0) {
    lines.push('_No customer-fixture tokens in operational source. Zero-hit is the steady state._');
  } else {
    lines.push('| File | Hits | Classification | Reason |');
    lines.push('|------|-----:|----------------|--------|');
    for (const f of report.source.files) {
      const flag = f.overMaxHits ? ' ⚠️ over max' : '';
      lines.push(`| \`${f.file}\` | ${f.hits}${flag} | ${f.classification} | ${escapeMd(f.reason)} |`);
    }
  }
  if (report.errors.length) {
    lines.push('');
    lines.push('## Errors');
    lines.push('');
    for (const err of report.errors) {
      lines.push(`- ${err}`);
    }
  } else {
    lines.push('');
    lines.push('## Errors');
    lines.push('');
    lines.push('_None. Every customer-fixture reference in operational source is covered by the hardcoded audit-trail permit._');
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(
    'Generated by `tooling/reality/operational-build-scan.ts` (Task E — allowlist retirement). ' +
    'Enforced by `pnpm reality:build-scan`. Design: ' +
    '`docs/union-eyes/reality-remediation/20_OPERATIONAL_BUILD_DEMO_SCAN.md`.',
  );
  return lines.join('\n');
}

function escapeMd(s: string): string {
  // Escape backslashes first, then pipes, so an input containing `\` cannot
  // break out of the markdown table cell (CodeQL js/incomplete-sanitization).
  return s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  let buildDir: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--build-dir' && i + 1 < argv.length) {
      buildDir = argv[i + 1];
      i += 1;
    } else if (a.startsWith('--build-dir=')) {
      buildDir = a.slice('--build-dir='.length);
    } else if (a === '--help' || a === '-h') {
      // eslint-disable-next-line no-console
      console.log(
        'Usage: tsx tooling/reality/operational-build-scan.ts [--build-dir <path>]\n' +
        '\n' +
        '  --build-dir <path>   Optional. Also count customer-fixture hits under this\n' +
        '                       directory (typically `apps/union-eyes/.next`).\n' +
        '                       Requires ripgrep on PATH.',
      );
      process.exit(0);
    }
  }
  const here = fileURLToPath(new URL('.', import.meta.url));
  const root = resolve(here, '..', '..');

  const patternSrc = CUSTOMER_FIXTURE_PATTERNS.join('|');

  const { files, hits } = await scanSource(root, patternSrc);
  const { files: perFile, errors: enforceErrors } = enforce(hits);

  let buildSummary: BuildScanSummary | null = null;
  const buildErrors: string[] = [];
  if (buildDir) {
    const absBuild = resolve(root, buildDir);
    const s = await stat(absBuild).catch(() => null);
    if (!s || !s.isDirectory()) {
      buildErrors.push(`[operational-build-scan] --build-dir ${buildDir} does not exist or is not a directory.`);
    } else {
      try {
        buildSummary = await scanBuildDir(absBuild, patternSrc);
      } catch (err) {
        buildErrors.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  const filesWithHits = new Set(hits.map((h) => h.file)).size;
  const report: ScanReport = {
    generatedAt: new Date().toISOString(),
    workspace: root.split(sep).join('/'),
    patterns: CUSTOMER_FIXTURE_PATTERNS,
    policy: 'hardcoded-audit-trail-permit',
    source: {
      scannedFiles: files.length,
      filesWithHits,
      totalHits: hits.length,
      files: perFile,
    },
    build: buildSummary,
    // Note: buildErrors are surfaced in the report but do NOT contribute
    // to the process exit code — build-dir presence/absence is an
    // operator concern, not a policy violation.
    errors: enforceErrors,
  };

  await mkdir(resolve(root, 'reports'), { recursive: true });
  await writeFile(resolve(root, REPORT_JSON_PATH), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(resolve(root, REPORT_MD_PATH), `${renderMarkdown(report)}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(
    `[operational-build-scan] source: ${filesWithHits} file(s) with hits / ${hits.length} total hits; ` +
    `build: ${buildSummary ? `${buildSummary.filesWithHits} file(s) / ${buildSummary.totalHits} hits` : 'not scanned'}; ` +
    `errors: ${report.errors.length}. ` +
    `Wrote ${REPORT_JSON_PATH}, ${REPORT_MD_PATH}.`,
  );

  if (buildErrors.length > 0) {
    for (const e of buildErrors) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
    // Build-dir problems are informational — do not fail the run.
  }

  if (report.errors.length > 0) {
    for (const e of report.errors) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('operational-build-scan.ts')) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[operational-build-scan] fatal:', err);
    process.exit(2);
  });
}
