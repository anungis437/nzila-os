/**
 * schema:contract:verify — runtime-required contract verifier.
 *
 * Phase D/E. DB-free. Compares the checked-in runtime-required contract against
 * the generated canonical physical schema. It is CONTRACT-DRIVEN: it only ever
 * fails on entries the audit declared REQUIRED_NOW. A stale / incidental Drizzle
 * declaration that is physically absent can NEVER fail this verifier, because
 * the verifier never iterates ORM declarations — only the required contract.
 *
 * A contradiction guard refuses to run if any REQUIRED_NOW entry is also listed
 * in runtime-drift-dispositions.json (that would mean the audit disagrees with
 * itself).
 *
 * Usage:
 *   tsx verify-runtime-contract.ts [--canonical <file>] [--out <file>] [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { baseType, normalizeType, type CanonicalColumn, type CanonicalTable } from './lib/normalize';
import {
  CANONICAL_SCHEMA_PATH,
  key,
  loadCanonicalSchema,
  loadDispositions,
  loadRegistry,
  loadRequiredContract,
  type RequiredEntry,
} from './lib/contracts';

export interface VerifyResult {
  verdict: 'PASS' | 'FAIL';
  RUNTIME_REQUIRED_TABLES: number;
  RUNTIME_REQUIRED_COLUMNS: number;
  MISSING_RUNTIME_REQUIRED_TABLES: string[];
  MISSING_RUNTIME_REQUIRED_COLUMNS: string[];
  OWNER_MISMATCHES: Array<{ table: string; contractOwner: string; registryOwner: string }>;
  RLS_REQUIREMENT_MISMATCHES: string[];
  SEMANTIC_RUNTIME_TYPE_MISMATCHES: Array<{ column: string; required: string; actual: string }>;
  canonicalSchemaDigest: string;
}

const TEXT_FAMILY = new Set(['text', 'varchar', 'char', 'bpchar', 'citext']);
const INT_FAMILY = new Set(['int2', 'int4', 'int8', 'smallint', 'bigint']);
const NUM_FAMILY = new Set(['numeric', 'decimal']);

function typeCompatible(requiredRaw: string, actualRaw: string): boolean {
  const req = baseType(normalizeType(requiredRaw));
  const act = baseType(normalizeType(actualRaw));
  if (req === act) return true;
  if (TEXT_FAMILY.has(req) && TEXT_FAMILY.has(act)) return true;
  if (INT_FAMILY.has(req) && INT_FAMILY.has(act)) return true;
  if (NUM_FAMILY.has(req) && NUM_FAMILY.has(act)) return true;
  return false;
}

export function verify(options: {
  requiredContract: ReturnType<typeof loadRequiredContract>;
  dispositions: ReturnType<typeof loadDispositions>;
  registry: ReturnType<typeof loadRegistry>;
  canonical: ReturnType<typeof loadCanonicalSchema>;
}): VerifyResult {
  const { requiredContract, dispositions, registry, canonical } = options;

  // Canonical schema lookups.
  const tableMap = new Map<string, CanonicalTable>();
  const columnMap = new Map<string, CanonicalColumn>();
  for (const s of canonical.schemas) {
    for (const t of s.tables) {
      tableMap.set(key(s.schema, t.table), t);
      for (const c of t.columns) columnMap.set(key(s.schema, t.table, c.column), c);
    }
  }

  // Registry lookups (registry is public-schema, keyed by table name).
  const registryOwner = new Map<string, string>();
  const registryRls = new Map<string, boolean>();
  for (const rt of registry.tables) {
    registryOwner.set(rt.table, rt.owner);
    registryRls.set(rt.table, Boolean(rt.rlsRequired));
  }

  // Disposition set — column-level and table-level wildcard.
  const dispSet = new Set<string>();
  for (const d of dispositions.dispositions) {
    dispSet.add(key(d.schema, d.table, d.column));
    if (d.column === '*') dispSet.add(key(d.schema, d.table, '*'));
  }

  // Contradiction guard.
  const contradictions: string[] = [];
  for (const e of requiredContract.entries) {
    if (dispSet.has(key(e.schema, e.table, e.column)) || dispSet.has(key(e.schema, e.table, '*'))) {
      contradictions.push(key(e.schema, e.table, e.column));
    }
  }
  if (contradictions.length > 0) {
    throw new Error(
      `Contract contradiction: the following REQUIRED_NOW entries are also dispositioned as NOT required: ${contradictions.join(', ')}. ` +
        'Resolve the audit disagreement before verifying.',
    );
  }

  const missingTables = new Set<string>();
  const missingColumns: string[] = [];
  const ownerMismatches: VerifyResult['OWNER_MISMATCHES'] = [];
  const rlsMismatches = new Set<string>();
  const typeMismatches: VerifyResult['SEMANTIC_RUNTIME_TYPE_MISMATCHES'] = [];

  const requiredTables = new Set<string>();
  for (const e of requiredContract.entries) {
    requiredTables.add(key(e.schema, e.table));
    const tbl = tableMap.get(key(e.schema, e.table));

    if (!tbl) {
      missingTables.add(key(e.schema, e.table));
    } else {
      const col = columnMap.get(key(e.schema, e.table, e.column));
      if (!col) {
        missingColumns.push(key(e.schema, e.table, e.column));
      } else if (e.requiredType && !typeCompatible(e.requiredType, col.type)) {
        typeMismatches.push({ column: key(e.schema, e.table, e.column), required: e.requiredType, actual: col.type });
      }
      // RLS requirement (from registry) — only when the table physically exists.
      if (registryRls.get(e.table) === true && !tbl.rlsEnabled) {
        rlsMismatches.add(key(e.schema, e.table));
      }
    }

    // Owner authority: contract owner must match registry owner.
    const regOwner = registryOwner.get(e.table);
    if (regOwner && regOwner !== e.owner) {
      if (!ownerMismatches.some((m) => m.table === e.table)) {
        ownerMismatches.push({ table: e.table, contractOwner: e.owner, registryOwner: regOwner });
      }
    }
  }

  const result: VerifyResult = {
    verdict: 'PASS',
    RUNTIME_REQUIRED_TABLES: requiredTables.size,
    RUNTIME_REQUIRED_COLUMNS: requiredContract.entries.length,
    MISSING_RUNTIME_REQUIRED_TABLES: [...missingTables].sort(),
    MISSING_RUNTIME_REQUIRED_COLUMNS: [...missingColumns].sort(),
    OWNER_MISMATCHES: ownerMismatches,
    RLS_REQUIREMENT_MISMATCHES: [...rlsMismatches].sort(),
    SEMANTIC_RUNTIME_TYPE_MISMATCHES: typeMismatches,
    canonicalSchemaDigest: canonical.digest,
  };

  const clean =
    result.MISSING_RUNTIME_REQUIRED_TABLES.length === 0 &&
    result.MISSING_RUNTIME_REQUIRED_COLUMNS.length === 0 &&
    result.OWNER_MISMATCHES.length === 0 &&
    result.RLS_REQUIREMENT_MISMATCHES.length === 0 &&
    result.SEMANTIC_RUNTIME_TYPE_MISMATCHES.length === 0;
  result.verdict = clean ? 'PASS' : 'FAIL';
  return result;
}

export function humanSummary(r: VerifyResult): string {
  return [
    `RUNTIME_REQUIRED_TABLES = ${r.RUNTIME_REQUIRED_TABLES}`,
    `RUNTIME_REQUIRED_COLUMNS = ${r.RUNTIME_REQUIRED_COLUMNS}`,
    '',
    `MISSING_RUNTIME_REQUIRED_TABLES = ${r.MISSING_RUNTIME_REQUIRED_TABLES.length}`,
    `MISSING_RUNTIME_REQUIRED_COLUMNS = ${r.MISSING_RUNTIME_REQUIRED_COLUMNS.length}`,
    r.MISSING_RUNTIME_REQUIRED_COLUMNS.length ? `  ${r.MISSING_RUNTIME_REQUIRED_COLUMNS.join('\n  ')}` : '',
    '',
    `OWNER_MISMATCHES = ${r.OWNER_MISMATCHES.length}`,
    `RLS_REQUIREMENT_MISMATCHES = ${r.RLS_REQUIREMENT_MISMATCHES.length}`,
    `SEMANTIC_RUNTIME_TYPE_MISMATCHES = ${r.SEMANTIC_RUNTIME_TYPE_MISMATCHES.length}`,
    '',
    `CANONICAL_SCHEMA_DIGEST = ${r.canonicalSchemaDigest}`,
    `SCHEMA_CONTRACT_VERDICT = ${r.verdict}`,
  ]
    .filter((l) => l !== '')
    .join('\n');
}

function main(): void {
  const canonIdx = process.argv.indexOf('--canonical');
  const canonicalPath = canonIdx >= 0 ? path.resolve(process.argv[canonIdx + 1]) : CANONICAL_SCHEMA_PATH;
  const outIdx = process.argv.indexOf('--out');
  const wantJson = process.argv.includes('--json');

  const result = verify({
    requiredContract: loadRequiredContract(),
    dispositions: loadDispositions(),
    registry: loadRegistry(),
    canonical: loadCanonicalSchema(canonicalPath),
  });

  if (outIdx >= 0) {
    fs.writeFileSync(path.resolve(process.argv[outIdx + 1]), `${JSON.stringify(result, null, 2)}\n`);
  }
  process.stdout.write(wantJson ? `${JSON.stringify(result, null, 2)}\n` : `${humanSummary(result)}\n`);
  process.exit(result.verdict === 'PASS' ? 0 : 1);
}

const invokedDirectly = process.argv[1] && process.argv[1].includes('verify-runtime-contract');
if (invokedDirectly) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[verify] ${(err as Error).message}\n`);
    process.exit(2);
  }
}
