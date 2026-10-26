#!/usr/bin/env node
/**
 * Generates the Gate 0A.2 proposed persona baselines (data and documents) from the content modules.
 * Run: node tooling/scripts/lib/ue-gate0a2-build-baselines.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AUDIT_CLASSES, AUTHORIZATION_BASES, BANNER, BASELINE_DATA, BASELINE_DOCS, LABELS, PRIVACY_CLASSES,
} from './ue-gate0a2-baseline-facts.mjs'
import { decisions } from './ue-gate0a2-content-decisions.mjs'
import { buildSteward, stewardEvidenceUse } from './ue-gate0a2-content-steward.mjs'
import { buildRepActions } from './ue-gate0a2-content-rep-actions.mjs'
import { buildRepDomains } from './ue-gate0a2-content-rep-domains.mjs'
import { buildFinancial } from './ue-gate0a2-content-financial.mjs'
import { sha256File, validateBaselines } from './ue-gate0a2-validate-baselines.mjs'
import { loadRecovery } from './ue-gate0a-persona-recovery.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const LABEL_MEANING = {
  HISTORICALLY_EVIDENCED: 'The identifier is individually evidenced by a recovered historical record. Only the identifier and the recorded title or status are historical; the specification is new.',
  PROPOSED_NEW_BASELINE: 'The specification is a new design in this proposed baseline. Every contract carries this label.',
  IMPLEMENTED_SOURCE: 'The cited source files show some implementation. A cited file is not verification, conformance was not checked, and no run exists.',
  REQUIRES_INSTITUTIONAL_ADOPTION: 'The behaviour depends on an institutional authority decision that is outstanding. It stays inactive until a duly authorized body adopts it.',
}

function header(persona, title, extra = {}) {
  const recovery = loadRecovery(ROOT)
  return {
    schemaVersion: 1,
    kind: 'PROPOSED_PERSONA_BASELINE',
    persona,
    title,
    status: 'PROPOSED_NOT_ADOPTED',
    adopted: false,
    frozen: false,
    originalRecovered: false,
    banner: BANNER,
    labels: Object.fromEntries(LABELS.map((l) => [l, LABEL_MEANING[l]])),
    recoveryBaseCommit: recovery?.baseCommit ?? null,
    sources: (recovery?.sources ?? []).map((s) => ({ id: s.id, class: s.class, commit: s.commit, path: s.path, blob: s.blob })),
    authorizationBases: Object.fromEntries(Object.entries(AUTHORIZATION_BASES).map(([id, b]) => [id, { domain: b.domain, kernelActions: b.kernelActions, definition: b.definition, source: b.source, requiresInstitutionalInstrument: Boolean(b.requiresInstitutionalInstrument) }])),
    ...extra,
  }
}

export function buildBaselines() {
  const steward = {
    ...header('steward', 'Steward persona: proposed new baseline', {
      evidenceUse: stewardEvidenceUse,
      designNote: 'No original Steward canonical was recovered. The eight recovered evidence items S1 to S8 support some contracts and define none. Every steward contract is a new design.',
    }),
    contracts: buildSteward(ROOT),
  }

  const repActions = buildRepActions(ROOT)
  const repDomains = buildRepDomains(ROOT)
  const representative = {
    ...header('representative', 'Representative 2.2: proposed new baseline', {
      designNote: 'The Representative 2.2 original canonical was not recovered. The 56 identifiers are kept. Each receives its own specification. Where the record gives a group label or a status, the pairing of a label to an identifier is a new design choice.',
      r18VersionedRecord: repDomains.r18VersionedRecord,
    }),
    contracts: [...repActions, ...repDomains.domains],
    journeys: repDomains.journeys,
    scenarios: repDomains.scenarios,
  }

  const fin = buildFinancial(ROOT)
  for (const c of fin.domains) c.financial.currentImplementationStatus = c.implementation.status
  const financialOfficer = {
    ...header('financial-officer', 'Financial Officer 2.1: proposed new baseline', {
      designNote: 'The Financial Officer 2.1 original canonical was not recovered. Four of the 38 identifiers have a recovered title or status statement. Every other meaning is a new design. No financial mandate has been issued and nothing here issues one.',
      financialDuties: ['view', 'prepare', 'approve', 'execute', 'reconcile', 'audit'],
    }),
    contracts: [...fin.navigation, ...fin.domains, ...fin.boundaries, ...fin.denials],
    journeys: fin.journeys,
    scenarios: fin.scenarios,
  }

  const decisionData = {
    ...header('decisions', 'Persona baseline decision register', {
      designNote: 'Product design decisions can be settled by the product specification review. Institutional authority decisions name who may issue, approve, decide or receive something. Nothing in this repository settles an institutional authority decision, so each stays outstanding and the behaviour it governs stays inactive.',
    }),
    decisions,
  }
  return { steward, representative, 'financial-officer': financialOfficer, decisions: decisionData }
}

const esc = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
const list = (items) => (items ?? []).map((i) => `- ${esc(i)}`).join('<br>')
const bullets = (items) => (items ?? []).map((i) => esc(i)).join('<br>')

function implRows(impl) {
  const routes = (impl.routes ?? []).map((r) => `\`${r.file.replace('apps/union-eyes/', '')}\` (${r.methods.join(', ') || 'no handler'}; ${r.signal})`)
  const services = (impl.services ?? []).map((r) => `\`${r.file.replace('apps/union-eyes/', '')}\` (${r.signal})`)
  return `${impl.status}. Conformance checked: no. ${esc(impl.note)}${routes.length ? `<br>Routes: ${routes.join('; ')}` : ''}${services.length ? `<br>Services: ${services.join('; ')}` : ''}${impl.capabilityId ? `<br>Capability: \`${impl.capabilityId}\`` : ''}`
}

function renderContract(c) {
  const rows = []
  const row = (name, value) => rows.push(`| ${name} | ${value} |`)
  row('Labels', c.labels.map((l) => `\`${l}\``).join(' '))
  row('Historical record', c.historical ? `${esc(c.historical.kind)} in \`${c.historical.sourceId}\`: "${esc(c.historical.quote)}"${c.historical.individuallyEvidenced ? '' : ' (group or status only; not an individual meaning)'}${c.historical.note ? ` ${esc(c.historical.note)}` : ''}` : 'None. This is a new design.')
  row('Meaning origin', `\`${c.meaningOrigin}\``)
  row('Proposed meaning', esc(c.proposedMeaning))
  row('Actor', esc(c.actor))
  row('Trigger', esc(c.trigger))
  row('Resource', esc(c.resource))
  row('Preconditions', list(c.preconditions))
  row('Permitted action', esc(c.permittedAction))
  row('Expected persisted result', esc(c.persistedResult))
  row('Authorization', `\`${c.authorization.basisId}\`${c.authorization.kernelActions.length ? ` (kernel: ${c.authorization.kernelActions.map((a) => `\`${a}\``).join(', ')})` : ''}. ${esc(c.authorization.requirement)}`)
  row('Recusal', esc(c.authorization.recusal))
  row('Audit', `\`${c.audit.classId}\`. ${esc(c.audit.note)}`)
  row('Privacy', `\`${c.privacy.classId}\`. ${esc(c.privacy.note)}`)
  row('User-visible outcome', esc(c.userVisibleOutcome))
  row('Denial and recovery', `\`${c.denialAndRecovery.class}\`. ${esc(c.denialAndRecovery.behavior)}`)
  row('Implementation (source-derived)', implRows(c.implementation))
  row('Provenance', `${esc(c.provenance.design)} Evidence class \`${c.provenance.evidenceClass}\`${c.provenance.evidenceIds.length ? `; evidence ${c.provenance.evidenceIds.join(', ')}` : ''}${c.provenance.relatedIds.length ? `; related ${c.provenance.relatedIds.join(', ')}` : ''}.`)
  row('Institutional adoption', c.institutionalAdoption.required ? `Required. Outstanding decisions: ${c.institutionalAdoption.decisionIds.join(', ')}. Activation: \`${c.activation}\`.` : `Not required. Activation: \`${c.activation}\`.`)
  if (c.completeness.openQuestionIds.length) row('Open product questions', c.completeness.openQuestionIds.join(', '))
  if (c.financial) {
    const f = c.financial
    row('Historical meaning recovered', esc(f.historicalMeaningRecovered))
    row('Operational capability', esc(f.operationalCapability))
    row('Required financial authority', `Duties: ${f.requiredFinancialAuthority.duties.join(', ') || 'none'}; basis \`${f.requiredFinancialAuthority.authorizationBasisId}\`; a mandate is required; derived from a role title: no.`)
    row('Required segregation of duties', esc(f.requiredSegregationOfDuties))
    row('Data and reporting scope', esc(f.dataAndReportingScope))
    row('Integration boundary', esc(f.integrationBoundary))
    row('Current implementation status', `\`${f.currentImplementationStatus}\``)
  }
  if (c.navigationNameOrigin) row('Navigation name origin', `\`${c.navigationNameOrigin}\``)
  if (c.versionedStatus) {
    const v = c.versionedStatus
    row('Versioned status', `${esc(v.rule)}<br>Historical: ${v.historicalDispositions.map((d) => `\`${d.sourceId}\` ${d.observation} ("${esc(d.quote)}")`).join('; ')}<br>Current implementation status: \`${v.currentImplementationStatus}\`. ${esc(v.currentImplementationBasis)}<br>Historical conflict: ${v.conflictOfHistoricalRecords}`)
  }
  if (c.components?.length) row('Components', c.components.map((x) => `${x.id} ${esc(x.title)} (\`${x.authorizationBasisId}\`, ${x.implementationStatus}${x.institutionalAdoptionDecisionIds.length ? `, adoption ${x.institutionalAdoptionDecisionIds.join(', ')}` : ''})`).join('<br>'))
  return `### ${c.id} ${esc(c.title)}\n\n| Field | Content |\n| --- | --- |\n${rows.join('\n')}\n`
}

function renderJourney(j) {
  const steps = j.steps.map((s) => `| ${s.n} | ${esc(s.actor)} | ${esc(s.action)} | ${s.contractIds.join(', ')} | \`${s.authorizationBasisId}\` | ${esc(s.assertion)} |`).join('\n')
  return `### ${j.id} ${esc(j.title)}\n\nLabels: ${j.labels.map((l) => `\`${l}\``).join(' ')}. Meaning origin: \`${j.meaningOrigin}\`. Historical record: ${j.historical ? `${j.historical.kind} in \`${j.historical.sourceId}\` ("${esc(j.historical.quote)}"; the range is named and no journey is defined)` : 'none'}.\n\n${esc(j.proposedMeaning)}\n\n- Actors: ${esc(j.actor)}\n- Preconditions: ${bullets(j.preconditions)}\n- Expected persisted result: ${esc(j.expectedPersistedResult)}\n- Denial and recovery: ${esc(j.denialAndRecovery)}\n- Testable assertions: ${bullets(j.testableAssertions)}\n- Institutional adoption: ${j.institutionalAdoption.required ? `required (${j.institutionalAdoption.decisionIds.join(', ')}); activation \`${j.activation}\`` : 'not required'}\n- Implementation: ${esc(j.implementation.note)}\n${j.segregatedPairs ? `- Segregated duty pairs: ${j.segregatedPairs.map((p) => p.join(' / ')).join('; ')}\n` : ''}\n| Step | Actor | Action | Contracts | Authorization boundary | Assertion |\n| --- | --- | --- | --- | --- | --- |\n${steps}\n`
}

function renderScenario(s) {
  return `### ${s.id} ${esc(s.title)}\n\nLabels: ${s.labels.map((l) => `\`${l}\``).join(' ')}. Operating model: \`${s.operatingModel}\`. Source backing: \`${s.sourceBacking}\`. Historical record: ${s.historical ? `${s.historical.kind} in \`${s.historical.sourceId}\` ("${esc(s.historical.quote)}"; a name only)` : 'none'}.\n\n- Facts: ${s.facts.map((f) => `${esc(f.statement)}${f.file ? ` (\`${f.file.replace('apps/union-eyes/', '')}\`: "${esc(f.quote)}")` : ' (no source; hypothesis)'}`).join('<br>')}\n- Authority structure: ${esc(s.authorityStructure)}\n- Behaviour: ${esc(s.behavior)}\n- Denials: ${bullets(s.denials)}\n- Applies to: ${s.appliesToContractIds.join(', ')}\n- Not interchangeable because: ${esc(s.notInterchangeableBecause)}\n- Implementation: ${esc(s.implementation.note)}\n- Institutional adoption: ${s.institutionalAdoption.required ? `required (${s.institutionalAdoption.decisionIds.join(', ')}); activation \`${s.activation}\`` : 'not required'}\n`
}

function identifierTable(contracts) {
  const rows = contracts.map((c) => `| ${c.id} | ${esc(c.title)} | ${c.historical ? `${c.historical.kind}${c.historical.individuallyEvidenced ? '' : ' (group/status)'}` : 'none'} | \`${c.meaningOrigin}\` | ${c.implementation?.status ?? 'NOT_IMPLEMENTED'} | ${(c.institutionalAdoption?.decisionIds ?? []).join(', ') || 'none'} |`)
  return `| Id | Title | Historical basis | Meaning origin | Implementation (source) | Adoption decisions |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`
}

function summaryTable(measures, counts) {
  const m = measures
  return `| Measure | Value |\n| --- | --- |\n| Identifier coverage | ${m.identifierCoverage.covered} of ${m.identifierCoverage.universe} identifiers have a proposed contract |\n| Behavioural specification | ${m.behavioralSpecification.withAllRequiredFields} of ${m.behavioralSpecification.contracts} contracts carry every required field; ${m.behavioralSpecification.withOpenQuestions} carry open product questions |\n| Implemented functionality (source-derived) | SOURCE_PRESENT ${m.implementedFunctionality.SOURCE_PRESENT}; PARTIAL_SOURCE ${m.implementedFunctionality.PARTIAL_SOURCE}; UNAVAILABLE_501 ${m.implementedFunctionality.UNAVAILABLE_501}; NOT_IMPLEMENTED ${m.implementedFunctionality.NOT_IMPLEMENTED} |\n| Historical versus proposed | ${counts.historicallyEvidenced} individually evidenced; ${counts.historicalGroupOrStatusOnly} under a historical group or status only; ${counts.newDesignOnly} new design only; ${counts.requiresInstitutionalAdoption} require institutional adoption (of ${counts.contracts}) |\n\nThe three measures are separate. An identifier with a contract is not a verified capability, and a cited route is not a conformance check.\n`
}

function banner(dataHash) {
  return `${BANNER.map((l) => `> ${l}`).join('\n>\n')}\n\nData hash: ${dataHash}\n\nThis file is generated by \`node tooling/scripts/lib/ue-gate0a2-build-baselines.mjs\` from \`${'docs/union-eyes/convergence/register'}\`. Do not edit it by hand.\n`
}

function labelsSection() {
  return `## How to read the labels\n\n${LABELS.map((l) => `- \`${l}\`: ${LABEL_MEANING[l]}`).join('\n')}\n\nThe labels are never merged. A contract can carry several, and each is derived from a separate field the validator re-checks.\n`
}

function basesSection(usedIds) {
  return `## Authorization bases used\n\n${[...usedIds].sort().map((id) => `- \`${id}\` (${AUTHORIZATION_BASES[id].domain}): ${AUTHORIZATION_BASES[id].definition}${AUTHORIZATION_BASES[id].requiresInstitutionalInstrument ? ' It needs an institutional instrument that is outstanding.' : ''}`).join('\n')}\n`
}

function renderPersona(key, data, summary, dataHash) {
  const used = new Set()
  for (const c of [...(data.contracts ?? [])]) used.add(c.authorization.basisId)
  for (const j of data.journeys ?? []) for (const s of j.steps) used.add(s.authorizationBasisId)
  const parts = [`# ${data.title}\n\n${banner(dataHash)}\n`, `## Design note\n\n${data.designNote}\n`, labelsSection(), `## Measures\n\n${summaryTable(summary.personas[key], summary.historicalVersusProposed[key])}`]
  if (key === 'steward') parts.push(`## Recovered evidence used\n\n${Object.entries(data.evidenceUse).map(([id, text]) => `- ${id}: ${text}`).join('\n')}\n\nThe evidence supports some contracts and defines none.\n`)
  if (data.r18VersionedRecord) parts.push(`## R18 versioned record\n\n${data.r18VersionedRecord.rule}\n\n${data.r18VersionedRecord.historicalDispositions.map((d) => `- \`${d.sourceId}\` (${d.commit}): ${d.observation}. "${esc(d.quote)}". ${d.meaning}`).join('\n')}\n\nHistorical conflict: ${data.r18VersionedRecord.historicalConflict}. Current implementation status: ${data.r18VersionedRecord.currentImplementationStatus}. ${data.r18VersionedRecord.currentImplementationBasis}\n`)
  parts.push(`## Identifier accounting\n\n${identifierTable(data.contracts)}`)
  parts.push(basesSection(used))
  const byKind = (kind) => data.contracts.filter((c) => c.kind === kind)
  const section = (title, items, render) => (items.length ? `## ${title}\n\n${items.map(render).join('\n')}` : '')
  parts.push(section('Navigation', byKind('NAVIGATION'), renderContract))
  parts.push(section('Actions', byKind('ACTION'), renderContract))
  parts.push(section('Domains', byKind('DOMAIN'), renderContract))
  parts.push(section('Denial contracts', byKind('DENIAL'), renderContract))
  parts.push(section('Journeys', data.journeys ?? [], renderJourney))
  parts.push(section('Organization scenarios', data.scenarios ?? [], renderScenario))
  return `${parts.filter(Boolean).join('\n')}\n`
}

function renderDecisions(data, dataHash) {
  const render = (d) => `### ${d.id} ${esc(d.title)}\n\n- Type: \`${d.type}\`. Status: \`${d.status}\`. Activation: \`${d.activation}\`. Decision owner: \`${d.decisionOwner}\`.\n- Personas: ${d.personas.join(', ')}\n- Question: ${esc(d.question)}\n${d.baselineProposal ? `- Baseline proposal (for review, not adopted): ${esc(d.baselineProposal)}\n` : '- Baseline proposal: none. This baseline does not propose an answer to an institutional authority decision.\n'}${d.options?.length ? `- Options: ${bullets(d.options)}\n` : ''}${d.sources?.length ? `- Related capability or identifier: ${d.sources.join(', ')}\n` : ''}- Behaviour that stays inactive until adopted: ${esc(d.inactiveBehaviorUntilAdopted)}\n`
  const pd = data.decisions.filter((d) => d.type === 'PRODUCT_DESIGN')
  const ia = data.decisions.filter((d) => d.type === 'INSTITUTIONAL_AUTHORITY')
  return `# ${data.title}\n\n${banner(dataHash)}\n\n## Design note\n\n${data.designNote}\n\n## Product design decisions (${pd.length})\n\nThe product specification review can settle these. A settled product decision changes the proposed baseline and still grants no authority.\n\n${pd.map(render).join('\n')}\n## Institutional authority decisions (${ia.length})\n\nThese name who may issue, approve, decide or receive something. They are outstanding. The behaviour each governs is inactive. No reviewer of this repository can settle them.\n\n${ia.map(render).join('\n')}`
}

export function writeBaselines(root = ROOT) {
  const data = buildBaselines()
  for (const [key, file] of Object.entries(BASELINE_DATA)) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), `${JSON.stringify(data[key], null, 2)}\n`)
  }
  const { problems: dataProblems, summary } = validateBaselines(root, { data })
  for (const key of ['steward', 'representative', 'financial-officer', 'decisions']) {
    const hash = sha256File(root, BASELINE_DATA[key])
    const text = key === 'decisions' ? renderDecisions(data.decisions, hash) : renderPersona(key, data[key], summary, hash)
    mkdirSync(dirname(join(root, BASELINE_DOCS[key])), { recursive: true })
    writeFileSync(join(root, BASELINE_DOCS[key]), text)
  }
  return { data, summary, dataProblems }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { summary, dataProblems } = writeBaselines()
  console.log(JSON.stringify(summary, null, 2))
  if (dataProblems.length > 0) {
    console.error(dataProblems.join('\n'))
    process.exitCode = 1
  }
}
