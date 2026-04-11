/**
 * @nzila/os-core — Evidence Pack Lifecycle State Machine
 *
 * Enforces the only valid status transitions for evidence packs:
 *
 *   draft  →  sealed   (via seal())
 *   sealed →  verified (via markVerified())
 *   sealed →  expired  (via markExpired())
 *   verified → expired  (via markExpired())
 *
 * Invariants:
 *  - A draft exists only in memory, never persisted to Blob or DB.
 *  - seal() is one-shot: once sealed, the pack CANNOT be re-sealed.
 *  - Artifacts can only be added to a draft; sealed packs are immutable.
 *  - persistSealedEvidencePack() accepts ONLY SealedEvidencePack objects.
 *
 * @invariant INV-14: Draft packs never leave process memory
 * @invariant INV-15: Seal-once — re-sealing a sealed pack throws
 */
import { createHash } from 'node:crypto'
import { generateSeal, type SealEnvelope, type SealOptions } from './seal'
import type { ArtifactDescriptor, ControlFamily, EvidenceEventType, BlobContainer } from './types'

// ── Status types ────────────────────────────────────────────────────────────

export type EvidencePackStatus = 'draft' | 'sealed' | 'verified' | 'expired'

/**
 * Valid status transitions. Any transition not listed here is illegal.
 */
const VALID_TRANSITIONS: Record<EvidencePackStatus, EvidencePackStatus[]> = {
  draft: ['sealed'],
  sealed: ['verified', 'expired'],
  verified: ['expired'],
  expired: [],
}

// ── Errors ──────────────────────────────────────────────────────────────────

export class LifecycleTransitionError extends Error {
  readonly from: EvidencePackStatus
  readonly to: EvidencePackStatus

  constructor(from: EvidencePackStatus, to: EvidencePackStatus) {
    super(`Invalid evidence pack transition: ${from} → ${to}`)
    this.name = 'LifecycleTransitionError'
    this.from = from
    this.to = to
  }
}

export class SealOnceViolationError extends Error {
  readonly packId: string

  constructor(packId: string) {
    super(`Evidence pack "${packId}" is already sealed — re-sealing is prohibited`)
    this.name = 'SealOnceViolationError'
    this.packId = packId
  }
}

export class DraftMutationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DraftMutationError'
  }
}

// ── Transition guard ────────────────────────────────────────────────────────

/**
 * Assert that a status transition is valid. Throws LifecycleTransitionError
 * if the transition is not in the VALID_TRANSITIONS map.
 */
export function assertValidTransition(
  from: EvidencePackStatus,
  to: EvidencePackStatus,
): void {
  const allowed = VALID_TRANSITIONS[from]
  if (!allowed || !allowed.includes(to)) {
    throw new LifecycleTransitionError(from, to)
  }
}

// ── Draft builder ───────────────────────────────────────────────────────────

export interface EvidencePackDraftOptions {
  /** Unique pack identifier (e.g. IR-2026-001) */
  packId: string
  /** Entity UUID (Org scope) */
  orgId: string
  /** Control family for this evidence */
  controlFamily: ControlFamily
  /** Type of triggering event */
  eventType: EvidenceEventType
  /** ID of the triggering event */
  eventId: string
  /** Blob container to upload into */
  blobContainer?: BlobContainer
  /** Human-readable summary */
  summary?: string
  /** Control IDs covered */
  controlsCovered?: string[]
  /** Auth user ID or "system" */
  createdBy: string
}

/**
 * In-memory-only evidence pack draft. Artifacts can be added freely.
 * Calling seal() transitions to SealedEvidencePack and locks the draft.
 * A draft is NEVER persisted — it exists only in process memory (INV-14).
 */
export interface EvidencePackDraft {
  readonly status: 'draft'
  readonly packId: string
  readonly orgId: string
  readonly controlFamily: ControlFamily
  readonly eventType: EvidenceEventType
  readonly eventId: string
  readonly blobContainer: BlobContainer
  readonly summary: string
  readonly controlsCovered: string[]
  readonly createdBy: string
  readonly artifacts: ReadonlyArray<ArtifactDescriptor>

  /** Add one artifact to the draft. Throws if already sealed. */
  addArtifact(artifact: ArtifactDescriptor): void

  /**
   * Seal the pack. Returns a SealedEvidencePack with a cryptographic seal.
   * This is a one-shot operation — the draft becomes unusable after sealing.
   * @throws SealOnceViolationError if called a second time
   */
  seal(opts?: SealOptions): SealedEvidencePack
}

/**
 * Immutable sealed evidence pack. No further modifications are possible.
 * This is the only form accepted by persistSealedEvidencePack().
 */
export interface SealedEvidencePack {
  readonly status: 'sealed'
  readonly packId: string
  readonly orgId: string
  readonly controlFamily: ControlFamily
  readonly eventType: EvidenceEventType
  readonly eventId: string
  readonly blobContainer: BlobContainer
  readonly summary: string
  readonly controlsCovered: string[]
  readonly createdBy: string
  readonly artifacts: ReadonlyArray<ArtifactDescriptor>
  readonly seal: SealEnvelope
  readonly sealedAt: string
}

// ── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a new in-memory evidence pack draft.
 *
 * Usage:
 *   const draft = createEvidencePackDraft({ packId, orgId, ... })
 *   draft.addArtifact(artifact1)
 *   draft.addArtifact(artifact2)
 *   const sealed = draft.seal()
 *   // sealed: SealedEvidencePack — ready for persistence
 */
export function createEvidencePackDraft(
  opts: EvidencePackDraftOptions,
): EvidencePackDraft {
  const artifacts: ArtifactDescriptor[] = []
  let isSealed = false

  const draft: EvidencePackDraft = {
    get status() {
      return 'draft' as const
    },
    packId: opts.packId,
    orgId: opts.orgId,
    controlFamily: opts.controlFamily,
    eventType: opts.eventType,
    eventId: opts.eventId,
    blobContainer: opts.blobContainer ?? 'evidence',
    summary: opts.summary ?? '',
    controlsCovered: opts.controlsCovered ?? [],
    createdBy: opts.createdBy,

    get artifacts() {
      return Object.freeze([...artifacts])
    },

    addArtifact(artifact: ArtifactDescriptor) {
      if (isSealed) {
        throw new DraftMutationError(
          `Cannot add artifact to pack "${opts.packId}" — draft has been sealed`,
        )
      }
      artifacts.push(artifact)
    },

    seal(sealOpts?: SealOptions): SealedEvidencePack {
      if (isSealed) {
        throw new SealOnceViolationError(opts.packId)
      }

      if (artifacts.length === 0) {
        throw new DraftMutationError(
          `Cannot seal pack "${opts.packId}" — no artifacts added`,
        )
      }

      // Build the index structure for sealing
      const sealableArtifacts = artifacts.map((a) => ({
        artifactId: a.artifactId,
        artifactType: a.artifactType,
        filename: a.filename,
        sha256: createHash('sha256').update(a.buffer).digest('hex'),
        contentType: a.contentType,
        sizeBytes: a.buffer.length,
        retentionClass: a.retentionClass,
        classification: a.classification ?? 'INTERNAL',
      }))

      const sealableIndex = {
        packId: opts.packId,
        orgId: opts.orgId,
        controlFamily: opts.controlFamily,
        eventType: opts.eventType,
        eventId: opts.eventId,
        summary: opts.summary ?? '',
        controlsCovered: opts.controlsCovered ?? [],
        createdBy: opts.createdBy,
        artifacts: sealableArtifacts,
      }

      const seal = generateSeal(sealableIndex, sealOpts)

      // Lock the draft — no further mutations
      isSealed = true

      return Object.freeze({
        status: 'sealed' as const,
        packId: opts.packId,
        orgId: opts.orgId,
        controlFamily: opts.controlFamily,
        eventType: opts.eventType,
        eventId: opts.eventId,
        blobContainer: opts.blobContainer ?? 'evidence',
        summary: opts.summary ?? '',
        controlsCovered: opts.controlsCovered ?? [],
        createdBy: opts.createdBy,
        artifacts: Object.freeze([...artifacts]),
        seal,
        sealedAt: seal.sealedAt,
      })
    },
  }

  return draft
}

// ── Persistence gate ────────────────────────────────────────────────────────

/**
 * Type guard ensuring only sealed packs reach persistence.
 * This is the ONLY function that should be called before writing to DB/Blob.
 */
export function isSealedEvidencePack(
  pack: EvidencePackDraft | SealedEvidencePack | { status: string },
): pack is SealedEvidencePack {
  return (
    pack.status === 'sealed' &&
    'seal' in pack &&
    (pack as SealedEvidencePack).seal != null
  )
}

/**
 * Assert that a pack is sealed. Throws if not.
 * Use as a persistence gate: assertSealed(pack) before writing.
 */
export function assertSealed(
  pack: EvidencePackDraft | SealedEvidencePack | { status: string },
): asserts pack is SealedEvidencePack {
  if (!isSealedEvidencePack(pack)) {
    const packId = 'packId' in pack ? (pack as { packId: string }).packId : 'unknown'
    throw new DraftMutationError(
      `Cannot persist evidence pack "${packId}" — pack is not sealed (status: ${pack.status})`,
    )
  }
}
