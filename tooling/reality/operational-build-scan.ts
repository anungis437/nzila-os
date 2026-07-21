/**
 * Operational-Build Demo-Content Scanner
 *
 * Wave 0 §8 of the Union Eyes Reality & World-Class Remediation
 * Programme.
 *
 * PROBLEM
 * -------
 * `apps/union-eyes/` is compiled as a single Next.js application.
 * The demo-profile assets (CUPE Local 4373 personas, navigation lists,
 * mock document titles, demo-only components) are bundled into the
 * same output as the operational build and gated at *runtime* by
 * `isCupe4373DemoRuntime()`, which evaluates to `false` unless one of
 * the four demo-profile environment variables is set.
 *
 * Build-time isolation (i.e. eliminating the demo dead-code from the
 * operational bundle) is Wave 5+ work and is registered under
 * capability `UE-BUILD-OPERATIONAL-ISOLATION` in
 * `apps/union-eyes/lib/reality/capability-registry.ts`.
 *
 * GOAL
 * ----
 * Prevent silent growth of demo-content bleed while build-time
 * isolation is pending:
 *
 *   1. Scan every operational source file under `apps/union-eyes/`
 *      (git-tracked, tests/fixtures/reports excluded) for the
 *      four demo-identifier patterns:
 *
 *          cupe4373
 *          CUPE 4373
 *          CUPE Local 4373
 *          CUPE4373_
 *
 *   2. Each hit file MUST appear in
 *      `tooling/reality/operational-build-demo-allowlist.json`
 *      with a `classification` (see allowlist docs) and a `reason`.
 *      An unallowlisted hit is a HARD FAILURE.
 *
 *   3. Emit machine-readable `reports/operational-build-demo-scan.json`
 *      + human-readable `.md` recording every hit and its classification.
 *
 *   4. Optionally (when `--build-dir=<path>` is passed) scan the built
 *      output for the same patterns and record a summary. Bundle hits
 *      are INFORMATIONAL only — they cannot ever be zero while build
 *      isolation is pending, so the source-side gate is authoritative.
 *
 * DESIGN
 * ------
 * - Deterministic ordering; JSON is sorted; both outputs stable.
 * - Fail-closed: unallowlisted source hits → non-zero exit.
 * - Uses `git ls-files apps/union-eyes` for source discovery, falling
 *   back to a filesystem walk if git isn't available.
 * - Uses ripgrep (`rg`) if present for build-dir scans; falls back to
 *   node file walk. Ripgrep is dramatically faster on the 20k+ files
 *   that Next.js emits under `.next/`.
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Classification =
  | 'env-schema'            // Zod enum / type discriminant enumerating the demo token literally.
  | 'runtime-detector'      // Runtime code that must match the string to detect the demo profile.
  | 'demo-component'        // Component/module whose contents ARE the demo UX; imported by the operational bundle but gated at render.
  | 'gated-render'          // Production surface that references demo strings inside an isCupe4373Demo… branch.
  | 'registry-evidence'     // capability-registry.ts entry text.
  | 'code-comment'          // Only a code comment mentions the demo token.
  | 'build-config'          // Infra/CI files that reference the profile (Bicep, Docker, package.json scripts). Not shipped in the bundle.
  | 'report-artifact'       // Auto-generated report under `reports/` that names the profile.
  | 'test-fixture';         // Test/spec/fixtures.

export interface AllowlistEntry {
  file: string;               // Path relative to workspace root.
  classification: Classification;
  reason: string;
  /** Maximum hits allowed in this file. Prevents silent bloat within an allowlisted file. */
  maxHits: number;
  /** Optional target wave for eventual removal (undefined = permanent). */
  targetWave?: number;
}

export interface AllowlistFile {
  version: number;
  updated: string;
  patterns: readonly string[];
  entries: readonly AllowlistEntry[];
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
  classification: Classification | 'UNALLOWLISTED';
  reason: string;
  targetWave?: number;
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
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_PATTERN =
  'cupe\\s*[-_]?\\s*4373|cupe\\s*local\\s*4373|CUPE4373_';

const ALLOWLIST_PATH = 'tooling/reality/operational-build-demo-allowlist.json';
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
    // Fallback: walk the filesystem (rare — git should be available).
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
 * Return true for paths that are not bundled into the Next.js
 * operational build output (tests, specs, mocks, fixtures, snapshots,
 * scripts, top-level dump directories). Tests naturally reference the
 * demo tokens; excluding them keeps the allowlist scoped to genuine
 * bundle content.
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
  // Root-only markers: reports/ and artifacts/ must match at the very
  // start of the relative path.
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
  // Count matches per file, then aggregate.
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
    // Format: <path>:<count>
    const idx = line.lastIndexOf(':');
    if (idx < 0) continue;
    const count = Number.parseInt(line.slice(idx + 1), 10);
    if (Number.isFinite(count) && count > 0) {
      filesWithHits += 1;
      totalHits += count;
    }
  }
  // Count total scannable files with a second `rg --files`.
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
// Allowlist enforcement
// ---------------------------------------------------------------------------

async function loadAllowlist(root: string): Promise<AllowlistFile> {
  const path = resolve(root, ALLOWLIST_PATH);
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as AllowlistFile;
}

function enforce(
  hits: readonly SourceHit[],
  allowlist: AllowlistFile,
): {
  files: FileSummary[];
  errors: string[];
} {
  const byFile = new Map<string, SourceHit[]>();
  for (const h of hits) {
    const list = byFile.get(h.file) ?? [];
    list.push(h);
    byFile.set(h.file, list);
  }
  const entryByFile = new Map<string, AllowlistEntry>();
  for (const e of allowlist.entries) {
    entryByFile.set(e.file, e);
  }
  const summaries: FileSummary[] = [];
  const errors: string[] = [];
  for (const [file, fhits] of [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const entry = entryByFile.get(file);
    if (!entry) {
      summaries.push({
        file,
        hits: fhits.length,
        classification: 'UNALLOWLISTED',
        reason: '(not in allowlist)',
      });
      errors.push(
        `[operational-build-scan] Unallowlisted demo-identifier reference in operational source: ` +
        `${file} (${fhits.length} hit(s)). Add an entry to ${ALLOWLIST_PATH} with a classification and reason, or remove the reference.`,
      );
      continue;
    }
    const over = fhits.length > entry.maxHits;
    summaries.push({
      file,
      hits: fhits.length,
      classification: entry.classification,
      reason: entry.reason,
      targetWave: entry.targetWave,
      overMaxHits: over || undefined,
      allowedMaxHits: entry.maxHits,
    });
    if (over) {
      errors.push(
        `[operational-build-scan] ${file}: ${fhits.length} hit(s) exceeds allowlisted maxHits=${entry.maxHits}. ` +
        `Reduce the number of demo references or raise the ceiling in ${ALLOWLIST_PATH}.`,
      );
    }
  }
  // Also detect allowlist entries with zero real hits (dead allowlist rows).
  for (const e of allowlist.entries) {
    if (!byFile.has(e.file)) {
      errors.push(
        `[operational-build-scan] Allowlist entry ${e.file} has zero hits in source — remove the stale entry from ${ALLOWLIST_PATH}.`,
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
  lines.push('# Operational Build Demo-Content Scan (Wave 0 §8)');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Patterns: ${report.patterns.join(', ')}`);
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
  lines.push('| File | Hits | Classification | Reason | Target wave |');
  lines.push('|------|-----:|----------------|--------|:-----------:|');
  for (const f of report.source.files) {
    const wave = f.targetWave === undefined ? '—' : String(f.targetWave);
    const flag = f.overMaxHits ? ' ⚠️ over max' : '';
    lines.push(`| \`${f.file}\` | ${f.hits}${flag} | ${f.classification} | ${escapeMd(f.reason)} | ${wave} |`);
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
    lines.push('_None. Every demo-identifier reference in operational source is allowlisted with a classification and reason._');
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(
    'This report is generated by `tooling/reality/operational-build-scan.ts` and enforced by the ' +
    '`pnpm reality:build-scan` script. See `docs/union-eyes/reality-remediation/20_OPERATIONAL_BUILD_DEMO_SCAN.md`.',
  );
  return lines.join('\n');
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, '\\|');
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
        '  --build-dir <path>   Optional. Also count demo-identifier hits under this\n' +
        '                       directory (typically `apps/union-eyes/.next`).\n' +
        '                       Requires ripgrep on PATH.',
      );
      process.exit(0);
    }
  }
  const here = fileURLToPath(new URL('.', import.meta.url));
  const root = resolve(here, '..', '..');

  const allowlist = await loadAllowlist(root);
  const patterns = allowlist.patterns.length > 0 ? allowlist.patterns : [DEFAULT_PATTERN];
  const patternSrc = patterns.join('|');

  const { files, hits } = await scanSource(root, patternSrc);
  const { files: perFile, errors: enforceErrors } = enforce(hits, allowlist);

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
    patterns,
    source: {
      scannedFiles: files.length,
      filesWithHits,
      totalHits: hits.length,
      files: perFile,
    },
    build: buildSummary,
    errors: [...enforceErrors, ...buildErrors],
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
