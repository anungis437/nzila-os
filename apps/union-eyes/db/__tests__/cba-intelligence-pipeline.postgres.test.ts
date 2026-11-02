/**
 * The CBA intelligence pipeline on real PostgreSQL, as the tenant runtime role: the unmodified services over the eleven cba_intel_* relations.
 *
 * Platform 0061 created the relations; until then every service here answered with an undefined-relation fault, and their unit tests (which mock the
 * database) could not say whether the statements they send are statements PostgreSQL accepts. This walks one source through the whole pipeline with the
 * handle the routes use (the runtime role, no organization: the dataset is shared reference data, GLOBAL_REFERENCE_DATA in the storage-authority manifest):
 *   source registry -> ingestion job lifecycle -> document versioning -> extraction run -> findings -> agreement, wage adjustments and clauses
 *   -> review queue and decisions -> benchmark over comparable agreements and its snapshot -> freshness and operational health -> the registry seed,
 * and checks the closed relation stays closed: cba_intel_freshness_log has no caller by design and the runtime role has no privilege on it.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const logged = vi.hoisted(() => ({ errors: [] as Array<{ message: string; cause: string }> }))

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
// A service reports a failure with a generic message and logs the cause; keep the cause so a failing assertion can say why.
vi.mock('@/lib/logger', () => {
  const record = (message: string, context?: { error?: unknown }) => {
    const error = context?.error as { message?: string; cause?: { message?: string; code?: string } } | undefined
    logged.errors.push({ message, cause: `${error?.cause?.code ?? ''} ${error?.cause?.message ?? error?.message ?? ''}`.trim() })
  }
  return { logger: { error: record, warn: () => undefined, info: () => undefined, debug: () => undefined } }
})

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const schema = URL ? await import('@/db/schema') : null
const sources = URL ? await import('@/lib/services/cba-intelligence/source-registry-service') : null
const ingestion = URL ? await import('@/lib/services/cba-intelligence/ingestion-service') : null
const documents = URL ? await import('@/lib/services/cba-intelligence/document-service') : null
const extraction = URL ? await import('@/lib/services/cba-intelligence/extraction-service') : null
const review = URL ? await import('@/lib/services/cba-intelligence/review-service') : null
const benchmark = URL ? await import('@/lib/services/cba-intelligence/benchmark-service') : null
const freshness = URL ? await import('@/lib/services/cba-intelligence/freshness-service') : null
const health = URL ? await import('@/lib/services/cba-intelligence/health-service') : null
const seed = URL ? await import('@/lib/services/cba-intelligence/seed-sources') : null

const first = (column: { enumValues?: readonly string[] | string[] }, index = 0) => (column.enumValues as readonly string[])[index]

describe.skipIf(!URL)('the CBA intelligence pipeline on the combined schema, as the tenant runtime role', () => {
  const tag = `ci${randomUUID().slice(0, 8)}`
  let admin: pg.Client
  const state = {
    sourceId: '', otherSourceId: '', jobId: '', documentId: '', runId: '', findingIds: [] as string[],
    target: '', comparables: [] as string[], clauseId: '', wageId: '',
  }

  /** The cause the service logged for the failure it just reported, for an assertion message. */
  const why = () => logged.errors.map((entry) => `${entry.message}: ${entry.cause}`).join(' | ')
  const count = async (table: string, where = 'true', params: unknown[] = []) =>
    Number((await admin.query(`SELECT count(*)::int AS n FROM public.${table} WHERE ${where}`, params)).rows[0].n)

  const newAgreement = async (title: string, overrides: Record<string, unknown> = {}) =>
    extraction!.createAgreement({
      documentId: state.documentId, sourceId: state.sourceId, extractionRunId: state.runId,
      title, employerNormalized: `Employer ${title}`, unionNormalized: `Union ${tag}`, jurisdiction: 'ON', sector: 'education',
      overallConfidence: '0.90', termMonths: 36, ...overrides,
    } as never)

  beforeAll(async () => {
    admin = await harness.start(URL!)
  }, 60_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  describe('source registry', () => {
    it('creates a source with the defaults the schema declares, and reads it by id, by slug and in a filtered list', async () => {
      const source = await sources!.createSource({
        slug: `source-${tag}`, name: `Source ${tag}`, nameEn: `Source ${tag}`, sourceType: first(schema!.sourceTypeEnum) as never,
        collectionMethod: 'manual_upload', baseUrl: 'https://example.test/cba',
      })
      state.sourceId = source.id
      expect(source).toMatchObject({ slug: `source-${tag}`, isActive: true, consecutiveFailures: 0 })
      expect((await sources!.getSourceById(source.id))?.slug).toBe(`source-${tag}`)
      expect((await sources!.getSourceBySlug(`source-${tag}`))?.id).toBe(source.id)
      expect(await sources!.getSourceBySlug(`absent-${tag}`)).toBeNull()
      const listed = await sources!.listSources({ sourceType: source.sourceType, isActive: true })
      expect(listed.items.map((row) => row.id)).toContain(source.id)
      expect(listed.total).toBeGreaterThanOrEqual(1)
      const other = await sources!.createSource({ slug: `other-${tag}`, name: 'Other', nameEn: 'Other', sourceType: source.sourceType, collectionMethod: 'manual_upload', baseUrl: 'https://example.test/other' })
      state.otherSourceId = other.id
    })

    it('refuses a second source with the same slug, as a failure and not a duplicate row', async () => {
      await expect(sources!.createSource({ slug: `source-${tag}`, name: 'Dup', nameEn: 'Dup', sourceType: first(schema!.sourceTypeEnum) as never, collectionMethod: 'manual_upload', baseUrl: 'https://example.test/dup' }))
        .rejects.toThrow('Failed to create CBA intelligence source')
      expect(await count('cba_intel_sources', 'slug = $1', [`source-${tag}`])).toBe(1)
    })

    it('updates a source, and counts failures and clears them as health reports arrive', async () => {
      expect((await sources!.updateSource(state.sourceId, { description: 'Updated' }))?.description).toBe('Updated')
      await sources!.updateSourceHealth(state.sourceId, false)
      await sources!.updateSourceHealth(state.sourceId, false)
      expect(await sources!.getSourceById(state.sourceId)).toMatchObject({ healthStatus: 'degraded', consecutiveFailures: 2 })
      await sources!.updateSourceHealth(state.sourceId, true)
      const healthy = (await sources!.getSourceById(state.sourceId))!
      expect(healthy).toMatchObject({ healthStatus: 'healthy', consecutiveFailures: 0 })
      expect(healthy.lastSuccessAt).toBeInstanceOf(Date)
    })

    it('deactivates a source and leaves it listed as inactive', async () => {
      expect(await sources!.deactivateSource(state.otherSourceId)).toBe(true)
      const inactive = await sources!.listSources({ isActive: false })
      expect(inactive.items.map((row) => row.id)).toContain(state.otherSourceId)
      expect(await sources!.deactivateSource(randomUUID())).toBe(false)
    })
  })

  describe('ingestion jobs', () => {
    it('moves a job queued -> running -> completed, and a completed job reports its source healthy', async () => {
      const job = await ingestion!.createIngestionJob({ sourceId: state.sourceId })
      state.jobId = job.id
      expect(job.status).toBe('queued')
      expect((await ingestion!.startIngestionJob(job.id))?.status).toBe('running')
      expect(await ingestion!.startIngestionJob(job.id)).toBeNull()
      const done = await ingestion!.completeIngestionJob(job.id, { documentsFound: 3, documentsNew: 2, documentsUnchanged: 1 })
      expect(done).toMatchObject({ status: 'completed', documentsFound: 3, documentsNew: 2 })
      expect(done!.durationMs).toBeGreaterThanOrEqual(0)
      expect((await ingestion!.getIngestionJobById(job.id))?.completedAt).toBeInstanceOf(Date)
      expect((await sources!.getSourceById(state.sourceId))?.healthStatus).toBe('healthy')
    })

    it('requeues a failed job while it has retries left, fails it for good after, and degrades the source', async () => {
      const job = await ingestion!.createIngestionJob({ sourceId: state.sourceId, maxRetries: 1 })
      await ingestion!.startIngestionJob(job.id)
      const retry = await ingestion!.failIngestionJob(job.id, 'upstream timeout', first(schema!.failureClassEnum), { attempt: 1 })
      expect(retry).toMatchObject({ status: 'queued', retryCount: 1, errorMessage: 'upstream timeout' })
      const final = await ingestion!.failIngestionJob(job.id, 'upstream timeout again', first(schema!.failureClassEnum))
      expect(final).toMatchObject({ status: 'failed', retryCount: 2 })
      expect((await sources!.getSourceById(state.sourceId))?.healthStatus).toBe('degraded')
      await sources!.updateSourceHealth(state.sourceId, true)
    })

    it('cancels a queued or running job and nothing else, and filters the list by source and status', async () => {
      const job = await ingestion!.createIngestionJob({ sourceId: state.sourceId })
      expect(await ingestion!.cancelIngestionJob(job.id)).toBe(true)
      expect(await ingestion!.cancelIngestionJob(job.id)).toBe(false)
      expect(await ingestion!.cancelIngestionJob(state.jobId)).toBe(false)
      const cancelled = await ingestion!.listIngestionJobs({ sourceId: state.sourceId, status: 'cancelled' })
      expect(cancelled.items.map((row) => row.id)).toEqual([job.id])
      expect((await ingestion!.listIngestionJobs({ sourceId: state.sourceId })).total).toBe(3)
    })
  })

  describe('documents', () => {
    const url = () => `https://example.test/${tag}/agreement.pdf`

    it('stores a document, bumps it when its content is unchanged, and versions it when its content changes', async () => {
      const content = `Collective agreement ${tag}, version one.`
      const created = await documents!.upsertDocument({ sourceId: state.sourceId, sourceUrl: url(), documentType: first(schema!.documentTypeEnum) as never, rawContent: content, contentHash: documents!.computeContentHash(content) })
      state.documentId = created.document.id
      expect(created).toMatchObject({ action: 'created', document: { version: 1, isLatest: true, previousVersionId: null } })

      const unchanged = await documents!.upsertDocument({ sourceId: state.sourceId, sourceUrl: url(), documentType: created.document.documentType, rawContent: content, contentHash: documents!.computeContentHash(content) })
      expect(unchanged.action).toBe('unchanged')
      expect(unchanged.document.id).toBe(created.document.id)

      const revised = `Collective agreement ${tag}, version two, with a wage reopener.`
      const updated = await documents!.upsertDocument({ sourceId: state.sourceId, sourceUrl: url(), documentType: created.document.documentType, rawContent: revised, contentHash: documents!.computeContentHash(revised) })
      expect(updated).toMatchObject({ action: 'updated', document: { version: 2, isLatest: true, previousVersionId: created.document.id } })
      expect((await documents!.getDocumentById(created.document.id))?.isLatest).toBe(false)
      expect(await count('cba_intel_documents', 'source_id = $1 AND source_url = $2 AND is_latest', [state.sourceId, url()])).toBe(1)
      state.documentId = updated.document.id
    })

    it('lists the latest documents of a source and moves a document through its processing states', async () => {
      const latest = await documents!.listDocuments({ sourceId: state.sourceId, isLatest: true })
      expect(latest.items.map((row) => row.id)).toEqual([state.documentId])
      const updated = await documents!.updateDocumentStatus(state.documentId, first(schema!.documentProcessingStatusEnum, 1) as never, { normalizedText: 'normalized', wordCount: 12, pageCount: 2, parsedMetadata: { language: 'en' } })
      expect(updated).toMatchObject({ normalizedText: 'normalized', wordCount: 12, pageCount: 2 })
      expect(await documents!.updateDocumentStatus(randomUUID(), first(schema!.documentProcessingStatusEnum) as never)).toBeNull()
    })
  })

  describe('extraction', () => {
    it('records an extraction run and completes it with its counts', async () => {
      const run = await extraction!.createExtractionRun({ documentId: state.documentId, extractionMethod: 'deterministic' })
      state.runId = run.id
      expect(run.status).toBeDefined()
      const done = await extraction!.completeExtractionRun(run.id, { findingsCount: 3, errorCount: 1, errors: [{ field: 'term', message: 'unreadable' }] })
      expect(done).toMatchObject({ status: 'completed_with_errors', findingsCount: 3, errorCount: 1 })
      expect((await extraction!.listExtractionRuns({ documentId: state.documentId, status: 'completed_with_errors' })).items.map((row) => row.id)).toEqual([run.id])
      expect(await extraction!.completeExtractionRun(randomUUID(), { findingsCount: 0 })).toBeNull()
    })

    it('stores findings singly and in a batch with a stable content hash, and filters them by confidence', async () => {
      const common = { extractionRunId: state.runId, documentId: state.documentId, extractionMethod: 'deterministic' as const }
      const single = await extraction!.createFinding({ ...common, findingType: 'wage_increase', label: 'General increase', value: '3.5%', confidence: '0.95' })
      const batch = await extraction!.createFindingsBatch([
        { ...common, findingType: 'term', label: 'Term', value: '36 months', confidence: '0.55' },
        { ...common, findingType: 'sector', label: 'Sector', value: 'education', confidence: '0.30' },
      ])
      state.findingIds = [single.id, ...batch.map((row) => row.id)]
      expect(single.contentHash).toMatch(/^[0-9a-f]{64}$/)
      expect(await extraction!.createFindingsBatch([])).toEqual([])
      const sure = await extraction!.listFindings({ documentId: state.documentId, minConfidence: 0.5 })
      expect(sure.items.map((row) => row.id).sort()).toEqual([single.id, batch[0].id].sort())
      expect(sure.total).toBe(2)
      expect((await extraction!.listFindings({ extractionRunId: state.runId })).total).toBe(3)
    })

    it('stores an agreement with its wage adjustments and clauses, and reads them back in order', async () => {
      const agreement = await newAgreement(`Target ${tag}`)
      state.target = agreement.id
      expect(agreement.reviewStatus).toBe('pending_review')
      const wage = await extraction!.createWageAdjustment({ agreementId: agreement.id, findingId: state.findingIds[0], adjustmentType: 'general_increase', adjustmentPercent: '3.50', effectiveDate: new Date('2026-04-01T00:00:00Z'), year: 2026, confidence: '0.90' } as never)
      state.wageId = wage.id
      await extraction!.createWageAdjustment({ agreementId: agreement.id, adjustmentType: 'general_increase', adjustmentPercent: '2.00', effectiveDate: new Date('2025-04-01T00:00:00Z'), year: 2025, confidence: '0.90' } as never)
      const clause = await extraction!.createClause({ agreementId: agreement.id, clauseFamily: 'wages', clauseNumber: '12.01', rawText: 'Wages shall increase as follows.', confidence: '0.88' } as never)
      state.clauseId = clause.id
      expect(clause.contentHash).toMatch(/^[0-9a-f]{64}$/)

      expect((await extraction!.getAgreementById(agreement.id))?.title).toBe(`Target ${tag}`)
      expect(await extraction!.getAgreementById(randomUUID())).toBeNull()
      expect((await extraction!.listWageAdjustments(agreement.id)).map((row) => row.year)).toEqual([2025, 2026])
      expect((await extraction!.listClauses(agreement.id)).map((row) => row.id)).toEqual([clause.id])
      expect(await extraction!.listWageAdjustments(agreement.id, { approvedOnly: true })).toEqual([])
    })

    it('searches and filters agreements', async () => {
      const bySearch = await extraction!.listAgreements({ search: `Target ${tag}` })
      expect(bySearch.items.map((row) => row.id)).toEqual([state.target])
      expect((await extraction!.listAgreements({ jurisdiction: 'ON', sector: 'education', reviewStatus: 'pending_review' })).items.map((row) => row.id)).toContain(state.target)
      expect((await extraction!.listAgreements({ employerLike: `Target ${tag}`, unionLike: tag })).items.map((row) => row.id)).toEqual([state.target])
      expect((await extraction!.listAgreements({ jurisdiction: 'XX' })).total).toBe(0)
    })
  })

  describe('review', () => {
    it('queues findings and agreements that await review, and counts them', async () => {
      const queue = await review!.getReviewQueue({ minConfidence: 0.2 })
      expect(queue.items.map((row) => row.id).sort()).toEqual([...state.findingIds].sort())
      expect(Number(queue.items[0].confidence)).toBe(0.3)
      expect((await review!.getReviewQueue({ maxConfidence: 0.5, clauseFamily: 'wages' })).total).toBe(0)
      expect((await review!.getPendingAgreementReviews()).items.map((row) => row.id)).toEqual([state.target])
      const counts = await review!.getReviewQueueCounts()
      expect(counts).toMatchObject({ findings: 3, agreements: 1, wageAdjustments: 2, clauses: 1, total: 7 })
    })

    it('records a decision, applies it to its target, and keeps the history', async () => {
      const decision = await review!.submitReview({ targetType: 'agreement', targetId: state.target, decision: 'approved', reason: 'verified against the source', reviewerId: `reviewer-${tag}`, reviewerRole: 'steward' })
      expect(decision).toMatchObject({ targetType: 'agreement', targetId: state.target, decision: 'approved', previousStatus: 'pending_review' })
      expect((await extraction!.getAgreementById(state.target))?.reviewStatus).toBe('approved')
      const history = await review!.getReviewHistory('agreement', state.target)
      expect(history.map((row) => row.id)).toEqual([decision.id])
      expect((await review!.getPendingAgreementReviews()).total).toBe(0)
      await review!.submitReview({ targetType: 'wage_adjustment', targetId: state.wageId, decision: 'approved', reviewerId: `reviewer-${tag}`, reviewerRole: 'steward' })
      await review!.submitReview({ targetType: 'clause', targetId: state.clauseId, decision: 'rejected', reason: 'misread', reviewerId: `reviewer-${tag}`, reviewerRole: 'steward' })
      expect((await extraction!.listWageAdjustments(state.target, { approvedOnly: true })).map((row) => row.id)).toEqual([state.wageId])
      expect(await extraction!.listClauses(state.target, { approvedOnly: true })).toEqual([])
    })

    it('flags a finding for follow-up, and refuses a target that is unknown', async () => {
      const flagged = await review!.flagForFollowupReview({ targetType: 'finding', targetId: state.findingIds[1], reason: 'low confidence' })
      expect(flagged).toMatchObject({ decision: 'needs_followup', reviewerId: 'system:classification-guard', reviewerRole: 'system' })
      expect((await review!.getReviewQueue()).items.map((row) => row.id)).toContain(state.findingIds[1])
      await expect(review!.submitReview({ targetType: 'agreement', targetId: randomUUID(), decision: 'approved', reviewerId: 'r', reviewerRole: 'steward' })).rejects.toThrow('Target not found')
    })

    it('records the decision and the status change together: a decision that cannot apply leaves no history', async () => {
      const before = await count('cba_intel_review_decisions')
      await expect(
        harness.tenant(RUNTIME_ROLE, null, null, async (tx) => {
          await review!.submitReview({ targetType: 'finding', targetId: state.findingIds[2], decision: 'approved', reviewerId: 'r', reviewerRole: 'steward' }, tx as never)
          throw new Error('the caller\'s audit failed')
        }),
      ).rejects.toThrow('the caller\'s audit failed')
      expect(await count('cba_intel_review_decisions')).toBe(before)
      expect((await admin.query('SELECT review_status FROM public.cba_intel_findings WHERE id = $1', [state.findingIds[2]])).rows[0].review_status).toBe('pending_review')
    })
  })

  describe('benchmark', () => {
    it('compares a target with the approved agreements of its jurisdiction and sector, and saves the snapshot', async () => {
      logged.errors.length = 0
      state.comparables = []
      for (const [index, increase] of ['2.00', '3.00', '4.00'].entries()) {
        const agreement = await newAgreement(`Comparable ${index} ${tag}`, { termMonths: 24 + index * 12, reviewStatus: 'approved' })
        await extraction!.createWageAdjustment({ agreementId: agreement.id, adjustmentType: 'general_increase', adjustmentPercent: increase, effectiveDate: new Date('2026-04-01T00:00:00Z'), year: 2026, confidence: '0.90', reviewStatus: 'approved' } as never)
        await extraction!.createClause({ agreementId: agreement.id, clauseFamily: 'wages', rawText: `Wages ${index}`, confidence: '0.90' } as never)
        if (index < 2) await extraction!.createClause({ agreementId: agreement.id, clauseFamily: first(schema!.clauseFamilyEnum, 1) as never, rawText: `Other ${index}`, confidence: '0.90' } as never)
        state.comparables.push(agreement.id)
      }
      await newAgreement(`Pending ${tag}`, { reviewStatus: 'pending_review' })
      await newAgreement(`Elsewhere ${tag}`, { reviewStatus: 'approved', jurisdiction: 'BC', sector: 'health' })

      const result = await benchmark!.findComparableAgreements(state.target, { minComparables: 2 })
      expect(logged.errors.filter((entry) => entry.message.includes('benchmark')), why()).toEqual([])
      expect(result.comparableCount).toBe(3)
      expect(result.comparables.map((row) => row.agreementId).sort()).toEqual([...state.comparables].sort())
      expect(result.comparables.every((row) => row.comparability === 'exact')).toBe(true)
      expect(result).toMatchObject({ medianWageIncrease: 3, avgTermMonths: 36, targetWageIncrease: 3.5, targetTermMonths: 36, targetWagePercentile: 67 })
      expect(result.clauseFamilyCoverage.wages).toBe(100)
      expect(Object.values(result.clauseFamilyCoverage)).toContain(67)

      const snapshot = await benchmark!.saveBenchmarkSnapshot(result, `reviewer-${tag}`)
      expect(snapshot).toMatchObject({ targetAgreementId: state.target, comparableCount: 3 })
      expect(Number(snapshot.medianWageIncrease)).toBe(3)
      expect(Number(snapshot.wagePercentile)).toBe(67)
      const history = await benchmark!.getBenchmarkSnapshots(state.target)
      expect(history.total).toBe(1)
      expect(history.items[0].id).toBe(snapshot.id)
      expect(history.items[0]).not.toHaveProperty('computedBy')
    })

    it('says so, and computes no aggregate, when there are too few comparable agreements', async () => {
      const sparse = await benchmark!.findComparableAgreements(state.target, { minComparables: 10 })
      expect(sparse).toMatchObject({ insufficientData: true, requiredComparables: 10, comparableCount: 3, medianWageIncrease: null, targetWagePercentile: null })
    })

    it('fails for an agreement that does not exist', async () => {
      await expect(benchmark!.findComparableAgreements(randomUUID())).rejects.toThrow('Agreement not found')
    })
  })

  describe('freshness and operational health', () => {
    it('computes the freshness of one source and of every active source from the documents it holds', async () => {
      logged.errors.length = 0
      const one = await freshness!.computeSourceFreshness(state.sourceId)
      expect(one).toMatchObject({ sourceId: state.sourceId, freshnessStatus: 'fresh', documentCount: 2, staleDocumentCount: 0 })
      const overview = await freshness!.getFreshnessOverview()
      expect(logged.errors.filter((entry) => entry.message.includes('freshness')), why()).toEqual([])
      expect(overview.sources.map((row) => row.sourceId)).toContain(state.sourceId)
      expect(overview.sources.map((row) => row.sourceId)).not.toContain(state.otherSourceId)
      expect(overview.summary.total).toBe(overview.sources.length)
      await admin.query(`UPDATE public.cba_intel_sources SET last_success_at = now() - interval '45 days' WHERE id = $1`, [state.sourceId])
      expect((await freshness!.computeSourceFreshness(state.sourceId)).freshnessStatus).toBe('stale')
      await admin.query(`UPDATE public.cba_intel_documents SET last_seen_at = now() - interval '60 days' WHERE id = $1`, [state.documentId])
      expect((await freshness!.computeSourceFreshness(state.sourceId)).staleDocumentCount).toBe(1)
      await expect(freshness!.computeSourceFreshness(randomUUID())).rejects.toThrow('Source not found')
    })

    it('reports the operational health from the ingestion, extraction, review and freshness records', async () => {
      logged.errors.length = 0
      const report = await health!.getCbaIntelOperationalHealth()
      expect(logged.errors, why()).toEqual([])
      expect(report.checks.map((check) => check.name)).toEqual(['ingestion_success_rate', 'extraction_success_rate', 'review_backlog', 'source_freshness'])
      expect(report.checks.map((check) => check.level)).toEqual(['critical', 'healthy', 'healthy', 'warning'])
      expect(report.quality).toMatchObject({ staleSources: 1, expiredSources: 0 })
      expect(report.throughput.ingestionSuccessRate).toBeCloseTo(0.5, 5)
      expect(report.throughput.extractionSuccessRate).toBe(1)
      expect(report.level).toBe('critical')
    })
  })

  describe('the registry seed', () => {
    it('seeds the real sources once, and a second run adds nothing', async () => {
      const before = await count('cba_intel_sources')
      const firstRun = await seed!.seedSources()
      expect(firstRun.errors).toEqual([])
      expect(firstRun.created + firstRun.skipped).toBe(seed!.SEED_SOURCES.length)
      expect(await count('cba_intel_sources')).toBe(before + firstRun.created)
      const secondRun = await seed!.seedSources()
      expect(secondRun).toEqual({ created: 0, skipped: seed!.SEED_SOURCES.length, errors: [] })
      expect(await count('cba_intel_sources')).toBe(before + firstRun.created)
    })
  })

  describe('the closed relation', () => {
    it('keeps cba_intel_freshness_log closed to the runtime role, because nothing calls the code that writes it', async () => {
      await expect(freshness!.logFreshnessCheck(state.sourceId)).rejects.toThrow('Failed to log freshness check')
      expect(logged.errors.at(-1)?.cause).toMatch(/permission denied/i)
      expect(await count('cba_intel_freshness_log')).toBe(0)
    })
  })
})
