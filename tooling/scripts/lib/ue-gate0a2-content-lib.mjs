/**
 * Builds one proposed action contract from compact content. The builder derives every label that can be derived
 * (history, implementation, adoption) so a contract cannot carry a label its own fields contradict, and it re-reads
 * each cited source file so implementation claims reflect the tree.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AUTHORIZATION_BASES, deriveFileFacts } from './ue-gate0a2-baseline-facts.mjs'

export const RECUSAL = {
  CASE: 'A live recusal or adverse-party status on this case denies the action before any source of authority is consulted. A person may declare their own recusal. Lifting a recusal is an institutional decision (DEC-IA-07) and is not offered.',
  THREAD: 'A live recusal on this conversation denies the action. A person may declare their own recusal. Lifting it is an institutional decision (DEC-IA-07).',
  MEMBER_RECORD: 'A live recusal on the member record, or being the subject of the record in a contested matter, denies the action. Lifting a recusal is an institutional decision (DEC-IA-07).',
  FINANCIAL: 'A participant in a transaction cannot take a second segregated duty on it. A live recusal or adverse-party status on the transaction or record denies every duty. Lifting a recusal is an institutional decision (DEC-IA-07).',
  NAVIGATION: 'The entry point touches no case, conversation or financial record. Every resource listed behind it is filtered by recusal individually.',
  ADMIN: 'An administrator who is a party to the matter, or who authored the instrument being approved, cannot approve it. Lifting a recusal is an institutional decision (DEC-IA-07).',
  SELF: 'Not applicable. The action changes only the signed-in person\u2019s own settings.',
}

const RECUSAL_BY_DOMAIN = { case: 'CASE', message: 'THREAD', document: 'CASE', workaid: 'CASE', member: 'MEMBER_RECORD', finance: 'FINANCIAL', navigation: 'NAVIGATION', self: 'SELF', administration: 'ADMIN', role: 'CASE' }

export const AUDIT_DEFAULT = {
  write: ['AUDIT_ATOMIC_WITH_MUTATION', 'The persisted result and its audit record commit together; a failed audit record rolls the result back.'],
  sensitiveRead: ['AUDIT_SENSITIVE_READ_LOGGED', 'The read is logged with actor, resource and authority source. A refusal of a readable resource is recorded.'],
  view: ['AUDIT_NONE_NONSENSITIVE_VIEW', 'No audit record beyond request logging.'],
  denial: ['AUDIT_DENIAL_RECORDED', 'The refusal is recorded as security evidence.'],
}

const PRIV_NOTES = {
  PRIV_STAFF_ONLY_INTERNAL: 'Staff-only. The member never sees the content unless a separate, explicit, affirmative disclosure is chosen.',
  PRIV_MEMBER_VISIBLE: 'The member sees the content. It excludes internal notes, assessments and cost reserves.',
  PRIV_MEMBER_PII_MINIMIZED: 'Member identity and contact data appear only where a live relationship to the member\u2019s matter exists.',
  PRIV_PRIVILEGED_EXCLUDED: 'Privileged and counsel-controlled content is excluded. Only an explicit, independent privileged-access grant reaches it.',
  PRIV_FINANCIAL_PERSONAL: 'Individual member financial data is visible only to the member and to a live mandate that names the account. Unknown values stay unknown and are never shown as zero or paid up.',
  PRIV_CONTENT_FREE_NOTICE: 'The notice carries no case, message or financial content.',
  PRIV_NONE: 'No personal or confidential data is processed by the action itself.',
}

const DENY_DEFAULTS = {
  forbid: ['KERNEL_DENY_403', 'The refusal is recorded and nothing is written. The actor may request the authority through the institution.'],
  notfound: ['NOT_FOUND_404_NO_ORACLE', 'A resource the actor may not read answers as not found, so its existence is not disclosed.'],
  closed: ['FAIL_CLOSED_NO_WRITE', 'On any failure nothing is written and the failure is shown as a failure, never as an empty or zero result.'],
  unavailable: ['UNAVAILABLE_501', 'The capability answers HTTP 501 with an honest not-available state. It never returns a success it did not perform.'],
  validation: ['VALIDATION_REJECT', 'An invalid request is rejected with the reason and nothing is written.'],
}

/** Expands the shorthand used by the Representative and Financial Officer content into the full contract fields. */
export function fill(o) {
  const out = { ...o }
  if (typeof o.audit === 'string') out.audit = [AUDIT_DEFAULT[o.audit][0], o.auditNote ?? AUDIT_DEFAULT[o.audit][1]]
  if (typeof o.priv === 'string') out.priv = [o.priv, o.privNote ?? PRIV_NOTES[o.priv]]
  if (typeof o.deny === 'string') {
    const [cls, text] = DENY_DEFAULTS[o.deny]
    out.deny = [cls, o.denyNote ? `${o.denyNote} ${text}` : text]
  }
  return out
}

function meaningOrigin(historical) {
  if (!historical) return 'NEW_DESIGN'
  if (historical.kind === 'STATUS_STATEMENT' || historical.kind === 'STATUS_ONLY') return 'NEW_DESIGN_UNDER_HISTORICAL_STATUS'
  return historical.individuallyEvidenced ? 'HISTORICAL_TITLE_WITH_NEW_SPECIFICATION' : 'NEW_DESIGN_UNDER_HISTORICAL_GROUP'
}

export function buildContract(root, input) {
  const o = fill(input)
  const basis = AUTHORIZATION_BASES[o.auth.basis]
  if (!basis) throw new Error(`${o.id}: unknown authorization basis ${o.auth.basis}`)
  const recusal = o.auth.recusal ?? RECUSAL[RECUSAL_BY_DOMAIN[basis.domain]]
  for (const file of o.impl?.routes ?? []) if (deriveFileFacts(root, file).signal === 'FILE_ABSENT') throw new Error(`${o.id}: cited route file is absent: ${file}`)
  for (const file of o.impl?.services ?? []) if (deriveFileFacts(root, file).signal === 'FILE_ABSENT') throw new Error(`${o.id}: cited service file is absent: ${file}`)
  const routes = (o.impl?.routes ?? []).map((file) => deriveFileFacts(root, file))
  const services = (o.impl?.services ?? []).map((file) => ({ file, signal: deriveFileFacts(root, file).signal }))
  const status = o.impl?.status ?? 'NOT_IMPLEMENTED'
  const hasSource = status === 'SOURCE_PRESENT' || status === 'PARTIAL_SOURCE'
  const adoption = o.adopt ?? []
  const historical = o.hist ? { sourceId: o.hist.src, quote: o.hist.q, kind: o.hist.kind, individuallyEvidenced: o.hist.individual ?? true, note: o.hist.note ?? null } : null
  const labels = ['PROPOSED_NEW_BASELINE']
  if (historical?.individuallyEvidenced) labels.unshift('HISTORICALLY_EVIDENCED')
  if (hasSource) labels.push('IMPLEMENTED_SOURCE')
  if (adoption.length > 0) labels.push('REQUIRES_INSTITUTIONAL_ADOPTION')
  const contract = {
    id: o.id,
    kind: o.kind ?? 'ACTION',
    title: o.title,
    labels,
    historical,
    meaningOrigin: meaningOrigin(historical),
    proposedMeaning: o.desc,
    actor: o.actor,
    trigger: o.trigger,
    resource: o.resource,
    preconditions: o.pre,
    permittedAction: o.act,
    persistedResult: o.result,
    authorization: { basisId: o.auth.basis, kernelActions: o.auth.kernel ?? [], requirement: o.auth.req, recusal },
    audit: { classId: o.audit[0], note: o.audit[1] },
    privacy: { classId: o.priv[0], note: o.priv[1] },
    userVisibleOutcome: o.ui,
    denialAndRecovery: { class: o.deny[0], behavior: o.deny[1] },
    implementation: { status, routes, services, capabilityId: o.impl?.cap ?? null, conformanceChecked: false, note: o.impl?.note ?? 'No source implements this contract.' },
    provenance: { design: o.design ?? 'New design for the proposed baseline.', evidenceIds: o.evidence ?? [], evidenceClass: o.evClass ?? (o.evidence?.length ? 'SUPPORTED_BY_RECOVERED_EVIDENCE' : hasSource ? 'SUPPORTED_BY_EXECUTABLE_CONTRACT' : 'DESIGN_ONLY'), relatedIds: o.rel ?? [] },
    institutionalAdoption: { required: adoption.length > 0, decisionIds: adoption },
    liveAuthorityCreated: false,
    activation: adoption.length > 0 ? 'INACTIVE_UNTIL_ADOPTED' : 'PROPOSAL_ONLY_NOT_ADOPTED',
    completeness: { state: (o.open ?? []).length > 0 ? 'PROPOSED_WITH_OPEN_QUESTIONS' : 'PROPOSED_NO_OPEN_QUESTIONS', openQuestionIds: o.open ?? [] },
  }
  if (o.extra) Object.assign(contract, o.extra)
  return contract
}

export function buildJourney(o) {
  const adoption = o.adopt ?? []
  const historical = o.hist ? { sourceId: o.hist.src, quote: o.hist.q, kind: o.hist.kind, individuallyEvidenced: false, note: o.hist.note ?? null } : null
  const labels = ['PROPOSED_NEW_BASELINE']
  if (adoption.length > 0) labels.push('REQUIRES_INSTITUTIONAL_ADOPTION')
  return {
    id: o.id,
    kind: 'JOURNEY',
    title: o.title,
    labels,
    historical,
    meaningOrigin: historical ? 'NEW_DESIGN_UNDER_HISTORICAL_GROUP' : 'NEW_DESIGN',
    proposedMeaning: o.desc,
    actor: o.actor,
    preconditions: o.pre,
    steps: o.steps.map((s, i) => ({ n: i + 1, actor: s.actor, action: s.action, contractIds: s.ids, authorizationBasisId: s.basis, assertion: s.assert })),
    expectedPersistedResult: o.result,
    denialAndRecovery: o.recovery,
    testableAssertions: o.assertions,
    implementation: { status: 'NOT_IMPLEMENTED', note: 'The journey is a specification for later qualification. No run of it exists.' , conformanceChecked: false },
    provenance: { design: o.design ?? 'New design for the proposed baseline.', evidenceIds: [], evidenceClass: 'DESIGN_ONLY', relatedIds: o.rel ?? [] },
    institutionalAdoption: { required: adoption.length > 0, decisionIds: adoption },
    liveAuthorityCreated: false,
    activation: adoption.length > 0 ? 'INACTIVE_UNTIL_ADOPTED' : 'PROPOSAL_ONLY_NOT_ADOPTED',
    completeness: { state: (o.open ?? []).length > 0 ? 'PROPOSED_WITH_OPEN_QUESTIONS' : 'PROPOSED_NO_OPEN_QUESTIONS', openQuestionIds: o.open ?? [] },
    ...(o.extra ?? {}),
  }
}

export function buildScenario(root, o) {
  for (const f of o.facts.filter((x) => x.file)) {
    const path = join(root, f.file)
    if (!existsSync(path)) throw new Error(`${o.id}: cited fact file is absent: ${f.file}`)
    if (f.q && !readFileSync(path, 'utf8').replace(/\s+/g, ' ').includes(f.q)) throw new Error(`${o.id}: quoted fact not found in ${f.file}: ${f.q}`)
  }
  const adoption = o.adopt ?? []
  const labels = ['PROPOSED_NEW_BASELINE']
  if (adoption.length > 0) labels.push('REQUIRES_INSTITUTIONAL_ADOPTION')
  return {
    id: o.id,
    kind: 'SCENARIO',
    title: o.title,
    labels,
    historical: o.hist ? { sourceId: o.hist.src, quote: o.hist.q, kind: 'NAME', individuallyEvidenced: false, note: o.hist.note ?? null } : null,
    meaningOrigin: 'NEW_DESIGN_UNDER_HISTORICAL_GROUP',
    operatingModel: o.model,
    sourceBacking: o.backing,
    facts: o.facts.map((f) => ({ statement: f.t, file: f.file ?? null, quote: f.q ?? null, class: f.file ? 'EXECUTABLE_CONTRACT_COMMENT_OR_CODE' : 'NO_SOURCE_HYPOTHESIS' })),
    authorityStructure: o.structure,
    behavior: o.behavior,
    denials: o.denials,
    appliesToContractIds: o.ids,
    notInterchangeableBecause: o.distinct,
    implementation: { status: 'NOT_IMPLEMENTED', note: o.implNote ?? 'No source represents this scenario as configuration, and no run of it exists.', conformanceChecked: false },
    provenance: { design: 'New design for the proposed baseline.', evidenceIds: [], evidenceClass: o.backing === 'SOURCE_BACKED_PROTOCOL' ? 'SUPPORTED_BY_EXECUTABLE_CONTRACT' : 'DESIGN_ONLY', relatedIds: o.rel ?? [] },
    institutionalAdoption: { required: adoption.length > 0, decisionIds: adoption },
    liveAuthorityCreated: false,
    activation: adoption.length > 0 ? 'INACTIVE_UNTIL_ADOPTED' : 'PROPOSAL_ONLY_NOT_ADOPTED',
    completeness: { state: 'PROPOSED_WITH_OPEN_QUESTIONS', openQuestionIds: o.open ?? adoption },
  }
}
