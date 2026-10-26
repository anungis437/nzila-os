/**
 * Persona specification completeness for Gate 0.
 *
 * Measures each of the seven personas against the identifiers its own repository source declares,
 * rather than against the subset an extractor happens to recognise. A persona whose identifiers
 * are only cited as a range, or are not in the repository at all, is reported as unresolved.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const PERSONAS = [
  'member',
  'steward',
  'representative',
  'senior-representative',
  'officer-executive',
  'financial-officer',
  'governance-officer',
]

export const PERSONA_LABELS = {
  member: 'Member',
  steward: 'Steward',
  representative: 'Representative',
  'senior-representative': 'Senior Representative',
  'officer-executive': 'Officer / Executive',
  'financial-officer': 'Financial Officer',
  'governance-officer': 'Governance Officer',
}

export const SOURCE_FILES = {
  member: 'docs/union-eyes/reality-remediation/UE_MEMBER_CANONICAL_2_1.md',
  representative: 'docs/union-eyes/convergence/UE_REPRESENTATIVE_2_2_CONVERGENCE_DISPOSITION.md',
  'senior-representative': 'docs/union-eyes/reality-remediation/32_UE_SENIOR_REPRESENTATIVE_2_1_CONVERGENCE_DISPOSITION.md',
  'officer-executive': 'apps/union-eyes/lib/executive/capability-matrix.ts',
  'financial-officer': 'docs/union-eyes/financial-officer/UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION.md',
  'governance-officer': 'docs/union-eyes/governance-officer/UE-GOVERNANCE-OFFICER-CANONICAL-2.1.md',
}

export const UNRESOLVED_OWNER = {
  steward: 'UE-OMIT-STEWARD-CANONICAL-ABSENT',
  representative: 'UE-OMIT-REP-CANONICAL-ABSENT',
  'financial-officer': 'UE-OMIT-FINANCE-RANGE-UNSPECIFIED',
}

const pad = (n, width = 2) => String(n).padStart(width, '0')

function expand(prefix, from, to) {
  const out = []
  for (let n = Number(from); n <= Number(to); n += 1) out.push(`${prefix}${pad(n)}`)
  return out
}

function section(text, start, end) {
  const from = text.indexOf(start)
  if (from < 0) return ''
  const rest = text.slice(from + start.length)
  const to = end ? rest.indexOf(end) : -1
  return to < 0 ? rest : rest.slice(0, to)
}

function member(text) {
  const line = text.split('\n').find((item) => item.startsWith('**Journeys.**')) ?? ''
  const defined = line
    .replace('**Journeys.**', '')
    .split('·')
    .map((item) => item.trim())
    .map((item) => item.match(/^(M\d{2}) (.+)$/))
    .filter(Boolean)
    .map((match) => match[1])
  return { universe: defined, individuallyDefined: defined, groupedOnly: [], unspecified: [] }
}

function governance(text) {
  const defined = [...text.matchAll(/^\| (G\d{2}) \| ([^|]+) \|/gm)].filter((m) => m[2].trim()).map((m) => m[1])
  return { universe: defined, individuallyDefined: defined, groupedOnly: [], unspecified: [] }
}

function officer(text) {
  const defined = [...text.matchAll(/id: '(O\d{2})'/g)].map((m) => m[1])
  return { universe: defined, individuallyDefined: defined, groupedOnly: [], unspecified: [] }
}

function seniorRepresentative(text) {
  const body = section(text, '## 4.', '## 5.')
  const defined = []
  const groupedRows = []
  for (const row of body.split('\n')) {
    const cells = row.split('|').map((cell) => cell.trim())
    if (cells.length < 4) continue
    if (!/^SR\d{2}(, SR\d{2})*$/.test(cells[1]) || !cells[2]) continue
    const ids = cells[1].split(', ')
    defined.push(...ids)
    if (ids.length > 1) groupedRows.push(ids.join(', '))
  }
  return { universe: defined, individuallyDefined: defined, groupedOnly: [], unspecified: [], groupedRows }
}

function financialOfficer(text) {
  const universe = []
  for (const match of text.matchAll(/\bF(\d{2})[–-]F(\d{2})\b/g)) universe.push(...expand('F', match[1], match[2]))
  for (const match of text.matchAll(/\bFJ(\d{2})[–-]FJ(\d{2})\b/g)) universe.push(...expand('FJ', match[1], match[2]))
  const unique = [...new Set(universe)]
  const grouped = new Set()
  for (const match of text.matchAll(/((?:\bF\d{2}\/)+F\d{2})\s*\(/g)) for (const id of match[1].split('/')) grouped.add(id)
  const individual = new Set()
  for (const match of text.matchAll(/\b(F\d{2})\s+(?:\(|[A-Z]{4,})/g)) if (!grouped.has(match[1])) individual.add(match[1])
  const individuallyDefined = unique.filter((id) => individual.has(id))
  const groupedOnly = unique.filter((id) => grouped.has(id) && !individual.has(id))
  const unspecified = unique.filter((id) => !individual.has(id) && !grouped.has(id))
  return { universe: unique, individuallyDefined, groupedOnly, unspecified }
}

function representative(text) {
  const navigation = []
  for (const row of section(text, '## 3.', '## 4.').split('\n')) {
    const match = row.match(/^\| (\d+) \| ([^|]+) \| ([^|]+) \|/)
    if (match) navigation.push(`REP-NAV-${match[1]}`)
  }
  const actions = []
  for (const row of section(text, '## 6.', '## 7.').split('\n')) {
    const match = row.match(/^\| (\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/)
    if (match) actions.push(`REP-ACT-${pad(match[1])}`)
  }
  const heading = text.match(/^## 7\. R(\d{2})[–-]R(\d{2})/m)
  const codes = heading ? expand('R', heading[1], heading[2]) : []
  const body = section(text, '## 7.', '## 8.').split('\n').slice(1).join('\n')
  const referenced = new Set()
  for (const match of body.matchAll(/\bR(\d{2})[–-]R(\d{2})\b/g)) for (const id of expand('R', match[1], match[2])) referenced.add(id)
  for (const match of body.matchAll(/\bR(\d{2})\b/g)) referenced.add(`R${match[1]}`)
  referenced.delete(undefined)
  const groupedOnly = codes.filter((id) => referenced.has(id))
  const unspecified = codes.filter((id) => !referenced.has(id))
  const individuallyDefined = [...navigation, ...actions]
  return { universe: [...individuallyDefined, ...codes], individuallyDefined, groupedOnly, unspecified }
}

const EXTRACTORS = {
  member,
  representative,
  'senior-representative': seniorRepresentative,
  'officer-executive': officer,
  'financial-officer': financialOfficer,
  'governance-officer': governance,
}

function trackedFiles(root) {
  try {
    return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean)
  } catch {
    return []
  }
}

export function computePersonaSpecs(root, options = {}) {
  const read = options.read ?? ((file) => readFileSync(join(root, file), 'utf8'))
  const files = options.trackedFiles ?? trackedFiles(root)
  const dispositionOrCanonical = (pattern) => files.filter((file) => pattern.test(file) && !/disposition|checkpoint|report|queue|register/i.test(file))
  const canonicalProbes = {
    steward: dispositionOrCanonical(/steward[^/]*canonical|canonical[^/]*steward/i),
    representative: dispositionOrCanonical(/representative[^/]*canonical|canonical[^/]*representative/i),
    'financial-officer': dispositionOrCanonical(/financial[^/]*canonical|canonical[^/]*financial/i),
  }
  const specs = {}
  for (const persona of PERSONAS) {
    const file = SOURCE_FILES[persona] ?? null
    let extracted = { universe: [], individuallyDefined: [], groupedOnly: [], unspecified: [] }
    if (file && EXTRACTORS[persona]) extracted = EXTRACTORS[persona](read(file))
    const canonicalFiles = canonicalProbes[persona] ?? null
    const canonicalFileFound = canonicalFiles ? canonicalFiles.length > 0 : true
    const requiresCanonical = persona in UNRESOLVED_OWNER
    const complete = extracted.universe.length > 0 && extracted.groupedOnly.length === 0 && extracted.unspecified.length === 0
    const resolved = requiresCanonical ? complete && canonicalFileFound : complete
    specs[persona] = {
      persona,
      label: PERSONA_LABELS[persona],
      sourceFile: file,
      canonicalFileFound,
      canonicalFiles: canonicalFiles ?? [],
      ...extracted,
      resolved,
    }
  }
  return specs
}

export function personaActionsFromSpecs(specs) {
  const actions = []
  for (const persona of PERSONAS) {
    const spec = specs[persona]
    for (const actionId of spec.universe) {
      const definition = spec.individuallyDefined.includes(actionId) ? 'INDIVIDUAL' : spec.groupedOnly.includes(actionId) ? 'GROUPED_ONLY' : 'UNSPECIFIED'
      actions.push({ persona, source: spec.sourceFile, actionId, definition })
    }
  }
  return actions
}

const sameSet = (left, right) => {
  const a = [...(left ?? [])].sort()
  const b = [...(right ?? [])].sort()
  return a.length === b.length && a.every((item, index) => item === b[index])
}

export function validatePersonaCompleteness(matrix, specs, capabilityById) {
  const problems = []
  const entries = Array.isArray(matrix?.personaCompleteness) ? matrix.personaCompleteness : []
  const byPersona = new Map()
  for (const entry of entries) {
    if (byPersona.has(entry.persona)) problems.push(`persona ${entry.persona} appears twice in personaCompleteness`)
    byPersona.set(entry.persona, entry)
  }
  const mappings = new Map((matrix?.personaActions ?? []).map((item) => [`${item.source}|${item.actionId}`, item]))
  for (const persona of PERSONAS) {
    const spec = specs[persona]
    const entry = byPersona.get(persona)
    if (!entry) {
      problems.push(`persona ${persona} is not accounted for in personaCompleteness`)
      continue
    }
    for (const field of ['universe', 'individuallyDefined', 'groupedOnly', 'unspecified']) {
      if (!sameSet(entry[field], spec[field])) problems.push(`personaCompleteness for ${persona} does not match its source (${field})`)
    }
    if (entry.canonicalFileFound !== spec.canonicalFileFound) problems.push(`personaCompleteness for ${persona} misreports whether a canonical file exists`)
    if (entry.resolved === true && !spec.resolved) {
      problems.push(`${persona} is marked resolved while its source specifications are unresolved`)
    }
    if (entry.resolved !== spec.resolved) problems.push(`personaCompleteness for ${persona} resolved flag does not match the source state`)
    const owner = UNRESOLVED_OWNER[persona]
    if (owner && !spec.resolved) {
      const capability = capabilityById.get(owner)
      if (!capability) problems.push(`unresolved persona ${persona} has no tracking capability ${owner}`)
      else if (capability.sourceStatus !== 'SOURCE_UNSPECIFIED') problems.push(`${owner} must stay SOURCE_UNSPECIFIED while ${persona} specifications are unresolved`)
    }
    for (const actionId of spec.unspecified) {
      const mapping = mappings.get(`${spec.sourceFile}|${actionId}`)
      const capability = mapping ? capabilityById.get(mapping.capabilityId) : null
      if (!capability) continue
      if (['SOURCE_IMPLEMENTED', 'SOURCE_VERIFIED', 'NATIVE_PENDING'].includes(capability.sourceStatus)) {
        problems.push(`unspecified ${persona} action ${actionId} maps to ${capability.id}, which claims implementation`)
      }
    }
  }
  const blockers = []
  for (const persona of PERSONAS) {
    const spec = specs[persona]
    if (spec.resolved) continue
    blockers.push({
      code: 'PERSONA_SPEC_UNRESOLVED',
      persona,
      canonicalFileFound: spec.canonicalFileFound,
      identifiers: spec.universe.length,
      individuallyDefined: spec.individuallyDefined.length,
      groupedOnly: spec.groupedOnly.length,
      unspecified: spec.unspecified.length,
    })
  }
  return { problems, blockers }
}
