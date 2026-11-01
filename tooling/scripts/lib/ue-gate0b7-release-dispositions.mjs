/**
 * Release dispositions for HIGH severity route defects.
 *
 * Severity says how bad a defect is. A release disposition says whether the product may ship with it, and that depends
 * on the actual exposure, the potential impact, whether the capability is active and what contains it today. Gate 0B.7
 * adds one control: every HIGH defect found from Gate 0B.7 on records an explicit disposition, and the disposition is
 * proved against the source. Being found in an inventory-only phase is never a ground for a lower disposition.
 *
 * The 0B.1 to 0B.6 defect records are frozen. They carry no disposition and their severity and release-blocking mark are
 * preserved byte for byte. The review queue lists every HIGH defect of those tranches, pins the sha256 of each frozen
 * record, and leaves its disposition empty until an independent qualification records one. The inventory cannot qualify
 * its own earlier findings.
 */
import { createHash } from 'node:crypto'
import { compareCodeUnit, nonEmpty } from './ue-gate0b1-classification.mjs'

export const FILE_REVIEW_QUEUE = 'docs/union-eyes/convergence/register/ue-release-disposition-review-queue.json'
export const QUEUE_REGISTER = 'HIGH_SEVERITY_RELEASE_DISPOSITION_REVIEW_QUEUE'
export const QUEUE_STATUS = 'AWAITING_INDEPENDENT_QUALIFICATION'
export const DISPOSITIONS = ['RELEASE_BLOCKING', 'CONDITIONALLY_BLOCKING', 'NON_BLOCKING_WITH_JUSTIFICATION']
export const ACTIVATION_STATES = [
  'REACHABLE_UNAUTHENTICATED',
  'REACHABLE_ANY_AUTHENTICATED',
  'REACHABLE_ROLE_RESTRICTED',
  'REACHABLE_ENTITLEMENT_GATED',
  'NO_CALLER_FOUND',
  'NOT_ACTIVATED',
]
export const IMPACT_CLASSES = [
  'CROSS_TENANT_DISCLOSURE',
  'SAME_TENANT_OVER_DISCLOSURE',
  'UNAUTHORIZED_MUTATION',
  'FINANCIAL_INTEGRITY',
  'FALSE_ATTESTATION_OR_OUTCOME',
  'PRIVACY_OR_CONSENT',
  'AVAILABILITY_OR_DATA_LOSS',
  'DATA_QUALITY',
]
export const DEFECT_TRANCHES_BEFORE = ['0B.1', '0B.2', '0B.3', '0B.4', '0B.5', '0B.6']
const WIDE_ACTIVATION = ['REACHABLE_UNAUTHENTICATED', 'REACHABLE_ANY_AUTHENTICATED']
const HARM_CLASSES = ['UNAUTHORIZED_MUTATION', 'FINANCIAL_INTEGRITY', 'FALSE_ATTESTATION_OR_OUTCOME', 'PRIVACY_OR_CONSENT']
const PHASE_EXCUSE = /inventory[- ]only|found (during|in) (an )?inventory|gate 0|not (being )?(fixed|repaired) (in|during|here)|no (code )?(change|repair) (is )?(made|allowed)|only (an )?inventory|classification[- ]only/i

export const defectHash = (defect) => createHash('sha256').update(JSON.stringify(defect)).digest('hex')

const evidenceProblems = (label, items, { exists, readText }) => {
  const out = []
  if (!Array.isArray(items) || items.length === 0) return [`${label} cites no source evidence`]
  for (const item of items) {
    if (!nonEmpty(item?.ref) || !nonEmpty(item?.quote, 8)) out.push(`${label} has a malformed evidence item`)
    else if (!exists(item.ref)) out.push(`${label} cites ${item.ref}, which does not exist`)
    else if (!readText(item.ref).includes(item.quote)) out.push(`${label} quotes a line that is not in ${item.ref}`)
  }
  return out
}

/** Problems with the disposition of one defect found by Gate 0B.7 or later. */
export function releaseDispositionProblems(defect, ctx) {
  const label = `defect ${defect?.id ?? '(missing id)'}`
  const out = []
  const disposition = defect?.releaseDisposition
  if (defect?.severity === 'HIGH' && !disposition) return [`${label} is HIGH severity and records no release disposition`]
  if (!disposition) {
    if (defect?.releaseBlocking === true) out.push(`${label} is marked release blocking without a RELEASE_BLOCKING disposition`)
    return out
  }
  if (!DISPOSITIONS.includes(disposition.disposition)) return [`${label} has an invalid release disposition ${JSON.stringify(disposition.disposition)}`]
  if (!nonEmpty(disposition.actualExposure, 40)) out.push(`${label} does not state its actual exposure`)
  const impact = disposition.potentialImpact
  if (!impact || !Array.isArray(impact.classes) || impact.classes.length === 0 || impact.classes.some((item) => !IMPACT_CLASSES.includes(item)) || !nonEmpty(impact.description, 40)) {
    out.push(`${label} does not state a valid potential impact`)
  }
  if (!ACTIVATION_STATES.includes(disposition.activationState)) out.push(`${label} does not state a valid activation state`)
  out.push(...evidenceProblems(`${label} activation`, disposition.activationEvidence, ctx))
  if (!nonEmpty(disposition.justification, 60)) out.push(`${label} gives no justification for its disposition`)
  for (const field of ['actualExposure', 'justification']) {
    if (PHASE_EXCUSE.test(disposition[field] ?? '')) out.push(`${label} justifies its disposition by the phase in which it was found; an inventory-only phase is never a ground`)
  }
  const containment = disposition.existingContainment
  const contained = containment && containment !== 'NONE' && nonEmpty(containment.summary, 30)
  if (containment && containment !== 'NONE' && !contained) out.push(`${label} has an incomplete containment statement`)
  if (contained) out.push(...evidenceProblems(`${label} containment`, containment.evidence, ctx))
  else if (!containment) out.push(`${label} does not state its existing containment (use NONE when there is none)`)

  const blocking = defect.releaseBlocking === true
  if (disposition.disposition === 'RELEASE_BLOCKING' && !blocking) out.push(`${label} has a RELEASE_BLOCKING disposition but is not marked release blocking`)
  if (disposition.disposition !== 'RELEASE_BLOCKING' && blocking) out.push(`${label} is marked release blocking but its disposition is ${disposition.disposition}`)
  if (disposition.disposition === 'CONDITIONALLY_BLOCKING' && !nonEmpty(disposition.blockingCondition, 30)) out.push(`${label} is CONDITIONALLY_BLOCKING and states no blocking condition`)
  if (disposition.disposition === 'NON_BLOCKING_WITH_JUSTIFICATION') {
    if (!contained) out.push(`${label} is NON_BLOCKING_WITH_JUSTIFICATION without an existing containment`)
    const classes = impact?.classes ?? []
    if (classes.includes('CROSS_TENANT_DISCLOSURE')) out.push(`${label} reaches another organization and cannot be NON_BLOCKING_WITH_JUSTIFICATION`)
    if (disposition.activationState === 'REACHABLE_UNAUTHENTICATED') out.push(`${label} is reachable without authentication and cannot be NON_BLOCKING_WITH_JUSTIFICATION`)
    if (WIDE_ACTIVATION.includes(disposition.activationState) && classes.some((item) => HARM_CLASSES.includes(item))) {
      out.push(`${label} is reachable by any authenticated caller with ${classes.filter((item) => HARM_CLASSES.includes(item)).join(', ')} impact and cannot be NON_BLOCKING_WITH_JUSTIFICATION`)
    }
  }
  return out
}

export function buildReviewQueue({ defectRegister, anchorCommit }) {
  const entries = defectRegister
    .filter((defect) => DEFECT_TRANCHES_BEFORE.includes(defect.tranche) && defect.severity === 'HIGH')
    .map((defect) => ({
      defectId: defect.id,
      tranche: defect.tranche,
      gate: defect.gate,
      ownerCapabilityId: defect.ownerCapabilityId,
      originalSeverity: defect.severity,
      originalReleaseBlocking: defect.releaseBlocking === true,
      defectSha256: defectHash(defect),
      status: QUEUE_STATUS,
      releaseDisposition: null,
      qualifiedBy: null,
    }))
    .sort((a, b) => compareCodeUnit(a.defectId, b.defectId))
  return {
    schemaVersion: 1,
    register: QUEUE_REGISTER,
    note: 'Every HIGH severity defect that Gate 0B.1 to Gate 0B.6 recorded without a release disposition. The defect records are frozen and are not altered here: their severity and release-blocking mark are preserved and pinned by hash. A disposition is not assigned by this queue. Each entry waits for an independent qualification that states the actual exposure, the potential impact, the activation state and the existing containment. Until then the defect keeps its recorded release-blocking mark, and nothing in this register downgrades it.',
    anchorCommit,
    entries,
  }
}

export function validateReviewQueue({ queue, defectRegister }) {
  const problems = []
  if (!queue || queue.schemaVersion !== 1 || queue.register !== QUEUE_REGISTER) return ['the release disposition review queue is missing or malformed']
  const entries = Array.isArray(queue.entries) ? queue.entries : []
  const byId = new Map()
  for (const entry of entries) {
    if (byId.has(entry.defectId)) problems.push(`review queue lists ${entry.defectId} twice`)
    byId.set(entry.defectId, entry)
  }
  const expected = defectRegister.filter((defect) => DEFECT_TRANCHES_BEFORE.includes(defect.tranche) && defect.severity === 'HIGH')
  for (const defect of expected) {
    const entry = byId.get(defect.id)
    if (!entry) {
      problems.push(`HIGH defect ${defect.id} of Gate ${defect.tranche} is missing from the release disposition review queue`)
      continue
    }
    if (entry.defectSha256 !== defectHash(defect)) problems.push(`review queue entry ${defect.id} no longer matches the frozen defect record; an accepted defect cannot be altered or downgraded`)
    if (entry.originalSeverity !== defect.severity || entry.originalReleaseBlocking !== (defect.releaseBlocking === true)) problems.push(`review queue entry ${defect.id} does not preserve the original severity and release-blocking mark`)
    if (entry.tranche !== defect.tranche || entry.gate !== defect.gate || entry.ownerCapabilityId !== defect.ownerCapabilityId) problems.push(`review queue entry ${defect.id} does not match the tranche, gate and owner of its defect`)
    if (entry.status !== QUEUE_STATUS || entry.releaseDisposition !== null || entry.qualifiedBy !== null) problems.push(`review queue entry ${defect.id} records a disposition; only an independent qualification may, and none is on file`)
  }
  for (const entry of entries) if (!expected.some((defect) => defect.id === entry.defectId)) problems.push(`review queue lists ${entry.defectId}, which is not a HIGH defect of Gate 0B.1 to Gate 0B.6`)
  const sorted = entries.map((entry) => entry.defectId).slice().sort(compareCodeUnit)
  if (sorted.join('\n') !== entries.map((entry) => entry.defectId).join('\n')) problems.push('review queue is not in deterministic order')
  return problems
}
