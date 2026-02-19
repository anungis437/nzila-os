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
  entityId: string
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
      entityId: input.entityId,
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
    entityId: input.entityId,
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
  entityId: string
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
    .where(eq(auditEvents.entityId, input.entityId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(1)

  const previousHash = latest?.hash ?? null

  const payload = {
    entityId: input.entityId,
    actorClerkUserId: input.actorClerkUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    afterJson: input.afterJson ?? null,
    timestamp: new Date().toISOString(),
  }

  const hash = computeEntryHash(payload, previousHash)

  await db.insert(auditEvents).values({
    entityId: input.entityId,
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
