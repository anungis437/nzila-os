/**
 * @nzila/tool-fabric — governance decision binding
 *
 * Tool Fabric does not invent governance authority. A trust decision is only
 * valid if an authoritative system (behind GovernanceDecisionVerifier) vouches
 * that the decision exists, applies to this tool and artifact digest, was made
 * by an entitled role, and has not been revoked or superseded.
 *
 * `VerifiedGovernanceDecision` objects are minted only by
 * verifyGovernanceDecision(). The runtime registry check (not the TypeScript
 * type) is the control: a hand-built or JSON-deserialised object fails it.
 *
 * No backing governance-decision authority exists in the platform for tool
 * trust today. NullGovernanceDecisionVerifier is therefore the default and
 * denies everything.
 */
import { z } from 'zod'

import {
  GOVERNANCE_DECISION_KINDS,
  GOVERNANCE_DECISION_OUTCOMES,
  type GovernanceDecisionSnapshot,
} from './types'

export interface GovernanceDecisionVerifier {
  /** Returns the authoritative snapshot, or null when the decision is unknown. */
  verify(decisionRef: string): Promise<GovernanceDecisionSnapshot | null>
}

export class NullGovernanceDecisionVerifier implements GovernanceDecisionVerifier {
  async verify(): Promise<null> {
    return null
  }
}

export class GovernanceVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GovernanceVerificationError'
  }
}

export type VerifiedGovernanceDecision = Readonly<GovernanceDecisionSnapshot>

export const governanceSnapshotSchema = z
  .object({
    decisionRef: z.string().min(1),
    kind: z.enum(GOVERNANCE_DECISION_KINDS),
    subject: z.string().min(1),
    subjectDigest: z.string().min(1).nullable(),
    outcome: z.enum(GOVERNANCE_DECISION_OUTCOMES),
    decidedByRole: z.string().min(1),
    authorityBasis: z.string().min(1),
    evidenceRefs: z.array(z.string().min(1)),
    source: z.string().min(1),
    verifiedAt: z.string().datetime(),
    status: z.enum(['ACTIVE', 'REVOKED', 'SUPERSEDED']),
    boundIntentHash: z.string().min(1).optional(),
    validUntil: z.string().datetime().optional(),
  })
  .strict()

const minted = new WeakSet<object>()

function mint(snapshot: GovernanceDecisionSnapshot): VerifiedGovernanceDecision {
  const frozen = Object.freeze({
    ...snapshot,
    evidenceRefs: Object.freeze([...snapshot.evidenceRefs]),
  })
  minted.add(frozen)
  return frozen
}

/** True only for objects minted by this module. Forgeries fail closed. */
export function isVerifiedGovernanceDecision(value: unknown): value is VerifiedGovernanceDecision {
  return typeof value === 'object' && value !== null && minted.has(value)
}

/**
 * Asks the authoritative verifier about a decision reference and mints a
 * verified decision only if the answer is well-formed, matches the reference,
 * and is ACTIVE.
 */
export async function verifyGovernanceDecision(
  verifier: GovernanceDecisionVerifier,
  decisionRef: string,
  now: Date = new Date(),
): Promise<VerifiedGovernanceDecision> {
  if (!decisionRef.trim()) throw new GovernanceVerificationError('decision reference is required')
  const raw = await verifier.verify(decisionRef)
  if (raw === null) throw new GovernanceVerificationError(`decision "${decisionRef}" could not be verified`)

  const parsed = governanceSnapshotSchema.safeParse(raw)
  if (!parsed.success) throw new GovernanceVerificationError('verifier returned a malformed decision')
  const snapshot = parsed.data as GovernanceDecisionSnapshot

  if (snapshot.decisionRef !== decisionRef) {
    throw new GovernanceVerificationError('verifier returned a different decision than requested')
  }
  if (snapshot.status !== 'ACTIVE') {
    throw new GovernanceVerificationError(`decision "${decisionRef}" is ${snapshot.status}`)
  }
  if (snapshot.validUntil && new Date(snapshot.validUntil).getTime() <= now.getTime()) {
    throw new GovernanceVerificationError(`decision "${decisionRef}" has expired`)
  }
  return mint(snapshot)
}

/**
 * Rebuilds a verified decision from a snapshot already recorded in the trust
 * ledger. Used only by ledger replay; NOT re-exported from the package
 * barrel. Replay trusts the ledger's own integrity chain; current validity is
 * re-checked against the verifier at execution time (see gate.ts).
 */
export function rehydrateRecordedDecision(snapshot: GovernanceDecisionSnapshot): VerifiedGovernanceDecision {
  const parsed = governanceSnapshotSchema.parse(snapshot)
  return mint(parsed as GovernanceDecisionSnapshot)
}
