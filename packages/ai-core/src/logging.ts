/**
 * @nzila/ai-core — Request logging
 *
 * Writes to ai_requests + ai_request_payloads + audit_events.
 * Handles hashing, encryption, and payload storage.
 */
import { createHash, createCipheriv, randomBytes } from 'node:crypto'
import { db } from '@nzila/db'
import { aiRequests, aiRequestPayloads, auditEvents } from '@nzila/db/schema'
import { computeEntryHash } from '@nzila/os-core/hash'
import { getAiEnv } from '@nzila/os-core/ai-env'
import { eq, desc } from 'drizzle-orm'
import type { AiFeature, AiProvider, DataClass, AiTrace } from './types'

// ── Hashing ─────────────────────────────────────────────────────────────────

export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}

// ── Encryption ──────────────────────────────────────────────────────────────

function encryptPayload(plaintext: string): { ciphertext: string; iv: string } {
  const env = getAiEnv()
  if (!env.AI_ENCRYPTION_KEY) {
    throw new Error('AI_ENCRYPTION_KEY required for payload encryption')
  }
  const keyBuffer = Buffer.from(env.AI_ENCRYPTION_KEY, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')
  return {
    ciphertext: encrypted + ':' + tag,
    iv: iv.toString('hex'),
  }
}

// ── Log request ─────────────────────────────────────────────────────────────

export interface LogAiRequestInput {
  orgId: string
  appKey: string
  profileKey: string
  feature: AiFeature
  promptVersionId?: string
  provider: AiProvider
  modelOrDeployment: string
  requestBody: unknown
  responseBody: unknown
  inputRedacted: boolean
  tokensIn: number | null
  tokensOut: number | null
  costUsd: number | null
  latencyMs: number
  status: 'success' | 'refused' | 'failed'
  errorCode?: string
  createdBy: string | null
  dataClass: DataClass
  trace?: AiTrace
}

/**
 * Log an AI request with hashes and optionally store payloads.
 * Also appends a hash-chained audit_event.
 */
export async function logAiRequest(
  input: LogAiRequestInput,
): Promise<{ requestId: string; requestHash: string; responseHash: string }> {
  const env = getAiEnv()

  const requestStr = JSON.stringify(input.requestBody ?? '')
  const responseStr = JSON.stringify(input.responseBody ?? '')

  const requestHash = sha256(requestStr)
  const responseHash = sha256(responseStr)

  // 1. Insert ai_requests row
  const [row] = await db
    .insert(aiRequests)
    .values({
      orgId: input.orgId,
      appKey: input.appKey,
      profileKey: input.profileKey,
      feature: input.feature,
      promptVersionId: input.promptVersionId ?? undefined,
      provider: input.provider,
      modelOrDeployment: input.modelOrDeployment,
      requestHash,
      responseHash,
      inputRedacted: input.inputRedacted,
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      costUsd: input.costUsd != null ? String(input.costUsd) : undefined,
      latencyMs: input.latencyMs,
      status: input.status,
      errorCode: input.errorCode ?? undefined,
      createdBy: input.createdBy,
    })
    .returning({ id: aiRequests.id })

  // 2. Optionally store payloads
  if (env.AI_LOG_PAYLOADS) {
    const needsEncrypt =
      (input.dataClass === 'sensitive' || input.dataClass === 'regulated') &&
      !!env.AI_ENCRYPTION_KEY

    let reqJson: unknown = input.requestBody
    let resJson: unknown = input.responseBody
    let encrypted = false

    if (needsEncrypt) {
      const encReq = encryptPayload(requestStr)
      const encRes = encryptPayload(responseStr)
      reqJson = { ciphertext: encReq.ciphertext, iv: encReq.iv }
      resJson = { ciphertext: encRes.ciphertext, iv: encRes.iv }
      encrypted = true
    }

    await db.insert(aiRequestPayloads).values({
      requestId: row.id,
      requestJson: reqJson,
      responseJson: resJson,
      encrypted,
    })
  }

  // 3. Append hash-chained audit event
  await appendAiAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: input.createdBy ?? 'system',
    action: 'ai.request_executed',
    targetType: 'ai_request',
    targetId: row.id,
    afterJson: {
      appKey: input.appKey,
      feature: input.feature,
      provider: input.provider,
      model: input.modelOrDeployment,
      status: input.status,
      requestHash: requestHash.slice(0, 12),
      responseHash: responseHash.slice(0, 12),
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      costUsd: input.costUsd,
      latencyMs: input.latencyMs,
      correlationId: input.trace?.correlationId,
    },
  })

  return { requestId: row.id, requestHash, responseHash }
}

// ── Audit event helper ──────────────────────────────────────────────────────

async function appendAiAuditEvent(input: {
  orgId: string
  actorClerkUserId: string
  action: string
  targetType: string
  targetId?: string
  afterJson?: Record<string, unknown>
}): Promise<void> {
  // Get latest hash for chain
  const [latest] = await db
    .select({ hash: auditEvents.hash })
    .from(auditEvents)
    .where(eq(auditEvents.orgId, input.orgId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(1)

  const previousHash = latest?.hash ?? null

  const payload = {
    orgId: input.orgId,
    actorClerkUserId: input.actorClerkUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    afterJson: input.afterJson ?? null,
    timestamp: new Date().toISOString(),
  }

  const hash = computeEntryHash(payload, previousHash)

  await db.insert(auditEvents).values({
    orgId: input.orgId,
    actorClerkUserId: input.actorClerkUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? undefined,
    afterJson: input.afterJson,
    hash,
    previousHash,
  })
}

export { appendAiAuditEvent }

// ── Structured metric emission ──────────────────────────────────────────────

/**
 * Emit a structured AI metric to stdout in a format compatible with
 * Azure Monitor / Application Insights custom metrics.
 *
 * Each metric line is a JSON object on a single line tagged with the
 * "nzila.ai.metric" prefix so that Azure Monitor log-based alerts or
 * Log Analytics workspace queries can filter and aggregate them.
 *
 * NZ-RISK-020 — AI gateway telemetry instrumentation.
 */
export interface AiMetricPayload {
  /** Which app originated this call (e.g. "union-eyes", "console"). */
  appKey: string
  /** The AI feature being measured (e.g. "grievance_triage"). */
  feature: string
  /** Providing model (e.g. "openai", "azure_openai", "anthropic"). */
  provider: string
  /** End-to-end latency in milliseconds. */
  latencyMs: number
  /** Input token count (null if embedding). */
  tokensIn: number | null
  /** Output token count (null if embedding). */
  tokensOut: number | null
  /** Estimated USD cost for this call. */
  costUsd: number | null
  /**
   * Estimated CO₂ in grams for this call (NZ-RISK-027).
   * Computed from token count × per-model carbon intensity constant.
   * Stored in the metric stream; DB column pending migration.
   */
  co2EstimateGrams?: number
  /** Whether the model refused the request. */
  refused: boolean
  /** Whether the call resulted in an error. */
  errored: boolean
  /** Org identifier (opaque — NOT a PII-bearing value). */
  orgId: string
  /** Optional correlation ID for distributed tracing. */
  correlationId?: string
}

export function emitAiMetric(payload: AiMetricPayload): void {
  // The structured log line is intentionally synchronous and non-blocking.
  // Azure Monitor / Application Insights ingests stdout in containerized workloads.
  const metric = {
    _type: 'nzila.ai.metric',
    timestamp: new Date().toISOString(),
    ...payload,
  }
  // Write to stdout, not stderr, so it is captured by log-forwarding agents.
  process.stdout.write(JSON.stringify(metric) + '\n')
}

