/** Renders the four Gate 0C.4 review documents from the generated registers. */
import { ANCHOR_0C3_COMMIT, DOCS_0C4, DOCUMENTARY_LABEL, FILES_0C4 } from './ue-gate0c4-ids.mjs'
import { sha256Of } from './ue-gate0c4-reconcile.mjs'

const cell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const table = (header, rows) => [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`)].join('\n')
const bullets = (items) => items.map((item) => `- ${item}`).join('\n')
const short = (id) => String(id).replace(/^DEF-/, '')
const entries = (object) => Object.entries(object).map(([key, value]) => [key, value])

export function registerHashes(all) {
  return Object.fromEntries(Object.keys(FILES_0C4).map((key) => [key, sha256Of(all[key])]))
}

const banner = (title) => `# ${title}

Gate: GATE-0C.4. Accepted Gate 0C.3 commit: \`${ANCHOR_0C3_COMMIT}\`. Gate 0 verdict: IN_PROGRESS. Release authorization: NOT_GRANTED. UE_SAAS_OPERATIONAL_READINESS: NO_GO.`

export function renderIndex(all, hashes) {
  const q = all.qualification
  const e = all.evidence
  const t = q.totals
  const flagged = q.qualifications.filter((item) => item.independentFindings.some((entry) => entry.severity !== 'INFO'))
  return `${banner('Union Eyes Gate 0C.4 - independent scope-lock qualification')}

This gate challenges the Gate 0C.3 evidence and prepares decision dossiers. It repairs nothing, accepts no disposition, ratifies no persona, adopts no institutional decision, accepts no release risk and changes no application source, schema, migration or allowlist.

## Review provenance

${q.review.limitation}

${bullets(q.review.method)}

Not done: ${q.review.notDone.join(' ')}

## Registers

${table(['Register', 'File', 'sha256'], entries(FILES_0C4).map(([key, file]) => [key, `\`${file}\``, `\`${hashes[key]}\``]))}

## Qualification of the 71 proposed dispositions

Every proposed disposition stays PROPOSED_NOT_ACCEPTED, no approval field is filled and no severity changed.

${table(['Review status', 'Count'], entries(t.byReviewStatus))}

Source verification before the runtime rule is applied:

${table(['Source verification', 'Count'], entries(t.bySourceVerification))}

Stated activation state against the recomputed route declarations:

${table(['Verdict', 'Count'], entries(t.byActivationVerdict))}

Independent finding codes:

${table(['Code', 'Count'], entries(t.findingCodes))}

Disposition sensitivity flags (for an authorized reviewer; nothing was changed):

${table(['Flag', 'Count'], entries(t.byDispositionSensitivity))}

### Records with a qualifying or challenge finding (${flagged.length})

${table(
  ['Defect', 'Proposed', 'Review status', 'Findings'],
  flagged.map((item) => [short(item.defectId), item.proposedDisposition.value, item.reviewStatus, item.independentFindings.filter((entry) => entry.severity !== 'INFO').map((entry) => entry.code).join(', ')]),
)}

## The 150-item index

${e.deduplication.method}

${table(['Measure', 'Value'], [
  ['Release-blocking dispositions', e.deduplication.groups.releaseBlocking],
  ['Conditional dispositions', e.deduplication.groups.conditional],
  ['Older HIGH defects awaiting assessment', e.deduplication.groups.awaiting],
  ['Release-blocking exposure defects', e.deduplication.groups.exposureDefects],
  ['Tracked ratchet, test and source items', e.deduplication.groups.tracked],
  ['Unique recomputed', e.deduplication.uniqueRecomputed],
  ['Overlaps between groups', e.deduplication.overlapsBetweenGroups.length],
  ['Indexed items', e.deduplication.indexedItems],
  ['Matches the Gate 0C.3 index', e.deduplication.matches ? 'yes' : 'no'],
])}

${e.deduplication.limitation}

## The two OPL challenges

${e.challenges.method}

${table(['Challenge', 'Frozen disposition', 'Challenge position', 'Containment status'], e.challenges.challenges.map((c) => [c.challengeId, c.frozenDisposition, c.challengePosition, c.statuses.containment]))}

The challenges are not additional defects and neither supersedes the frozen conditional disposition. ${e.challenges.limitation}

## The three public exposures

${e.exposures.finding}

${table(['Operation', 'Handler', 'In proxy allowlist', 'Justification recorded', 'Public reachability'], e.exposures.operations.map((o) => [o.operation, o.handlerWrapper, o.inProxyAllowlist ? 'yes' : 'no', o.allowlistJustification, o.statuses.publicReachability]))}

## Per-capita relationship

${e.perCapita.finding}

${table(['Defect', 'Severity', 'In the 150-item index'], e.perCapita.records.map((r) => [short(r.defectId), r.severity, r.inReleaseDebtIndex ? 'yes' : 'no']))}

${e.perCapita.carriedGap ?? ''}

## Carbon evidence

Superseded statement (frozen text is preserved, not edited): ${e.carbon.supersededStatement}

Narrower supported finding: ${e.carbon.narrowerSupportedFinding}

Not established: ${e.carbon.notEstablished.join(' ')}

${e.carbon.limitation}

## Retention scheduler search

${e.reviewRequiredProposals.find((entry) => entry.retentionSchedulerFinding).retentionSchedulerFinding.repositorySearchFinding} It does not establish: ${e.reviewRequiredProposals.find((entry) => entry.retentionSchedulerFinding).retentionSchedulerFinding.doesNotEstablish.join(' ')}

## Supersession and clarification records

${all.supersessions.totals.records} records (${entries(all.supersessions.totals.byKind).map(([k, n]) => `${k} ${n}`).join(', ')}), ${all.supersessions.totals.unsupportedClaimRecords} of them about claims in the 71 assessments. Each names the frozen record by hash and changes nothing.

## Presentation of the Gate 0 criteria

The seven criteria are documentary criteria. They carry the label ${DOCUMENTARY_LABEL}. They are shown only with the qualifiers that sit beside them: independent Gate 0 certification NOT_GRANTED, persona ratification PENDING, institutional authority decisions OUTSTANDING, release authorization NOT_GRANTED and UE_SAAS_OPERATIONAL_READINESS NO_GO.
`
}

export function renderProduct(all) {
  const p = all.product
  return `${banner('Union Eyes Gate 0C.4 - product-owner ratification dossier')}

Register: \`${FILES_0C4.product}\`. Status: ${p.status}. Nothing in this dossier is a decision.

${p.separation}

## The three proposed canonicals

${table(['Persona', 'Record', 'Proposed canonical', 'State', 'Decisions to settle', 'Institutional ids listed'], p.personas.map((x) => [x.persona, x.recordId, `${x.proposedCanonical.packageId} ${x.proposedCanonical.version}`, x.currentState, x.productDecisionsToSettle.length, x.listedInstitutionalAuthorityDecisions.length]))}

${p.personas
  .map(
    (x) => `### ${x.persona}

Artifact: \`${x.proposedCanonical.file}\` (\`${x.proposedCanonical.sha256}\`). Decision owner role: ${x.decisionOwnerRole}. Approval evidence on file: ${x.approvalEvidenceOnFile === null ? 'none' : 'present'}.

Decisions the owner may take:

${table(['Option', 'Resulting state', 'Effect'], x.decisionsAvailable.map((o) => [o.option, o.resultingState, o.effect]))}

Required approval evidence: ${x.requiredApprovalEvidence.join(', ')}.

Product decisions this record settles or defers: ${x.productDecisionsToSettle.join(', ')}.

Institutional authority decisions this record lists: ${x.listedInstitutionalAuthorityDecisions.length === 0 ? 'none' : x.listedInstitutionalAuthorityDecisions.join(', ')}. ${x.institutionalBoundary}

Decisions shared with another persona record: ${x.decisionsSharedWithOtherPersonaRecords.length === 0 ? 'none' : x.decisionsSharedWithOtherPersonaRecords.map((s) => `${s.decisionId} (${s.listedBy.join(', ')})`).join('; ')}.

Depends on: ${x.dependsOnPersonas.join('; ')}.

Evidence still unavailable:

${bullets(x.evidenceStillUnavailable.map((g) => `${g.gapId} (${g.kind}): ${g.statement}`))}

A product approval does not:

${bullets(x.productApprovalDoesNot)}
`,
  )
  .join('\n')}

## Steward structure

The preparer recommends ${p.stewardStructure.preparerRecommendation}. The recommendation is not a selection and nothing is selected or ratified. ${p.stewardStructure.effectOfRecommendation}

${table(['Option', 'Title'], p.stewardStructure.options.map((o) => [o.optionId, o.title]))}

## Order of ratification

${p.ratificationOrder.dependency} Decisions shared by more than one persona record: ${p.ratificationOrder.sharedDecisions.join(', ')}. The dossier states no sequencing opinion.

## The ${p.outstandingProductDecisions.count} outstanding product decisions

${table(['Decision', 'Family', 'Title', 'Personas', 'Settled by'], p.outstandingProductDecisions.items.map((d) => [d.decisionId, d.family, d.title, d.personas.join(', '), d.settledByRecords.join(', ')]))}

## Boundary with institutional decisions

${p.institutionalBoundary.statement} ${p.institutionalBoundary.outstandingInstitutionalDecisions} institutional decisions stay outstanding. A product ratification issues no institutional permission.
`
}

export function renderInstitutional(all) {
  const d = all.institutional
  return `${banner('Union Eyes Gate 0C.4 - institutional decision dossier')}

Register: \`${FILES_0C4.institutional}\`. Status: ${d.status}. Nothing in this dossier is a decision.

${d.deferralIsNotAdoption}

## Totals

${table(['Measure', 'Value'], [
  ['Institutional decisions retained with their original identifiers', d.totals.institutionalDecisions],
  ['Required before Gate 0 certification', d.totals.requiredBeforeCertification],
  ['May stay open under the non-authorizing disposition', d.totals.deferredNonAuthorizing],
  ['Of those, marked release blocking', d.totals.deferredAndReleaseBlocking],
  ['Adopted', d.totals.adopted],
])}

By priority theme (keyword prioritisation, not a decision): ${entries(d.totals.byTheme).map(([k, n]) => `${k} ${n}`).join(', ')}.

## Required before certification

${d.requiredBeforeCertification.map((id) => `- \`${id}\``).join('\n')}

${d.carbonDecision.whyBeforeCertification}

Options: ${d.carbonDecision.options.join(', ')}. Preparer recommendation: ${d.carbonDecision.preparerRecommendation} (recommendation only, nothing selected). The four operations stay unowned and non-authorizing: ${d.carbonDecision.scopeExceptionOperations.join(', ')}. Whichever option is chosen: ${d.carbonDecision.obligationRegardlessOfOption}

## Decisions by priority

${table(
  ['Priority', 'Theme', 'Decision', 'Scope-lock disposition', 'Release blocking', 'Operations'],
  d.decisions.map((x) => [x.priority, x.theme, x.decisionId, x.scopeLockDisposition, x.releaseBlocking, x.dependentOperations]),
)}
`
}

export function renderChecklist(all) {
  const c = all.certification
  return `${banner('Union Eyes Gate 0 certification checklist')}

Register: \`${FILES_0C4.certification}\`. Status: ${c.status}. Gate 0 verdict: ${c.gate0Verdict}.

## Presentation

${table(['Record', 'Value'], [
  ['Documentary scope record', c.presentation.documentaryScopeRecord],
  ['Independent Gate 0 certification', c.presentation.independentGate0Certification],
  ['Persona ratification', c.presentation.personaRatification],
  ['Institutional authority decisions', c.presentation.institutionalAuthorityDecisions],
  ['Release authorization', c.presentation.releaseAuthorization],
  ['UE_SAAS_OPERATIONAL_READINESS', c.presentation.ueSaasOperationalReadiness],
])}

The ${c.presentation.documentaryCriteria.of} criteria below are documentary criteria (${c.presentation.documentaryCriteria.label}). ${c.presentation.displayRule}

${table(['Documentary criterion', 'State'], c.presentation.documentaryCriteria.criteria.map((x) => [x.id, x.state]))}

## Checklist

${table(['Item', 'Check', 'Tier', 'State'], c.checklist.items.map((i) => [i.id, i.check, i.tier, i.state]))}

${c.checklist.items.map((i) => `- **${i.id}** ${i.requirement} ${i.note ?? ''}`).join('\n')}

## Rules

${bullets(c.checklist.grantRules)}

## Evaluation

${table(['Measure', 'Value'], [
  ['Items not met', c.evaluation.unmet.join(', ')],
  ['Eligible for a certification decision', c.evaluation.eligibleForCertificationDecision ? 'yes' : 'no'],
  ['Certification granted', 'no'],
  ['Implies release authorization', 'no'],
  ['Implies production GO', 'no'],
])}

## Downstream release obligations

${c.downstreamObligations.itemCount} release-debt items are carried once (index \`${c.downstreamObligations.debtIndexSha256}\`). ${c.downstreamObligations.proposedDispositionsAwaitingAcceptance} proposed dispositions await acceptance. Carrying an obligation does not discharge it.
`
}

export function renderDocs(all) {
  const hashes = registerHashes(all)
  return {
    [DOCS_0C4.index]: renderIndex(all, hashes),
    [DOCS_0C4.product]: renderProduct(all),
    [DOCS_0C4.institutional]: renderInstitutional(all),
    [DOCS_0C4.checklist]: renderChecklist(all),
  }
}
