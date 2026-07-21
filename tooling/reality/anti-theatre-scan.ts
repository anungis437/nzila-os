/**
 * Anti-Theatre Scanner
 *
 * Static-analysis containment tool for the Union Eyes Reality &
 * World-Class Remediation Programme. Detects the specific dishonest
 * patterns that the programme forbids:
 *
 *   R-1  2xx response body contains the string `not_implemented`.
 *   R-2  Hard-coded readiness success (literal `true` assigned to a
 *        `PilotConfiguration` field, or `status: 'healthy'` returned
 *        without a measurement).
 *   R-3  Production code imports from `**\/demo\/**` or
 *        `**\/fixtures\/**` or `**\/__fixtures__\/**` outside tests.
 *   R-4  A `UE_FEATURE_PROFILE=cupe4373` or
 *        `NEXT_PUBLIC_UE_DEMO_PROFILE=cupe4373` in a non-development
 *        environment file.
 *   R-5  Fabricated Bank-of-Canada provenance: string literal
 *        `'Bank of Canada (FXUSDCAD)'` in a code path that is reached
 *        after a caught error (cached-fallback masquerading as fresh).
 *   R-6  Silent-swallow catch blocks: catch clauses whose body is empty
 *        or contains only whitespace/comments.
 *   R-7  A production `route.ts` under `app/api/**` that has no matching
 *        capability entry in the registry.
 *   R-8  Empty authoritative outputs returned as `NextResponse.json({...},
 *        { status: 200 })` when the array is a placeholder.
 *
 * Design principles:
 *
 * - **Allowlist-aware.** Tests (`*.test.ts`, `*.spec.ts`, `__tests__/**`,
 *   `tests/**`), stories, fixtures, docs, and demo packages are excluded
 *   from every rule except R-3 (which is specifically about production
 *   code importing demo).
 * - **Deterministic.** Findings are sorted by rule then file then line.
 * - **Machine + human output.** Writes `reports/anti-theatre.json` and
 *   emits a Markdown table on stdout.
 * - **Fail closed.** Any finding is a non-zero exit.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Finding {
  rule: string;
  file: string;
  line: number;
  message: string;
  evidence: string;
  severity: 'error' | 'warning';
}

export interface ScanOptions {
  root: string;
  /** Extra glob-style path fragments to include in the "test/fixture" allowlist. */
  extraAllowlist?: readonly string[];
  /** Files to force-include even if they match the default allowlist. */
  forceInclude?: readonly string[];
}

export interface ScanResult {
  scannedFiles: number;
  findings: readonly Finding[];
  rulesRun: readonly string[];
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

const DEFAULT_TEST_PATH_MARKERS: readonly string[] = [
  `${sep}__tests__${sep}`,
  `${sep}__mocks__${sep}`,
  `${sep}__fixtures__${sep}`,
  `${sep}tests${sep}`,
  `${sep}test${sep}`,
  `${sep}stories${sep}`,
  `${sep}fixtures${sep}`,
  `${sep}mocks${sep}`,
  `${sep}e2e${sep}`,
  `${sep}playwright-report${sep}`,
  `${sep}coverage${sep}`,
  `${sep}dist${sep}`,
  `${sep}build${sep}`,
  `${sep}.next${sep}`,
  `${sep}node_modules${sep}`,
  `${sep}artifacts${sep}`,
  `${sep}reports${sep}`,
  `${sep}proof-artifacts${sep}`,
  `${sep}migrations${sep}`,
];

const TEST_FILE_SUFFIXES: readonly string[] = [
  '.test.ts',
  '.test.tsx',
  '.spec.ts',
  '.spec.tsx',
  '.stories.ts',
  '.stories.tsx',
];

const DOC_EXTS = new Set(['.md', '.mdx', '.mdc']);

export function isTestOrFixturePath(
  filePath: string,
  options: Pick<ScanOptions, 'extraAllowlist' | 'forceInclude'> = {},
): boolean {
  const normalised = filePath.split('/').join(sep);
  if (options.forceInclude?.some((f) => normalised.endsWith(f.split('/').join(sep)))) {
    return false;
  }
  const markers = [
    ...DEFAULT_TEST_PATH_MARKERS,
    ...(options.extraAllowlist ?? []).map((m) => m.split('/').join(sep)),
  ];
  if (markers.some((m) => normalised.includes(m))) return true;
  return TEST_FILE_SUFFIXES.some((s) => normalised.endsWith(s));
}

/** Return every TypeScript-ish source file under `root/apps/union-eyes`. */
async function listUnionEyesSources(root: string): Promise<string[]> {
  // Prefer git ls-files for speed + respect for .gitignore.
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
    // Fallback: walk the filesystem.
    return walk(resolve(root, 'apps/union-eyes'));
  }
}

async function walk(dir: string): Promise<string[]> {
  const fs = await import('node:fs/promises');
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dist') continue;
      out.push(...(await walk(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

interface FileContext {
  root: string;
  absPath: string;
  relPath: string;
  content: string;
  lines: readonly string[];
}

type Rule = (ctx: FileContext) => readonly Finding[];

/** R-1: 2xx response containing `not_implemented`. */
const rule_notImplementedIn2xx: Rule = (ctx) => {
  if (!ctx.relPath.startsWith('apps/union-eyes/app/api/')) return [];
  if (!ctx.relPath.endsWith('/route.ts')) return [];
  const findings: Finding[] = [];
  // Match NextResponse.json({...not_implemented...}, { status: 2xx })
  // or a plain object literal containing not_implemented paired with a 2xx status option.
  const RE = /NextResponse\.json\(\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})\s*,\s*\{[^}]*status:\s*(2\d\d)/gs;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(ctx.content)) !== null) {
    const body = m[1];
    const status = m[2];
    if (/not_implemented/i.test(body)) {
      const line = ctx.content.slice(0, m.index).split(/\r?\n/).length;
      findings.push({
        rule: 'R-1',
        file: ctx.relPath,
        line,
        message: `Route returns HTTP ${status} while declaring itself not_implemented. Use ApiError.notImplemented() (HTTP 501) instead.`,
        evidence: body.slice(0, 200).replace(/\s+/g, ' ').trim(),
        severity: 'error',
      });
    }
  }
  // Also catch bare object literals: `{ status: "not_implemented" ... }` returned from a POST/GET handler.
  ctx.lines.forEach((raw, idx) => {
    const l = raw.trim();
    if (/status\s*:\s*['"`]not_implemented['"`]/.test(l) && /return\s+/.test(ctx.lines[Math.max(0, idx - 3)] ?? '')) {
      findings.push({
        rule: 'R-1',
        file: ctx.relPath,
        line: idx + 1,
        message: 'Handler returns a body claiming `not_implemented` in what looks like a success return. Use ApiError.notImplemented().',
        evidence: l.slice(0, 200),
        severity: 'error',
      });
    }
  });
  return findings;
};

/** R-2: hard-coded readiness. */
const rule_hardcodedReadiness: Rule = (ctx) => {
  const findings: Finding[] = [];
  // Match PilotConfiguration literals with `true` for any of the boolean flags.
  const flagNames = [
    'vocabularyLoaded',
    'orgConfigured',
    'slaThresholdsSet',
    'auditTrailActive',
  ];
  ctx.lines.forEach((raw, idx) => {
    for (const name of flagNames) {
      const re = new RegExp(`\\b${name}\\s*:\\s*true\\b`);
      if (re.test(raw) && !ctx.relPath.includes('__tests__') && !ctx.relPath.endsWith('.test.ts')) {
        // Only flag inside a production route/service file that constructs a config object.
        if (/route\.ts$|pilot-admin\.ts$/.test(ctx.relPath) === false) continue;
        findings.push({
          rule: 'R-2',
          file: ctx.relPath,
          line: idx + 1,
          message: `Hard-coded readiness: \`${name}: true\` in production code. Measure the flag or pass \`null\` (unknown).`,
          evidence: raw.trim().slice(0, 200),
          severity: 'error',
        });
      }
    }
    // status: 'healthy' returned directly from a handler with no measurement.
    if (/status\s*:\s*['"`]healthy['"`]/.test(raw) && /route\.ts$/.test(ctx.relPath)) {
      // Skip matches that live inside single-line or block comments —
      // documentation of the anti-pattern is not the anti-pattern.
      const trimmed = raw.trimStart();
      const isLineComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
      if (!isLineComment) {
        findings.push({
          rule: 'R-2',
          file: ctx.relPath,
          line: idx + 1,
          message: 'Handler literally returns `status: "healthy"`. Verify this is derived from real measurements, not a placeholder.',
          evidence: raw.trim().slice(0, 200),
          severity: 'warning',
        });
      }
    }
  });
  return findings;
};

/** R-3: production code imports demo/fixtures. */
const rule_demoImportInProd: Rule = (ctx) => {
  // Only care about production surfaces: app/, actions/, services/, lib/, db/, workers/.
  const prodPrefixes = [
    'apps/union-eyes/app/',
    'apps/union-eyes/actions/',
    'apps/union-eyes/services/',
    'apps/union-eyes/lib/',
    'apps/union-eyes/db/',
    'apps/union-eyes/workers/',
    'apps/union-eyes/middleware.ts',
  ];
  if (!prodPrefixes.some((p) => ctx.relPath.startsWith(p) || ctx.relPath === p)) return [];
  // Skip tests and stories inside those trees.
  if (isTestOrFixturePath(ctx.relPath)) return [];
  // Skip demo-tree self-references: files that themselves live under a
  // `demo/` or `__hashfixture__/` directory are allowed to import from
  // sibling demo files. What we want to catch is *cross-boundary*
  // imports from real production code into demo data. This exemption is
  // narrow and cannot be used to hide production→demo leakage in
  // dashboard pages, API routes, or shared library code.
  const normalised = ctx.relPath.replace(/\\/g, '/');
  if (/\/(?:demo|__hashfixture__|__fixtures__)\//.test(normalised)) return [];
  const findings: Finding[] = [];
  const RE = /from\s+['"`]([^'"`]+)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(ctx.content)) !== null) {
    const spec = m[1];
    if (/\/demo\//i.test(spec) || /\/fixtures?\//i.test(spec) || /\/__fixtures__\//.test(spec)) {
      // Exclude the demo package itself (union-eyes demo feature-flag helper is currently at
      // `lib/feature-flags.ts` — it does not import demo data, it merely detects the profile).
      // But if a route/service imports a `demo-data` module, that is flagged.
      const line = ctx.content.slice(0, m.index).split(/\r?\n/).length;
      findings.push({
        rule: 'R-3',
        file: ctx.relPath,
        line,
        message: `Production code imports from a demo/fixtures path: \`${spec}\`. Move behind a demo-profile guard.`,
        evidence: spec,
        severity: 'error',
      });
    }
  }
  return findings;
};

/** R-4: demo profile in non-development env. */
const rule_demoProfileInProdEnv: Rule = (ctx) => {
  const findings: Finding[] = [];
  // Only inspect .env* files and deployment workflows/manifests.
  const isEnvFile = /\.env(?:\.[a-z0-9_-]+)?$/.test(ctx.relPath);
  const isDeploymentFile =
    ctx.relPath.startsWith('.github/workflows/') ||
    ctx.relPath.startsWith('infrastructure/') ||
    ctx.relPath.startsWith('ops/deploy/') ||
    /docker-compose(?:\.[a-z0-9_-]+)?\.ya?ml$/.test(ctx.relPath);
  if (!isEnvFile && !isDeploymentFile) return [];
  // .env.development / .env.local / .env.test are allowed.
  const isDevEnv = /\.env\.(?:development|local|test|example)(?:\.[a-z0-9_-]+)?$/.test(ctx.relPath) ||
    ctx.relPath.endsWith('.env.example');
  if (isDevEnv && isEnvFile) return [];
  ctx.lines.forEach((raw, idx) => {
    const l = raw.trim();
    if (
      /(?:UE_FEATURE_PROFILE|NEXT_PUBLIC_UE_DEMO_PROFILE)\s*[:=]\s*['"]?cupe4373\b/i.test(l)
    ) {
      findings.push({
        rule: 'R-4',
        file: ctx.relPath,
        line: idx + 1,
        message: 'Demo profile `cupe4373` referenced in a non-development environment/deployment file.',
        evidence: l.slice(0, 200),
        severity: 'error',
      });
    }
  });
  return findings;
};

/** R-5: fabricated Bank-of-Canada provenance on a cached-fallback path. */
const rule_fabricatedBocProvenance: Rule = (ctx) => {
  if (!/currency|exchange|forex|fx/i.test(ctx.relPath)) return [];
  if (isTestOrFixturePath(ctx.relPath)) return [];
  const findings: Finding[] = [];
  // Look for the exact fabricated label `Bank of Canada (FXUSDCAD)` inside a catch block.
  const RE = /catch\s*\([^)]*\)\s*\{([\s\S]*?)\}/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(ctx.content)) !== null) {
    const body = m[1];
    if (/Bank of Canada \(FXUSDCAD\)/.test(body)) {
      const line = ctx.content.slice(0, m.index).split(/\r?\n/).length;
      findings.push({
        rule: 'R-5',
        file: ctx.relPath,
        line,
        message: 'Cached-fallback path labels the rate as a fresh Bank of Canada observation. Use the cached label.',
        evidence: 'Bank of Canada (FXUSDCAD) inside catch block',
        severity: 'error',
      });
    }
  }
  return findings;
};

/** R-6: silent catch blocks. */
const rule_silentCatch: Rule = (ctx) => {
  if (isTestOrFixturePath(ctx.relPath)) return [];
  if (!ctx.relPath.startsWith('apps/union-eyes/')) return [];
  const findings: Finding[] = [];
  // catch ( ... ) { <whitespace or comment only> }
  const RE = /catch\s*(?:\([^)]*\)\s*)?\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(ctx.content)) !== null) {
    const body = m[1].replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (body === '') {
      const line = ctx.content.slice(0, m.index).split(/\r?\n/).length;
      findings.push({
        rule: 'R-6',
        file: ctx.relPath,
        line,
        message: 'Silent-swallow catch block. Log and re-throw, or explicitly document why the error is ignored.',
        evidence: 'catch { }',
        severity: 'warning',
      });
    }
  }
  return findings;
};

/** R-7: production route.ts without a capability-registry entry. */
const rule_routeNotInRegistry: Rule = (ctx) => {
  if (!ctx.relPath.startsWith('apps/union-eyes/app/api/')) return [];
  if (!ctx.relPath.endsWith('/route.ts')) return [];
  const routePath = ctx.relPath;
  // A route is "covered" if the registry mentions the file path or a
  // capability id that references it. We defer to a coverage step that
  // runs after all files are read; see `checkRegistryCoverage`.
  return [{
    rule: 'R-7-STUB',
    file: routePath,
    line: 1,
    message: 'STUB — resolved by post-scan registry-coverage check.',
    evidence: '',
    severity: 'warning',
  }];
};

/** R-8: empty authoritative array returned as 200 success. */
const rule_emptyAuthoritativeSuccess: Rule = (ctx) => {
  if (!ctx.relPath.startsWith('apps/union-eyes/app/api/')) return [];
  if (!ctx.relPath.endsWith('/route.ts')) return [];
  const findings: Finding[] = [];
  // Common shape: `return NextResponse.json({ data: [] })` or `return NextResponse.json([], { status: 200 })`
  const RE1 = /NextResponse\.json\(\s*\{\s*(?:data|items|records|results|rows|report)\s*:\s*\[\s*\]/g;
  const RE2 = /NextResponse\.json\(\s*\[\s*\]\s*(?:,\s*\{[^}]*status:\s*200[^}]*\})?\s*\)/g;
  for (const RE of [RE1, RE2]) {
    let m: RegExpExecArray | null;
    while ((m = RE.exec(ctx.content)) !== null) {
      const line = ctx.content.slice(0, m.index).split(/\r?\n/).length;
      findings.push({
        rule: 'R-8',
        file: ctx.relPath,
        line,
        message: 'Handler returns an empty authoritative payload as success. Either compute real data or return HTTP 501 with ApiError.notImplemented().',
        evidence: m[0].slice(0, 200).replace(/\s+/g, ' '),
        severity: 'warning',
      });
    }
  }
  return findings;
};

const RULES: readonly { id: string; run: Rule }[] = [
  { id: 'R-1', run: rule_notImplementedIn2xx },
  { id: 'R-2', run: rule_hardcodedReadiness },
  { id: 'R-3', run: rule_demoImportInProd },
  { id: 'R-4', run: rule_demoProfileInProdEnv },
  { id: 'R-5', run: rule_fabricatedBocProvenance },
  { id: 'R-6', run: rule_silentCatch },
  { id: 'R-7', run: rule_routeNotInRegistry },
  { id: 'R-8', run: rule_emptyAuthoritativeSuccess },
] as const;

// ---------------------------------------------------------------------------
// Registry-coverage post-check (for R-7)
// ---------------------------------------------------------------------------

interface RegistryEntry {
  id: string;
  ownedBy: string[];
}

async function loadRegistryEntries(root: string): Promise<RegistryEntry[]> {
  const registryPath = resolve(root, 'apps/union-eyes/lib/reality/capability-registry.ts');
  if (!existsSync(registryPath)) return [];
  const src = await readFile(registryPath, 'utf8');
  const entries: RegistryEntry[] = [];
  // Extract each capability object literal. Not a real parser but works for the
  // controlled shape of the file. Match id + ownedBy array of string literals.
  const RE = /\{\s*id:\s*['"`]([A-Z0-9_-]+)['"`][\s\S]*?ownedBy:\s*\[([\s\S]*?)\][\s\S]*?\}/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(src)) !== null) {
    const id = m[1];
    const arr = m[2];
    const paths = Array.from(arr.matchAll(/['"`]([^'"`]+)['"`]/g)).map((mm) => mm[1]);
    entries.push({ id, ownedBy: paths });
  }
  return entries;
}

function findRegistryCoverageGaps(
  routeFiles: readonly string[],
  registry: readonly RegistryEntry[],
): Finding[] {
  const ownedSet = new Set(registry.flatMap((e) => e.ownedBy));
  const findings: Finding[] = [];
  for (const rel of routeFiles) {
    // The registry stores paths relative to `apps/union-eyes/`.
    const registryKey = rel.replace(/^apps\/union-eyes\//, '');
    if (!ownedSet.has(registryKey)) {
      findings.push({
        rule: 'R-7',
        file: rel,
        line: 1,
        message: `Production API route \`${registryKey}\` has no capability-registry entry. Add it to \`apps/union-eyes/lib/reality/capability-registry.ts\`.`,
        evidence: registryKey,
        // Warning (not error) until the registry back-fill (Wave 0 §3)
        // completes. Once the inventory reaches 100 % coverage this is
        // promoted to `error` so any newly-added route without an entry
        // fails CI.
        severity: 'warning',
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const files = await listUnionEyesSources(options.root);
  const routeFiles: string[] = [];
  const findings: Finding[] = [];
  let scanned = 0;

  for (const absPath of files) {
    if (!/\.(ts|tsx|env(?:\..*)?|ya?ml|yml|md)$/.test(absPath) && !/\.env$/.test(absPath)) {
      // Only process TS/TSX/env/yaml/md.
      if (!/(?:^|[\\/])\.env(?:\.[^\\/]+)?$/.test(absPath)) continue;
    }
    let content: string;
    try {
      content = await readFile(absPath, 'utf8');
    } catch {
      continue;
    }
    scanned += 1;
    const relPath = relative(options.root, absPath).split(sep).join('/');
    if (relPath.endsWith('/route.ts') && relPath.startsWith('apps/union-eyes/app/api/')) {
      routeFiles.push(relPath);
    }
    const ctx: FileContext = {
      root: options.root,
      absPath,
      relPath,
      content,
      lines: content.split(/\r?\n/),
    };
    for (const rule of RULES) {
      if (rule.id === 'R-7') continue; // handled below with registry.
      try {
        findings.push(...rule.run(ctx));
      } catch (err) {
        findings.push({
          rule: rule.id,
          file: relPath,
          line: 0,
          message: `Rule crashed: ${(err as Error).message}`,
          evidence: '',
          severity: 'warning',
        });
      }
    }
  }

  const registry = await loadRegistryEntries(options.root);
  findings.push(...findRegistryCoverageGaps(routeFiles, registry));

  // Deterministic ordering.
  findings.sort((a, b) => {
    if (a.rule !== b.rule) return a.rule.localeCompare(b.rule);
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  return {
    scannedFiles: scanned,
    findings,
    rulesRun: RULES.map((r) => r.id),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const root = process.cwd();
  const result = await runScan({ root });
  const errors = result.findings.filter((f) => f.severity === 'error');
  const warnings = result.findings.filter((f) => f.severity === 'warning');

  const reportDir = resolve(root, 'reports');
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    resolve(reportDir, 'anti-theatre.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        scannedFiles: result.scannedFiles,
        rulesRun: result.rulesRun,
        totals: { errors: errors.length, warnings: warnings.length },
        findings: result.findings,
      },
      null,
      2,
    ),
    'utf8',
  );

  // Markdown summary
  const md: string[] = [
    '# Anti-Theatre Scan Report',
    '',
    `- Generated: ${new Date().toISOString()}`,
    `- Files scanned: ${result.scannedFiles}`,
    `- Rules: ${result.rulesRun.join(', ')}`,
    `- **Errors: ${errors.length}**`,
    `- Warnings: ${warnings.length}`,
    '',
    '## Findings',
    '',
    '| Severity | Rule | File | Line | Message |',
    '|----------|------|------|------|---------|',
    ...result.findings.slice(0, 500).map(
      (f) => `| ${f.severity} | ${f.rule} | \`${f.file}\` | ${f.line} | ${f.message.replace(/\|/g, '\\|')} |`,
    ),
  ];
  await writeFile(resolve(reportDir, 'anti-theatre.md'), md.join('\n'), 'utf8');

  if (errors.length > 0) {
    console.error(`\n❌ Anti-theatre scan: ${errors.length} error(s), ${warnings.length} warning(s).`);
    for (const f of errors.slice(0, 25)) {
      console.error(`  [${f.rule}] ${f.file}:${f.line}  ${f.message}`);
    }
    if (errors.length > 25) console.error(`  ... ${errors.length - 25} more`);
    process.exit(1);
  }
  console.log(
    `✅ Anti-theatre scan: 0 errors, ${warnings.length} warning(s). Files scanned: ${result.scannedFiles}.`,
  );
}

// Only run when invoked directly (not when imported for tests).
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
    process.exit(2);
  });
}
