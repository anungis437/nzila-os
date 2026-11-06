import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { db } from '@/db/db';
import { knowledgeBase } from '@/db/schema';
import { KNOWLEDGE_BASE_EMBEDDING, requireVectorColumn, vectorColumnReady } from '@/lib/ai/vector-readiness';

/**
 * Reading and writing knowledge_base.embedding (capability UE-AI-SEMANTIC-SEARCH, lib/reality/capability-registry.ts).
 *
 * The column is deliberately not part of the Drizzle declaration of knowledge_base. pgvector is optional: platform 0063 creates the column only on a server that
 * offers the extension. A declared column is part of every `select()` and `returning()`, so declaring it would make every read of the table (the list and item
 * routes, the bylaws page, the chatbot) fail on a database without the extension. The vector is reached only here, and only after asking whether it exists.
 *
 * The similarity is scored by the database (`<=>`, cosine distance), so a question does not pull every stored 1536-number vector across the wire.
 */
export const KNOWLEDGE_BASE_EMBEDDING_DIMENSIONS = 1536;

export class EmbeddingShapeError extends Error {
  readonly code = 'EMBEDDING_SHAPE_INVALID';

  constructor(reason: string) {
    super(`Embedding rejected: ${reason}`);
    this.name = 'EmbeddingShapeError';
  }
}

type SelectExecutor = Pick<typeof db, 'execute' | 'select'>;
type WriteExecutor = Pick<typeof db, 'execute'>;

const EMBEDDING_COLUMN = sql.raw('"knowledge_base"."embedding"');

function vectorLiteral(embedding: readonly number[]): string {
  if (!Array.isArray(embedding) || embedding.length !== KNOWLEDGE_BASE_EMBEDDING_DIMENSIONS) {
    throw new EmbeddingShapeError(
      `expected ${KNOWLEDGE_BASE_EMBEDDING_DIMENSIONS} numbers, received ${Array.isArray(embedding) ? embedding.length : typeof embedding}`,
    );
  }
  if (!embedding.every((value) => Number.isFinite(value))) throw new EmbeddingShapeError('every value must be a finite number');
  return `[${embedding.join(',')}]`;
}

/** Stores the embedding of a knowledge_base row of the organization. Throws VectorSearchUnavailableError where the column does not exist. */
export async function writeKnowledgeBaseEmbedding(
  executor: WriteExecutor,
  row: { id: string; organizationId: string; embedding: readonly number[] },
): Promise<void> {
  const literal = vectorLiteral(row.embedding);
  await requireVectorColumn(KNOWLEDGE_BASE_EMBEDDING, executor);
  const written = await executor.execute(sql`
    UPDATE knowledge_base
       SET embedding = ${literal}::vector
     WHERE id = ${row.id}::uuid AND organization_id = ${row.organizationId}::uuid
    RETURNING id
  `);
  if (Array.from(written).length !== 1) throw new Error('Knowledge base record not found');
}

/**
 * Erases the stored embedding of an organization's knowledge rows made from one source record (and of any further row named by id), active or
 * not, and returns the ids whose vector was erased. The vector is a derivative of the source text: when the source may no longer be indexed
 * (consent withdrawn, or reclassified to a level that is never indexed) it is erased, not only hidden behind is_active. The row itself and its
 * text stay: whether they are kept is a retention and legal-hold decision made elsewhere. Where the column does not exist, no vector was ever
 * stored, and nothing is erased.
 */
export async function eraseKnowledgeBaseEmbeddings(
  executor: WriteExecutor,
  target: { organizationId: string; sourceType: string; sourceId: string; ids?: readonly string[] },
): Promise<string[]> {
  if (!(await vectorColumnReady(KNOWLEDGE_BASE_EMBEDDING, executor))) return [];
  const named = (target.ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
  const byId = named.length > 0 ? sql` OR id::text IN (${sql.join(named.map((id) => sql`${id}`), sql`, `)})` : sql``;
  const erased = await executor.execute(sql`
    UPDATE knowledge_base
       SET embedding = NULL, updated_at = now()
     WHERE organization_id = ${target.organizationId}::uuid
       AND ${EMBEDDING_COLUMN} IS NOT NULL
       AND ((source_type = ${target.sourceType} AND source_id = ${target.sourceId})${byId})
    RETURNING id
  `);
  return (Array.from(erased) as Array<{ id: unknown }>).map((row) => String(row.id));
}

export interface KnowledgeBaseMatch {
  id: string;
  title: string;
  content: string;
  /** Cosine similarity to the query, 1 = the same direction. */
  similarity: number;
  documentType: string;
  summary: string | null;
  tags: string[] | null;
  keywords: string[] | null;
  language: string;
  sourceType: string;
  sourceUrl: string | null;
  viewCount: number;
  citationCount: number;
  effectiveDate: Date | null;
  expiryDate: Date | null;
}

export interface KnowledgeBaseEmbeddingQuery {
  organizationId: string;
  embedding: readonly number[];
  /** Cosine similarity (1 = identical direction) a row must reach to be returned. */
  minSimilarity: number;
  limit: number;
  documentTypes?: readonly string[];
  /** Which rows made from an exit interview the reader may see (interview-access.ts knowledgeBaseSourceCondition). */
  sourceCondition: SQL;
}

/**
 * The organization's active, unexpired knowledge rows nearest to the query embedding, best first. Throws
 * VectorSearchUnavailableError where the column does not exist.
 */
export async function searchKnowledgeBaseByEmbedding(executor: SelectExecutor, query: KnowledgeBaseEmbeddingQuery): Promise<KnowledgeBaseMatch[]> {
  const literal = vectorLiteral(query.embedding);
  await requireVectorColumn(KNOWLEDGE_BASE_EMBEDDING, executor);

  const distance = sql`(${EMBEDDING_COLUMN} <=> ${literal}::vector)`;
  const rows = await executor
    .select({
      id: knowledgeBase.id,
      title: knowledgeBase.title,
      content: knowledgeBase.content,
      similarity: sql<number>`1 - ${distance}`,
      documentType: knowledgeBase.documentType,
      summary: knowledgeBase.summary,
      tags: knowledgeBase.tags,
      keywords: knowledgeBase.keywords,
      language: knowledgeBase.language,
      sourceType: knowledgeBase.sourceType,
      sourceUrl: knowledgeBase.sourceUrl,
      viewCount: knowledgeBase.viewCount,
      citationCount: knowledgeBase.citationCount,
      effectiveDate: knowledgeBase.effectiveDate,
      expiryDate: knowledgeBase.expiryDate,
    })
    .from(knowledgeBase)
    .where(
      and(
        eq(knowledgeBase.organizationId, query.organizationId),
        eq(knowledgeBase.isActive, true),
        sql`${EMBEDDING_COLUMN} IS NOT NULL`,
        // expiry_date is a timestamp without time zone holding UTC; a document past it is no longer current.
        sql`(${knowledgeBase.expiryDate} IS NULL OR ${knowledgeBase.expiryDate} > (now() AT TIME ZONE 'UTC'))`,
        query.documentTypes?.length ? inArray(knowledgeBase.documentType, [...query.documentTypes] as never) : undefined,
        query.sourceCondition,
        sql`1 - ${distance} >= ${query.minSimilarity}`,
      ),
    )
    .orderBy(distance)
    .limit(query.limit);

  return rows.map((row) => ({ ...row, similarity: Number(row.similarity) }));
}
