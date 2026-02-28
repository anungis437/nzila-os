/**
 * NACP Evidence Packs — Terminal/Irreversible Events
 *
 * Defines which NACP exam events are terminal (cannot be undone)
 * and generates signed evidence packs with hash chains for
 * regulatory compliance and integrity verification.
 *
 * Terminal events:
 * - Submission sealed — exam answers cryptographically locked
 * - Grading finalized — results are immutable and officially recorded
 * - Export generated — data has crossed the system boundary
 *
 * @module @nacp/evidence-packs
 */
import {
  buildEvidencePackFromAction,
  processEvidencePack,
  type GovernanceActionContext,
  type EvidencePackResult,
} from '@nzila/os-core/evidence'
import { generateSeal, type SealEnvelope } from '@nzila/os-core/evidence/seal'

// ── Terminal Event Definitions ─────────────────────────────────────────────

export const NACP_TERMINAL_EVENTS = [
  'SUBMISSION_SEALED',
  'GRADING_FINALIZED',
  'EXPORT_GENERATED',
] as const

export type NacpTerminalEvent = (typeof NACP_TERMINAL_EVENTS)[number]

export function isNacpTerminalEvent(action: string): action is NacpTerminalEvent {
  return (NACP_TERMINAL_EVENTS as readonly string[]).includes(action)
}

// ── Evidence Pack Context ──────────────────────────────────────────────────

export interface NacpEvidenceContext {
  /** The terminal action triggering evidence creation */
  action: NacpTerminalEvent
  /** Org that owns this exam session */
  orgId: string
  /** Actor executing the terminal action */
  actorId: string
  /** Correlation ID for distributed tracing */
  correlationId: string
  /** Entity type (e.g. 'exam_session', 'exam_submission', 'exam_result') */
  entityType: string
  /** Entity ID */
  entityId: string
  /** State transition */
  fromState?: string
  toState?: string
  /** Additional evidence artifacts */
  artifacts?: Record<string, unknown>
  /** Summary for evidence record */
  summary?: string
}

// ── Evidence Pack Result ───────────────────────────────────────────────────

export interface NacpEvidencePackResult {
  /** The platform evidence pack result */
  evidencePack: EvidencePackResult
  /** The sealed envelope for tamper detection */
  seal: SealEnvelope
  /** Hash chain entry for this evidence pack */
  hashChainEntry: HashChainEntry
  /** Timestamp of evidence creation */
  createdAt: string
}

// ── Hash Chain for Integrity ───────────────────────────────────────────────

export interface HashChainEntry {
  /** Sequential index in the chain */
  index: number
  /** SHA-256 hash of this entry's content */
  contentHash: string
  /** Hash of the previous chain entry (genesis = '0'.repeat(64)) */
  previousHash: string
  /** Combined hash linking this entry to the chain */
  chainHash: string
  /** Timestamp */
  timestamp: string
}

/**
 * Compute a hash chain entry linking a new evidence pack to the chain.
 * Genesis block uses zero-hash as previous.
 */
export function computeHashChainEntry(
  index: number,
  contentHash: string,
  previousHash: string,
): HashChainEntry {
  const { createHash } = require('node:crypto') as typeof import('node:crypto')
  const timestamp = new Date().toISOString()

  const chainInput = `${index}:${contentHash}:${previousHash}:${timestamp}`
  const chainHash = createHash('sha256').update(chainInput).digest('hex')

  return {
    index,
    contentHash,
    previousHash,
    chainHash,
    timestamp,
  }
}

/**
 * Verify that a hash chain entry is valid given its predecessor.
 */
export function verifyHashChainEntry(
  entry: HashChainEntry,
  expectedPreviousHash: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (entry.previousHash !== expectedPreviousHash) {
    errors.push(
      `Previous hash mismatch: expected ${expectedPreviousHash}, got ${entry.previousHash}`,
    )
  }

  const { createHash } = require('node:crypto') as typeof import('node:crypto')
  const expectedChainInput = `${entry.index}:${entry.contentHash}:${entry.previousHash}:${entry.timestamp}`
  const expectedChainHash = createHash('sha256')
    .update(expectedChainInput)
    .digest('hex')

  if (entry.chainHash !== expectedChainHash) {
    errors.push(`Chain hash mismatch: expected ${expectedChainHash}, got ${entry.chainHash}`)
  }

  return { valid: errors.length === 0, errors }
}

// ── Evidence Pack Builder ──────────────────────────────────────────────────

/**
 * Build and seal an evidence pack for a NACP terminal event.
 *
 * This function:
 * 1. Validates the event is terminal (throws if not)
 * 2. Builds a GovernanceActionContext for the evidence pipeline
 * 3. Creates the sealed evidence pack with Merkle root + HMAC
 * 4. Computes a hash chain entry linking to the previous entry
 *
 * The caller MUST persist both the evidence pack reference and
 * the hash chain entry.
 */
export async function buildNacpEvidencePack(
  ctx: NacpEvidenceContext,
  previousChainHash?: string,
  chainIndex?: number,
): Promise<NacpEvidencePackResult> {
  if (!isNacpTerminalEvent(ctx.action)) {
    throw new Error(
      `NACP evidence packs are only created for terminal events. ` +
        `Got: ${ctx.action}. Terminal events: ${NACP_TERMINAL_EVENTS.join(', ')}`,
    )
  }

  // Map to platform evidence action context
  const govAction: GovernanceActionContext = {
    actionId: `nacp-${ctx.action}-${ctx.entityId}`,
    actionType: ctx.action,
    orgId: ctx.orgId,
    executedBy: ctx.actorId,
  }

  // Build and process the evidence pack
  const pack = await buildEvidencePackFromAction(govAction)
  const evidencePack = await processEvidencePack(pack)

  // Seal with cryptographic envelope
  const { createHash } = require('node:crypto') as typeof import('node:crypto')
  const sealInput = {
    packDigest: evidencePack.packId ?? ctx.entityId,
    artifacts: Object.keys(ctx.artifacts ?? {}).map((key) => ({
      sha256: createHash('sha256').update(String(ctx.artifacts?.[key] ?? key)).digest('hex'),
      name: key,
    })),
  }
  const seal = generateSeal(sealInput)

  // Compute hash chain entry
  const contentHash = createHash('sha256')
    .update(JSON.stringify({ packId: evidencePack.packId, sealDigest: seal.packDigest }))
    .digest('hex')

  const prevHash = previousChainHash ?? '0'.repeat(64)
  const idx = chainIndex ?? 0
  const hashChainEntry = computeHashChainEntry(idx, contentHash, prevHash)

  return {
    evidencePack,
    seal,
    hashChainEntry,
    createdAt: new Date().toISOString(),
  }
}
