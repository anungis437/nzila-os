/**
 * Gate 0A persona source recovery.
 *
 * The recovery file is an evidence consolidation. It is not a canonical document and it never adds or
 * removes an identifier from a persona universe. It can only move an identifier up one rung (unspecified to
 * grouped, or to individually defined) when a verbatim quote from a git-recorded source supports the move.
 * Every source is addressed by commit and path, its blob hash is re-derived from git, and every quote is
 * re-found in that blob. An executable contract, supporting design evidence, or an inference can name a
 * candidate but cannot define an institutional requirement.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const RECOVERY_FILE = 'docs/union-eyes/convergence/register/ue-gate0a-persona-source-recovery.json'

export const SOURCE_CLASSES = [
  'ORIGINAL_FROZEN_CANONICAL',
  'HISTORICAL_CANONICAL_PREDECESSOR',
  'FROZEN_DISPOSITION',
  'EXISTING_EXECUTABLE_CONTRACT',
  'SUPPORTING_DESIGN_EVIDENCE',
  'UNVERIFIED_INFERENCE',
]

export const DEFINITION_AUTHORITY = ['ORIGINAL_FROZEN_CANONICAL', 'HISTORICAL_CANONICAL_PREDECESSOR', 'FROZEN_DISPOSITION']

export const LEVELS = ['INDIVIDUALLY_DEFINED', 'GROUPED_ONLY', 'UNSPECIFIED']

const normalize = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()
const ID_TOKEN = '(?:REP-(?:NAV|ACT)-\\d+|FJ\\d{2}|F\\d{2}|R\\d{2}|SR\\d{2}|[MGO]\\d{2})'

export function gitShowAt(root, commit, path) {
  try {
    return execFileSync('git', ['show', `${commit}:${path}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

export function gitBlobAt(root, commit, path) {
  try {
    return execFileSync('git', ['rev-parse', `${commit}:${path}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

export function loadRecovery(root) {
  try {
    return JSON.parse(readFileSync(join(root, RECOVERY_FILE), 'utf8'))
  } catch {
    return null
  }
}

export function expandRange(prefix, from, to) {
  const out = []
  for (let n = Number(from); n <= Number(to); n += 1) out.push(`${prefix}${String(n).padStart(2, '0')}`)
  return out
}

export function idsInQuote(quote) {
  const ids = new Set()
  for (const match of quote.matchAll(/\b(FJ|F|R)(\d{2})\s*[–-]\s*(?:FJ|F|R)?(\d{2})\b/g)) for (const id of expandRange(match[1], match[2], match[3])) ids.add(id)
  for (const match of quote.matchAll(/\b(FJ\d{2}|F\d{2}|R\d{2})\b/g)) ids.add(match[1])
  return ids
}

/** An identifier is solitary when no sibling identifier is joined to it by a slash, comma, or dash. */
export function isSolitary(quote, id) {
  const text = normalize(quote)
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const joinedBefore = new RegExp(`${ID_TOKEN}\\s*[/,–-]\\s*${escaped}\\b`)
  const joinedAfter = new RegExp(`\\b${escaped}\\s*[/,–-]\\s*${ID_TOKEN}`)
  return new RegExp(`\\b${escaped}\\b`).test(text) && !joinedBefore.test(text) && !joinedAfter.test(text)
}

export function verifyRecovery(recovery, specs, options = {}) {
  const root = options.root
  const show = options.show ?? ((commit, path) => gitShowAt(root, commit, path))
  const blobOf = options.blobOf ?? ((commit, path) => gitBlobAt(root, commit, path))
  const problems = []
  const sourceById = new Map()
  const sourceText = new Map()
  const result = { problems, promotions: new Map(), groupLabels: [], conflicts: [], unidentified: [], steward: { evidenceCount: 0, authoritativeActions: 0 }, sources: [] }
  if (!recovery) {
    problems.push('persona source recovery file is missing or unreadable')
    return result
  }
  if (recovery.schemaVersion !== 1) problems.push('persona source recovery schemaVersion must be 1')
  if (recovery.kind !== 'EVIDENCE_CONSOLIDATION') problems.push('persona source recovery must declare kind EVIDENCE_CONSOLIDATION and must not present itself as a canonical')

  for (const source of recovery.sources ?? []) {
    if (sourceById.has(source.id)) problems.push(`recovery source ${source.id} appears twice`)
    sourceById.set(source.id, source)
    result.sources.push({ id: source.id, class: source.class, commit: source.commit, path: source.path })
    if (!SOURCE_CLASSES.includes(source.class)) problems.push(`recovery source ${source.id} has unknown class ${source.class}`)
    if (!/^[0-9a-f]{40}$/.test(source.commit ?? '')) {
      problems.push(`recovery source ${source.id} needs a full commit SHA`)
      continue
    }
    const text = show(source.commit, source.path)
    if (text === null) {
      problems.push(`recovery source ${source.id} is not readable at ${String(source.commit).slice(0, 9)}:${source.path}`)
      continue
    }
    sourceText.set(source.id, normalize(text))
    if (blobOf(source.commit, source.path) !== source.blob) problems.push(`recovery source ${source.id} blob hash does not match git`)
  }

  const quoteProblem = (label, sourceId, quote) => {
    const source = sourceById.get(sourceId)
    if (!source) return `${label} cites unknown source ${sourceId}`
    if (typeof quote !== 'string' || quote.trim() === '') return `${label} has no quote`
    const text = sourceText.get(sourceId)
    if (text === undefined) return `${label} cites unreadable source ${sourceId}`
    return text.includes(normalize(quote)) ? null : `${label} quote is not in ${sourceId}`
  }

  const statementsById = new Map()
  for (const entry of recovery.identifiers ?? []) {
    const label = `recovery identifier ${entry.persona}/${entry.id}`
    const spec = specs[entry.persona]
    if (!spec) {
      problems.push(`${label} names an unknown persona`)
      continue
    }
    if (!spec.universe.includes(entry.id)) {
      problems.push(`${label} is not in the ${entry.persona} universe; recovery cannot add identifiers`)
      continue
    }
    if (!LEVELS.includes(entry.level)) problems.push(`${label} has unknown level ${entry.level}`)
    const source = sourceById.get(entry.sourceId)
    const issue = quoteProblem(label, entry.sourceId, entry.quote)
    if (issue) problems.push(issue)
    if (entry.level === 'INDIVIDUALLY_DEFINED') {
      if (entry.basis === 'INFERENCE' || source?.class === 'UNVERIFIED_INFERENCE') problems.push(`${label} is an inference and cannot be presented as an individually defined requirement`)
      else if (!source || !DEFINITION_AUTHORITY.includes(source.class)) problems.push(`${label} cites a ${source?.class ?? 'missing'} source, which cannot define an institutional requirement`)
      if (typeof entry.title !== 'string' || entry.title.trim() === '') problems.push(`${label} has no title`)
      else if (!normalize(entry.quote).includes(normalize(entry.title))) problems.push(`${label} title is not in its quote`)
      if (!isSolitary(entry.quote ?? '', entry.id)) problems.push(`${label} is joined to sibling identifiers in its quote, so it is grouped and not individually defined`)
      if (!issue && source && DEFINITION_AUTHORITY.includes(source.class) && entry.basis !== 'INFERENCE' && entry.title?.trim() && isSolitary(entry.quote ?? '', entry.id)) {
        result.promotions.set(`${entry.persona}|${entry.id}`, { persona: entry.persona, id: entry.id, level: 'INDIVIDUALLY_DEFINED', title: entry.title, sourceId: source.id, class: source.class, commit: source.commit, path: source.path })
      }
    }
    for (const statement of entry.statements ?? []) {
      const statementIssue = quoteProblem(`${label} statement`, statement.sourceId, statement.quote)
      if (statementIssue) problems.push(statementIssue)
      const key = `${entry.persona}|${entry.id}`
      if (!statementsById.has(key)) statementsById.set(key, [])
      statementsById.get(key).push({ sourceId: statement.sourceId, status: normalize(statement.status).toUpperCase() })
    }
  }

  for (const group of recovery.groups ?? []) {
    const label = `recovery group ${group.persona}/${(group.ids ?? []).join(',')}`
    const spec = specs[group.persona]
    if (!spec) {
      problems.push(`${label} names an unknown persona`)
      continue
    }
    const issue = quoteProblem(label, group.sourceId, group.quote)
    if (issue) problems.push(issue)
    const named = idsInQuote(group.quote ?? '')
    for (const id of group.ids ?? []) {
      if (!spec.universe.includes(id)) problems.push(`${label} names ${id}, which is not in the ${group.persona} universe`)
      else if (!named.has(id)) problems.push(`${label} names ${id}, which its quote does not cover`)
    }
    const mismatch = Array.isArray(group.labels) && group.labels.length !== (group.ids ?? []).length
    if (mismatch && group.pairing !== 'NONE') problems.push(`${label} has ${group.labels.length} labels for ${group.ids.length} identifiers and must record pairing NONE`)
    if (group.pairing && !['NONE', 'POSITIONAL_INFERENCE'].includes(group.pairing)) problems.push(`${label} has unknown pairing ${group.pairing}`)
    result.groupLabels.push({ persona: group.persona, ids: group.ids, labels: group.labels ?? [], pairing: group.pairing ?? 'NONE', sourceId: group.sourceId, level: group.level })
    if (group.level === 'GROUPED_ONLY' && !issue) {
      for (const id of group.ids ?? []) {
        const key = `${group.persona}|${id}`
        if (!result.promotions.has(key)) result.promotions.set(key, { persona: group.persona, id, level: 'GROUPED_ONLY', sourceId: group.sourceId })
      }
    }
  }

  const declared = new Set((recovery.conflicts ?? []).map((item) => `${item.persona}|${item.id}`))
  for (const item of recovery.conflicts ?? []) {
    const label = `recovery conflict ${item.persona}/${item.id}`
    if (item.disposition !== 'UNRESOLVED') problems.push(`${label} must stay UNRESOLVED; Gate 0A has no authority to settle a source conflict`)
    for (const statement of item.statements ?? []) {
      const issue = quoteProblem(label, statement.sourceId, statement.quote)
      if (issue) problems.push(issue)
    }
    if (new Set((item.statements ?? []).map((statement) => normalize(statement.status).toUpperCase())).size < 2) problems.push(`${label} does not record two differing statements`)
  }
  for (const [key, statements] of statementsById) {
    const distinct = new Set(statements.map((statement) => statement.status))
    if (distinct.size > 1 && !declared.has(key)) problems.push(`sources disagree about ${key.replace('|', '/')} (${[...distinct].join(' vs ')}) and no unresolved conflict is recorded`)
  }
  for (const key of declared) {
    const [persona, id] = key.split('|')
    result.conflicts.push({ persona, id })
  }

  for (const item of recovery.unidentifiedReferences ?? []) {
    const label = `recovery unidentified reference ${item.persona}/${item.label}`
    const issue = quoteProblem(label, item.sourceId, item.quote)
    if (issue) problems.push(issue)
    if (!specs[item.persona]) problems.push(`${label} names an unknown persona`)
    if (item.blocksResolution !== true) problems.push(`${label} must block resolution; it has no identifier and no definition`)
    result.unidentified.push({ persona: item.persona, label: item.label, sourceId: item.sourceId })
  }

  for (const search of recovery.canonicalSearch ?? []) {
    const label = `recovery canonical search ${search.persona}`
    if (search.status !== 'NOT_RECOVERED' && search.status !== 'RECOVERED') problems.push(`${label} has unknown status ${search.status}`)
    if (search.status === 'RECOVERED' && !(recovery.sources ?? []).some((source) => DEFINITION_AUTHORITY.slice(0, 2).includes(source.class) && source.canonicalFor === search.persona)) {
      problems.push(`${label} claims a recovered canonical but no ORIGINAL_FROZEN_CANONICAL or HISTORICAL_CANONICAL_PREDECESSOR source is registered for it`)
    }
    if (search.firstCited) {
      const issue = quoteProblem(label, search.firstCited.sourceId, search.firstCited.quote)
      if (issue) problems.push(issue)
    }
  }

  const steward = recovery.steward ?? {}
  for (const evidence of steward.evidence ?? []) {
    const label = `recovery steward evidence ${evidence.id}`
    const issue = quoteProblem(label, evidence.sourceId, evidence.quote)
    if (issue) problems.push(issue)
    if (evidence.definesAction === true) problems.push(`${label} is evidence only and cannot define a steward action`)
    if (!SOURCE_CLASSES.includes(evidence.class)) problems.push(`${label} has unknown class ${evidence.class}`)
  }
  result.steward.evidenceCount = (steward.evidence ?? []).length
  result.steward.authoritativeActions = Number(steward.authoritativeActions ?? 0)
  if (result.steward.authoritativeActions !== 0 && (specs.steward?.universe ?? []).length === 0) {
    problems.push('recovery claims authoritative steward actions but the steward universe is empty')
  }

  for (const row of recovery.financialAuthoritySeparation ?? []) {
    const label = `recovery financial separation ${row.concern}`
    if (row.institutionallyRequired === true && !(row.evidence ?? []).some((item) => DEFINITION_AUTHORITY.includes(sourceById.get(item.sourceId)?.class) && item.definesRequirement === true)) {
      problems.push(`${label} is presented as institutionally required without an authoritative source`)
    }
    for (const item of row.evidence ?? []) {
      const issue = quoteProblem(label, item.sourceId, item.quote)
      if (issue) problems.push(issue)
    }
  }
  return result
}

/** Apply verified recovery to one extracted persona universe. */
export function applyRecovery(persona, extracted, verification) {
  const promoted = { individuallyDefined: [], groupedOnly: [] }
  const definitionSources = {}
  const individually = new Set(extracted.individuallyDefined)
  const grouped = new Set(extracted.groupedOnly)
  const unspecified = new Set(extracted.unspecified)
  for (const [key, promotion] of verification.promotions) {
    if (!key.startsWith(`${persona}|`)) continue
    if (!extracted.universe.includes(promotion.id)) continue
    if (promotion.level === 'INDIVIDUALLY_DEFINED' && !individually.has(promotion.id)) {
      individually.add(promotion.id)
      grouped.delete(promotion.id)
      unspecified.delete(promotion.id)
      promoted.individuallyDefined.push(promotion.id)
      definitionSources[promotion.id] = { sourceId: promotion.sourceId, class: promotion.class, commit: promotion.commit, path: promotion.path, title: promotion.title }
    } else if (promotion.level === 'GROUPED_ONLY' && !individually.has(promotion.id) && !grouped.has(promotion.id)) {
      grouped.add(promotion.id)
      unspecified.delete(promotion.id)
      promoted.groupedOnly.push(promotion.id)
    }
  }
  const ordered = (set) => extracted.universe.filter((id) => set.has(id))
  return {
    individuallyDefined: ordered(individually),
    groupedOnly: ordered(grouped),
    unspecified: ordered(unspecified),
    promoted,
    definitionSources,
  }
}
