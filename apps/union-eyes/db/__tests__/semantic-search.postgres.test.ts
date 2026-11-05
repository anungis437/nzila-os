/**
 * Semantic search on real PostgreSQL, with and without pgvector, as the tenant runtime role (UE-AI-SEMANTIC-SEARCH, UE-CONV-H-015).
 *
 * knowledge_base.embedding (vector(1536)) exists only where the server offers the pgvector extension (platform 0063). Its Drizzle declaration named the column on every
 * database, so every plain read of the table failed wherever the extension is absent, and the vector queries cast to `vector` and used `<=>` whether or not it existed:
 * the question had already gone to the embedding service when the database refused it. The column is no longer declared; it is read and written only through
 * lib/ai/knowledge-base-embeddings.ts, after asking whether it exists (lib/ai/vector-readiness.ts). The chatbot retrieval and the exit-interview indexer run unmodified
 * under FORCE row-level security. What it holds:
 *
 * Where the server has no vector column
 *   - the table reads and writes through its declaration (a plain select and an insert ... returning no longer name a column that is not there);
 *   - a search, a write, the chatbot retrieval and the exit-interview indexer all say that semantic search is not available, before the question or the interview text
 *     is sent to the embedding service; the interview stays pending (it is neither indexed nor failed) and no knowledge row is made;
 *   - the interview search is the keyword search there: it reads a published interview only with the retiree's consent below the steward role, only at the levels
 *     the role may read, and never across organizations.
 * Where it has one (the server offers the extension; platform 0063's own block creates the column)
 *   - the database scores and orders the matches: best first, a threshold, a limit, a document type, and never an expired, inactive or unembedded row;
 *   - knowledge made from an exit interview is returned only to a reader whose role may read the interview's level, and only with the retiree's consent, by the
 *     knowledge search, the chatbot retrieval and the interview search alike;
 *   - one organization never sees another's rows, also when the query names the other organization (row-level security answers before the predicate);
 *   - a vector of the wrong size or a non-finite number is refused and nothing is written; a write for another organization's row finds nothing;
 *   - the exit-interview indexer writes the row, its vector, the interview's indexed status and the audit record in one transaction, re-indexing updates the same row,
 *     and what it indexed is what the chatbot retrieval then finds.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database. The vector phase needs a server that offers the
 * extension (the CI job installs it: UE_NATIVE_REQUIRE_PGVECTOR=1 makes a server without it fail this file instead of skipping the phase).
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { serializeRawDates } from '@/db/driver-dates'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const APP_ROOT = join(__dirname, '..', '..')
const state = vi.hoisted(() => ({ db: null as unknown, tx: null as unknown, user: '', embedding: [] as number[], embedCalls: 0 }))

async function inRole<T>(organizationId: string, userId: string, work: (tx: unknown) => Promise<T>): Promise<T> {
  const db = state.db as { transaction: <R>(fn: (tx: { execute: (query: unknown) => Promise<unknown> }) => Promise<R>) => Promise<R> }
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw('SET LOCAL ROLE union_eyes_runtime'))
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, true), set_config('app.current_user_id', ${userId}, true)`)
    return work(tx)
  })
}

// Outside a tenant transaction the shared handle is the raw pool; inside a request it is that request's transaction, which is what state.tx binds it to.
const ambient = () =>
  new Proxy(
    {},
    {
      get: (_target, property) => {
        const bound = (state.tx ?? state.db) as Record<PropertyKey, unknown>
        const value = bound[property]
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(bound) : value
      },
    },
  )
vi.mock('@/db/db', () => ({ db: ambient() }))
vi.mock('@/db', () => ({ db: ambient() }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (ctx: { organizationId: string; userId?: string }, work: (tx: unknown) => Promise<unknown>) => inRole(ctx.organizationId, ctx.userId ?? state.user, work),
  withSystemContext: () => {
    throw new Error('semantic search never uses the system role')
  },
}))
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({
    embed: async () => {
      state.embedCalls += 1
      return { embeddings: [state.embedding] }
    },
  }),
  buildOrgAiTrace: () => ({}),
  toGatewayDataClass: (value: string) => value,
  UE_APP_KEY: 'union-eyes',
  UE_SYSTEM_ORG_ID: '00000000-0000-0000-0000-000000000000',
  UE_PROFILES: { EMBEDDINGS: 'ue-embeddings', CHATBOT: 'ue-chatbot', CHATBOT_MODERATION: 'ue-chatbot-moderation' },
}))
vi.mock('@/lib/services/ai/embedding-cache', () => ({
  embeddingCache: { getCachedEmbedding: async () => null, setCachedEmbedding: async () => undefined },
}))
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: async () => ({ allowed: true, remaining: 1, limit: 1, resetIn: 1 }) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

async function serverOffersVector(): Promise<boolean> {
  if (!URL) return false
  const client = new pg.Client({ connectionString: URL })
  await client.connect()
  try {
    return (await client.query(`SELECT 1 FROM pg_available_extensions WHERE name = 'vector'`)).rowCount === 1
  } finally {
    await client.end()
  }
}

const offered = await serverOffersVector()
const readiness = URL ? await import('@/lib/ai/vector-readiness') : null
const embeddings = URL ? await import('@/lib/ai/knowledge-base-embeddings') : null
const chatbot = URL ? await import('@/lib/ai/chatbot-service') : null
const indexer = URL ? await import('@/lib/knowledge-transfer/indexing/semantic-indexer') : null
const hybridSearch = URL ? await import('@/lib/knowledge-transfer/search/hybrid-search') : null
const access = URL ? await import('@/lib/knowledge-transfer/governance/interview-access') : null
const schema = URL ? await import('@/db/schema') : null

const DIM = 1536
const vec = (components: Record<number, number>) => Array.from({ length: DIM }, (_, index) => components[index] ?? 0)
const literal = (vector: readonly number[]) => `[${vector.join(',')}]`
const E0 = vec({ 0: 1 })
const E1 = vec({ 1: 1 })
const E2 = vec({ 2: 1 })
// Unit vectors at a known angle to E0: their cosine similarity to E0 is the first component.
const AT_0_8 = vec({ 0: 0.8, 1: 0.6 })
const AT_0_6 = vec({ 0: 0.6, 1: 0.8 })

describe.skipIf(!URL)('semantic search on the combined schema, as the real runtime role', () => {
  const sfx = randomUUID().slice(0, 8)
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const USER = `sem-user-${sfx}`
  let admin: pg.Client
  let client: ReturnType<typeof postgres>

  const rows = async (query: string, params: unknown[] = []) => (await admin.query(query, params)).rows
  const reader = (levels: string[]) => ({ userId: null, stewardPlus: false, levels: new Set(levels) })
  const asRuntime = <T>(organizationId: string, work: (tx: unknown) => Promise<T>) => inRole(organizationId, USER, work)

  const insertKnowledge = async (
    organizationId: string,
    title: string,
    options: { documentType?: string; sourceType?: string; sourceId?: string | null; active?: boolean; expires?: string | null; embedding?: number[] | null } = {},
  ) => {
    const id = randomUUID()
    await admin.query(
      `INSERT INTO knowledge_base (id, organization_id, title, document_type, content, source_type, source_id, created_by, is_active, expiry_date)
       VALUES ($1, $2, $3, $4::knowledge_document_type, $5, $6, $7, $8, $9, ${options.expires ? `(now() AT TIME ZONE 'UTC') + interval '${options.expires}'` : 'NULL'})`,
      [id, organizationId, title, options.documentType ?? 'faq', `Content of ${title}. `.repeat(20), options.sourceType ?? 'manual', options.sourceId ?? null, USER, options.active ?? true],
    )
    if (options.embedding) await admin.query(`UPDATE knowledge_base SET embedding = $1::vector WHERE id = $2`, [literal(options.embedding), id])
    return id
  }

  const insertInterview = async (organizationId: string, options: { level?: string; consent?: boolean; status?: string; lessons?: string } = {}) => {
    const id = randomUUID()
    await admin.query(
      `INSERT INTO exit_interviews (id, organization_id, status, retiring_employee_name, role_in_union, title, key_lessons, sensitivity_level, consent_granted, created_by)
       VALUES ($1, $2, $3, 'Pat Retiree', 'steward', $4, $5, $6, $7, $8)`,
      [id, organizationId, options.status ?? 'published', `Interview ${id.slice(0, 6)}`, options.lessons ?? 'Lessons learned over many years of grievance handling.', options.level ?? 'public_internal', options.consent ?? true, USER],
    )
    return id
  }

  // The interview search reads through the shared handle, which inside a request is the request's tenant transaction.
  const hybrid = (organizationId: string, options: { levels: string[]; stewardPlus: boolean; query?: string }) =>
    asRuntime(organizationId, async (tx) => {
      state.tx = tx
      try {
        return await hybridSearch!.hybridKnowledgeSearch({
          query: options.query ?? 'zebra',
          orgId: organizationId,
          allowedSensitivityLevels: options.levels as never,
          stewardPlus: options.stewardPlus,
        })
      } finally {
        state.tx = null
      }
    })

  const search = (organizationId: string, levels: string[], over: Record<string, unknown> = {}, sessionOrganization = organizationId) =>
    asRuntime(sessionOrganization, (tx) =>
      embeddings!.searchKnowledgeBaseByEmbedding(tx as never, {
        organizationId,
        embedding: E0,
        minSimilarity: 0.5,
        limit: 10,
        sourceCondition: access!.knowledgeBaseSourceCondition(reader(levels), organizationId),
        ...over,
      }),
    )
  const titles = (matches: Array<{ title: string }>) => matches.map((match) => match.title)

  beforeAll(async () => {
    state.user = USER
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    client = postgres(URL!, { max: 4, onnotice: () => undefined })
    state.db = drizzle(client)
    serializeRawDates(client)
    for (const [id, name] of [
      [ORG_A, 'Semantic Fixture Local A'],
      [ORG_B, 'Semantic Fixture Local B'],
    ]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [id, name, `sem-${sfx}-${id.slice(0, 6)}`],
      )
    }
    // Start from a database without the vector column, whichever way the template was built: the clone is disposable.
    await admin.query('ALTER TABLE knowledge_base DROP COLUMN IF EXISTS embedding')
    await admin.query('DROP EXTENSION IF EXISTS vector')
    readiness!.forgetVectorProbes()
  }, 120_000)

  afterAll(async () => {
    await client?.end({ timeout: 5 }).catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  describe('where the database has no vector column', () => {
    it('says so', async () => {
      expect(await readiness!.vectorColumnReady(readiness!.KNOWLEDGE_BASE_EMBEDDING)).toBe(false)
      expect(await rows(`SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_base' AND column_name = 'embedding'`)).toHaveLength(0)
    })

    it('still reads and writes the table through its declaration', async () => {
      const { knowledgeBase } = schema!
      const created = await asRuntime(ORG_A, async (tx) => {
        const db = tx as ReturnType<typeof drizzle>
        const [row] = await db
          .insert(knowledgeBase)
          .values({ organizationId: ORG_A, title: 'Declared read', documentType: 'faq', content: 'A plain insert returns every declared column.', sourceType: 'manual', createdBy: USER })
          .returning()
        const read = await db.select().from(knowledgeBase).where(eq(knowledgeBase.organizationId, ORG_A))
        return { row, read }
      })
      expect(created.row).toMatchObject({ title: 'Declared read', embeddingModel: 'text-embedding-ada-002' })
      expect('embedding' in created.row).toBe(false)
      expect(created.read.map((row) => row.title)).toContain('Declared read')
    })

    it('refuses a search and a write as unavailable, and writes nothing', async () => {
      const id = await insertKnowledge(ORG_A, 'No vector yet')
      await expect(search(ORG_A, ['public_internal'])).rejects.toBeInstanceOf(readiness!.VectorSearchUnavailableError)
      await expect(
        asRuntime(ORG_A, (tx) => embeddings!.writeKnowledgeBaseEmbedding(tx as never, { id, organizationId: ORG_A, embedding: E0 })),
      ).rejects.toBeInstanceOf(readiness!.VectorSearchUnavailableError)
    })

    it('makes the chatbot retrieval unavailable before the question is embedded', async () => {
      state.embedCalls = 0
      await expect(new chatbot!.RAGService().searchDocuments('what is the filing deadline', { organizationId: ORG_A })).rejects.toBeInstanceOf(readiness!.VectorSearchUnavailableError)
      expect(state.embedCalls).toBe(0)
    })

    it('searches interviews by keyword there, with the retiree\'s consent and the reader\'s levels, and sends nothing to the embedding service', async () => {
      const open = await insertInterview(ORG_A, { level: 'public_internal', consent: true, lessons: 'The zebra clause is the one to read first.' })
      const unconsented = await insertInterview(ORG_A, { level: 'public_internal', consent: false, lessons: 'Nobody asked me, but the zebra clause matters.' })
      const restricted = await insertInterview(ORG_A, { level: 'restricted', consent: true, lessons: 'The zebra clause is for stewards.' })
      await insertInterview(ORG_B, { level: 'public_internal', consent: true, lessons: 'The zebra clause in another local.' })
      state.embedCalls = 0

      // Below steward a published interview is shared only with the retiree's consent, and only at the levels the role may read.
      expect((await hybrid(ORG_A, { levels: ['public_internal'], stewardPlus: false })).map((result) => result.id)).toEqual([open])
      // A steward or above reads more levels, but never a published interview whose retiree has not consented.
      expect((await hybrid(ORG_A, { levels: ['public_internal', 'restricted'], stewardPlus: true })).map((result) => result.id).sort()).toEqual([open, restricted].sort())
      expect((await hybrid(ORG_A, { levels: ['public_internal', 'restricted'], stewardPlus: true })).map((result) => result.id)).not.toContain(unconsented)
      expect(await hybrid(ORG_A, { levels: [], stewardPlus: true })).toEqual([])
      // One organization never reads another's interviews: the other local's interview is not among them, and row-level security says so before the predicate.
      expect(await hybrid(ORG_B, { levels: ['public_internal'], stewardPlus: false })).toHaveLength(1)
      expect(state.embedCalls).toBe(0)
    })

    it('leaves an interview pending, not failed, makes no knowledge row, and sends nothing to the embedding service', async () => {
      const interview = await insertInterview(ORG_A)
      state.embedCalls = 0
      const result = await indexer!.indexExitInterview(interview, ORG_A, USER)
      expect(result).toMatchObject({ indexed: false, unavailable: true })
      expect(state.embedCalls).toBe(0)
      expect(await rows(`SELECT indexing_status::text status, knowledge_base_id FROM exit_interviews WHERE id = $1`, [interview])).toEqual([{ status: 'pending', knowledge_base_id: null }])
      expect(await rows(`SELECT 1 FROM knowledge_base WHERE source_id = $1`, [interview])).toHaveLength(0)
    })
  })

  it('runs on a server that offers pgvector wherever the run requires it', () => {
    if (process.env.UE_NATIVE_REQUIRE_PGVECTOR === '1') {
      expect(offered, 'this server does not offer the vector extension; the CI job installs postgresql-<major>-pgvector before the native run').toBe(true)
    }
  })

  describe.skipIf(!offered)('where the database has the vector column', () => {
    const ids: Record<string, string> = {}
    let restrictedInterview: string
    let unconsentedInterview: string

    beforeAll(async () => {
      // Platform 0063's own block: the extension, and the column only where the server offers it.
      const migration = readFileSync(join(APP_ROOT, 'db', 'migrations-platform', '0063_declared_shape_convergence.sql'), 'utf8')
      const block = /DO \$ext\$[\s\S]*?\$ext\$;/.exec(migration)?.[0]
      expect(block, 'the extension block of platform 0063').toBeTruthy()
      await admin.query(block!)
      readiness!.forgetVectorProbes()

      ids.exact = await insertKnowledge(ORG_A, 'Exact match', { embedding: E0 })
      ids.partial = await insertKnowledge(ORG_A, 'Partial match', { documentType: 'guide', embedding: AT_0_8 })
      ids.future = await insertKnowledge(ORG_A, 'Future expiry', { expires: '1 day', embedding: AT_0_6 })
      ids.far = await insertKnowledge(ORG_A, 'Orthogonal', { embedding: E1 })
      ids.expired = await insertKnowledge(ORG_A, 'Expired', { expires: '-1 day', embedding: E0 })
      ids.inactive = await insertKnowledge(ORG_A, 'Inactive', { active: false, embedding: E0 })
      ids.unembedded = await insertKnowledge(ORG_A, 'No vector', {})
      ids.other = await insertKnowledge(ORG_B, 'Other organization', { embedding: E0 })
      restrictedInterview = await insertInterview(ORG_A, { level: 'restricted', consent: true })
      unconsentedInterview = await insertInterview(ORG_A, { level: 'public_internal', consent: false })
      ids.fromRestricted = await insertKnowledge(ORG_A, 'From a restricted interview', { sourceType: 'exit_interview', sourceId: restrictedInterview, embedding: E0 })
      ids.fromUnconsented = await insertKnowledge(ORG_A, 'From an unconsented interview', { sourceType: 'exit_interview', sourceId: unconsentedInterview, embedding: E0 })
      ids.fromNowhere = await insertKnowledge(ORG_A, 'From an interview that does not exist', { sourceType: 'exit_interview', sourceId: randomUUID(), embedding: E0 })
    }, 120_000)

    it('has a vector(1536) column and says so', async () => {
      expect(await readiness!.vectorColumnReady(readiness!.KNOWLEDGE_BASE_EMBEDDING)).toBe(true)
      expect(await rows(`SELECT format_type(atttypid, atttypmod) AS type FROM pg_attribute WHERE attrelid = 'public.knowledge_base'::regclass AND attname = 'embedding'`)).toEqual([{ type: 'vector(1536)' }])
    })

    it('reads and writes the table through its declaration here too', async () => {
      const { knowledgeBase } = schema!
      const read = await asRuntime(ORG_A, (tx) => (tx as ReturnType<typeof drizzle>).select().from(knowledgeBase).where(eq(knowledgeBase.organizationId, ORG_A)))
      expect(read.length).toBeGreaterThan(5)
      expect(read.every((row) => !('embedding' in row))).toBe(true)
    })

    it('has the database score and order the matches, best first, with the similarity it measured', async () => {
      const matches = await search(ORG_A, ['public_internal'], { minSimilarity: 0.5 })
      expect(titles(matches)).toEqual(['Exact match', 'Partial match', 'Future expiry'])
      expect(matches.map((match) => match.similarity)[0]).toBeCloseTo(1, 5)
      expect(matches[1].similarity).toBeCloseTo(0.8, 5)
      expect(matches[2].similarity).toBeCloseTo(0.6, 5)
      expect(matches[0].content).toContain('Content of Exact match')
    })

    it('applies the threshold, the limit and the document type', async () => {
      expect(titles(await search(ORG_A, ['public_internal'], { minSimilarity: 0.7 }))).toEqual(['Exact match', 'Partial match'])
      expect(titles(await search(ORG_A, ['public_internal'], { minSimilarity: 0.5, limit: 1 }))).toEqual(['Exact match'])
      expect(titles(await search(ORG_A, ['public_internal'], { minSimilarity: 0.5, documentTypes: ['guide'] }))).toEqual(['Partial match'])
      expect(titles(await search(ORG_A, ['public_internal'], { minSimilarity: 0.99 }))).toEqual(['Exact match'])
      expect(await search(ORG_A, ['public_internal'], { minSimilarity: 0.5, documentTypes: ['precedent'] })).toEqual([])
    })

    it('never returns an expired, inactive or unembedded row, or an orthogonal one', async () => {
      const everything = titles(await search(ORG_A, ['public_internal', 'restricted'], { minSimilarity: -1, limit: 50 }))
      for (const absent of ['Expired', 'Inactive', 'No vector', 'Other organization']) expect(everything).not.toContain(absent)
      expect(everything).toContain('Orthogonal')
      expect(everything).toContain('Future expiry')
    })

    it('returns knowledge made from an interview only to a reader whose role may read its level, and only with consent', async () => {
      const without = titles(await search(ORG_A, ['public_internal']))
      expect(without).not.toContain('From a restricted interview')
      const withRestricted = titles(await search(ORG_A, ['public_internal', 'restricted']))
      expect(withRestricted).toContain('From a restricted interview')
      // The retiree withheld consent, and no interview stands behind the third copy: neither is returned at any level.
      for (const levels of [[], ['public_internal'], ['public_internal', 'restricted', 'privileged', 'legal_sensitive', 'executive_confidential']]) {
        const returned = titles(await search(ORG_A, levels, { limit: 50 }))
        expect(returned).not.toContain('From an unconsented interview')
        expect(returned).not.toContain('From an interview that does not exist')
      }
      // No level at all reads none of the interview copies but still reads the ordinary knowledge.
      const none = titles(await search(ORG_A, []))
      expect(none).toEqual(['Exact match', 'Partial match', 'Future expiry'])
    })

    it('shows one organization none of the other\'s rows, also when the query names the other organization', async () => {
      expect(titles(await search(ORG_B, ['public_internal']))).toEqual(['Other organization'])
      // The session is organization B, the predicate names A: row-level security answers first.
      expect(await search(ORG_A, ['public_internal'], {}, ORG_B)).toEqual([])
    })

    it('stores a vector, and refuses a vector of the wrong size or with a non-finite number without writing', async () => {
      await asRuntime(ORG_A, (tx) => embeddings!.writeKnowledgeBaseEmbedding(tx as never, { id: ids.unembedded, organizationId: ORG_A, embedding: E2 }))
      expect(await rows(`SELECT vector_dims(embedding) AS dims, (embedding <=> $2::vector) AS distance FROM knowledge_base WHERE id = $1`, [ids.unembedded, literal(E2)])).toEqual([{ dims: DIM, distance: 0 }])

      await admin.query(`UPDATE knowledge_base SET embedding = NULL WHERE id = $1`, [ids.unembedded])
      const refused = (embedding: number[]) =>
        asRuntime(ORG_A, (tx) => embeddings!.writeKnowledgeBaseEmbedding(tx as never, { id: ids.unembedded, organizationId: ORG_A, embedding }))
      await expect(refused([1, 2, 3])).rejects.toBeInstanceOf(embeddings!.EmbeddingShapeError)
      await expect(refused(vec({ 0: Number.NaN }))).rejects.toBeInstanceOf(embeddings!.EmbeddingShapeError)
      await expect(refused(vec({ 0: Number.POSITIVE_INFINITY }))).rejects.toBeInstanceOf(embeddings!.EmbeddingShapeError)
      expect(await rows(`SELECT embedding IS NULL AS empty FROM knowledge_base WHERE id = $1`, [ids.unembedded])).toEqual([{ empty: true }])
    })

    it('finds nothing to write for another organization\'s row', async () => {
      await expect(
        asRuntime(ORG_B, (tx) => embeddings!.writeKnowledgeBaseEmbedding(tx as never, { id: ids.exact, organizationId: ORG_A, embedding: E2 })),
      ).rejects.toThrow('Knowledge base record not found')
      await expect(
        asRuntime(ORG_B, (tx) => embeddings!.writeKnowledgeBaseEmbedding(tx as never, { id: ids.exact, organizationId: ORG_B, embedding: E2 })),
      ).rejects.toThrow('Knowledge base record not found')
      expect(await rows(`SELECT (embedding <=> $2::vector) AS distance FROM knowledge_base WHERE id = $1`, [ids.exact, literal(E0)])).toEqual([{ distance: 0 }])
    })

    it('gives the chatbot the matches, with an excerpt, for the reader\'s levels', async () => {
      state.embedding = E0
      state.embedCalls = 0
      const found = await new chatbot!.RAGService().searchDocuments('what is the filing deadline', { organizationId: ORG_A, limit: 3, similarityThreshold: 0.5, readableLevels: ['public_internal'] })
      expect(state.embedCalls).toBe(1)
      expect(found.map((doc) => doc.documentId)).toEqual([ids.exact, ids.partial, ids.future])
      expect(found[0].excerpt.endsWith('...')).toBe(true)
      expect(found[0].excerpt.length).toBe(203)
      expect(found[1].relevanceScore).toBeCloseTo(0.8, 5)

      const guides = await new chatbot!.RAGService().searchDocuments('x', { organizationId: ORG_A, similarityThreshold: 0.5, documentTypes: ['guide'], readableLevels: ['public_internal'] })
      expect(guides.map((doc) => doc.documentId)).toEqual([ids.partial])

      // Without reader levels the chatbot reads no knowledge made from an interview.
      const unscoped = await new chatbot!.RAGService().searchDocuments('x', { organizationId: ORG_A, limit: 50, similarityThreshold: 0.5 })
      expect(unscoped.map((doc) => doc.documentId)).not.toContain(ids.fromRestricted)
    })

    it('finds an interview by meaning, at the reader\'s levels and with the retiree\'s consent, when no word matches', async () => {
      state.embedding = E0
      state.embedCalls = 0
      const query = 'a phrase that no interview contains'
      const asSteward = await hybrid(ORG_A, { levels: ['public_internal', 'restricted'], stewardPlus: true, query })
      expect(state.embedCalls).toBe(1)
      expect(asSteward.map((result) => result.id)).toContain(restrictedInterview)
      expect(asSteward.find((result) => result.id === restrictedInterview)).toMatchObject({ keywordScore: 0, sourceInterviewId: restrictedInterview })
      expect(asSteward.find((result) => result.id === restrictedInterview)!.semanticScore).toBeCloseTo(1, 5)
      // The retiree withheld consent for the other interview: its knowledge copy is not matched, not even for a steward.
      expect(asSteward.map((result) => result.id)).not.toContain(unconsentedInterview)
      // Below the interview's level nothing is matched.
      expect((await hybrid(ORG_A, { levels: ['public_internal'], stewardPlus: false, query })).map((result) => result.id)).not.toContain(restrictedInterview)
    })

    it('indexes an interview in one transaction, re-indexes the same row, and what it indexed is what the chatbot then finds', async () => {
      const interview = await insertInterview(ORG_A, { level: 'public_internal', consent: true })
      state.embedding = E2
      state.embedCalls = 0
      const first = await indexer!.indexExitInterview(interview, ORG_A, USER)
      expect(first).toMatchObject({ indexed: true })
      const knowledgeBaseId = (first as { knowledgeBaseId: string }).knowledgeBaseId
      expect(state.embedCalls).toBe(1)

      expect(await rows(`SELECT indexing_status::text status, knowledge_base_id::text kb, indexed_at IS NOT NULL indexed FROM exit_interviews WHERE id = $1`, [interview])).toEqual([
        { status: 'indexed', kb: knowledgeBaseId, indexed: true },
      ])
      expect(
        await rows(`SELECT source_type, source_id, organization_id::text org, embedding_model, (embedding <=> $2::vector) AS distance FROM knowledge_base WHERE id = $1`, [knowledgeBaseId, literal(E2)]),
      ).toEqual([{ source_type: 'exit_interview', source_id: interview, org: ORG_A, embedding_model: 'text-embedding-3-small', distance: 0 }])
      const actions = (await rows(`SELECT action FROM audit_security.audit_logs WHERE resource_id = $1 ORDER BY created_at`, [interview])).map((row) => row.action)
      expect(actions).toEqual(expect.arrayContaining(['exit_interview.index.embed.requested', 'exit_interview.index.embed.completed', 'exit_interview.index']))

      const found = await new chatbot!.RAGService().searchDocuments('x', { organizationId: ORG_A, similarityThreshold: 0.9, readableLevels: ['public_internal'] })
      expect(found.map((doc) => doc.documentId)).toContain(knowledgeBaseId)

      state.embedding = E1
      const again = await indexer!.indexExitInterview(interview, ORG_A, USER)
      expect(again).toEqual({ indexed: true, knowledgeBaseId })
      expect(await rows(`SELECT count(*)::int n, bool_and((embedding <=> $2::vector) = 0) moved FROM knowledge_base WHERE source_id = $1`, [interview, literal(E1)])).toEqual([{ n: 1, moved: true }])
    })

    it('leaves nothing behind when the vector cannot be written: the row, its status and the audit success roll back together', async () => {
      const interview = await insertInterview(ORG_A, { level: 'public_internal', consent: true })
      state.embedding = [1, 2, 3]
      const result = await indexer!.indexExitInterview(interview, ORG_A, USER)
      expect(result).toEqual({ indexed: false, reason: 'Indexing failed', failed: true })
      expect(await rows(`SELECT indexing_status::text status, knowledge_base_id FROM exit_interviews WHERE id = $1`, [interview])).toEqual([{ status: 'failed', knowledge_base_id: null }])
      expect(await rows(`SELECT 1 FROM knowledge_base WHERE source_id = $1`, [interview])).toHaveLength(0)
      const actions = (await rows(`SELECT action FROM audit_security.audit_logs WHERE resource_id = $1`, [interview])).map((row) => row.action)
      expect(actions).toContain('exit_interview.index.failed')
      expect(actions).not.toContain('exit_interview.index')
    })
  })
})
