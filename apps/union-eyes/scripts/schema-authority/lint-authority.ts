/**
 * schema:authority:lint — bounded schema-authority linter (Phase D/E).
 *
 * Validates (this tranche only — NOT the full repo-wide historical baseline):
 *   1. registry JSON structural schema
 *   2. exactly one owner per registered table; no UNKNOWN/SHARED/DUAL owner;
 *      computed UNOWNED/DUAL invariants are 0
 *   3. runtime-required contract references only registered tables
 *   4. runtime-required manifest acceptance (Step 3):
 *        UNKNOWN_REQUIRED_CONTRACT_ENTRIES = 0
 *        DUPLICATE_REQUIRED_CONTRACT_ENTRIES = 0
 *        REQUIRED_ENTRY_WITHOUT_OWNER = 0
 *      + every entry has table/column/owner/usage/source evidence
 *   5. drift-disposition entries are unique
 *   6. best-effort scan of NEW working-tree changes for prohibited patterns
 *      (ALTER TABLE on a Django-owned table outside Django migrations;
 *       new align/repair script targeting a canonical entity)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_ROOT,
  key,
  loadDispositions,
  loadRegistry,
  loadRequiredContract,
  type Registry,
} from './lib/contracts';

const VALID_OWNERS = new Set(['DJANGO_CANONICAL', 'DRIZZLE_SCOPED', 'PLATFORM_AUTH', 'EXTERNAL_READONLY']);
const VALID_USAGE = new Set([
  'DIRECTLY_CONSUMED',
  'AUTHORITY_SEMANTIC',
  'WRITE_REQUIRED',
  'FILTER_REQUIRED',
  'JOIN_REQUIRED',
  'ORDER_REQUIRED',
]);
const REPO_ROOT = path.resolve(APP_ROOT, '..', '..');

export interface LintResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  metrics: Record<string, number | string>;
}

export interface LintInputs {
  registry?: Registry;
  contract?: ReturnType<typeof loadRequiredContract>;
  dispositions?: ReturnType<typeof loadDispositions>;
  skipScan?: boolean;
}

function validateRegistryStructure(registry: unknown, errors: string[]): registry is Registry {
  const r = registry as Registry;
  if (!r || typeof r !== 'object') {
    errors.push('registry: not an object');
    return false;
  }
  if (typeof r.version !== 'number') errors.push('registry: missing/invalid version');
  if (!Array.isArray(r.tables)) {
    errors.push('registry: tables must be an array');
    return false;
  }
  if (!r.computed || typeof r.computed !== 'object') errors.push('registry: missing computed block');
  r.tables.forEach((t, i) => {
    if (!t.table || typeof t.table !== 'string') errors.push(`registry.tables[${i}]: missing table`);
    if (!t.owner || !VALID_OWNERS.has(t.owner)) {
      errors.push(`registry.tables[${i}] (${t.table}): invalid owner "${t.owner}" (UNKNOWN/SHARED/DUAL owners are prohibited)`);
    }
  });
  return true;
}

export function lint(inputs: LintInputs = {}): LintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metrics: Record<string, number | string> = {};

  const registry = inputs.registry ?? loadRegistry();
  validateRegistryStructure(registry, errors);

  // One owner per registered table (no duplicate table declarations).
  const tableOwner = new Map<string, string>();
  for (const t of registry.tables) {
    if (tableOwner.has(t.table)) {
      errors.push(`registry: table "${t.table}" declared more than once (dual ownership risk)`);
    } else {
      tableOwner.set(t.table, t.owner);
    }
  }
  metrics.REGISTERED_TABLES = tableOwner.size;

  // Registry computed invariants.
  const computed = (registry.computed ?? {}) as Record<string, unknown>;
  const unowned = Number(computed.UNOWNED_REQUIRED_TABLES ?? -1);
  const dual = Number(computed.DUAL_OWNED_REQUIRED_TABLES ?? -1);
  metrics.UNOWNED_REQUIRED_TABLES = unowned;
  metrics.DUAL_OWNED_REQUIRED_TABLES = dual;
  if (unowned !== 0) errors.push(`registry.computed.UNOWNED_REQUIRED_TABLES = ${unowned} (must be 0)`);
  if (dual !== 0) errors.push(`registry.computed.DUAL_OWNED_REQUIRED_TABLES = ${dual} (must be 0)`);

  // Runtime-required manifest acceptance (Step 3).
  const contract = inputs.contract ?? loadRequiredContract();
  let unknownEntries = 0;
  let withoutOwner = 0;
  let withoutEvidence = 0;
  const seen = new Set<string>();
  let duplicates = 0;
  for (const e of contract.entries) {
    if (!e.table || !tableOwner.has(e.table)) unknownEntries += 1;
    if (!e.owner || !VALID_OWNERS.has(e.owner)) withoutOwner += 1;
    if (!e.usage || !VALID_USAGE.has(e.usage)) errors.push(`required contract: entry ${key(e.schema, e.table, e.column)} has invalid usage "${e.usage}"`);
    const hasEvidence = Array.isArray(e.source_paths) && e.source_paths.length > 0;
    if (!hasEvidence) withoutEvidence += 1;
    const k = key(e.schema, e.table, e.column);
    if (seen.has(k)) duplicates += 1;
    else seen.add(k);
    // Owner must match registry owner for that table.
    const regOwner = tableOwner.get(e.table);
    if (regOwner && regOwner !== e.owner) {
      errors.push(`required contract: entry ${k} owner "${e.owner}" != registry owner "${regOwner}"`);
    }
  }
  metrics.RUNTIME_REQUIRED_COLUMNS = contract.entries.length;
  metrics.RUNTIME_REQUIRED_TABLES = new Set(contract.entries.map((e) => e.table)).size;
  metrics.UNKNOWN_REQUIRED_CONTRACT_ENTRIES = unknownEntries;
  metrics.DUPLICATE_REQUIRED_CONTRACT_ENTRIES = duplicates;
  metrics.REQUIRED_ENTRY_WITHOUT_OWNER = withoutOwner;
  metrics.REQUIRED_ENTRY_WITHOUT_EVIDENCE = withoutEvidence;
  if (unknownEntries !== 0) errors.push(`UNKNOWN_REQUIRED_CONTRACT_ENTRIES = ${unknownEntries} (must be 0)`);
  if (duplicates !== 0) errors.push(`DUPLICATE_REQUIRED_CONTRACT_ENTRIES = ${duplicates} (must be 0)`);
  if (withoutOwner !== 0) errors.push(`REQUIRED_ENTRY_WITHOUT_OWNER = ${withoutOwner} (must be 0)`);
  if (withoutEvidence !== 0) errors.push(`REQUIRED_ENTRY_WITHOUT_EVIDENCE = ${withoutEvidence} (every physical-required field needs source evidence)`);

  // Drift-disposition uniqueness.
  const dispositions = inputs.dispositions ?? loadDispositions();
  const dseen = new Set<string>();
  let ddup = 0;
  for (const d of dispositions.dispositions) {
    const k = key(d.schema, d.table, d.column);
    if (dseen.has(k)) {
      ddup += 1;
      errors.push(`dispositions: duplicate entry ${k}`);
    } else dseen.add(k);
  }
  metrics.DISPOSITION_ENTRIES = dispositions.dispositions.length;
  metrics.DUPLICATE_DISPOSITION_ENTRIES = ddup;

  // Bounded prohibited-pattern scan on NEW working-tree changes.
  if (inputs.skipScan) {
    metrics.PROHIBITED_PATTERN_SCAN = 'SKIPPED';
  } else {
    try {
      scanProhibitedPatterns(tableOwner, errors, warnings, metrics);
    } catch (err) {
      metrics.PROHIBITED_PATTERN_SCAN = 'SKIPPED';
      warnings.push(`prohibited-pattern scan skipped: ${(err as Error).message}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, metrics };
}

function git(args: string[]): string {
  return execFileSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function scanProhibitedPatterns(
  tableOwner: Map<string, string>,
  errors: string[],
  warnings: string[],
  metrics: Record<string, number | string>,
): void {
  const djangoTables = [...tableOwner.entries()].filter(([, o]) => o === 'DJANGO_CANONICAL').map(([t]) => t);
  const djangoAlter = new RegExp(
    `alter\\s+table\\s+(?:only\\s+)?(?:"?public"?\\.)?"?(${djangoTables.join('|')})"?`,
    'i',
  );

  // Collected "added" content: untracked (whole file) + tracked added diff lines.
  const scanUnits: Array<{ file: string; line: string }> = [];

  const status = git(['status', '--porcelain', '--', 'apps/union-eyes']).split('\n').filter(Boolean);
  const untracked: string[] = [];
  for (const s of status) {
    const code = s.slice(0, 2);
    const file = s.slice(3).trim();
    if (code.includes('?')) untracked.push(file);
  }
  for (const rel of untracked) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
    if (!/\.(ts|mjs|js|sql)$/.test(rel)) continue;
    for (const line of fs.readFileSync(abs, 'utf8').split('\n')) scanUnits.push({ file: rel, line });
  }

  // Tracked modifications: added lines only.
  const diff = git(['diff', 'HEAD', '--unified=0', '--', 'apps/union-eyes']);
  let curFile = '';
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ b/')) curFile = raw.slice(6).trim();
    else if (raw.startsWith('+') && !raw.startsWith('+++')) scanUnits.push({ file: curFile, line: raw.slice(1) });
  }

  let alterViolations = 0;
  for (const { file, line } of scanUnits) {
    if (/[\\/]migrations[\\/]/.test(file)) continue; // Django migrations are the legitimate place.
    if (djangoTables.length && djangoAlter.test(line)) {
      alterViolations += 1;
      errors.push(`prohibited: ALTER TABLE on Django-owned table outside Django migrations in ${file}: ${line.trim().slice(0, 120)}`);
    }
  }

  // New align/repair scripts targeting a canonical entity.
  let alignRepair = 0;
  for (const rel of untracked) {
    const base = path.basename(rel).toLowerCase();
    if (!/(align|repair)/.test(base)) continue;
    if (!/\.(ts|mjs|js)$/.test(rel)) continue;
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, 'utf8').toLowerCase();
    if (djangoTables.some((t) => content.includes(t))) {
      alignRepair += 1;
      errors.push(`prohibited: new align/repair script targeting a canonical entity: ${rel}`);
    }
  }

  metrics.PROHIBITED_ALTER_VIOLATIONS = alterViolations;
  metrics.PROHIBITED_ALIGN_REPAIR_SCRIPTS = alignRepair;
  metrics.PROHIBITED_PATTERN_SCAN = 'RAN';
  if (alterViolations === 0 && alignRepair === 0) warnings.push('prohibited-pattern scan: clean');
}

function main(): void {
  const result = lint();
  const wantJson = process.argv.includes('--json');
  if (wantJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    for (const [k, v] of Object.entries(result.metrics)) process.stdout.write(`${k} = ${v}\n`);
    for (const w of result.warnings) process.stdout.write(`[warn] ${w}\n`);
    for (const e of result.errors) process.stderr.write(`[error] ${e}\n`);
    process.stdout.write(`SCHEMA_AUTHORITY_LINT = ${result.ok ? 'PASS' : 'FAIL'}\n`);
  }
  process.exit(result.ok ? 0 : 1);
}

const invokedDirectly = process.argv[1] && process.argv[1].includes('lint-authority');
if (invokedDirectly) main();
