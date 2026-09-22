/**
 * Deterministic normalization + digest for the canonical physical schema.
 *
 * Phase D/E — executable schema contract. Pure, DB-free, unit-testable.
 *
 * Normalization rule (Step 5): the canonical JSON is deterministic. Schemas,
 * tables, columns, constraints, foreign keys and indexes are sorted
 * lexicographically by stable identifiers. Harmless representation
 * differences are normalized; semantically distinct types are NEVER merged.
 *
 * Digest rule (Step 6): CANONICAL_SCHEMA_DIGEST = SHA256 of the normalized
 * schema STRUCTURE only. Volatile metadata (database name, host, creation
 * time, row counts, connection identity, PostgreSQL version) is excluded.
 */
import crypto from 'node:crypto';

export interface CanonicalColumn {
  column: string;
  type: string;
  nullable: boolean;
  default: string | null;
  primaryKey: boolean;
}

export interface CanonicalForeignKey {
  name: string;
  columns: string[];
  references: { schema: string; table: string; columns: string[] };
}

export interface CanonicalUniqueConstraint {
  name: string;
  columns: string[];
}

export interface CanonicalIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface CanonicalTable {
  table: string;
  columns: CanonicalColumn[];
  primaryKey: string[];
  foreignKeys: CanonicalForeignKey[];
  uniqueConstraints: CanonicalUniqueConstraint[];
  indexes: CanonicalIndex[];
  rlsEnabled: boolean;
  rlsForced: boolean;
}

export interface CanonicalSchema {
  schema: string;
  tables: CanonicalTable[];
}

/**
 * Normalize a raw PostgreSQL type (from format_type(atttypid, atttypmod) or a
 * udt_name) into a stable representation. Preserves length/precision modifiers
 * because those are physically significant; only collapses spelling variants.
 */
export function normalizeType(raw: string): string {
  if (!raw) return 'unknown';
  let t = String(raw).trim().toLowerCase();
  // Array udt spellings: `_text` -> `text[]`, `_uuid` -> `uuid[]`, etc.
  if (t.startsWith('_')) {
    t = `${t.slice(1)}[]`;
  }
  // Collapse internal whitespace runs.
  t = t.replace(/\s+/g, ' ');
  // Spelling variants -> canonical spelling (length/precision preserved).
  t = t.replace(/\bcharacter varying\b/g, 'varchar');
  t = t.replace(/\bcharacter\b(?!\s+varying)/g, 'char');
  t = t.replace(/\btimestamp with time zone\b/g, 'timestamptz');
  t = t.replace(/\btimestamp without time zone\b/g, 'timestamp');
  t = t.replace(/\btime with time zone\b/g, 'timetz');
  t = t.replace(/\btime without time zone\b/g, 'time');
  t = t.replace(/\bboolean\b/g, 'bool');
  t = t.replace(/\binteger\b/g, 'int4');
  t = t.replace(/\bdouble precision\b/g, 'float8');
  return t.trim();
}

/** Base type without length/precision modifiers, for coarse compatibility checks. */
export function baseType(normalized: string): string {
  return normalized.replace(/\([^)]*\)/g, '').replace(/\s*\[\]$/, '[]').trim();
}

function sortByKey<T>(arr: T[], key: (v: T) => string): T[] {
  return [...arr].sort((a, b) => key(a).localeCompare(key(b), 'en'));
}

/**
 * Produce the fully-sorted, deterministic canonical schema structure. Column
 * lists are sorted by name; constraint/index/fk lists are sorted by their
 * stable identifiers while preserving the ordinal column order WITHIN each
 * constraint (composite-key order is semantic).
 */
export function normalizeSchemas(schemas: CanonicalSchema[]): CanonicalSchema[] {
  return sortByKey(
    schemas.map((s) => ({
      schema: s.schema,
      tables: sortByKey(
        s.tables.map((tbl) => ({
          table: tbl.table,
          columns: sortByKey(
            tbl.columns.map((c) => ({
              column: c.column,
              type: normalizeType(c.type),
              nullable: Boolean(c.nullable),
              default: c.default ?? null,
              primaryKey: Boolean(c.primaryKey),
            })),
            (c) => c.column,
          ),
          primaryKey: [...tbl.primaryKey],
          foreignKeys: sortByKey(
            tbl.foreignKeys.map((fk) => ({
              name: fk.name,
              columns: [...fk.columns],
              references: {
                schema: fk.references.schema,
                table: fk.references.table,
                columns: [...fk.references.columns],
              },
            })),
            (fk) => `${fk.name}|${fk.columns.join(',')}`,
          ),
          uniqueConstraints: sortByKey(
            tbl.uniqueConstraints.map((u) => ({ name: u.name, columns: [...u.columns] })),
            (u) => `${u.name}|${u.columns.join(',')}`,
          ),
          indexes: sortByKey(
            tbl.indexes.map((i) => ({ name: i.name, columns: [...i.columns], unique: Boolean(i.unique) })),
            (i) => i.name,
          ),
          rlsEnabled: Boolean(tbl.rlsEnabled),
          rlsForced: Boolean(tbl.rlsForced),
        })),
        (tbl) => tbl.table,
      ),
    })),
    (s) => s.schema,
  );
}

/** Stable JSON: object keys emitted in sorted order recursively. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeysDeep((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

/**
 * CANONICAL_SCHEMA_DIGEST — SHA256 over the normalized structure ONLY. Input is
 * normalized first so ordering can never affect the digest.
 */
export function computeSchemaDigest(schemas: CanonicalSchema[]): string {
  const normalized = normalizeSchemas(schemas);
  const canonical = stableStringify({ schemas: normalized });
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}
