import { platformDb } from '@nzila/db/platform'
import {
  mlModels,
  mlTrainingRuns,
  mlInferenceRuns,
  mlScoresStripeDaily,
  mlScoresStripeTxn,
  mlScoresUECasesPriority,
  mlScoresUESlaRisk,
} from '@nzila/db/schema'
import { eq, and, desc, gte, lte, lt, count, or } from 'drizzle-orm'

export async function listMlModels(input: { orgId: string; status: string | null }) {
  const { orgId, status } = input
  const conditions = [
    eq(mlModels.orgId, orgId),
    ...(status ? [eq(mlModels.status, status as 'draft' | 'active' | 'retired')] : []),
  ]
  const rows = await platformDb
    .select()
    .from(mlModels)
    .where(and(...conditions))
    .orderBy(desc(mlModels.createdAt))
  return {
    status: 200,
    body: rows.map((m) => ({
      id: m.id,
      orgId: m.orgId,
      modelKey: m.modelKey,
      algorithm: m.algorithm,
      version: m.version,
      status: m.status,
      hyperparamsJson: m.hyperparamsJson,
      meta: {
        trainingDatasetId: m.trainingDatasetId,
        artifactDocumentId: m.artifactDocumentId,
        metricsDocumentId: m.metricsDocumentId,
        approvedBy: m.approvedBy,
        approvedAt: m.approvedAt?.toISOString() ?? null,
      },
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
  }
}

export async function listActiveMlModels(input: { orgId: string; modelKey: string | null }) {
  const { orgId, modelKey } = input
  const rows = await platformDb
    .select({
      id: mlModels.id,
      orgId: mlModels.orgId,
      modelKey: mlModels.modelKey,
      algorithm: mlModels.algorithm,
      version: mlModels.version,
      status: mlModels.status,
      trainingDatasetId: mlModels.trainingDatasetId,
      artifactDocumentId: mlModels.artifactDocumentId,
      metricsDocumentId: mlModels.metricsDocumentId,
      approvedBy: mlModels.approvedBy,
      approvedAt: mlModels.approvedAt,
      createdAt: mlModels.createdAt,
      updatedAt: mlModels.updatedAt,
    })
    .from(mlModels)
    .where(
      and(
        eq(mlModels.orgId, orgId),
        eq(mlModels.status, 'active'),
        ...(modelKey ? [eq(mlModels.modelKey, modelKey)] : []),
      ),
    )
  return {
    status: 200,
    body: rows.map((m) => ({
      id: m.id,
      orgId: m.orgId,
      modelKey: m.modelKey,
      algorithm: m.algorithm,
      version: m.version,
      status: m.status,
      meta: {
        trainingDatasetId: m.trainingDatasetId,
        artifactDocumentId: m.artifactDocumentId,
        metricsDocumentId: m.metricsDocumentId,
        approvedBy: m.approvedBy,
        approvedAt: m.approvedAt?.toISOString() ?? null,
      },
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
  }
}

export async function listMlTrainingRuns(input: {
  orgId: string
  modelKey: string | null
  limit: number
}) {
  const { orgId, modelKey, limit } = input
  const rows = await platformDb
    .select()
    .from(mlTrainingRuns)
    .where(
      and(
        eq(mlTrainingRuns.orgId, orgId),
        ...(modelKey ? [eq(mlTrainingRuns.modelKey, modelKey)] : []),
      ),
    )
    .orderBy(desc(mlTrainingRuns.startedAt))
    .limit(limit)
  return {
    status: 200,
    body: rows.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      modelKey: r.modelKey,
      datasetId: r.datasetId,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}

export async function listMlInferenceRuns(input: {
  orgId: string
  modelId: string | null
  limit: number
}) {
  const { orgId, modelId, limit } = input
  const rows = await platformDb
    .select({
      id: mlInferenceRuns.id,
      orgId: mlInferenceRuns.orgId,
      modelId: mlInferenceRuns.modelId,
      modelKey: mlModels.modelKey,
      status: mlInferenceRuns.status,
      startedAt: mlInferenceRuns.startedAt,
      finishedAt: mlInferenceRuns.finishedAt,
      inputPeriodStart: mlInferenceRuns.inputPeriodStart,
      inputPeriodEnd: mlInferenceRuns.inputPeriodEnd,
      summaryJson: mlInferenceRuns.summaryJson,
      error: mlInferenceRuns.error,
      createdAt: mlInferenceRuns.createdAt,
    })
    .from(mlInferenceRuns)
    .innerJoin(mlModels, eq(mlInferenceRuns.modelId, mlModels.id))
    .where(
      and(
        eq(mlInferenceRuns.orgId, orgId),
        ...(modelId ? [eq(mlInferenceRuns.modelId, modelId)] : []),
      ),
    )
    .orderBy(desc(mlInferenceRuns.startedAt))
    .limit(limit)
  return {
    status: 200,
    body: rows.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      modelId: r.modelId,
      modelKey: r.modelKey,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      inputPeriodStart: r.inputPeriodStart,
      inputPeriodEnd: r.inputPeriodEnd,
      summaryJson: r.summaryJson,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}

export async function listStripeDailyScores(input: {
  orgId: string
  startDate: string
  endDate: string
  modelKey: string | null
  includeFeatures: boolean
}) {
  const { orgId, startDate, endDate, modelKey, includeFeatures } = input
  // If modelKey is passed, resolve modelId(s) for that key
  let modelIds: string[] | null = null
  if (modelKey) {
    const models = await platformDb
      .select({ id: mlModels.id })
      .from(mlModels)
      .where(and(eq(mlModels.orgId, orgId), eq(mlModels.modelKey, modelKey)))
    modelIds = models.map((m) => m.id)
    if (modelIds.length === 0) {
      return {
        status: 200,
        body: [],
      }
    }
  }
  const rows = await platformDb
    .select({
      id: mlScoresStripeDaily.id,
      date: mlScoresStripeDaily.date,
      score: mlScoresStripeDaily.score,
      isAnomaly: mlScoresStripeDaily.isAnomaly,
      threshold: mlScoresStripeDaily.threshold,
      modelId: mlScoresStripeDaily.modelId,
      modelKey: mlModels.modelKey,
      inferenceRunId: mlScoresStripeDaily.inferenceRunId,
      featuresJson: mlScoresStripeDaily.featuresJson,
    })
    .from(mlScoresStripeDaily)
    .innerJoin(mlModels, eq(mlScoresStripeDaily.modelId, mlModels.id))
    .where(
      and(
        eq(mlScoresStripeDaily.orgId, orgId),
        gte(mlScoresStripeDaily.date, startDate),
        lte(mlScoresStripeDaily.date, endDate),
      ),
    )
    .orderBy(mlScoresStripeDaily.date)
  const filtered = modelIds ? rows.filter((r) => modelIds!.includes(r.modelId)) : rows
  return {
    status: 200,
    body: filtered.map((r) => ({
      id: r.id,
      date: r.date,
      score: r.score,
      isAnomaly: r.isAnomaly,
      threshold: r.threshold,
      modelId: r.modelId,
      modelKey: r.modelKey,
      inferenceRunId: r.inferenceRunId,
      ...(includeFeatures ? { features: r.featuresJson } : {}),
    })),
  }
}

export async function listStripeTransactionScores(input: {
  orgId: string
  startDate: string
  endDate: string
  isAnomalyParam: string | null
  minScore: string | null
  limit: number
  cursor: string | null
  includeFeatures: boolean
}) {
  const { orgId, startDate, endDate, isAnomalyParam, minScore, limit, cursor, includeFeatures } =
    input
  const startTs = new Date(startDate + 'T00:00:00Z')
  const endTs = new Date(endDate + 'T23:59:59Z')
  const cursorTs = cursor ? new Date(cursor) : null
  const conditions = [
    eq(mlScoresStripeTxn.orgId, orgId),
    gte(mlScoresStripeTxn.occurredAt, startTs),
    lte(mlScoresStripeTxn.occurredAt, endTs),
    ...(isAnomalyParam !== null
      ? [eq(mlScoresStripeTxn.isAnomaly, isAnomalyParam === 'true')]
      : []),
    ...(cursorTs ? [lt(mlScoresStripeTxn.occurredAt, cursorTs)] : []),
  ]
  // Period counts for summary header (runs against full period, ignoring cursor/limit)
  const periodConditions = [
    eq(mlScoresStripeTxn.orgId, orgId),
    gte(mlScoresStripeTxn.occurredAt, startTs),
    lte(mlScoresStripeTxn.occurredAt, endTs),
  ]
  const [rows, [totalRow], [anomalyRow]] = await Promise.all([
    platformDb
      .select({
        id: mlScoresStripeTxn.id,
        occurredAt: mlScoresStripeTxn.occurredAt,
        amount: mlScoresStripeTxn.amount,
        currency: mlScoresStripeTxn.currency,
        score: mlScoresStripeTxn.score,
        isAnomaly: mlScoresStripeTxn.isAnomaly,
        threshold: mlScoresStripeTxn.threshold,
        modelId: mlScoresStripeTxn.modelId,
        modelKey: mlModels.modelKey,
        inferenceRunId: mlScoresStripeTxn.inferenceRunId,
        stripePaymentIntentId: mlScoresStripeTxn.stripePaymentIntentId,
        stripeChargeId: mlScoresStripeTxn.stripeChargeId,
        featuresJson: mlScoresStripeTxn.featuresJson,
      })
      .from(mlScoresStripeTxn)
      .innerJoin(mlModels, eq(mlScoresStripeTxn.modelId, mlModels.id))
      .where(and(...conditions))
      .orderBy(mlScoresStripeTxn.occurredAt)
      .limit(limit + 1),
    platformDb
      .select({ count: count() })
      .from(mlScoresStripeTxn)
      .where(and(...periodConditions)),
    platformDb
      .select({ count: count() })
      .from(mlScoresStripeTxn)
      .where(and(...periodConditions, eq(mlScoresStripeTxn.isAnomaly, true))),
  ])
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1].occurredAt.toISOString() : null
  // Apply minScore filter post-query (score is numeric string from DB)
  const filtered = minScore
    ? items.filter((r) => parseFloat(String(r.score)) <= parseFloat(minScore))
    : items
  return {
    status: 200,
    body: {
      items: filtered.map((r) => ({
        id: r.id,
        occurredAt: r.occurredAt.toISOString(),
        amount: r.amount,
        currency: r.currency,
        score: r.score,
        isAnomaly: r.isAnomaly,
        threshold: r.threshold,
        modelId: r.modelId,
        modelKey: r.modelKey,
        inferenceRunId: r.inferenceRunId,
        stripePaymentIntentId: r.stripePaymentIntentId,
        stripeChargeId: r.stripeChargeId,
        ...(includeFeatures ? { features: r.featuresJson } : {}),
      })),
      nextCursor,
      totalInPeriod: totalRow?.count ?? 0,
      anomalyInPeriod: anomalyRow?.count ?? 0,
    },
  }
}

export async function listUePriorityScores(input: {
  orgId: string
  startDate: string
  endDate: string
  priorityFilter: string | null
  includeFeatures: boolean
  cursor: string | null
  limit: number
}) {
  const { orgId, startDate, endDate, priorityFilter, includeFeatures, cursor, limit } = input
  const startTs = new Date(startDate + 'T00:00:00Z')
  const endTs = new Date(endDate + 'T23:59:59Z')
  // Decode composite cursor: base64("<iso-timestamp>|<uuid>")
  // Composite key prevents duplicate/skipped rows when rows share a timestamp.
  let cursorTs: Date | null = null
  let cursorId: string | null = null
  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
      const pipeIdx = decoded.lastIndexOf('|')
      if (pipeIdx === -1) throw new Error('malformed')
      cursorTs = new Date(decoded.slice(0, pipeIdx))
      cursorId = decoded.slice(pipeIdx + 1)
      if (isNaN(cursorTs.getTime()) || !cursorId) throw new Error('invalid')
    } catch {
      return {
        status: 400,
        body: { error: 'Invalid cursor' },
      }
    }
  }
  const whereClause = and(
    eq(mlScoresUECasesPriority.orgId, orgId),
    gte(mlScoresUECasesPriority.occurredAt, startTs),
    lte(mlScoresUECasesPriority.occurredAt, endTs),
    ...(priorityFilter ? [eq(mlScoresUECasesPriority.predictedPriority, priorityFilter)] : []),
    ...(cursorTs && cursorId
      ? [
          or(
            lt(mlScoresUECasesPriority.occurredAt, cursorTs),
            and(
              eq(mlScoresUECasesPriority.occurredAt, cursorTs),
              lt(mlScoresUECasesPriority.id, cursorId),
            ),
          ),
        ]
      : []),
  )
  const rows = await platformDb
    .select({
      id: mlScoresUECasesPriority.id,
      caseId: mlScoresUECasesPriority.caseId,
      occurredAt: mlScoresUECasesPriority.occurredAt,
      score: mlScoresUECasesPriority.score,
      predictedPriority: mlScoresUECasesPriority.predictedPriority,
      actualPriority: mlScoresUECasesPriority.actualPriority,
      modelId: mlScoresUECasesPriority.modelId,
      modelKey: mlModels.modelKey,
      inferenceRunId: mlScoresUECasesPriority.inferenceRunId,
      createdAt: mlScoresUECasesPriority.createdAt,
      featuresJson: mlScoresUECasesPriority.featuresJson,
    })
    .from(mlScoresUECasesPriority)
    .innerJoin(mlModels, eq(mlScoresUECasesPriority.modelId, mlModels.id))
    .where(whereClause)
    .orderBy(desc(mlScoresUECasesPriority.occurredAt), desc(mlScoresUECasesPriority.id))
    .limit(limit + 1) // fetch one extra to detect next page

  const hasMore = rows.length > limit
  const pageRows = rows.slice(0, limit)
  const nextCursor = hasMore
    ? Buffer.from(
        `${pageRows[pageRows.length - 1].occurredAt.toISOString()}|${pageRows[pageRows.length - 1].id}`,
      ).toString('base64')
    : null
  return {
    status: 200,
    body: {
      items: pageRows.map((r) => ({
        id: r.id,
        caseId: r.caseId,
        occurredAt: r.occurredAt.toISOString(),
        score: r.score,
        predictedPriority: r.predictedPriority,
        actualPriority: r.actualPriority,
        modelId: r.modelId,
        modelKey: r.modelKey,
        inferenceRunId: r.inferenceRunId,
        createdAt: r.createdAt.toISOString(),
        ...(includeFeatures ? { features: r.featuresJson } : {}),
      })),
      nextCursor,
      total: pageRows.length,
    },
  }
}

export async function listUeSlaRiskScores(input: {
  orgId: string
  startDate: string
  endDate: string
  breachParam: string | null
  minProbParam: string | null
  includeFeatures: boolean
  cursor: string | null
  limit: number
}) {
  const { orgId, startDate, endDate, breachParam, minProbParam, includeFeatures, cursor, limit } =
    input
  const startTs = new Date(startDate + 'T00:00:00Z')
  const endTs = new Date(endDate + 'T23:59:59Z')
  const minProb = minProbParam ? parseFloat(minProbParam) : null
  // Optional breach filter
  let breachFilter: boolean | null = null
  if (breachParam === 'true') breachFilter = true
  if (breachParam === 'false') breachFilter = false
  // Decode composite cursor: base64("<iso-timestamp>|<uuid>")
  let cursorTs: Date | null = null
  let cursorId: string | null = null
  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
      const pipeIdx = decoded.lastIndexOf('|')
      if (pipeIdx === -1) throw new Error('malformed')
      cursorTs = new Date(decoded.slice(0, pipeIdx))
      cursorId = decoded.slice(pipeIdx + 1)
      if (isNaN(cursorTs.getTime()) || !cursorId) throw new Error('invalid')
    } catch {
      return {
        status: 400,
        body: { error: 'Invalid cursor' },
      }
    }
  }
  const whereClause = and(
    eq(mlScoresUESlaRisk.orgId, orgId),
    gte(mlScoresUESlaRisk.occurredAt, startTs),
    lte(mlScoresUESlaRisk.occurredAt, endTs),
    ...(breachFilter !== null ? [eq(mlScoresUESlaRisk.predictedBreach, breachFilter)] : []),
    ...(cursorTs && cursorId
      ? [
          or(
            lt(mlScoresUESlaRisk.occurredAt, cursorTs),
            and(eq(mlScoresUESlaRisk.occurredAt, cursorTs), lt(mlScoresUESlaRisk.id, cursorId)),
          ),
        ]
      : []),
  )
  let rows = await platformDb
    .select({
      id: mlScoresUESlaRisk.id,
      caseId: mlScoresUESlaRisk.caseId,
      occurredAt: mlScoresUESlaRisk.occurredAt,
      probability: mlScoresUESlaRisk.probability,
      predictedBreach: mlScoresUESlaRisk.predictedBreach,
      actualBreach: mlScoresUESlaRisk.actualBreach,
      modelId: mlScoresUESlaRisk.modelId,
      modelKey: mlModels.modelKey,
      inferenceRunId: mlScoresUESlaRisk.inferenceRunId,
      createdAt: mlScoresUESlaRisk.createdAt,
      featuresJson: mlScoresUESlaRisk.featuresJson,
    })
    .from(mlScoresUESlaRisk)
    .innerJoin(mlModels, eq(mlScoresUESlaRisk.modelId, mlModels.id))
    .where(whereClause)
    .orderBy(desc(mlScoresUESlaRisk.occurredAt), desc(mlScoresUESlaRisk.id))
    .limit(limit + 1)
  // Apply minProb filter in application layer (numeric comparison on string column)
  if (minProb !== null) {
    rows = rows.filter((r) => parseFloat(r.probability ?? '0') >= minProb)
  }
  const hasMore = rows.length > limit
  const pageRows = rows.slice(0, limit)
  const nextCursor = hasMore
    ? Buffer.from(
        `${pageRows[pageRows.length - 1].occurredAt.toISOString()}|${pageRows[pageRows.length - 1].id}`,
      ).toString('base64')
    : null
  return {
    status: 200,
    body: {
      items: pageRows.map((r) => ({
        id: r.id,
        caseId: r.caseId,
        occurredAt: r.occurredAt.toISOString(),
        probability: r.probability,
        predictedBreach: r.predictedBreach,
        actualBreach: r.actualBreach,
        modelId: r.modelId,
        modelKey: r.modelKey,
        inferenceRunId: r.inferenceRunId,
        createdAt: r.createdAt.toISOString(),
        ...(includeFeatures ? { features: r.featuresJson } : {}),
      })),
      nextCursor,
      total: pageRows.length,
    },
  }
}
