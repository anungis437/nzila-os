/**
 * Gate 0C handoff register. Gate 0C.1 records, and does not resolve, the obligations that stay open after the
 * canonical route universe is reconciled: persona-baseline ratification (a product-specification act kept apart from an
 * institutional grant of authority), the outstanding institutional decisions, the carbon scope exceptions, the HIGH
 * defects awaiting release-disposition review, the accepted and conditional release dispositions, the independent
 * challenges, the unjustified public exposures, the tracked ratchet and test defects and the pending runtime and browser
 * qualification. Every count is recomputed from the registers by the validator; a count that drifts, a resolved status or
 * a ratification claim is rejected.
 */
import { compareCodeUnit, nonEmpty } from './ue-gate0b1-classification.mjs'
import { ANCHOR_COMMIT, DECISION_BOUND_OPERATIONS } from './ue-gate0c1-ids.mjs'

export const FILE_HANDOFF = 'docs/union-eyes/convergence/register/ue-gate0c-handoff-register.json'
export const PERSONAS_PROPOSED = ['steward', 'representative', 'financial-officer']
const OPEN_STATUSES = ['OUTSTANDING', 'OPEN', 'PENDING', 'AWAITING', 'NOT_RATIFIED', 'NOT_GRANTED', 'NOT_VERIFIED']

const sorted = (items) => [...items].sort(compareCodeUnit)

function disposed(register, name) {
  return sorted(register.filter((defect) => defect.severity === 'HIGH' && defect.releaseDisposition?.disposition === name).map((defect) => defect.id))
}

/** The facts the register records, recomputed from the live registers. */
export function handoffFacts({ matrix, classification, reviewQueue, challenges, exceptionRegister, exceptionOperations, entries, fileSha }) {
  const register = classification?.defectRegister ?? []
  const decisions = classification?.institutionalDecisions ?? []
  const baselines = matrix?.proposedPersonaBaselines ?? {}
  const personas = (matrix?.personaCompleteness ?? []).filter((persona) => PERSONAS_PROPOSED.includes(persona.persona))
  const queue = reviewQueue?.entries ?? []
  const high = register.filter((defect) => defect.severity === 'HIGH')
  const awaiting = sorted(high.filter((defect) => !defect.releaseDisposition).map((defect) => defect.id))
  const exposures = classification?.releaseBlockingExposures ?? []
  const capabilities = matrix?.capabilities ?? []
  const tracked = capabilities.flatMap((capability) => (capability.trackedDefects ?? []).map((defect) => ({ capabilityId: capability.id, id: defect.id, kind: defect.kind, file: defect.file })))
  return {
    personas: PERSONAS_PROPOSED.map((persona) => ({
      persona,
      file: baselines.data?.[persona]?.file ?? null,
      sha256: baselines.data?.[persona]?.sha256 ?? null,
      currentSha256: baselines.data?.[persona]?.file ? fileSha(baselines.data[persona].file) : null,
      resolvedInMatrix: personas.find((item) => item.persona === persona)?.resolved === true,
    })),
    decisionRegister: { file: baselines.data?.decisions?.file ?? null, sha256: baselines.data?.decisions?.sha256 ?? null, currentSha256: baselines.data?.decisions?.file ? fileSha(baselines.data.decisions.file) : null },
    baselinesAdopted: baselines.adopted === true || baselines.frozen === true || baselines.originalRecovered === true,
    decisions: { count: decisions.length, outstanding: decisions.filter((decision) => decision.status === 'OUTSTANDING').length, ids: sorted(decisions.map((decision) => decision.id)) },
    carbon: { operations: sorted(exceptionOperations), dispositions: sorted(unique((entries ?? []).filter((entry) => exceptionOperations.includes(`${entry[0]}|${entry[1]}`)).map((entry) => entry[4]))), registerOperations: sorted((exceptionRegister?.exceptions ?? []).map((item) => item.id ?? item.operation ?? '')) },
    highDefects: { total: high.length, awaitingReview: awaiting, queueEntries: queue.length, queueAwaiting: sorted(queue.filter((item) => item.status === 'AWAITING_INDEPENDENT_QUALIFICATION' && !item.releaseDisposition).map((item) => item.defectId)) },
    releaseDispositions: { releaseBlocking: disposed(register, 'RELEASE_BLOCKING'), conditionallyBlocking: disposed(register, 'CONDITIONALLY_BLOCKING') },
    challenges: (challenges?.challenges ?? []).map((challenge) => ({ id: challenge.id, challengedDefectId: challenge.challengedDefectId, status: challenge.status, blocksGate: challenge.blocksGate })),
    exposures: sorted(exposures.map((item) => item.id)),
    tracked: tracked.sort((a, b) => compareCodeUnit(a.id, b.id)),
    qualification: {
      capabilities: capabilities.length,
      nativePending: sorted(capabilities.filter((capability) => capability.nativeQualification === 'PENDING').map((capability) => capability.id)),
      browserPending: sorted(capabilities.filter((capability) => capability.browserQualification === 'PENDING').map((capability) => capability.id)),
    },
  }
}

const unique = (items) => [...new Set(items)]

export function buildHandoffRegister({ facts, newDefects, transitionFile, trancheFile, files }) {
  return {
    schemaVersion: 1,
    register: 'UE-GATE0C-HANDOFF-REGISTER',
    gate: '0C.1',
    status: 'RECORDED_NOT_RESOLVED',
    anchorCommit: ANCHOR_COMMIT,
    note: 'Obligations that Gate 0C.1 records and does not resolve. Gate 0C.1 reconciled the canonical route universe only: it ratifies no persona specification, adopts no institutional decision, converts no scope exception, qualifies no defect, runs no native PostgreSQL, Docker or browser proof and repairs no application behavior. A product-specification acceptance and an institutional grant of authority are different acts by different parties; this register keeps them in separate fields and records neither as given.',
    separation: {
      productSpecificationAcceptance: 'A product owner accepting a proposed persona baseline as the product specification. It settles product design. It grants no authority.',
      institutionalGrantOfAuthority: 'A duly authorized body adopting an institutional authority decision (who may issue, approve, decide or receive something). Nothing in the repository settles one.',
    },
    sources: files,
    nextGates: {
      '0C.2': 'Persona-baseline ratification handling.',
      '0C.3': 'Exception and release-debt reconciliation.',
    },
    newInGate0C1: {
      defects: newDefects,
      note: 'Defects found while classifying the two reviews operations. None is HIGH, so none needs a release disposition; each is owned by one engineering capability and gate and none is repaired here.',
    },
    obligations: [
      {
        id: 'OBL-0C-PERSONA-BASELINES',
        ownerGate: '0C.2',
        status: 'PENDING',
        title: 'Steward, Representative and Financial Officer proposed baselines',
        baselinesAdopted: false,
        decisionRegister: { file: facts.decisionRegister.file, sha256: facts.decisionRegister.sha256 },
        personas: facts.personas.map((persona) => ({
          persona: persona.persona,
          file: persona.file,
          sha256: persona.sha256,
          proposedBaselineStatus: 'PROPOSED_NOT_ADOPTED',
          productSpecificationRatification: 'NOT_RATIFIED',
          productOwnerRatificationRecord: null,
          institutionalGrantOfAuthority: 'NOT_GRANTED',
          resolvedInMatrix: false,
        })),
      },
      {
        id: 'OBL-0C-INSTITUTIONAL-DECISIONS',
        ownerGate: '0C.3',
        status: 'OUTSTANDING',
        title: 'Outstanding inventory-level institutional decisions',
        count: facts.decisions.count,
        outstanding: facts.decisions.outstanding,
        decisionIds: facts.decisions.ids,
      },
      {
        id: 'OBL-0C-CARBON-SCOPE-EXCEPTIONS',
        ownerGate: '0C.3',
        status: 'OUTSTANDING',
        title: 'Decision-bound carbon scope exceptions',
        operations: facts.carbon.operations,
        disposition: 'SCOPE_UNDECIDED',
        nonAuthorizing: true,
      },
      {
        id: 'OBL-0C-HIGH-DEFECTS-AWAITING-REVIEW',
        ownerGate: '0C.3',
        status: 'AWAITING',
        title: 'Earlier HIGH defects awaiting release-disposition review',
        count: facts.highDefects.awaitingReview.length,
        defectIds: facts.highDefects.awaitingReview,
        reviewQueueEntries: facts.highDefects.queueEntries,
      },
      {
        id: 'OBL-0C-RELEASE-DISPOSITIONS',
        ownerGate: '0C.3',
        status: 'OPEN',
        title: 'Accepted release-blocking and conditional release dispositions',
        releaseBlocking: { count: facts.releaseDispositions.releaseBlocking.length, defectIds: facts.releaseDispositions.releaseBlocking },
        conditionallyBlocking: { count: facts.releaseDispositions.conditionallyBlocking.length, defectIds: facts.releaseDispositions.conditionallyBlocking },
      },
      {
        id: 'OBL-0C-OPL-CHALLENGES',
        ownerGate: '0C.3',
        status: 'OPEN',
        title: 'Independent release-disposition challenges of DEF-0B10-OPL-01 and DEF-0B10-OPL-07',
        challenges: facts.challenges,
      },
      {
        id: 'OBL-0C-UNJUSTIFIED-PUBLIC-EXPOSURES',
        ownerGate: '0C.3',
        status: 'OPEN',
        title: 'Unjustified public exposures preserved as Gate 14 release-blocking defects',
        operations: facts.exposures,
      },
      {
        id: 'OBL-0C-TRACKED-RATCHET-AND-TEST-DEFECTS',
        ownerGate: '0C.3',
        status: 'OPEN',
        title: 'Previously tracked ratchet, test-suite and source defects',
        defects: facts.tracked,
      },
      {
        id: 'OBL-0C-RUNTIME-QUALIFICATION',
        ownerGate: '0C.3',
        status: 'PENDING',
        title: 'Pending native PostgreSQL row-level-security and browser qualification',
        nativeVerified: false,
        browserVerified: false,
        capabilities: facts.qualification.capabilities,
        nativePending: facts.qualification.nativePending.length,
        browserPending: facts.qualification.browserPending.length,
        nativePendingCapabilityIds: facts.qualification.nativePending,
        browserPendingCapabilityIds: facts.qualification.browserPending,
      },
    ],
  }
}

const sameList = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function validateHandoffRegister({ register, facts, newDefectIds }) {
  const problems = []
  if (!register || register.schemaVersion !== 1 || register.register !== 'UE-GATE0C-HANDOFF-REGISTER') return ['HANDOFF-ABSENT: the Gate 0C handoff register is missing']
  if (register.status !== 'RECORDED_NOT_RESOLVED') problems.push(`HANDOFF-STATUS: the register status is ${JSON.stringify(register.status)}; Gate 0C.1 records obligations and resolves none`)
  if (!nonEmpty(register.separation?.productSpecificationAcceptance, 30) || !nonEmpty(register.separation?.institutionalGrantOfAuthority, 30)) problems.push('HANDOFF-SEPARATION: product-specification acceptance and institutional grants of authority are not recorded as separate acts')
  const byId = new Map((register.obligations ?? []).map((item) => [item.id, item]))
  const required = ['OBL-0C-PERSONA-BASELINES', 'OBL-0C-INSTITUTIONAL-DECISIONS', 'OBL-0C-CARBON-SCOPE-EXCEPTIONS', 'OBL-0C-HIGH-DEFECTS-AWAITING-REVIEW', 'OBL-0C-RELEASE-DISPOSITIONS', 'OBL-0C-OPL-CHALLENGES', 'OBL-0C-UNJUSTIFIED-PUBLIC-EXPOSURES', 'OBL-0C-TRACKED-RATCHET-AND-TEST-DEFECTS', 'OBL-0C-RUNTIME-QUALIFICATION']
  for (const id of required) if (!byId.has(id)) problems.push(`HANDOFF-OBLIGATION: ${id} is not recorded`)
  if ((register.obligations ?? []).length !== required.length) problems.push('HANDOFF-OBLIGATION: the register holds an obligation that is not one of the required nine, or repeats one')
  for (const item of register.obligations ?? []) {
    if (!OPEN_STATUSES.includes(item.status)) problems.push(`HANDOFF-RESOLVED: ${item.id} has status ${JSON.stringify(item.status)}; Gate 0C.1 resolves no obligation`)
    if (!['0C.2', '0C.3'].includes(item.ownerGate)) problems.push(`HANDOFF-OWNER: ${item.id} names no downstream Gate 0C owner`)
  }

  const persona = byId.get('OBL-0C-PERSONA-BASELINES')
  if (persona) {
    if (persona.baselinesAdopted !== false || facts.baselinesAdopted) problems.push('HANDOFF-PERSONA-RATIFIED: the persona baselines are recorded or found adopted, frozen or recovered')
    if (persona.decisionRegister?.sha256 !== facts.decisionRegister.currentSha256) problems.push('HANDOFF-PERSONA: the persona decision register no longer matches its recorded hash')
    for (const expected of facts.personas) {
      const item = (persona.personas ?? []).find((candidate) => candidate.persona === expected.persona)
      if (!item) { problems.push(`HANDOFF-PERSONA: ${expected.persona} is not recorded`); continue }
      if (item.file !== expected.file || item.sha256 !== expected.currentSha256) problems.push(`HANDOFF-PERSONA: the ${expected.persona} baseline no longer matches its recorded file and hash`)
      if (item.productSpecificationRatification !== 'NOT_RATIFIED' || item.productOwnerRatificationRecord !== null) problems.push(`HANDOFF-PERSONA-RATIFIED: ${expected.persona} is recorded as product-ratified without a ratification record on file`)
      if (item.institutionalGrantOfAuthority !== 'NOT_GRANTED') problems.push(`HANDOFF-PERSONA-RATIFIED: ${expected.persona} is recorded as holding an institutional grant of authority`)
      if (item.resolvedInMatrix !== false || expected.resolvedInMatrix) problems.push(`HANDOFF-PERSONA-RATIFIED: ${expected.persona} is resolved by a proposed baseline`)
    }
  }
  const decisions = byId.get('OBL-0C-INSTITUTIONAL-DECISIONS')
  if (decisions && (decisions.count !== facts.decisions.count || decisions.outstanding !== facts.decisions.outstanding || !sameList(decisions.decisionIds, facts.decisions.ids) || facts.decisions.outstanding !== facts.decisions.count || decisions.count !== 79)) problems.push('HANDOFF-DECISIONS: the recorded institutional decisions are not the 79 outstanding decisions of the frozen register')
  const carbon = byId.get('OBL-0C-CARBON-SCOPE-EXCEPTIONS')
  if (carbon && (!sameList(carbon.operations, sorted(DECISION_BOUND_OPERATIONS)) || !sameList(facts.carbon.operations, sorted(DECISION_BOUND_OPERATIONS)) || !sameList(facts.carbon.dispositions, ['SCOPE_UNDECIDED']) || carbon.nonAuthorizing !== true)) problems.push('HANDOFF-CARBON: the four carbon exceptions are not recorded as non-authorizing SCOPE_UNDECIDED operations')
  const high = byId.get('OBL-0C-HIGH-DEFECTS-AWAITING-REVIEW')
  if (high && (high.count !== facts.highDefects.awaitingReview.length || high.count !== 71 || !sameList(high.defectIds, facts.highDefects.awaitingReview) || high.reviewQueueEntries !== facts.highDefects.queueEntries || !sameList(facts.highDefects.queueAwaiting, facts.highDefects.awaitingReview))) problems.push('HANDOFF-HIGH-DEFECTS: the recorded HIGH defects awaiting release-disposition review are not the 71 of the review queue')
  const dispositions = byId.get('OBL-0C-RELEASE-DISPOSITIONS')
  if (dispositions && (dispositions.releaseBlocking?.count !== 32 || dispositions.conditionallyBlocking?.count !== 41 || !sameList(dispositions.releaseBlocking?.defectIds, facts.releaseDispositions.releaseBlocking) || !sameList(dispositions.conditionallyBlocking?.defectIds, facts.releaseDispositions.conditionallyBlocking))) problems.push('HANDOFF-DISPOSITIONS: the recorded release dispositions are not the 32 release-blocking and 41 conditional dispositions of the frozen register')
  const challenges = byId.get('OBL-0C-OPL-CHALLENGES')
  if (challenges && (!sameList(challenges.challenges, facts.challenges) || facts.challenges.length !== 2 || facts.challenges.some((item) => !String(item.status).startsWith('AWAITING')))) problems.push('HANDOFF-CHALLENGES: the recorded independent challenges are not the two open OPL challenges')
  const exposures = byId.get('OBL-0C-UNJUSTIFIED-PUBLIC-EXPOSURES')
  if (exposures && (!sameList(exposures.operations, facts.exposures) || facts.exposures.length !== 3)) problems.push('HANDOFF-EXPOSURES: the recorded unjustified public exposures are not the three frozen exposures')
  const tracked = byId.get('OBL-0C-TRACKED-RATCHET-AND-TEST-DEFECTS')
  if (tracked && !sameList(tracked.defects, facts.tracked)) problems.push('HANDOFF-TRACKED: the recorded ratchet, test and source defects are not the matrix tracked defects')
  const runtime = byId.get('OBL-0C-RUNTIME-QUALIFICATION')
  if (runtime && (runtime.nativeVerified !== false || runtime.browserVerified !== false || !sameList(runtime.nativePendingCapabilityIds, facts.qualification.nativePending) || !sameList(runtime.browserPendingCapabilityIds, facts.qualification.browserPending) || runtime.capabilities !== facts.qualification.capabilities)) problems.push('HANDOFF-RUNTIME: the recorded pending runtime and browser qualification is not the matrix qualification state')

  const listed = register.newInGate0C1?.defects ?? []
  if (!sameList(listed, newDefectIds)) problems.push('HANDOFF-NEW-DEFECTS: the register does not list the defects Gate 0C.1 found')
  return problems
}
