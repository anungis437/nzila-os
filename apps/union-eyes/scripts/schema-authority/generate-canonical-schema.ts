/**
 * schema:contract:generate — canonical physical-schema generator.
 *
 * Phase D/E. READ-ONLY introspection of an already-materialized PostgreSQL
 * database. This generator MUST NOT run migrations, ALTER schema, repair
 * schema, or seed data. It only inspects catalogs and emits a deterministic
 * canonical-schema.json + canonical-schema.sha256.
 *
 * Usage:
 *   DATABASE_URL=postgres://... tsx generate-canonical-schema.ts [--out <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {
  computeSchemaDigest,
  normalizeSchemas,
  stableStringify,
  type CanonicalColumn,
  type CanonicalForeignKey,
  type CanonicalIndex,
  type CanonicalSchema,
  type CanonicalTable,
  type CanonicalUniqueConstraint,
} from './lib/normalize';
import { CANONICAL_SCHEMA_PATH, CANONICAL_SCHEMA_SHA_PATH, GENERATED_DIR } from './lib/contracts';

const SYSTEM_SCHEMA_FILTER = `n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
  AND n.nspname NOT LIKE 'pg\\_temp%' AND n.nspname NOT LIKE 'pg\\_toast_temp%'`;

interface GenerateResult {
  meta: Record<string, unknown>;
  digest: string;
  schemas: CanonicalSchema[];
}

export async function introspect(client: pg.Client): Promise<CanonicalSchema[]> {
  const tablesRes = await client.query(`
    SELECT n.nspname AS schema, c.relname AS table,
           c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','p') AND ${SYSTEM_SCHEMA_FILTER}
  `);

  const columnsRes = await client.query(`
    SELECT n.nspname AS schema, c.relname AS table, a.attname AS column,
           format_type(a.atttypid, a.atttypmod) AS type,
           a.attnotnull AS not_null,
           pg_get_expr(d.adbin, d.adrelid) AS default_expr
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE c.relkind IN ('r','p') AND a.attnum > 0 AND NOT a.attisdropped AND ${SYSTEM_SCHEMA_FILTER}
  `);

  // Primary keys + unique constraints (conkey ordinal preserved).
  const consRes = await client.query(`
    SELECT n.nspname AS schema, c.relname AS table, con.conname AS name, con.contype AS contype,
           (SELECT array_agg(att.attname ORDER BY k.ord)
              FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
           ) AS columns,
           fn.nspname AS ref_schema, fc.relname AS ref_table,
           (SELECT array_agg(fatt.attname ORDER BY fk.ord)
              FROM unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord)
              JOIN pg_attribute fatt ON fatt.attrelid = con.confrelid AND fatt.attnum = fk.attnum
           ) AS ref_columns
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_class fc ON fc.oid = con.confrelid
    LEFT JOIN pg_namespace fn ON fn.oid = fc.relnamespace
    WHERE con.contype IN ('p','u','f') AND ${SYSTEM_SCHEMA_FILTER}
  `);

  const idxRes = await client.query(`
    SELECT n.nspname AS schema, c.relname AS table, ic.relname AS name,
           ix.indisunique AS is_unique,
           (SELECT array_agg(att.attname ORDER BY k.ord)
              FROM unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute att ON att.attrelid = ix.indrelid AND att.attnum = k.attnum
              WHERE k.attnum <> 0
           ) AS columns
    FROM pg_index ix
    JOIN pg_class c ON c.oid = ix.indrelid
    JOIN pg_class ic ON ic.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ${SYSTEM_SCHEMA_FILTER}
  `);

  type TblAcc = CanonicalTable & { _pk: Set<string> };
  const map = new Map<string, TblAcc>();
  const tkey = (s: string, t: string) => `${s}\u0000${t}`;

  for (const r of tablesRes.rows) {
    map.set(tkey(r.schema, r.table), {
      table: r.table,
      columns: [],
      primaryKey: [],
      foreignKeys: [],
      uniqueConstraints: [],
      indexes: [],
      rlsEnabled: Boolean(r.rls_enabled),
      rlsForced: Boolean(r.rls_forced),
      _pk: new Set<string>(),
    });
  }

  // Primary-key columns first, so column.primaryKey flags are accurate.
  for (const r of consRes.rows) {
    if (r.contype !== 'p') continue;
    const t = map.get(tkey(r.schema, r.table));
    if (!t) continue;
    const cols: string[] = r.columns ?? [];
    t.primaryKey = cols;
    for (const c of cols) t._pk.add(c);
  }

  for (const r of columnsRes.rows) {
    const t = map.get(tkey(r.schema, r.table));
    if (!t) continue;
    const col: CanonicalColumn = {
      column: r.column,
      type: r.type,
      nullable: !r.not_null,
      default: r.default_expr ?? null,
      primaryKey: t._pk.has(r.column),
    };
    t.columns.push(col);
  }

  for (const r of consRes.rows) {
    const t = map.get(tkey(r.schema, r.table));
    if (!t) continue;
    if (r.contype === 'u') {
      const u: CanonicalUniqueConstraint = { name: r.name, columns: r.columns ?? [] };
      t.uniqueConstraints.push(u);
    } else if (r.contype === 'f') {
      const fk: CanonicalForeignKey = {
        name: r.name,
        columns: r.columns ?? [],
        references: { schema: r.ref_schema, table: r.ref_table, columns: r.ref_columns ?? [] },
      };
      t.foreignKeys.push(fk);
    }
  }

  for (const r of idxRes.rows) {
    const t = map.get(tkey(r.schema, r.table));
    if (!t) continue;
    const idx: CanonicalIndex = { name: r.name, columns: r.columns ?? [], unique: Boolean(r.is_unique) };
    t.indexes.push(idx);
  }

  const bySchema = new Map<string, CanonicalTable[]>();
  // Rebuild schema grouping deterministically from the tables result set.
  const schemaOf = new Map<string, string>();
  for (const r of tablesRes.rows) schemaOf.set(tkey(r.schema, r.table), r.schema);
  for (const [k, t] of map) {
    const schema = schemaOf.get(k)!;
    const { _pk, ...clean } = t;
    void _pk;
    if (!bySchema.has(schema)) bySchema.set(schema, []);
    bySchema.get(schema)!.push(clean);
  }

  const schemas: CanonicalSchema[] = [];
  for (const [schema, tables] of bySchema) schemas.push({ schema, tables });
  return normalizeSchemas(schemas);
}

export async function generate(config: pg.ClientConfig): Promise<GenerateResult> {
  const client = new pg.Client(config);
  await client.connect();
  try {
    // Read-only guarantee: refuse to mutate anything.
    await client.query('SET SESSION default_transaction_read_only = on').catch(() => {});
    const versionRes = await client.query('SHOW server_version');
    const postgresVersion = versionRes.rows?.[0]?.server_version ?? 'unknown';
    const schemas = await introspect(client);
    const digest = computeSchemaDigest(schemas);
    const tableCount = schemas.reduce((n, s) => n + s.tables.length, 0);
    return {
      meta: {
        generator: 'schema:contract:generate',
        contractSchemaVersion: 1,
        postgresVersion,
        schemaCount: schemas.length,
        tableCount,
      },
      digest,
      schemas,
    };
  } finally {
    await client.end();
  }
}

export function serializeArtifact(result: GenerateResult): string {
  // Deterministic: meta is stable per-DB (no timestamps), schemas normalized.
  return `${stableStringify(result)}\n`;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    process.stderr.write('[generate] DATABASE_URL is not set. Refusing.\n');
    process.exit(1);
  }
  const outIdx = process.argv.indexOf('--out');
  const outDir = outIdx >= 0 ? path.resolve(process.argv[outIdx + 1]) : GENERATED_DIR;
  const outFile = outIdx >= 0 ? path.join(outDir, 'canonical-schema.json') : CANONICAL_SCHEMA_PATH;
  const shaFile = outIdx >= 0 ? path.join(outDir, 'canonical-schema.sha256') : CANONICAL_SCHEMA_SHA_PATH;

  const result = await generate({ connectionString: databaseUrl });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, serializeArtifact(result));
  fs.writeFileSync(shaFile, `${result.digest}\n`);
  process.stdout.write(
    `[generate] wrote ${outFile}\n[generate] CANONICAL_SCHEMA_DIGEST = ${result.digest}\n` +
      `[generate] schemas=${result.meta.schemaCount} tables=${result.meta.tableCount}\n`,
  );
}

// Run only when invoked directly (not when imported by tests).
const invokedDirectly = process.argv[1] && process.argv[1].includes('generate-canonical-schema');
if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(`[generate] failed: ${err.message}\n`);
    process.exit(1);
  });
}
