import { sql } from 'drizzle-orm';
import { db } from '@/db/db';

/**
 * Whether semantic (embedding) search can run on this database (capability UE-AI-SEMANTIC-SEARCH, lib/reality/capability-registry.ts).
 *
 * pgvector is optional. Platform 0063 creates the `vector` extension and knowledge_base.embedding (vector(1536)) only on a server that offers the extension, and
 * cba_clauses.embedding and arbitration_decisions.embedding are text columns (a JSON array as text) that nothing converts. A query that casts to `vector` or uses
 * the `<=>` operator on a database without both fails every time, after the query text has already been sent to the embedding service: so a search asks first, and
 * answers that it is not available instead.
 */
export interface VectorColumn {
  table: string;
  column: string;
}

export const KNOWLEDGE_BASE_EMBEDDING: VectorColumn = { table: 'knowledge_base', column: 'embedding' };
export const CLAUSE_EMBEDDING: VectorColumn = { table: 'cba_clauses', column: 'embedding' };
export const PRECEDENT_EMBEDDING: VectorColumn = { table: 'arbitration_decisions', column: 'embedding' };

export class VectorSearchUnavailableError extends Error {
  readonly code = 'VECTOR_SEARCH_UNAVAILABLE';

  constructor(readonly target: VectorColumn) {
    super(
      `Semantic search is not available: ${target.table}.${target.column} is not a pgvector column on this database. ` +
        'The vector extension is optional, and its embedding columns exist only where it is installed.',
    );
    this.name = 'VectorSearchUnavailableError';
  }
}

// The answer is stable for the life of a deployment, so it is asked once a minute at most, not on every request.
const REMEMBER_MS = 60_000;
const probes: Record<string, { ready: boolean; at: number }> = {};

type Executor = Pick<typeof db, 'execute'>;

export async function vectorColumnReady(target: VectorColumn, executor: Executor = db): Promise<boolean> {
  const key = `${target.table}.${target.column}`;
  const known = probes[key];
  if (known && Date.now() - known.at < REMEMBER_MS) return known.ready;

  const rows = Array.from(
    await executor.execute(sql`
      SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
         AND EXISTS (
           SELECT 1
             FROM pg_attribute a
             JOIN pg_class c ON c.oid = a.attrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
             JOIN pg_type t ON t.oid = a.atttypid
            WHERE n.nspname = 'public' AND c.relname = ${target.table} AND a.attname = ${target.column}
              AND NOT a.attisdropped AND t.typname = 'vector'
         ) AS ready
    `),
  ) as Array<{ ready?: unknown }>;
  const ready = rows[0]?.ready === true;
  probes[key] = { ready, at: Date.now() };
  return ready;
}

/** Throws VectorSearchUnavailableError unless the column can be searched by similarity. */
export async function requireVectorColumn(target: VectorColumn, executor: Executor = db): Promise<void> {
  if (!(await vectorColumnReady(target, executor))) throw new VectorSearchUnavailableError(target);
}

/** For tests: forget what has been learned about this database. */
export function forgetVectorProbes(): void {
  for (const key of Object.keys(probes)) delete probes[key];
}
