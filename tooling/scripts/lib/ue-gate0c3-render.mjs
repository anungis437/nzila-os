/** Renders the three Gate 0C.3 review documents from the generated registers. */
import { DOCS_0C3, FILES_0C3 } from './ue-gate0c3-ids.mjs'
import { sha256Of } from './ue-gate0c3-reconcile.mjs'

const cell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const table = (header, rows) => [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`)].join('\n')
const bullets = (items) => items.map((item) => `- ${item}`).join('\n')
const short = (id) => String(id).replace(/^DEF-/, '')
const count = (n, noun) => `${n} ${noun}`

export function registerHashes(all) {
  return Object.fromEntries(Object.keys(FILES_0C3).map((key) => [key, sha256Of(all[key])]))
}

export function renderAssessmentDoc(all, hashes) {
  const { assessment } = all
  const t = assessment.totals
  const rows = assessment.assessments.map((a) => [
    short(a.defectId),
    a.tranche,
    a.frozenRecord.originalSeverity,
    a.proposedDisposition.value,
    a.sourceExposure.activationState,
    a.impact.classes.join(', '),
    a.runtimeQualification.proofs.join(', ') || '-',
  ])
  const reviewRequired = assessment.assessments.filter((a) => a.proposedDisposition.value === 'REVIEW_REQUIRED')
  return `# Union Eyes Gate 0C.3 - release assessment of the 71 earlier HIGH defects

Register: \`${FILES_0C3.assessment}\`
Register sha256: \`${hashes.assessment}\`
Status: PROPOSED_NOT_ACCEPTED. Evidence basis: ${assessment.evidenceBasis}.

## What this is

An independent, versioned assessment of the ${t.defects} HIGH defects that Gates 0B.1 to 0B.6 recorded before a release disposition was required. Each defect keeps its historical record, its severity and its hash. The register adds, per defect, who can reach it, what it can do, whether it is active, what containment the sources show, what is proven and what is inference, a proposed disposition with its reason, and whether runtime qualification is still needed.

A proposed disposition is a recommendation. It is not an accepted release determination, it changes no severity and it grants no release. No defect has an executed proof on file (${t.executedProofs} of ${t.defects}), so every assessment rests on reading the source.

## Totals

${table(['Measure', 'Value'], [
  ['Defects assessed', t.defects],
  ['Proposed RELEASE_BLOCKING', t.byProposedDisposition.RELEASE_BLOCKING],
  ['Proposed CONDITIONALLY_BLOCKING', t.byProposedDisposition.CONDITIONALLY_BLOCKING],
  ['REVIEW_REQUIRED (under-evidenced)', t.byProposedDisposition.REVIEW_REQUIRED],
  ['Still needing runtime qualification', t.runtimeQualificationNeeded],
  ['Executed proofs on file', t.executedProofs],
  ['Accepted by an independent authority', t.accepted],
  ['Severities changed', t.severityChanged],
])}

By tranche: ${Object.entries(t.byTranche).map(([tranche, n]) => `${tranche} ${n}`).join(', ')}.

## Defects the record cannot yet qualify

${reviewRequired.length === 0 ? 'None.' : bullets(reviewRequired.map((a) => `\`${a.defectId}\` - ${a.proposedDisposition.reviewReasons ?? ''}`))}

## Rubric

${bullets(Object.entries(assessment.rubric).map(([key, text]) => `\`${key}\`: ${text}`))}

## Per-defect proposals

${table(['Defect', 'Tranche', 'Frozen severity', 'Proposed disposition', 'Activation', 'Impact', 'Runtime proof needed'], rows)}

Every row is PROPOSED_NOT_ACCEPTED. The full evidence quotes, containment statements and conditions are in the register.
`
}

export function renderCarbonDoc(all, hashes) {
  const { carbon } = all
  const options = carbon.options.map((option) => `### ${option.id} - ${option.label}

${option.summary}

Requires:
${bullets(option.requires)}

Route consequence: ${option.routeConsequence}

Evidence for:
${bullets(option.evidenceFor)}

Evidence against:
${bullets(option.evidenceAgainst)}

Reversibility: ${option.reversibility}

Selected: no. Adopted: no.`).join('\n\n')
  return `# Union Eyes Gate 0C.3 - carbon accounting scope decision record

Register: \`${FILES_0C3.carbon}\`
Register sha256: \`${hashes.carbon}\`
Decision: \`${carbon.decisionId}\`. State: ${carbon.state}. Status: ${carbon.status}.

## Status of this record

${carbon.note}

No option is selected and none is adopted. The four operations stay DECISION_BOUND_SCOPE_EXCEPTION. The recommendation below is the preparer's input to the deciding authority and decides nothing.

## Question

${carbon.question}

Decision owner role: ${carbon.decisionOwnerRole}. Required approval evidence: ${carbon.requiredApprovalEvidence}

## The four operations

${table(['Operation', 'Classification', 'Option chosen', 'Owned', 'Authorized', 'Defects'], carbon.operations.map((op) => [op.operationId, op.inventoryClassification, op.scopeDisposition.anyOptionChosen ? 'yes' : 'none', op.countedAsOwned ? 'yes' : 'no', op.authorized ? 'yes' : 'no', op.defects.join(', ')]))}

## Current behavior

${carbon.currentBehavior.statement}

Defect: \`${carbon.currentBehavior.fabricatedMeasurementDefect.defectId}\` (${carbon.currentBehavior.fabricatedMeasurementDefect.severity}, ${carbon.currentBehavior.fabricatedMeasurementDefect.proposedDisposition}, ${carbon.currentBehavior.fabricatedMeasurementDefect.state}).

Route evidence:
${bullets(carbon.currentBehavior.routeEvidence.map((item) => `\`${item.ref}\`: \`${item.quote}\``))}

## Evidence found outside the routes

${carbon.evidenceFound.note}

${bullets(carbon.evidenceFound.sources.map((item) => `\`${item.ref}\`: \`${item.quote}\` - ${item.shows}`))}

## Correction to the frozen evidence

Frozen statement (preserved, not edited): ${carbon.priorEvidenceGap.frozenStatement}

Discrepancy: ${carbon.priorEvidenceGap.discrepancy}

Review required: ${carbon.priorEvidenceGap.reviewRequired}

## Options

${options}

## Preparer recommendation (not selected)

Recommended option: \`${carbon.recommendation.optionId}\`. Status: ${carbon.recommendation.status}. Not selected, not adopted.

Basis:
${bullets(carbon.recommendation.basis)}

Caveats:
${bullets(carbon.recommendation.caveats)}

## Preserved obligation

Capability \`${carbon.preservedObligation.capabilityId}\`, Gate ${carbon.preservedObligation.gate}: ${carbon.preservedObligation.obligation}

${carbon.preservedObligation.note}
`
}

export function renderIndexDoc(all, hashes) {
  const { debt, challenges, decisions, relationships, closure, assessment } = all
  const dt = debt.totals
  const frozen = Object.entries(debt.frozenEvidence.totals)
  const l1 = closure.level1
  const l2 = closure.level2
  return `# Union Eyes Gate 0C.3 - institutional scope exceptions and release-debt reconciliation

Gate: ${closure.gate}. Anchor commit: \`${closure.anchorCommit}\`. Gate 0 verdict: ${closure.gate0Verdict}.

This gate reconciles obligations. It repairs nothing, adopts no decision, selects no carbon option, ratifies no persona baseline, issues no release approval and changes no application source, schema, migration or allowlist.

## Registers

${table(['Register', 'File', 'sha256'], Object.keys(FILES_0C3).map((key) => [key, `\`${FILES_0C3[key]}\``, `\`${hashes[key]}\``]))}

## Frozen evidence

The totals the Gate 0C.2 commit accepted are compared with what the registers hold. They are not forced onto them.

${table(['Total', 'Accepted', 'Observed', 'Match'], frozen.map(([name, v]) => [name, v.accepted, v.observed, v.matchesAccepted ? 'yes' : 'NO']))}

## Release-debt index

${table(['Measure', 'Value'], [
  ['Unique release-debt items', dt.uniqueItems],
  ['Unique register defects among them', dt.uniqueRegisterDefects],
  ['Tracked ratchet, test or source items', dt.trackedItems],
  ['Repair obligations (one per item)', dt.repairObligations],
  ['Release-blocking register defects', dt.releaseBlockingRegisterDefects],
  ['RELEASE_BLOCKING dispositions', dt.releaseBlockingDispositions],
  ['CONDITIONALLY_BLOCKING dispositions', dt.conditionallyBlockingDispositions],
  ['Conditional dispositions under challenge', dt.conditionallyBlockingChallenged],
  ['Earlier HIGH defects awaiting an accepted disposition', dt.earlierHighAwaitingDisposition],
  ['Public exposure operations / their release-blocking defects', `${dt.publicExposureOperations} / ${dt.publicExposureReleaseBlockingDefects}`],
  ['Listings before de-duplication', dt.listedInstances],
  ['Duplicate inflation avoided', dt.duplicateInflationAvoided],
  ['Accepted release decisions', dt.acceptedReleaseDecisions],
  ['Closed obligations', dt.closedObligations],
])}

Reporting classes: ${Object.entries(dt.byReportingClass).map(([name, n]) => `${name} ${n}`).join(', ')}.

Six record types stay distinct: ${debt.recordTypes.join(', ')}. Every item carries an engineering owner (accountability, not authorization), a target gate, a source reference and an acceptance condition. The release effect of an unaccepted item is never recorded as accepted.

## Earlier HIGH defects

${count(assessment.totals.defects, 'defects')} assessed: ${Object.entries(assessment.totals.byProposedDisposition).map(([name, n]) => `${name} ${n}`).join(', ')}. See \`${DOCS_0C3.assessment}\`. All proposals are PROPOSED_NOT_ACCEPTED.

## OPL-01 and OPL-07 challenges

Status: ${challenges.status}. Original dispositions stay CONDITIONALLY_BLOCKING and frozen. The challenge position stays \`${challenges.challenges[0].challengePosition}\`. New source evidence: ${challenges.newSourceEvidence.conclusion} (${challenges.newSourceEvidence.citedFilesCompared} cited files compared with the challenge commit, ${challenges.newSourceEvidence.flagFilesAdded.length} flag files added, ${challenges.newSourceEvidence.flagFilesRemoved.length} removed).

${challenges.flag.assumption} ${challenges.flagDependentCount} dispositions depend on the flag.

## Carbon scope

Three options, one recommendation, none selected. See \`${DOCS_0C3.carbon}\`.

## Decision index

${count(decisions.totals.distinctRecords, 'distinct decision records')} across five families, ${decisions.totals.exactDuplicateIds.length} exact duplicate identifiers, ${decisions.totals.overlapPairs} reviewed overlaps (merged: none), ${decisions.totals.adopted} adopted.

${table(['Family', 'Count', 'Owner role', 'Blocks scope lock', 'Blocks implementation'], decisions.families.map((family) => [family.family, family.count, family.ownerRole, family.blocksScopeLock, family.blocksImplementation]))}

Overlap relations: ${Object.entries(decisions.totals.overlapByRelation).map(([name, n]) => `${name} ${n}`).join(', ')}. ${decisions.totals.clusterNote}

A product approval is a product-specification baseline. It never carries an institutional grant.

## Defect relationships

${relationships.totals.clusters} clusters over ${relationships.totals.clusterMembers} defects. Defects merged: ${relationships.totals.defectsMerged}. Severities changed: ${relationships.totals.severitiesChanged}.

${relationships.perCapitaSeverityPair.finding}

## Two-level closure model

Level 1, ${l1.name}: ${l1.criteriaSatisfiedByRecord} of ${l1.criteria.length} record criteria satisfied. Certifiable: ${l1.certifiable}. Certification blockers:
${bullets(l1.certificationBlockers.map((blocker) => `${blocker.id} (${blocker.kind}): ${blocker.description}`))}

Level 2, ${l2.name}, additional to level 1:
${table(['Criterion', 'State'], l2.criteria.map((criterion) => [criterion.label, criterion.state]))}

Release authorization: ${l2.releaseAuthorization}. Production GO: ${l2.productionGo}. ${l2.readinessGate.id}: ${l2.readinessGate.ruling}. A Gate 0 verdict is never a release authorization.

## Handoff obligations

${table(['Obligation', 'Before', 'After Gate 0C.3', 'Closed'], debt.handoffObligations.map((item) => [item.obligationId, item.statusBefore, item.statusAfterGate0C3, item.closed ? 'yes' : 'no']))}
`
}

export function renderDocs(all) {
  const hashes = registerHashes(all)
  return {
    [DOCS_0C3.index]: renderIndexDoc(all, hashes),
    [DOCS_0C3.assessment]: renderAssessmentDoc(all, hashes),
    [DOCS_0C3.carbon]: renderCarbonDoc(all, hashes),
  }
}
