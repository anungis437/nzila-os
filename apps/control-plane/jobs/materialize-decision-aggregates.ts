// Materialize Decision Aggregates Job — Phase 4.6
//
// --mode=incremental (default): cursor-based from checkpoint
// --mode=full_rebuild: full table reprocess — requires --confirm-full-rebuild
// --mode=org_specific: single-org pass — requires --organizationId=<uuid>
// --mode=dry_run: no writes; deterministic fixture mode without DATABASE_URL
// --mode=repair: idempotent full re-computation; never mutates audit_records
//
// Options:
//   --window=daily (default) | weekly | monthly
//   --organizationId=<uuid>
//   --from=<ISO>  / --to=<ISO>  (optional explicit range)
//   --confirm-full-rebuild  (safety gate for full_rebuild mode)
//   --skip-integrity-check  (NOT ALLOWED in production)
//   --max-attempts=<n>  (default: 3; exponential backoff retry)

import crypto from 'node:crypto'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import {
  auditRecords,
  decisionAggregates,
  decisionPipelineCheckpoints,
  decisionPipelineRuns,
} from '@nzila/db/schema'
import {
  aggregateDecisionRecords,
  computeFreshnessLag,
  type DecisionAggregateInputRecord,
  evaluateFreshnessSla,
} from '@nzila/decision-intelligence'
import {
  buildAggregateIntegrityReport,
  verifyAggregateCompleteness,
  verifyAggregateConsistency,
  detectAggregateAnomalies,
  type AggregateIntegrityReport,
} from '@nzila/decision-intelligence/integrity'
import {
  buildPipelineAlert,
  evaluatePipelineAlerts,
  sendPipelineAlert,
} from '@nzila/pipeline-alerting'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('control-plane:jobs:materialize-decision-aggregates')
const PIPELINE_NAME = 'decision-aggregate-materialization'

// ── Error codes ───────────────────────────────────────────────────────────

const ErrorCode = {
  MISSING_DATABASE_URL: 'MISSING_DATABASE_URL',
  INVALID_MODE: 'INVALID_MODE',
  MISSING_ORG_ID: 'MISSING_ORG_ID',
  FULL_REBUILD_CONFIRMATION_REQUIRED: 'FULL_REBUILD_CONFIRMATION_REQUIRED',
  AGGREGATE_WRITE_FAILED: 'AGGREGATE_WRITE_FAILED',
  CHECKPOINT_WRITE_FAILED: 'CHECKPOINT_WRITE_FAILED',
  FRESHNESS_SLA_BREACHED: 'FRESHNESS_SLA_BREACHED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INTEGRITY_CRITICAL: 'INTEGRITY_CRITICAL',
  NAR_CHAIN_MISMATCH: 'NAR_CHAIN_MISMATCH',
  REPAIR_SCOPE_UNCLEAR: 'REPAIR_SCOPE_UNCLEAR',
  REPAIR_SOURCE_MALFORMED: 'REPAIR_SOURCE_MALFORMED',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
} as const
type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

const DEFAULT_MAX_ATTEMPTS = 3

// ── CLI arg parsing ───────────────────────────────────────────────────────

type Mode = 'incremental' | 'full_rebuild' | 'org_specific' | 'dry_run' | 'repair'
type WindowSize = 'daily' | 'weekly' | 'monthly'

interface JobArgs {
  mode: Mode
  windowSize: WindowSize
  organizationId: string | undefined
  from: Date | undefined
  to: Date | undefined
  confirmFullRebuild: boolean
  skipIntegrityCheck: boolean
  maxAttempts: number
}

function parseArgs(): JobArgs {
  const argv = process.argv.slice(2)
  const rawMode = argv.find((a) => a.startsWith('--mode='))?.slice(7) ?? 'incremental'
  const rawWindow = argv.find((a) => a.startsWith('--window='))?.slice(9) ?? 'daily'
  const rawOrganizationId = argv.find((a) => a.startsWith('--organizationId='))?.slice(17)
  const rawFrom = argv.find((a) => a.startsWith('--from='))?.slice(7)
  const rawTo = argv.find((a) => a.startsWith('--to='))?.slice(5)
  const confirmFullRebuild = argv.includes('--confirm-full-rebuild')
  const skipIntegrityCheck = argv.includes('--skip-integrity-check')
  const rawMaxAttempts = argv.find((a) => a.startsWith('--max-attempts='))?.slice(15)
  const maxAttempts = rawMaxAttempts
    ? Math.max(1, parseInt(rawMaxAttempts, 10))
    : DEFAULT_MAX_ATTEMPTS

  const validModes: Mode[] = ['incremental', 'full_rebuild', 'org_specific', 'dry_run', 'repair']
  if (!validModes.includes(rawMode as Mode)) {
    logger.error(`Invalid --mode value: ${rawMode}`, { valid: validModes })
    process.exit(1)
  }

  const mode = rawMode as Mode
  const windowSize: WindowSize =
    rawWindow === 'weekly' ? 'weekly' : rawWindow === 'monthly' ? 'monthly' : 'daily'

  return {
    mode,
    windowSize,
    organizationId: rawOrganizationId,
    from: rawFrom ? new Date(rawFrom) : undefined,
    to: rawTo ? new Date(rawTo) : undefined,
    confirmFullRebuild,
    skipIntegrityCheck,
    maxAttempts,
  }
}

function validateArgs(args: JobArgs): void {
  if (args.mode === 'full_rebuild' && !args.confirmFullRebuild) {
    logger.error('full_rebuild mode requires --confirm-full-rebuild flag', {
      errorCode: ErrorCode.FULL_REBUILD_CONFIRMATION_REQUIRED,
    })
    process.exit(1)
  }
  if (args.mode === 'org_specific' && !args.organizationId) {
    logger.error('org_specific mode requires --organizationId=<uuid>', {
      errorCode: ErrorCode.MISSING_ORG_ID,
    })
    process.exit(1)
  }
  // Phase 4.6: --skip-integrity-check is forbidden in production
  if (args.skipIntegrityCheck && process.env['NODE_ENV'] === 'production') {
    logger.error('--skip-integrity-check is forbidden in production', {
      errorCode: ErrorCode.INTEGRITY_CRITICAL,
    })
    process.exit(1)
  }
}

// ── NAR chain check ───────────────────────────────────────────────────────

/**
 * Checks that audit records for each org have no anomalous time gaps.
 * Returns true if the chain appears valid, false if a gap > 30 days is detected.
 * Gaps of exactly zero (same-millisecond) are allowed.
 */
async function checkNarChain(orgIds: string[]): Promise<boolean> {
  const GAP_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

  for (const orgId of orgIds) {
    const rows = await platformDb
      .select({ createdAt: auditRecords.createdAt, id: auditRecords.id })
      .from(auditRecords)
      .where(eq(auditRecords.organizationId, orgId))
      .orderBy(auditRecords.createdAt)

    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!
      const curr = rows[i]!
      const gapMs = curr.createdAt.getTime() - prev.createdAt.getTime()
      if (gapMs > GAP_THRESHOLD_MS) {
        logger.warn('NAR chain gap detected', {
          organizationId: orgId,
          gapMs,
          prevId: prev.id,
          currId: curr.id,
        })
        return false
      }
    }
  }

  return true
}

// ── Time-window helpers ───────────────────────────────────────────────────

/**
 * Returns a stable string bucket key for a given timestamp and window size.
 * Keys are UTC-aligned.
 */
function windowBucketKey(date: Date, windowSize: WindowSize): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')

  switch (windowSize) {
    case 'daily':
      return `${y}-${m}-${d}`
    case 'weekly': {
      // Roll back to the Monday of the containing week
      const dow = date.getUTCDay() // 0=Sun, 1=Mon, …, 6=Sat
      const monday = new Date(date)
      monday.setUTCDate(date.getUTCDate() - ((dow + 6) % 7))
      const wy = monday.getUTCFullYear()
      const wm = String(monday.getUTCMonth() + 1).padStart(2, '0')
      const wd = String(monday.getUTCDate()).padStart(2, '0')
      return `W-${wy}-${wm}-${wd}`
    }
    case 'monthly':
      return `${y}-${m}`
  }
}

/**
 * Returns the inclusive start and exclusive end Date for a bucket key.
 */
function windowBounds(key: string, windowSize: WindowSize): { start: Date; end: Date } {
  switch (windowSize) {
    case 'daily': {
      const start = new Date(`${key}T00:00:00Z`)
      const end = new Date(start)
      end.setUTCDate(end.getUTCDate() + 1)
      return { start, end }
    }
    case 'weekly': {
      const datePart = key.slice(2) // strip 'W-'
      const start = new Date(`${datePart}T00:00:00Z`)
      const end = new Date(start)
      end.setUTCDate(end.getUTCDate() + 7)
      return { start, end }
    }
    case 'monthly': {
      const [rawYear, rawMonth] = key.split('-').map(Number)
      const year = rawYear ?? new Date().getUTCFullYear()
      const month = rawMonth ?? 1
      const start = new Date(Date.UTC(year, month - 1, 1))
      const end = new Date(Date.UTC(year, month, 1))
      return { start, end }
    }
  }
}

// ── DB helpers ────────────────────────────────────────────────────────────

async function loadOrgIds(filterOrgId?: string): Promise<string[]> {
  if (filterOrgId) return [filterOrgId]
  const rows = await platformDb
    .select({ organizationId: auditRecords.organizationId })
    .from(auditRecords)
    .groupBy(auditRecords.organizationId)
  return rows.map((row) => row.organizationId)
}

/** Returns the checkpoint record for this pipeline, or undefined. */
async function readCheckpoint() {
  const rows = await platformDb
    .select()
    .from(decisionPipelineCheckpoints)
    .where(eq(decisionPipelineCheckpoints.pipelineName, PIPELINE_NAME))
    .limit(1)
  return rows[0]
}

/** Upserts the checkpoint after a successful run. */
async function upsertCheckpoint(opts: {
  lastSuccessfulAuditCreatedAt: Date
  lastSuccessfulAuditId: string
  recordsScanned: number
  recordsMaterialized: number
}): Promise<void> {
  const now = new Date()
  await platformDb
    .insert(decisionPipelineCheckpoints)
    .values({
      id: crypto.randomUUID(),
      pipelineName: PIPELINE_NAME,
      lastSuccessfulAuditCreatedAt: opts.lastSuccessfulAuditCreatedAt,
      lastSuccessfulAuditId: opts.lastSuccessfulAuditId,
      lastRunStartedAt: now,
      lastRunCompletedAt: now,
      lastRunStatus: 'success',
      recordsScanned: opts.recordsScanned,
      recordsMaterialized: opts.recordsMaterialized,
      failureReason: null,
    })
    .onConflictDoUpdate({
      target: [decisionPipelineCheckpoints.pipelineName],
      set: {
        lastSuccessfulAuditCreatedAt: opts.lastSuccessfulAuditCreatedAt,
        lastSuccessfulAuditId: opts.lastSuccessfulAuditId,
        lastRunCompletedAt: now,
        lastRunStatus: 'success',
        recordsScanned: opts.recordsScanned,
        recordsMaterialized: opts.recordsMaterialized,
        failureReason: null,
        updatedAt: now,
      },
    })
}

/** Records a failure on the checkpoint (does not reset successful cursor). */
async function upsertCheckpointFailure(reason: string): Promise<void> {
  const now = new Date()
  await platformDb
    .insert(decisionPipelineCheckpoints)
    .values({
      id: crypto.randomUUID(),
      pipelineName: PIPELINE_NAME,
      lastSuccessfulAuditCreatedAt: null,
      lastSuccessfulAuditId: null,
      lastRunStartedAt: now,
      lastRunCompletedAt: now,
      lastRunStatus: 'failed',
      recordsScanned: 0,
      recordsMaterialized: 0,
      failureReason: reason,
    })
    .onConflictDoUpdate({
      target: [decisionPipelineCheckpoints.pipelineName],
      set: {
        lastRunCompletedAt: now,
        lastRunStatus: 'failed',
        failureReason: reason,
        updatedAt: now,
      },
    })
}

/** Inserts a run log entry and returns its id. */
async function insertRunLog(opts: {
  mode: Mode
  organizationId: string | undefined
  startedAt: Date
}): Promise<string> {
  const id = crypto.randomUUID()
  await platformDb.insert(decisionPipelineRuns).values({
    id,
    pipelineName: PIPELINE_NAME,
    mode: opts.mode,
    organizationId: opts.organizationId ?? null,
    startedAt: opts.startedAt,
    completedAt: null,
    status: 'running',
    recordsScanned: 0,
    recordsMaterialized: 0,
    aggregatesWritten: 0,
    freshnessLagMs: null,
    errorCode: null,
    errorMessage: null,
    metadata: null,
  })
  return id
}

/** Completes a run log entry. */
async function completeRunLog(opts: {
  runId: string
  status: 'success' | 'failed' | 'skipped'
  recordsScanned: number
  recordsMaterialized: number
  aggregatesWritten: number
  freshnessLagMs: number | null
  errorCode: string | null
  errorMessage: string | null
  metadata?: Record<string, unknown> | null
}): Promise<void> {
  await platformDb
    .update(decisionPipelineRuns)
    .set({
      completedAt: new Date(),
      status: opts.status,
      recordsScanned: opts.recordsScanned,
      recordsMaterialized: opts.recordsMaterialized,
      aggregatesWritten: opts.aggregatesWritten,
      freshnessLagMs: opts.freshnessLagMs,
      errorCode: opts.errorCode,
      errorMessage: opts.errorMessage,
      metadata: opts.metadata ?? null,
    })
    .where(eq(decisionPipelineRuns.id, opts.runId))
}

/** Returns the latest windowEnd already materialized for an org, or undefined. */
async function latestAggregateWindowEnd(orgId: string): Promise<Date | undefined> {
  const rows = await platformDb
    .select({ windowEnd: decisionAggregates.windowEnd })
    .from(decisionAggregates)
    .where(eq(decisionAggregates.organizationId, orgId))
    .orderBy(desc(decisionAggregates.windowEnd))
    .limit(1)
  return rows[0]?.windowEnd ?? undefined
}

/** Returns the most recent auditRecord.createdAt across all orgs (for freshness calc). */
async function latestAuditRecordCreatedAt(): Promise<Date | undefined> {
  const rows = await platformDb
    .select({ createdAt: auditRecords.createdAt })
    .from(auditRecords)
    .orderBy(desc(auditRecords.createdAt))
    .limit(1)
  return rows[0]?.createdAt ?? undefined
}

// ── Record conversion ─────────────────────────────────────────────────────

function toInputRecord(
  row: typeof auditRecords.$inferSelect,
): DecisionAggregateInputRecord | null {
  const payload = row.payload as Record<string, unknown>
  if (!payload || typeof payload !== 'object') return null
  return {
    organizationId: row.organizationId,
    decisionType: row.decisionType,
    createdAt: row.createdAt.toISOString(),
    policyVersion: row.policyVersion,
    payload: payload as DecisionAggregateInputRecord['payload'],
  }
}

// ── Per-org processing ────────────────────────────────────────────────────

async function processOrg(
  orgId: string,
  mode: Mode,
  windowSize: WindowSize,
  args: JobArgs,
): Promise<{ processed: number; upserted: number; latestAuditAt: Date | undefined; latestAuditId: string | undefined }> {
  // Determine the scan lower bound
  let since: Date | undefined
  if (mode === 'incremental') {
    // Use checkpoint cursor if available, fall back to latest aggregate windowEnd
    const checkpoint = await readCheckpoint()
    since = checkpoint?.lastSuccessfulAuditCreatedAt ?? await latestAggregateWindowEnd(orgId)
  } else if (mode === 'org_specific') {
    since = args.from
  } else if (mode === 'full_rebuild') {
    since = args.from // may be undefined — full scan
  }
  // dry_run: no DB, use fixture
  if (mode === 'dry_run') {
    return buildFixtureResult(orgId, windowSize)
  }

  const upper = args.to

  const whereClause = (() => {
    const conditions = [eq(auditRecords.organizationId, orgId)]
    if (since) conditions.push(gte(auditRecords.createdAt, since))
    if (upper) conditions.push(lte(auditRecords.createdAt, upper))
    return conditions.length === 1 ? conditions[0]! : and(...conditions)
  })()

  const rows = await platformDb
    .select()
    .from(auditRecords)
    .where(whereClause)
    .orderBy(auditRecords.createdAt)

  if (rows.length === 0) {
    logger.info('No audit records to process for organization', {
      organizationId: orgId,
      mode,
      since: since?.toISOString(),
    })
    return { processed: 0, upserted: 0, latestAuditAt: undefined, latestAuditId: undefined }
  }

  const latestRow = rows[rows.length - 1]!

  // Group records into time-window buckets
  const buckets = new Map<string, (typeof auditRecords.$inferSelect)[]>()
  for (const row of rows) {
    const key = windowBucketKey(row.createdAt, windowSize)
    const existing = buckets.get(key) ?? []
    existing.push(row)
    buckets.set(key, existing)
  }

  let upserted = 0

  for (const [bucketKey, bucketRows] of buckets) {
    const bounds = windowBounds(bucketKey, windowSize)
    const inputRecords = bucketRows
      .map(toInputRecord)
      .filter((r): r is DecisionAggregateInputRecord => r !== null)

    if (inputRecords.length === 0) continue

    const aggregateRows = aggregateDecisionRecords(inputRecords, {
      windowStart: bounds.start.toISOString(),
      windowEnd: bounds.end.toISOString(),
      source: 'audit_records',
    })

    for (const agg of aggregateRows) {
      const total = agg.metrics.total
      const approvals = Math.round(agg.metrics.approvalRate * total)
      const rejections = Math.round(agg.metrics.rejectionRate * total)
      const escalations = Math.round(agg.metrics.escalationRate * total)
      const pending = Math.max(0, total - approvals - rejections - escalations)

      await platformDb
        .insert(decisionAggregates)
        .values({
          id: crypto.randomUUID(),
          organizationId: agg.organizationId,
          domain: agg.domain,
          decisionType: agg.decisionType,
          policyVersion: agg.policy.version,
          windowStart: bounds.start,
          windowEnd: bounds.end,
          total,
          approvals,
          rejections,
          escalations,
          pending,
          avgDecisionTimeMs: agg.metrics.avgDecisionTimeMs,
          overrideRate: String(agg.behavior.overrideRate),
          humanInterventionRate: String(agg.behavior.humanInterventionRate),
          effectivenessScore: String(agg.policy.effectivenessScore),
          source: agg.source,
          metrics: agg.metrics,
          behavior: agg.behavior,
          meta: {
            windowKey: agg.windowKey,
            generatedAt: new Date().toISOString(),
            window: windowSize,
          },
        })
        .onConflictDoUpdate({
          target: [
            decisionAggregates.organizationId,
            decisionAggregates.decisionType,
            decisionAggregates.policyVersion,
            decisionAggregates.windowStart,
            decisionAggregates.windowEnd,
          ],
          set: {
            total,
            approvals,
            rejections,
            escalations,
            pending,
            avgDecisionTimeMs: agg.metrics.avgDecisionTimeMs,
            overrideRate: String(agg.behavior.overrideRate),
            humanInterventionRate: String(agg.behavior.humanInterventionRate),
            effectivenessScore: String(agg.policy.effectivenessScore),
            metrics: agg.metrics,
            behavior: agg.behavior,
            meta: {
              windowKey: agg.windowKey,
              generatedAt: new Date().toISOString(),
              window: windowSize,
            },
          },
        })

      upserted++
    }
  }

  return {
    processed: rows.length,
    upserted,
    latestAuditAt: latestRow.createdAt,
    latestAuditId: latestRow.id,
  }
}

/** Deterministic fixture result used in dry_run mode without a live DB. */
function buildFixtureResult(orgId: string, _windowSize: WindowSize) {
  logger.info('DRY RUN — fixture mode (no DB writes)', { organizationId: orgId })
  return {
    processed: 0,
    upserted: 0,
    latestAuditAt: undefined as Date | undefined,
    latestAuditId: undefined as string | undefined,
  }
}

// ── Entry point ───────────────────────────────────────────────────────────

async function run(): Promise<void> {
  async function runCore(args: JobArgs): Promise<void> {
    const isDryRun = args.mode === 'dry_run'
    const hasDatabaseUrl = !!process.env['DATABASE_URL']

    if (!hasDatabaseUrl && !isDryRun) {
      logger.error('DATABASE_URL is required in non-dry_run modes', {
        errorCode: ErrorCode.MISSING_DATABASE_URL,
      })
      process.exit(1)
    }

    if (args.mode === 'repair') {
      logger.info('Repair mode: idempotent full re-computation — audit_records will NOT be mutated')
    }

    const startedAt = new Date()
    const runId = isDryRun
      ? null
      : await insertRunLog({
          mode: args.mode,
          organizationId: args.organizationId,
          startedAt,
        })

    const orgIds = isDryRun
      ? args.organizationId
        ? [args.organizationId]
        : ['fixture-org-a', 'fixture-org-b']
      : await loadOrgIds(args.organizationId)

    logger.info('Starting decision aggregate materialization', {
      mode: args.mode,
      windowSize: args.windowSize,
      orgCount: orgIds.length,
      organizationId: args.organizationId,
      runId,
    })

    // NAR chain check — verify no audit record gaps exist before processing
    if (!isDryRun && args.mode !== 'repair') {
      const chainOk = await checkNarChain(orgIds)
      if (!chainOk) {
        logger.error('NAR chain mismatch detected — aborting to preserve aggregate integrity', {
          errorCode: ErrorCode.NAR_CHAIN_MISMATCH,
        })
        if (runId) {
          await completeRunLog({
            runId,
            status: 'failed',
            recordsScanned: 0,
            recordsMaterialized: 0,
            aggregatesWritten: 0,
            freshnessLagMs: null,
            errorCode: ErrorCode.NAR_CHAIN_MISMATCH,
            errorMessage: 'NAR chain mismatch — run aborted',
            metadata: null,
          })
          await upsertCheckpointFailure('NAR chain mismatch detected')
        }
        const alert = buildPipelineAlert({
          pipelineName: PIPELINE_NAME,
          severity: 'critical',
          trigger: 'nar_chain_mismatch',
          message: 'NAR chain mismatch: audit record sequence gap detected before materialization',
          runId: runId ?? undefined,
        })
        await sendPipelineAlert(alert)
        process.exit(1)
      }
    }

    let totalScanned = 0
    let totalUpserted = 0
    let overallLatestAuditAt: Date | undefined
    let overallLatestAuditId: string | undefined
    const orgResults: Record<string, { totalAmount: number; recordCount: number }> = {}

    try {
      for (const orgId of orgIds) {
        const result = await processOrg(orgId, args.mode, args.windowSize, args)
        totalScanned += result.processed
        totalUpserted += result.upserted
        orgResults[orgId] = { totalAmount: result.upserted, recordCount: result.processed }
        if (
          result.latestAuditAt &&
          (!overallLatestAuditAt || result.latestAuditAt > overallLatestAuditAt)
        ) {
          overallLatestAuditAt = result.latestAuditAt
          overallLatestAuditId = result.latestAuditId
        }
        logger.info('Processed organization', {
          organizationId: orgId,
          processed: result.processed,
          upserted: result.upserted,
        })
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (!isDryRun && runId) {
        await completeRunLog({
          runId: runId ?? undefined,
          status: 'failed',
          recordsScanned: totalScanned,
          recordsMaterialized: totalUpserted,
          aggregatesWritten: totalUpserted,
          freshnessLagMs: null,
          errorCode: ErrorCode.UNKNOWN_ERROR,
          errorMessage: msg,
          metadata: null,
        })
        await upsertCheckpointFailure(msg)
      }
      throw error
    }

    // ── Integrity checks ──────────────────────────────────────────────────
    let integrityReport: AggregateIntegrityReport | null = null
    let integritySummary:
      | {
          criticalCount: number
          warningCount: number
          passCount: number
          severity: AggregateIntegrityReport['severity']
          valid: boolean
        }
      | null = null
    let criticalIntegrityFailure = false

    if (!isDryRun && !args.skipIntegrityCheck) {
      const processedOrgCount = Object.values(orgResults).filter((r) => r.recordCount > 0).length

      const completenessCheck = verifyAggregateCompleteness({
        expectedOrgCount: orgIds.length,
        actualOrgCount: processedOrgCount,
      })

      const consistencyCheck = verifyAggregateConsistency({
        inputRecordCount: totalScanned,
        outputAggregateCount: totalUpserted,
      })

      const anomalyCheck = detectAggregateAnomalies({
        aggregatesByOrg: orgResults,
      })

      integrityReport = buildAggregateIntegrityReport([
        completenessCheck,
        consistencyCheck,
        anomalyCheck,
      ])

      integritySummary = {
        criticalCount: integrityReport.checks.filter((c) => c.status === 'fail').length,
        warningCount: integrityReport.checks.filter((c) => c.status === 'warn').length,
        passCount: integrityReport.checks.filter((c) => c.status === 'pass').length,
        severity: integrityReport.severity,
        valid: integrityReport.valid,
      }

      logger.info('Integrity report', { summary: integritySummary })

      if (integritySummary.criticalCount > 0) {
        criticalIntegrityFailure = true
        logger.error('Critical integrity failures detected', {
          errorCode: ErrorCode.INTEGRITY_CRITICAL,
          criticalCount: integritySummary.criticalCount,
        })
        const alert = buildPipelineAlert({
          pipelineName: PIPELINE_NAME,
          severity: 'critical',
          trigger: 'aggregate_verification_failed',
          message: `${integritySummary.criticalCount} critical integrity failure(s) after materialization`,
          metadata: integritySummary,
          runId: runId ?? undefined,
        })
        await sendPipelineAlert(alert)
      } else if (integritySummary.warningCount > 0) {
        logger.warn('Integrity warnings detected', {
          warningCount: integritySummary.warningCount,
        })
        const alert = buildPipelineAlert({
          pipelineName: PIPELINE_NAME,
          severity: 'warning',
          trigger: 'aggregate_verification_failed',
          message: `${integritySummary.warningCount} integrity warning(s) after materialization`,
          metadata: integritySummary,
          runId: runId ?? undefined,
        })
        await sendPipelineAlert(alert)
      }
    }

    // ── Freshness SLA ─────────────────────────────────────────────────────
    let freshnessLagMs: number | null = null
    let freshnessStatus: 'healthy' | 'warning' | 'breached' = 'healthy'
    if (!isDryRun) {
      const latestAuditAt = await latestAuditRecordCreatedAt()
      const latestWindowEnd = overallLatestAuditAt
      if (latestAuditAt && latestWindowEnd) {
        const { lagMs } = computeFreshnessLag({
          latestAuditRecordAt: latestAuditAt,
          latestAggregateWindowEnd: latestWindowEnd,
        })
        freshnessLagMs = lagMs
        const { status } = evaluateFreshnessSla({ lagMs })
        freshnessStatus = status
        logger.info('Freshness SLA evaluated', { lagMs, status })
        const freshnessAlerts = evaluatePipelineAlerts({
          pipelineName: PIPELINE_NAME,
          freshnessLagMs: lagMs,
          freshnessStatus: status === 'healthy' ? 'ok' : status,
          runId: runId ?? undefined,
        })
        for (const alert of freshnessAlerts) {
          await sendPipelineAlert(alert)
        }

        if (status === 'breached') {
          logger.warn('Freshness SLA breached', { lagMs, errorCode: ErrorCode.FRESHNESS_SLA_BREACHED })
        } else if (status === 'warning') {
          logger.warn('Freshness lag approaching SLA threshold', { lagMs })
        }
      }
    }

    // ── Persist checkpoint + run log ───────────────────────────────────────
    // Do NOT advance checkpoint on critical integrity failure
    if (!isDryRun && !criticalIntegrityFailure && overallLatestAuditAt && overallLatestAuditId) {
      await upsertCheckpoint({
        lastSuccessfulAuditCreatedAt: overallLatestAuditAt,
        lastSuccessfulAuditId: overallLatestAuditId,
        recordsScanned: totalScanned,
        recordsMaterialized: totalUpserted,
      })
    }

    const metadataPayload = integrityReport
      ? {
          integritySummary,
          freshnessLagMs,
          freshnessStatus,
        }
      : { freshnessLagMs, freshnessStatus }

    if (!isDryRun && runId) {
      await completeRunLog({
        runId,
        status: criticalIntegrityFailure ? 'failed' : 'success',
        recordsScanned: totalScanned,
        recordsMaterialized: totalUpserted,
        aggregatesWritten: totalUpserted,
        freshnessLagMs,
        errorCode: criticalIntegrityFailure
          ? ErrorCode.INTEGRITY_CRITICAL
          : freshnessStatus === 'breached'
            ? ErrorCode.FRESHNESS_SLA_BREACHED
            : null,
        errorMessage: criticalIntegrityFailure ? 'Critical integrity failures detected' : null,
        metadata: metadataPayload,
      })
    }

    logger.info('Decision aggregate materialization complete', {
      mode: args.mode,
      checkedOrganizations: orgIds.length,
      totalAuditRecords: totalScanned,
      totalAggregatesUpserted: totalUpserted,
      freshnessLagMs,
      freshnessStatus,
      runId,
      integritySummary,
    })

    if (criticalIntegrityFailure) {
      process.exit(1)
    }
    if (freshnessStatus === 'breached') {
      process.exit(2) // non-zero but distinct from hard failure
    }
  }

  async function run(): Promise<void> {
    const args = parseArgs()
    validateArgs(args)

    const maxAttempts = args.maxAttempts
    let lastError: unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await runCore(args)
        return
      } catch (error) {
        lastError = error
        const isLastAttempt = attempt === maxAttempts
        logger.warn('Job attempt failed', {
          attempt,
          maxAttempts,
          error: error instanceof Error ? error.message : String(error),
        })
        if (!isLastAttempt) {
          const delayMs = Math.min(1000 * 2 ** (attempt - 1), 30_000) // exponential backoff, cap 30s
          if (process.env['CI'] !== 'true') {
            await new Promise((resolve) => setTimeout(resolve, delayMs))
          }
        }
      }
    }

    logger.error('Max retry attempts exceeded', {
      maxAttempts,
      errorCode: ErrorCode.MAX_RETRIES_EXCEEDED,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    })
    process.exit(1)
  }

  run().catch((error) => {
    logger.error('Decision aggregate materialization job failed', {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : { value: String(error) },
    })
    process.exit(1)
  })
}

run()
