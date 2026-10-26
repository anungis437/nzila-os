/**
 * Union Eyes convergence checks.
 *
 * Pure functions (no I/O of their own) so they are unit-testable; check-ue-convergence.mjs supplies the file system,
 * git and the repository's own lineage verifier.
 *
 * Two kinds of control:
 *   1. Register integrity. The convergence register is only useful if it is truthful, so a CLOSED entry must cite
 *      evidence that exists, an EXTERNAL_GATE must name its owner and exact missing proof, every referenced file must
 *      exist, and a REMOVE disposition must name its replacement and retirement commit.
 *   2. Allowlist ratchets over the source tree. A pattern (retired symbol, legacy shortcut, unsupported reader) may
 *      appear only in an explicit, reasoned allowlist. A new occurrence fails the build; an allowlisted file that no
 *      longer matches is reported stale so the list can only shrink.
 */

export const STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED', 'EXTERNAL_GATE']
export const CLASSIFICATIONS = [
  'CANONICAL',
  'SUPPORTED_PROJECTION',
  'ACTIVE_COMPATIBILITY',
  'MIGRATION_ONLY',
  'HISTORICAL_EVIDENCE',
  'RETIRE_PENDING',
  'REMOVE',
]
export const SOURCE_KINDS = ['file', 'table', 'symbol', 'api']
export const EVIDENCE_TYPES = ['commit', 'path', 'test']
export const DISPOSITIONS = ['NONE', ...CLASSIFICATIONS.filter((c) => c === 'REMOVE' || c === 'RETIRE_PENDING')]
export const WORKSTREAMS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

const ID_RE = /^UE-CONV-[A-K]-\d{3}$/
const REQUIRED_TEXT = ['domain', 'capability', 'canonicalOwner', 'defect', 'securityImplications', 'requiredImplementation']

const isText = (v) => typeof v === 'string' && v.trim().length > 0
const looksLikePath = (v) => typeof v === 'string' && v.includes('/') && !/\s/.test(v)

/**
 * @param {object} register
 * @param {{ fileExists: (path: string) => boolean, commitExists?: (sha: string) => boolean }} io
 * @returns {{ problems: string[], counts: Record<string, number> }}
 */
export function validateRegister(register, io) {
  const problems = []
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]))
  if (!register || register.schemaVersion !== 1) problems.push('register: schemaVersion must be 1')
  if (!register || !Array.isArray(register.entries) || register.entries.length === 0) {
    problems.push('register: entries must be a non-empty array')
    return { problems, counts }
  }
  const seen = new Set()
  for (const e of register.entries) {
    const at = (m) => problems.push(`${e?.id ?? '<no id>'}: ${m}`)
    if (!ID_RE.test(String(e?.id ?? ''))) at('id must match UE-CONV-<A-K>-<nnn>')
    if (seen.has(e?.id)) at('duplicate id')
    seen.add(e?.id)
    if (!WORKSTREAMS.includes(e?.workstream)) at(`workstream must be one of ${WORKSTREAMS.join('')}`)
    for (const k of REQUIRED_TEXT) if (!isText(e?.[k])) at(`${k} is required`)
    if (!STATUSES.includes(e?.status)) at(`status must be one of ${STATUSES.join(', ')}`)
    else counts[e.status]++
    if (!Array.isArray(e?.sources)) at('sources must be an array')
    if (!Array.isArray(e?.consumers)) at('consumers must be an array')
    if (!Array.isArray(e?.evidence)) at('evidence must be an array')

    for (const s of e?.sources ?? []) {
      if (!SOURCE_KINDS.includes(s?.kind)) at(`source kind must be one of ${SOURCE_KINDS.join(', ')}`)
      if (!CLASSIFICATIONS.includes(s?.classification)) at(`source ${s?.ref}: classification must be one of ${CLASSIFICATIONS.join(', ')}`)
      if (!isText(s?.ref)) at('source ref is required')
      else if (s.kind === 'file' && !io.fileExists(s.ref)) at(`source file does not exist: ${s.ref}`)
    }
    for (const c of e?.consumers ?? []) {
      if (looksLikePath(c) && !io.fileExists(c)) at(`consumer path does not exist: ${c}`)
    }
    for (const ev of e?.evidence ?? []) {
      if (!EVIDENCE_TYPES.includes(ev?.type)) at(`evidence type must be one of ${EVIDENCE_TYPES.join(', ')}`)
      else if (!isText(ev?.ref)) at('evidence ref is required')
      else if (ev.type === 'commit') {
        if (!/^[0-9a-f]{7,40}$/.test(ev.ref)) at(`evidence commit is not a sha: ${ev.ref}`)
        else if (io.commitExists && !io.commitExists(ev.ref)) at(`evidence commit does not exist: ${ev.ref}`)
      } else if (!io.fileExists(ev.ref)) at(`evidence ${ev.type} does not exist: ${ev.ref}`)
    }

    if (e?.status === 'CLOSED') {
      if (!Array.isArray(e.evidence) || e.evidence.length === 0) at('CLOSED requires evidence')
    }
    if (e?.status === 'EXTERNAL_GATE') {
      if (!isText(e.externalGate?.owner) || !isText(e.externalGate?.missingProof)) at('EXTERNAL_GATE requires externalGate.owner and externalGate.missingProof')
    } else if (e?.externalGate) at('externalGate is only valid on an EXTERNAL_GATE entry')

    const r = e?.retirement
    if (!r || !DISPOSITIONS.includes(r.disposition)) at(`retirement.disposition must be one of ${DISPOSITIONS.join(', ')}`)
    else if (r.disposition === 'REMOVE') {
      if (!isText(r.replacement) || !isText(r.commit)) at('REMOVE requires retirement.replacement and retirement.commit')
      else if (io.commitExists && !io.commitExists(r.commit)) at(`retirement commit does not exist: ${r.commit}`)
      if (e.status !== 'CLOSED') at('REMOVE disposition requires a CLOSED entry (the artifact is already retired)')
    } else if (r.disposition === 'RETIRE_PENDING' && !isText(r.replacement)) at('RETIRE_PENDING requires retirement.replacement')
  }
  return { problems, counts }
}

/**
 * @param {{ id: string, allowed?: { file: string, reason: string }[], mode?: 'allowlist'|'zero' }} rule
 * @param {string[]} matchedFiles repo-relative paths that match the rule's pattern
 */
export function evaluateRule(rule, matchedFiles) {
  const allowed = new Map((rule.allowed ?? []).map((a) => [a.file, a]))
  const problems = []
  const stale = []
  for (const a of rule.allowed ?? []) {
    if (!isText(a.reason)) problems.push(`${rule.id}: allowlist entry ${a.file} has no reason`)
  }
  if (rule.mode === 'zero' && allowed.size > 0) problems.push(`${rule.id}: a zero rule may not have an allowlist`)
  for (const f of [...matchedFiles].sort()) {
    if (!allowed.has(f)) problems.push(`${rule.id}: unexpected occurrence in ${f} — ${rule.description}`)
  }
  const matched = new Set(matchedFiles)
  for (const a of rule.allowed ?? []) if (!matched.has(a.file)) stale.push(`${rule.id}: allowlisted file no longer matches (remove it): ${a.file}`)
  return { problems, stale }
}
