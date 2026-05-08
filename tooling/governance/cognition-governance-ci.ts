#!/usr/bin/env node
/**
 * Cognition Governance CI
 *
 * Repo-wide explainability + ontology governance enforcement. Walks
 * union-eyes cognition surfaces (lib + app/api) and:
 *
 *   1. forbids forbidden labor/surveillance vocabulary in production code
 *      (comments and JSDoc are excluded; anti-surveillance disclaimers in
 *      negated context are excluded; per-line/per-file allow pragmas honored)
 *   2. forbids redeclaration of canonical cognition types
 *   3. requires every API route under app/api/exit-interviews/ to flow
 *      through cognitionRoute() or use withApi + the kernel
 *
 * Pragmas:
 *   // cognition-governance-ci: allow-vocabulary       (per-line)
 *   // cognition-governance-ci: file-allow-vocabulary  (per-file, place near top)
 *
 * Exits non-zero on any violation. Designed to run in CI.
 *
 * Usage: pnpm tsx tooling/governance/cognition-governance-ci.ts
 *        [--app=apps/union-eyes] [--quiet]
 */

import { readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { FORBIDDEN_LABOR_VOCABULARY } from '../../packages/institutional-cognition-core/src/ontology-governance/index.js';
import { validateDeepSemantics } from '../../packages/institutional-cognition-core/src/ontology-governance/deep-semantics.js';

interface Violation {
  code:
    | 'forbidden_vocabulary'
    | 'redeclared_envelope'
    | 'redeclared_domain'
    | 'route_bypass'
    | 'ontology_lifecycle';
  file: string;
  line?: number;
  message: string;
}

const args = process.argv.slice(2);
const appArg = args.find((a) => a.startsWith('--app='));
const APP_ROOT = resolve(process.cwd(), appArg ? appArg.replace('--app=', '') : 'apps/union-eyes');
const QUIET = args.includes('--quiet');
const SCAN_DIRS = ['lib', 'components', 'app'];
const SKIP_FRAGMENTS = [
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'tooling/governance/cognition-governance-ci',
  'packages/institutional-cognition-core/src/ontology-governance',
];

const ALLOW_LINE_PRAGMA = 'cognition-governance-ci: allow-vocabulary';
const ALLOW_FILE_PRAGMA = 'cognition-governance-ci: file-allow-vocabulary';
const ALLOW_ROUTE_BYPASS_PRAGMA = 'cognition-governance-ci: allow-route-bypass';

const violations: Violation[] = [];

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (SKIP_FRAGMENTS.some((s) => full.includes(s))) continue;
    if (e.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (e.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      out.push(full);
    }
  }
  return out;
}

interface ProcessedLine {
  cleaned: string;
  raw: string;
}

function stripComments(source: string): ProcessedLine[] {
  const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const cleanedLines = noBlock.split('\n');
  const rawLines = source.split('\n');
  return cleanedLines.map((cleanedLine, i) => {
    const raw = rawLines[i] ?? '';
    const lineCommentIdx = cleanedLine.indexOf('//');
    const cleaned = lineCommentIdx >= 0 ? cleanedLine.slice(0, lineCommentIdx) : cleanedLine;
    return { cleaned, raw };
  });
}

const NEGATION_MARKERS = [
  'no ',
  'not ',
  'never',
  'anti-',
  'anti ',
  'without ',
  "isn't",
  "aren't",
  "won't",
  "doesn't",
  'free of ',
  'free from ',
  'rejects',
  'rejected',
  'forbidden',
  'forbids',
  'prohibits',
  'prohibited',
  'prevent',
  'prevents',
  'prevented',
  'avoid',
  'avoids',
  'avoided',
  'opposes',
  'opposed to',
  'eliminates',
  'eliminated',
  'beyond ',
  'cannot',
  'do not',
];

function isInNegatedContext(lower: string, termIdx: number): boolean {
  const window = lower.slice(Math.max(0, termIdx - 80), termIdx);
  return NEGATION_MARKERS.some((m) => window.includes(m));
}

function checkForbiddenVocabulary(file: string, processed: ProcessedLine[]): void {
  const fileBlob = processed.map((p) => p.raw).join('\n');
  if (fileBlob.includes(ALLOW_FILE_PRAGMA)) return;
  for (let i = 0; i < processed.length; i += 1) {
    const { cleaned, raw } = processed[i]!;
    if (raw.includes(ALLOW_LINE_PRAGMA)) continue;
    const lower = cleaned.toLowerCase();
    for (const term of FORBIDDEN_LABOR_VOCABULARY) {
      const idx = lower.indexOf(term);
      if (idx === -1) continue;
      if (isInNegatedContext(lower, idx)) continue;
      violations.push({
        code: 'forbidden_vocabulary',
        file,
        line: i + 1,
        message: `Forbidden labor/surveillance vocabulary "${term}" found.`,
      });
    }
  }
}

const ENVELOPE_REDECLARE_RE =
  /^\s*(export\s+)?(interface|type)\s+InstitutionalExplainabilityEnvelope\b[^,]/m;
const DOMAIN_REDECLARE_RE = /^\s*(export\s+)?(type|enum)\s+CognitionDomain\b[^,]/m;

function checkRedeclarations(file: string, source: string): void {
  if (file.includes('packages/institutional-cognition-core')) return;
  if (ENVELOPE_REDECLARE_RE.test(source)) {
    violations.push({
      code: 'redeclared_envelope',
      file,
      message:
        'Redeclares InstitutionalExplainabilityEnvelope. Import from @nzila/institutional-cognition-core.',
    });
  }
  if (DOMAIN_REDECLARE_RE.test(source)) {
    violations.push({
      code: 'redeclared_domain',
      file,
      message: 'Redeclares CognitionDomain. Import from @nzila/institutional-cognition-core.',
    });
  }
}

function checkExitInterviewRoute(file: string, source: string): void {
  const norm = file.replace(/\\/g, '/');
  if (!norm.includes('/api/exit-interviews/')) return;
  if (norm.endsWith('institutional-cognition/route.ts')) return;
  if (norm.endsWith('institutional-narratives/route.ts')) return;
  if (source.includes(ALLOW_ROUTE_BYPASS_PRAGMA)) return;
  const usesKernel =
    source.includes('cognitionRoute(') ||
    source.includes("from '@/lib/institutional-operating-intelligence'") ||
    source.includes("from '@nzila/institutional-cognition-core'");
  if (!usesKernel) {
    violations.push({
      code: 'route_bypass',
      file,
      message:
        'Cognition route bypasses the kernel. Use cognitionRoute() or import from @/lib/institutional-operating-intelligence.',
    });
  }
}

async function main(): Promise<void> {
  if (!safeStat(APP_ROOT)) {
    console.error(`[cognition-governance-ci] target not found: ${APP_ROOT}`);
    process.exit(2);
  }
  const files: string[] = [];
  for (const sub of SCAN_DIRS) {
    files.push(...(await walk(join(APP_ROOT, sub))));
  }
  for (const f of files) {
    let source: string;
    try {
      source = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const processed = stripComments(source);
    checkForbiddenVocabulary(f, processed);
    checkRedeclarations(f, source);
    checkExitInterviewRoute(f, source);
  }

  // Ontology lifecycle integrity — deep semantics registry.
  const semanticReport = validateDeepSemantics();
  if (!semanticReport.ok) {
    for (const issue of semanticReport.issues) {
      violations.push({
        code: 'ontology_lifecycle',
        file: 'packages/institutional-cognition-core/src/ontology-governance/deep-semantics.ts',
        message: `[${issue.code}] ${issue.nodeId}: ${issue.message}`,
      });
    }
  }

  if (!QUIET) {
    console.log(
      `[cognition-governance-ci] scanned ${files.length} files under ${relative(process.cwd(), APP_ROOT)}`,
    );
  }

  if (violations.length === 0) {
    console.log('[cognition-governance-ci] OK — no governance violations detected.');
    process.exit(0);
  }
  console.error(`[cognition-governance-ci] FAILED — ${violations.length} violation(s):`);
  for (const v of violations) {
    const loc = v.line ? `:${v.line}` : '';
    console.error(`  [${v.code}] ${relative(process.cwd(), v.file)}${loc} — ${v.message}`);
  }
  process.exit(1);
}

function safeStat(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error('[cognition-governance-ci] fatal:', err);
  process.exit(2);
});
