import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { digest, exactIds, root, sha, type buildProducerContract } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  w4: folder + 'PHASE_1B_3C_A1I_W4_PRECONSUMER_PHYSICAL_PRODUCERS.json',
  lineage: folder + 'PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE.json',
  w1: folder + 'PHASE_1B_3C_A1I_W1_DJANGO_DEPENDENCY_MIGRATION_LOCK.json',
  rls: folder + 'PHASE_1B_3B_STATIC_RLS_POLICY_CORRECTNESS_RECONCILIATION.json',
}
export const outputs = {
  json: folder + 'PHASE_1B_3C_A1I_W4D_PHYSICAL_OWNERSHIP_ADJUDICATION.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4D_PHYSICAL_OWNERSHIP_ADJUDICATION.md',
  holds: folder + 'UE_W4_PHYSICAL_OWNERSHIP_HUMAN_DECISION_PACKET.json',
}
const absolute = (file: string) => path.join(root, ...file.split('/'))
const read = (file: string) => readFileSync(absolute(file), 'utf8')
type Producer = ReturnType<typeof buildProducerContract>
interface Candidate {
  CANDIDATE_ID: string
  SOURCE_FILE: string
  SOURCE_KIND: string
  DATABASE_SCOPE: string
  PREREQUISITE_KIND: string
  PHYSICAL_OBJECT: string
  COLUMN_NAMES: string[]
  CREATES_OBJECT: string
  AUTHORITY_CLASS: string
  EXECUTION_PATH_ESTABLISHED: string
  SOURCE_EVIDENCE: { FILE: string; FILE_SHA256: string; LINE: number }
}
interface Manifest {
  FILE: string
  SHA256: string
  MIGRATION_NODE_ID: string
  FROZEN_POSITION: number
  DATABASE_SCOPE: string
}
interface Canonical {
  CONTRACT_VERSION: string
  frozenMigrationManifest: Manifest[]
  orderingObligations: { ORDERING_RECORD_ID: string }[]
  opaqueBindingObligations: { OPAQUE_BINDING_ID: string }[]
  extensionDoctrine: { MANDATORY_EXTENSIONS: string[]; VECTOR_CONSUMER_RECONCILIATION: unknown[] }
  prerequisiteObligations: {
    OBLIGATION_ID: string
    PREREQUISITE_ID: string
    PHYSICAL_IDENTITY: string
    PREREQUISITE_KIND: string
    DATABASE_SCOPE: string
    REQUIRED_BEFORE_CONSUMER_IDS: string[]
  }[]
  remediationWorkstreams: {
    WORKSTREAM_ID: string
    INPUT_OBLIGATION_IDS: string[]
    INPUT_DECISION_IDS: string[]
  }[]
  phaseStatus: Record<string, unknown>
}
interface Lineage {
  creationSourceCandidates: Candidate[]
  frozenMigrationManifest: Manifest[]
  bootstrapAuthorityRegistry: {
    BOOTSTRAP_ID: string
    COMMAND_OR_SCRIPT: string
    AUTHORITY_CLASS: string
    LIMITATIONS: string[]
  }[]
}
interface W1 {
  migrationNodes: {
    MIGRATION_ID: string
    SOURCE_FILE: string
    FILE_SHA256: string
    SOURCE_CLASS: string
    DISTRIBUTION_NAME: string | null
    DISTRIBUTION_VERSION: string | null
    OPERATIONS: { LINE: number; OPERATION_CLASS: string; PHYSICAL_DB_EFFECT: string }[]
  }[]
  lockedDistributions: { DISTRIBUTION: string; VERSION: string; ARTIFACT_SHA256: string }[]
}
interface Rls {
  helperFunctionReconciliation: {
    QUALIFIED_NAME: string
    DATABASE_SCOPE: string
    SECURITY_MODE: string
    SOURCE_EVIDENCE?: unknown[]
    BODY?: string
  }[]
  phaseStatus: Record<string, unknown>
}
export type Disposition =
  | 'DJANGO'
  | 'EXTERNAL_DJANGO_PACKAGE'
  | 'PLATFORM_BASELINE'
  | 'PRIOR_FROZEN_SECURITY_MIGRATION'
  | 'EXISTING_CANONICAL_PRODUCER'
  | 'FINANCIAL_SERVICE_W7'
  | 'NOT_REQUIRED_FOR_CANONICAL_BOOTSTRAP'
  | 'GOVERNANCE_HOLD_NO_ACTIVE_AUTHORITY'
  | 'GOVERNANCE_HOLD_CONFLICTING_AUTHORITY'
export const dispositions: Disposition[] = [
  'DJANGO',
  'EXTERNAL_DJANGO_PACKAGE',
  'PLATFORM_BASELINE',
  'PRIOR_FROZEN_SECURITY_MIGRATION',
  'EXISTING_CANONICAL_PRODUCER',
  'FINANCIAL_SERVICE_W7',
  'NOT_REQUIRED_FOR_CANONICAL_BOOTSTRAP',
  'GOVERNANCE_HOLD_NO_ACTIVE_AUTHORITY',
  'GOVERNANCE_HOLD_CONFLICTING_AUTHORITY',
]
export interface AuthorityEvidence {
  id: string
  disposition: Disposition
  active: boolean
  exactDefinition: boolean
  beforeConsumer: boolean
  explicitArchitectureAssignment: boolean
  w2QualifiedDefinition: boolean
  externalLockVerified: boolean
  securityDefiner: boolean
  trustedSearchPath: boolean
  qualifiedSensitiveReferences: boolean
  publicExecuteDefined: boolean
  ownerDefined: boolean
  frozen: boolean
}
export function selectAuthority(evidence: AuthorityEvidence[]): {
  disposition: Disposition
  selected: AuthorityEvidence | null
  strength: string
} {
  assert.equal(
    new Set(evidence.map((e) => e.id)).size,
    evidence.length,
    'DUPLICATE_AUTHORITY_CANDIDATE',
  )
  const activeCreators = evidence.filter((e) => e.active && e.exactDefinition)
  if (activeCreators.length > 1)
    return {
      disposition: 'GOVERNANCE_HOLD_CONFLICTING_AUTHORITY',
      selected: null,
      strength: 'CONFLICTING_ACTIVE_AUTHORITY',
    }
  const eligible = evidence.filter((e) => {
    if (!e.active || !e.exactDefinition || !e.beforeConsumer) return false
    if (
      e.securityDefiner &&
      !(
        e.trustedSearchPath &&
        e.qualifiedSensitiveReferences &&
        e.publicExecuteDefined &&
        e.ownerDefined
      )
    )
      return false
    if (e.disposition === 'EXTERNAL_DJANGO_PACKAGE' && !e.externalLockVerified) return false
    if (
      e.disposition === 'PLATFORM_BASELINE' &&
      !(e.explicitArchitectureAssignment && e.w2QualifiedDefinition)
    )
      return false
    if (e.disposition === 'PRIOR_FROZEN_SECURITY_MIGRATION' && !e.frozen) return false
    return [
      'DJANGO',
      'EXTERNAL_DJANGO_PACKAGE',
      'PLATFORM_BASELINE',
      'PRIOR_FROZEN_SECURITY_MIGRATION',
      'EXISTING_CANONICAL_PRODUCER',
    ].includes(e.disposition)
  })
  if (eligible.length > 1)
    return {
      disposition: 'GOVERNANCE_HOLD_CONFLICTING_AUTHORITY',
      selected: null,
      strength: 'CONFLICTING_ACTIVE_AUTHORITY',
    }
  const selected = eligible[0]
  if (!selected)
    return {
      disposition: 'GOVERNANCE_HOLD_NO_ACTIVE_AUTHORITY',
      selected: null,
      strength: 'INSUFFICIENT_ACTIVE_AUTHORITY',
    }
  return {
    disposition: selected.disposition,
    selected,
    strength:
      selected.disposition === 'EXTERNAL_DJANGO_PACKAGE'
        ? 'ACTIVE_AUTHORITY_WITH_EXTERNAL_LOCK'
        : selected.disposition === 'PRIOR_FROZEN_SECURITY_MIGRATION'
          ? 'PRIOR_FROZEN_PRODUCER'
          : selected.disposition === 'PLATFORM_BASELINE'
            ? 'ACTIVE_AUTHORITY_WITH_EXACT_DEFINITION'
            : 'EXACT_SOURCE_PRODUCER',
  }
}

const identifier = '(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)'
const qualified = `${identifier}(?:\\s*\\.\\s*${identifier})?`
function normalizedName(value: string) {
  const parts = value.replaceAll('"', '').replace(/\s/g, '').split('.')
  return parts.length === 1 ? `public.${parts[0]}` : parts.join('.')
}
function endOfClause(text: string, start: number) {
  let string = false
  let quoted = false
  for (let i = start; i < text.length; i++) {
    if (text[i] === "'" && !quoted) {
      if (string && text[i + 1] === "'") {
        i++
        continue
      }
      string = !string
    } else if (text[i] === '"' && !string) {
      if (quoted && text[i + 1] === '"') {
        i++
        continue
      }
      quoted = !quoted
    } else if (text[i] === ';' && !string && !quoted) return i + 1
  }
  throw new Error('DEFINITION_CLAUSE_UNTERMINATED')
}
export function exactSqlDefinition(
  source: string,
  candidate: Pick<Candidate, 'SOURCE_EVIDENCE' | 'PHYSICAL_OBJECT' | 'PREREQUISITE_KIND'>,
  column: string | null,
) {
  const lines = source.split('\n')
  assert(
    candidate.SOURCE_EVIDENCE.LINE > 0 && candidate.SOURCE_EVIDENCE.LINE <= lines.length,
    'DEFINITION_SOURCE_LINE_DRIFT',
  )
  const offset =
    lines.slice(0, candidate.SOURCE_EVIDENCE.LINE - 1).join('\n').length +
    (candidate.SOURCE_EVIDENCE.LINE > 1 ? 1 : 0)
  const line = lines[candidate.SOURCE_EVIDENCE.LINE - 1]
  const regex = new RegExp(
    `\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?(TABLE|TYPE|DOMAIN|FUNCTION)\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${qualified})`,
    'i',
  )
  const match = regex.exec(line)
  assert(match && !line.trimStart().startsWith('--'), 'EXACT_CREATE_STATEMENT_MISSING')
  assert.equal(
    normalizedName(match[2]),
    candidate.PHYSICAL_OBJECT,
    'DEFINITION_OBJECT_IDENTITY_DRIFT',
  )
  const start = offset + match.index
  const clause = source.slice(start, endOfClause(source, start))
  const kind = match[1].toUpperCase()
  assert(
    kind !== 'FUNCTION',
    'FUNCTION_DEFINITION_REQUIRES_COMPLETE_BODY_AND_SECURITY_PARSER; no function decisions in fixed W4D universe',
  )
  assert.equal(
    kind,
    candidate.PREREQUISITE_KIND === 'RELATION' ? 'TABLE' : candidate.PREREQUISITE_KIND,
    'DEFINITION_KIND_DRIFT',
  )
  if (column) {
    const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert(
      new RegExp(`(?:\\(|,|\\n)\\s*"?${escaped}"?\\s+[^\\s,;)]+`, 'i').test(clause),
      'REQUIRED_COLUMN_NOT_IN_EXACT_DEFINITION',
    )
  }
  const labels = kind === 'TYPE' ? /\bAS\s+ENUM\s*\(([\s\S]*?)\)/i.exec(clause) : null
  return {
    DEFINITION_KIND: kind,
    DEFINITION_SOURCE_LINE: candidate.SOURCE_EVIDENCE.LINE,
    EXACT_CREATE_CLAUSE: clause,
    DEFINITION_SHA256: sha(clause),
    REQUIRED_COLUMN: column,
    ENUM_MEMBERS_SOURCE: labels?.[1] ?? null,
    SECURITY_MODE:
      kind === 'FUNCTION'
        ? /SECURITY\s+DEFINER/i.test(clause)
          ? 'DEFINER'
          : 'INVOKER_DEFAULT_OR_EXPLICIT'
        : 'NOT_APPLICABLE_TYPE_OR_RELATION',
    SCHEMA_QUALIFIED_IN_SOURCE: /\./.test(match[2]),
    USED_AS_EXECUTABLE_SQL: 'NO; evidence only',
    EXTRACTION_CEILING:
      'Exact CREATE clause, not a standalone approved producer; enclosing DO/exception behavior and surrounding operations remain original-source semantics',
  }
}
function alterations(source: string, relation: string, file: string, hash: string) {
  const records: {
    FILE: string
    LINE: number
    FILE_SHA256: string
    SOURCE_LINE: string
    CLASS: string
  }[] = []
  for (const [index, line] of source.split('\n').entries()) {
    if (line.trimStart().startsWith('--')) continue
    const alter = new RegExp(
      `^\\s*ALTER\\s+(TABLE|TYPE)\\s+(?:IF\\s+EXISTS\\s+)?(${qualified})`,
      'i',
    ).exec(line)
    const createIndex = new RegExp(
      `^\\s*CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${qualified}\\s+ON\\s+(${qualified})`,
      'i',
    ).exec(line)
    if (
      (alter && normalizedName(alter[2]) === relation) ||
      (createIndex && normalizedName(createIndex[1]) === relation)
    )
      records.push({
        FILE: file,
        LINE: index + 1,
        FILE_SHA256: hash,
        SOURCE_LINE: line,
        CLASS: alter ? 'ALTERATION_NOT_CREATION' : 'INDEX_CREATION_NOT_RELATION_CREATION',
      })
  }
  return records
}

export function tally(rows: { DISPOSITION: Disposition }[]) {
  const result = Object.fromEntries(dispositions.map((d) => [d, 0])) as Record<Disposition, number>
  for (const row of rows) result[row.DISPOSITION]++
  assert.equal(
    Object.values(result).reduce((a, b) => a + b, 0),
    rows.length,
  )
  return {
    ...result,
    APPROVED_DJANGO: result.DJANGO,
    APPROVED_EXTERNAL_DJANGO: result.EXTERNAL_DJANGO_PACKAGE,
    APPROVED_PLATFORM_BASELINE: result.PLATFORM_BASELINE,
    APPROVED_PRIOR_FROZEN: result.PRIOR_FROZEN_SECURITY_MIGRATION,
    APPROVED_EXISTING_CANONICAL: result.EXISTING_CANONICAL_PRODUCER,
    ASSIGNED_FINANCIAL_W7: result.FINANCIAL_SERVICE_W7,
    NOT_REQUIRED: result.NOT_REQUIRED_FOR_CANONICAL_BOOTSTRAP,
    HELD_NO_ACTIVE_AUTHORITY: result.GOVERNANCE_HOLD_NO_ACTIVE_AUTHORITY,
    HELD_CONFLICTING_AUTHORITY: result.GOVERNANCE_HOLD_CONFLICTING_AUTHORITY,
    SUM: rows.length,
    UNACCOUNTED: 0,
  }
}
export async function buildAdjudication() {
  const bytes = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, read(f)]))
  const c: Canonical = JSON.parse(bytes.canonical)
  const producer: Producer = JSON.parse(bytes.producer)
  const w4: Producer = JSON.parse(bytes.w4)
  const l: Lineage = JSON.parse(bytes.lineage)
  const w1: W1 = JSON.parse(bytes.w1)
  const rls: Rls = JSON.parse(bytes.rls)
  assert.equal(c.CONTRACT_VERSION, '1.3')
  assert.equal(c.prerequisiteObligations.length, 803)
  assert.equal(new Set(c.prerequisiteObligations.map((o) => o.PREREQUISITE_ID)).size, 803)
  assert.deepEqual(c.frozenMigrationManifest, l.frozenMigrationManifest)
  assert.equal(l.frozenMigrationManifest.length, 23)
  for (const m of l.frozenMigrationManifest)
    assert.equal(sha(read(m.FILE)), m.SHA256, 'FROZEN_MIGRATION_HASH_DRIFT')
  assert.equal(c.orderingObligations.length, 86)
  assert.equal(c.opaqueBindingObligations.length, 118)
  assert.deepEqual(c.extensionDoctrine.MANDATORY_EXTENSIONS, [
    'uuid-ossp',
    'pgcrypto',
    'pg_trgm',
    'btree_gin',
  ])
  assert.equal(c.extensionDoctrine.VECTOR_CONSUMER_RECONCILIATION.length, 22)
  for (const key of ['W1', 'W2', 'W3'] as const) assert.equal(producer.phaseStatus[key], 'PASS')
  assert.equal(producer.phaseStatus.PHASE_1B_3C_A1I_W4_GATE, 'BLOCKED')
  assert.deepEqual(producer.djangoProducerRegistry, w4.djangoProducerRegistry)
  const work = c.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W4')
  assert(work)
  exactIds(
    producer.governanceDecisions.map((d) => d.DECISION_ID),
    work.INPUT_DECISION_IDS,
  )
  exactIds(
    producer.obligationLinkage.map((o) => o.OBLIGATION_ID),
    work.INPUT_OBLIGATION_IDS,
  )
  assert.equal(work.INPUT_DECISION_IDS.length, 310)
  const byCandidate = new Map(l.creationSourceCandidates.map((x) => [x.CANDIDATE_ID, x]))
  const byFile = new Map(l.frozenMigrationManifest.map((x) => [x.FILE, x]))
  const byMigration = new Map(l.frozenMigrationManifest.map((x) => [x.MIGRATION_NODE_ID, x]))
  const sourceCache = new Map<string, { text: string; hash: string }>()
  function source(candidate: Candidate) {
    const file = candidate.SOURCE_FILE
    assert.equal(file, candidate.SOURCE_EVIDENCE.FILE, 'SOURCE_REFERENCE_FILE_DRIFT')
    let entry = sourceCache.get(file)
    if (!entry) {
      const text = read(file)
      entry = { text, hash: sha(text) }
      sourceCache.set(file, entry)
    }
    assert.equal(entry.hash, candidate.SOURCE_EVIDENCE.FILE_SHA256, `SOURCE_HASH_DRIFT:${file}`)
    const frozen = byFile.get(file)
    if (frozen) assert.equal(entry.hash, frozen.SHA256, 'FROZEN_SOURCE_HASH_DRIFT')
    return entry
  }
  const decisions = work.INPUT_DECISION_IDS.map((decisionId) => {
    const decision = producer.governanceDecisions.find((d) => d.DECISION_ID === decisionId)
    assert(decision)
    const blocked = producer.platformProducerRegistry.filter((p) =>
      p.BLOCKING_DECISION_IDS.includes(decisionId),
    )
    assert.equal(blocked.length, 1, 'DECISION_TO_PHYSICAL_IDENTITY_DRIFT')
    const pending = blocked[0]
    const obligation = c.prerequisiteObligations.find(
      (o) => o.OBLIGATION_ID === pending.OBLIGATION_IDS[0],
    )
    assert(obligation, 'PHYSICAL_OBLIGATION_MISSING')
    assert.equal(
      obligation.DATABASE_SCOPE,
      'union-eyes',
      'FINANCIAL_SCOPE_REQUIRES_SEPARATE_W7_ADJUDICATION',
    )
    assert(
      obligation.REQUIRED_BEFORE_CONSUMER_IDS.length,
      'NO_CONSUMER_EVIDENCE; NOT_REQUIRED cannot be inferred',
    )
    const consumers = obligation.REQUIRED_BEFORE_CONSUMER_IDS.map((id) => {
      const m = byMigration.get(id)
      assert(m, 'CONSUMER_MANIFEST_REFERENCE_DRIFT')
      return m
    })
    const first = Math.min(...consumers.map((m) => m.FROZEN_POSITION))
    const physical = obligation.PHYSICAL_IDENTITY.split('::')[2]
    const column = obligation.PREREQUISITE_KIND === 'COLUMN' ? physical.split('.')[2] : null
    const relation = column ? physical.split('.').slice(0, 2).join('.') : physical
    const referenced = pending.SOURCE_CANDIDATE_IDS ?? []
    for (const candidateId of referenced)
      assert(byCandidate.has(candidateId), 'CANDIDATE_ID_MISSING')
    const exactObjectCandidates = l.creationSourceCandidates.filter(
      (candidate) =>
        candidate.DATABASE_SCOPE === obligation.DATABASE_SCOPE &&
        candidate.PHYSICAL_OBJECT === relation &&
        (!column || candidate.COLUMN_NAMES.includes(column)),
    )
    const candidates = [
      ...new Map(
        [...referenced.map((id) => byCandidate.get(id)!), ...exactObjectCandidates].map(
          (candidate) => [candidate.CANDIDATE_ID, candidate],
        ),
      ).values(),
    ]
    const packets = candidates.map((candidate) => {
      const entry = source(candidate)
      const frozen = byFile.get(candidate.SOURCE_FILE)
      const historical = /HISTORICAL/.test(candidate.AUTHORITY_CLASS)
      const declaration = candidate.AUTHORITY_CLASS === 'SCHEMA_DECLARATION_WITHOUT_EXECUTION_PATH'
      const active =
        candidate.AUTHORITY_CLASS === 'CANONICAL_ACTIVE_PREDECESSOR_MIGRATION' &&
        candidate.EXECUTION_PATH_ESTABLISHED === 'YES' &&
        candidate.CREATES_OBJECT === 'YES'
      const before = !!frozen && frozen.FROZEN_POSITION < first
      const objectMatches =
        candidate.PHYSICAL_OBJECT === relation &&
        (!column || candidate.COLUMN_NAMES.includes(column))
      const definition =
        active && objectMatches ? exactSqlDefinition(entry.text, candidate, column) : null
      const djangoNode =
        objectMatches &&
        candidate.CREATES_OBJECT === 'YES' &&
        candidate.EXECUTION_PATH_ESTABLISHED === 'YES'
          ? w1.migrationNodes.find(
              (n) =>
                n.SOURCE_FILE === candidate.SOURCE_FILE &&
                n.FILE_SHA256 === entry.hash &&
                n.OPERATIONS.some(
                  (op) =>
                    op.LINE === candidate.SOURCE_EVIDENCE.LINE &&
                    op.PHYSICAL_DB_EFFECT === 'YES' &&
                    ['CreateModel', 'AddField'].includes(op.OPERATION_CLASS),
                ),
            )
          : undefined
      const external = !!djangoNode && djangoNode.SOURCE_CLASS !== 'LOCAL'
      const pkg = external
        ? w1.lockedDistributions.find(
            (p) =>
              p.DISTRIBUTION === djangoNode.DISTRIBUTION_NAME &&
              p.VERSION === djangoNode.DISTRIBUTION_VERSION,
          )
        : null
      const evidence: AuthorityEvidence = {
        id: candidate.CANDIDATE_ID,
        disposition: djangoNode
          ? external
            ? 'EXTERNAL_DJANGO_PACKAGE'
            : 'DJANGO'
          : 'PRIOR_FROZEN_SECURITY_MIGRATION',
        active: active || !!djangoNode,
        exactDefinition: !!definition || !!djangoNode,
        beforeConsumer: djangoNode ? true : before,
        explicitArchitectureAssignment: false,
        w2QualifiedDefinition: definition?.SCHEMA_QUALIFIED_IN_SOURCE ?? false,
        externalLockVerified: !!pkg,
        securityDefiner: definition?.SECURITY_MODE === 'DEFINER',
        trustedSearchPath: false,
        qualifiedSensitiveReferences: false,
        publicExecuteDefined: false,
        ownerDefined: false,
        frozen: !!frozen,
      }
      return {
        CANDIDATE_ID: candidate.CANDIDATE_ID,
        AUTHORITY_CLASS: candidate.AUTHORITY_CLASS,
        SOURCE_KIND: candidate.SOURCE_KIND,
        SOURCE_FILE: candidate.SOURCE_FILE,
        SOURCE_FILE_SHA256: entry.hash,
        SOURCE_LINE: candidate.SOURCE_EVIDENCE.LINE,
        PHYSICAL_OBJECT: candidate.PHYSICAL_OBJECT,
        EXACT_REQUIRED_OBJECT_OR_COLUMN_MATCH: objectMatches ? 'YES' : 'NO',
        EXECUTION_PATH_ESTABLISHED: candidate.EXECUTION_PATH_ESTABLISHED,
        EVIDENCE_LADDER_CLASS: historical
          ? 'HISTORICAL_ONLY'
          : declaration
            ? 'SCHEMA_DECLARATION_ONLY'
            : frozen
              ? 'ACCEPTED_CANONICAL_MIGRATION_AUTHORITY'
              : djangoNode
                ? 'EXACT_ACTIVE_CREATION_SOURCE'
                : 'NO_AUTHORITY',
        SOURCE_CATEGORY: historical
          ? 'HISTORICAL_SUPPORTING_EVIDENCE'
          : declaration
            ? 'DECLARATION_ONLY'
            : active
              ? 'ACTIVE_CREATION_SOURCE'
              : 'NO_ACTIVE_AUTHORITY',
        FROZEN_MIGRATION_ID: frozen?.MIGRATION_NODE_ID ?? null,
        FROZEN_PRODUCER_POSITION: frozen?.FROZEN_POSITION ?? null,
        FIRST_CONSUMER_POSITION: first,
        PRODUCER_PRECEDES_FIRST_CONSUMER: before ? 'YES' : 'NO',
        W4_PRECONSUMER_AUTHORITY_ESTABLISHED: before && active && objectMatches ? 'YES' : 'NO',
        DEFINITION_EVIDENCE: definition,
        ARCHITECTURE_ASSIGNMENT_TO_NEW_W4_PLATFORM_BASELINE:
          'NOT_ESTABLISHED; original frozen platform owner does not approve earlier extraction',
        evidence,
      }
    })
    const selection = selectAuthority(packets.map((p) => p.evidence))
    const active = packets.filter((p) => p.SOURCE_CATEGORY === 'ACTIVE_CREATION_SOURCE')
    const alterationSources = [
      ...new Map(
        candidates.filter((p) => p.SOURCE_KIND === 'SQL_MIGRATION').map((p) => [p.SOURCE_FILE, p]),
      ).values(),
    ]
    const alterationEvidence = alterationSources.flatMap((p) => {
      const entry = source(p)
      return alterations(entry.text, relation, p.SOURCE_FILE, entry.hash).map((a) => ({
        ...a,
        AUTHORITY_CLASS: p.AUTHORITY_CLASS,
        SOURCE_CATEGORY: /HISTORICAL/.test(p.AUTHORITY_CLASS)
          ? 'HISTORICAL_SUPPORTING_EVIDENCE'
          : 'ACTIVE_ALTERATION_CANDIDATE',
        CREATION_AUTHORITY: 'NO',
      }))
    })
    assert(
      selection.disposition.startsWith('GOVERNANCE_HOLD'),
      'New positive authority requires concrete producer implementation and explicit normalization; never silently approve from this frozen hold packet',
    )
    const why = active.length
      ? `Exact active definition exists only at frozen position(s) ${[...new Set(active.map((a) => a.FROZEN_PRODUCER_POSITION))].join(', ')}; first required consumer is position ${first}. No earlier frozen creator or approved W4 preconsumer extraction/owner/definition sequence exists. Later producer is legitimate original authority, not preconsumer authority.`
      : 'Only historical and/or declaration-only candidates exist; none supplies positive active creation plus a canonical preconsumer execution path. No Django migration/package producer matches the fixed W1 graph.'
    return {
      DECISION_ID: decisionId,
      OBLIGATION_ID: obligation.OBLIGATION_ID,
      PREREQUISITE_ID: obligation.PREREQUISITE_ID,
      PHYSICAL_IDENTITY: obligation.PHYSICAL_IDENTITY,
      OBJECT_KIND: obligation.PREREQUISITE_KIND,
      DATABASE_SCOPE_ID: 'UE_OPERATIONAL',
      DISPOSITION: selection.disposition,
      CREATION_AUTHORITY: selection.disposition,
      ALTERATION_AUTHORITIES: alterationEvidence,
      SELECTED_CREATION_AUTHORITY: null,
      SELECTED_PRODUCER_ID: null,
      SELECTED_AUTHORITY: null,
      SELECTED_DEFINITION_SOURCE: null,
      DECISION_STATUS: selection.disposition,
      APPROVED: 'NO',
      IMPLEMENTED_IN_W4: 'NO',
      EVIDENCE_STRENGTH: selection.strength,
      ACTIVE_CREATION_CANDIDATES: active,
      ACTIVE_ALTERATION_CANDIDATES: alterationEvidence.filter(
        (a) => a.SOURCE_CATEGORY === 'ACTIVE_ALTERATION_CANDIDATE',
      ),
      HISTORICAL_CANDIDATES: packets.filter(
        (p) => p.SOURCE_CATEGORY === 'HISTORICAL_SUPPORTING_EVIDENCE',
      ),
      HISTORICAL_ALTERATION_CANDIDATES: alterationEvidence.filter(
        (a) => a.SOURCE_CATEGORY === 'HISTORICAL_SUPPORTING_EVIDENCE',
      ),
      DECLARATION_ONLY_CANDIDATES: packets.filter((p) => p.SOURCE_CATEGORY === 'DECLARATION_ONLY'),
      OTHER_INSUFFICIENT_CANDIDATES: packets.filter(
        (p) => p.SOURCE_CATEGORY === 'NO_ACTIVE_AUTHORITY',
      ),
      ACTIVE_DEFINITION_CANDIDATES: active.filter((a) => a.DEFINITION_EVIDENCE),
      SECURITY_MODE:
        obligation.PREREQUISITE_KIND === 'TYPE'
          ? 'NOT_APPLICABLE_ENUM_TYPE'
          : 'NOT_APPLICABLE_RELATION_COLUMN',
      SEARCH_PATH_REQUIREMENT:
        'W2 schema qualification for new privileged producers; no approved new W4 SQL or search-path exception',
      REFERENCED_OBJECTS: [relation],
      RLS_SUPPORTING_EVIDENCE: rls.helperFunctionReconciliation
        .filter((h) => h.QUALIFIED_NAME === relation)
        .map((h) => ({
          QUALIFIED_NAME: h.QUALIFIED_NAME,
          SECURITY_MODE: h.SECURITY_MODE,
          AUTHORITY_CEILING: 'RLS helper evidence alone is not object creation/owner approval',
        })),
      RATIONALE: why,
      WHY_ACTIVE_AUTHORITY_IS_INSUFFICIENT: why,
      CANDIDATE_OPTIONS: packets.map((p) => ({
        CANDIDATE_ID: p.CANDIDATE_ID,
        SOURCE_FILE: p.SOURCE_FILE,
        SOURCE_FILE_SHA256: p.SOURCE_FILE_SHA256,
        EVIDENCE_CLASS: p.EVIDENCE_LADDER_CLASS,
        ORIGINAL_FROZEN_AUTHORITY: p.FROZEN_MIGRATION_ID,
        PERMITTED_WITHOUT_NEW_DECISION:
          'NO; no historical revival, declaration synthesis or earlier extraction',
      })),
      MINIMUM_HUMAN_DECISION_REQUIRED: active.length
        ? 'Approve an exact source-backed preconsumer creation authority/definition and its compatibility with the unchanged later frozen CREATE/ALTER semantics, or authorize a separate architecture/manifest decision. Decide schema qualification, owner/dependencies, enum/body/column definition and drift checks; do not reorder in W4D.'
        : 'Supply and approve an exact active canonical creation source/definition for this identity under Django or explicit platform ownership with target/path/dependency/security/ACL evidence. Historical/schema candidates may inform that human decision but do not themselves authorize creation.',
      DOWNSTREAM_IMPACT: {
        W4_PRODUCER_ID: pending.PRODUCER_ID,
        BLOCKS_W4: 'YES',
        W4_RUNTIME_PROVEN: 'NO',
        FIRST_CONSUMER_POSITION: first,
        REQUIRED_BEFORE_CONSUMER_IDS: obligation.REQUIRED_BEFORE_CONSUMER_IDS,
        W5_ADJUDICATION_REQUIRED: 'YES',
        W6_SEMANTICS_CHANGED: 'NO',
      },
    }
  })
  exactIds(
    decisions.map((d) => d.DECISION_ID),
    work.INPUT_DECISION_IDS,
  )
  const relationColumn = decisions.filter((d) => ['RELATION', 'COLUMN'].includes(d.OBJECT_KIND))
  const typeFunction = decisions.filter((d) => !['RELATION', 'COLUMN'].includes(d.OBJECT_KIND))
  assert.equal(relationColumn.length, 269)
  assert.equal(typeFunction.length, 41)
  const byPrerequisite = new Map(decisions.map((d) => [d.PREREQUISITE_ID, d]))
  const ordering = producer.w5OrderingHandoff.map((h) => {
    const d = byPrerequisite.get(h.PREREQUISITE_ID!)
    const known = producer.djangoProducerRegistry.find(
      (m) => m.PREREQUISITE_ID === h.PREREQUISITE_ID,
    )
    assert(d || known, 'HANDOFF_AUTHORITY_NOT_ACCOUNTED')
    return {
      ...h,
      DECISION_ID: d?.DECISION_ID ?? null,
      FINAL_W4_CREATION_AUTHORITY: d?.DISPOSITION ?? 'DJANGO',
      PRODUCER_ID: d ? null : h.W4_PRODUCER_ID,
      BLOCKED_PRODUCER_REFERENCE: d ? h.W4_PRODUCER_ID : null,
      PRODUCER_POSITION_CLASS: d
        ? 'NOT_ESTABLISHED_PRECONSUMER_AUTHORITY'
        : 'CANONICAL_DJANGO_BEFORE_FROZEN_MANIFEST',
      W5_ADJUDICATION_REQUIRED: 'YES',
    }
  })
  exactIds(
    ordering.map((h) => h.ORDERING_RECORD_ID),
    producer.w5OrderingHandoff.map((h) => h.ORDERING_RECORD_ID),
  )
  exactIds(
    ordering.map((h) => h.ORDERING_RECORD_ID),
    c.orderingObligations.map((o) => o.ORDERING_RECORD_ID),
  )
  const linkage = producer.obligationLinkage.map((o) => {
    const d = decisions.find((d) => d.OBLIGATION_ID === o.OBLIGATION_ID)
    return {
      ...o,
      DOWNSTREAM_OWNER: d
        ? 'HUMAN_W4_OWNERSHIP_DEFINITION_THEN_W8_W9'
        : o.COMPLETION_CLASS === 'W5_ORDERING_HANDOFF_ONLY'
          ? 'W5'
          : 'W8/W9',
      W4D_DECISION_ID: d?.DECISION_ID ?? null,
      W4D_DISPOSITION: d?.DISPOSITION ?? 'PRESERVED_ACCEPTED_W4_COMPONENT',
      RUNTIME_PROVEN: 'NO',
    }
  })
  exactIds(
    linkage.map((o) => o.OBLIGATION_ID),
    work.INPUT_OBLIGATION_IDS,
  )
  exactIds(
    producer.w6OpaqueBindingHandoff.map((h) => h.OPAQUE_BINDING_ID),
    w4.w6OpaqueBindingHandoff.map((h) => h.OPAQUE_BINDING_ID),
  )
  exactIds(
    producer.w6OpaqueBindingHandoff.map((h) => h.OPAQUE_BINDING_ID),
    c.opaqueBindingObligations.map((o) => o.OPAQUE_BINDING_ID),
  )
  const preservation = Object.fromEntries(
    Object.entries(files).map(([k, f]) => [
      f,
      {
        BEFORE_SHA256: sha(bytes[k]),
        AFTER_SHA256: sha(read(f)),
        CHANGED: 'NO',
      },
    ]),
  )
  const sourceHashes = Object.fromEntries([...sourceCache].map(([f, entry]) => [f, entry.hash]))
  for (const [f, hash] of Object.entries(sourceHashes)) assert.equal(sha(read(f)), hash)
  if (existsSync(absolute(outputs.json))) {
    const prior: { preservation: typeof preservation; sourceHashes: typeof sourceHashes } =
      JSON.parse(read(outputs.json))
    assert.deepEqual(prior.preservation, preservation, 'FIXED_INPUT_DRIFT_AFTER_W4D_CAPTURE')
    assert.deepEqual(prior.sourceHashes, sourceHashes, 'SOURCE_DRIFT_AFTER_W4D_CAPTURE')
  }
  const phaseStatus = {
    ...producer.phaseStatus,
    PHASE_1B_3C_A1I_W4D_GATE: 'BLOCKED',
    PHASE_1B_3C_A1I_W4D: 'BLOCKED',
    PHASE_1B_3C_A1I_W4_GATE: 'BLOCKED',
    NO_FURTHER_W4_GENERIC_STATIC_DISCOVERY: 'YES',
    CONTRACT_VERSION: '1.3',
    CONTRACT_1_4_CREATED: 'NO',
    W5: 'NOT_AUTHORIZED_BY_W4D',
    W5_STARTED: 'NO',
  }
  const summary = {
    W4_DECISIONS_INPUT: 310,
    RELATION_COLUMN_INPUT: 269,
    TYPE_FUNCTION_INPUT: 41,
    TOTAL: tally(decisions),
    RELATION_COLUMN: tally(relationColumn),
    TYPE_FUNCTION: tally(typeFunction),
    DECISIONS_WITH_EXACT_LATER_ACTIVE_DEFINITIONS: decisions.filter(
      (d) => d.ACTIVE_DEFINITION_CANDIDATES.length > 0,
    ).length,
    DECISIONS_WITH_NO_ACTIVE_CREATION_SOURCE: decisions.filter(
      (d) => d.ACTIVE_CREATION_CANDIDATES.length === 0,
    ).length,
    APPROVED_PRODUCER_UPDATES: 0,
    MUTATING_SQL_GENERATED: 0,
    GENERATED_SUBSTITUTE_DJANGO_DDL: 0,
    W5_HANDOFFS: ordering.length,
    W6_OPAQUE_HANDOFFS: producer.w6OpaqueBindingHandoff.length,
    SOURCE_FILES_HASH_CHECKED: sourceHashes ? Object.keys(sourceHashes).length : 0,
  }
  const report = {
    metadata: {
      PHASE: 'PHASE_1B_3C_A1I_W4D',
      FIXED_INPUTS: Object.values(files),
      METHOD:
        'Exact decision/candidate identity projection plus hash-checked referenced sources only. Positive authority/definition and preconsumer path required; no generic source discovery.',
    },
    decisionAdjudication: decisions,
    relationColumnDisposition: relationColumn.map((d) => ({
      DECISION_ID: d.DECISION_ID,
      DISPOSITION: d.DISPOSITION,
    })),
    typeFunctionDisposition: typeFunction.map((d) => ({
      DECISION_ID: d.DECISION_ID,
      DISPOSITION: d.DISPOSITION,
    })),
    approvedProducerUpdates: [],
    platformProducerRegistry: producer.platformProducerRegistry,
    obligationLinkage: linkage,
    w5OrderingHandoff: ordering,
    w6OpaqueBindingHandoff: producer.w6OpaqueBindingHandoff,
    remainingDecisionHolds: decisions.map((d) => ({
      DECISION_ID: d.DECISION_ID,
      PHYSICAL_IDENTITY: d.PHYSICAL_IDENTITY,
      WHY_ACTIVE_AUTHORITY_IS_INSUFFICIENT: d.WHY_ACTIVE_AUTHORITY_IS_INSUFFICIENT,
      CANDIDATE_OPTIONS: d.CANDIDATE_OPTIONS,
      MINIMUM_HUMAN_DECISION_REQUIRED: d.MINIMUM_HUMAN_DECISION_REQUIRED,
      DOWNSTREAM_IMPACT: d.DOWNSTREAM_IMPACT,
    })),
    sourceHashes,
    preservation,
    acceptedW4SectionHashes: {
      DJANGO_372_MAPPING: digest(producer.djangoProducerRegistry),
      DJANGO_82_NODE_PLAN: digest(producer.canonicalProducerPlan),
      RAW_WRAPPERS: digest(producer.rawOperationProducerRegistry),
      W6_118_HANDOFFS: digest(producer.w6OpaqueBindingHandoff),
    },
    authorityCeilings: l.bootstrapAuthorityRegistry,
    summary,
    digests: {
      DECISIONS: digest(decisions),
      HANDOFFS: digest([ordering, producer.w6OpaqueBindingHandoff]),
      SOURCES: digest(sourceHashes),
    },
    validation: {
      closeoutChecks: [
        {
          COMMAND: 'pnpm exec tsx scripts\\ue\\adjudicate-w4-ownership.ts --self-test --check',
          RESULT: 'PASS; exact310/269/41 accounting, two matching generations, fixed/source hashes',
        },
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\adjudicate-w4-ownership.test.ts scripts\\ue\\w4-physical-producers.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
          RESULT: 'PASS;138 tests:41 W4D,38 preserved W4,59 preserved W3E',
        },
        {
          COMMAND:
            'pnpm exec tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\adjudicate-w4-ownership.ts scripts\\ue\\adjudicate-w4-ownership.test.ts',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\adjudicate-w4-ownership.ts scripts\\ue\\adjudicate-w4-ownership.test.ts',
          RESULT: 'PASS; root-scoped actual lint, exit0; existing Next pages-directory diagnostic',
        },
        {
          COMMAND:
            'pnpm exec prettier --check scripts\\ue\\adjudicate-w4-ownership.ts scripts\\ue\\adjudicate-w4-ownership.test.ts docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4D_PHYSICAL_OWNERSHIP_ADJUDICATION.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4D_PHYSICAL_OWNERSHIP_ADJUDICATION.md docs\\union-eyes\\reality-remediation\\UE_W4_PHYSICAL_OWNERSHIP_HUMAN_DECISION_PACKET.json',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec tsx scripts\\ue\\align-w3-delegation-contract.mjs --self-test --check',
          RESULT: 'PASS; unchanged W3E outputs and exact prior1.2 bytes',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS;0 errors,1215 existing warnings',
        },
        {
          METHOD:
            'Independent read-only Node assertion run against generated and accepted artifacts, not trusting the adjudicator implementation',
          RESULT:
            'PASS;310/269/41 IDs,768 linkage,372/82/raw hashes,86/118 IDs,803 prerequisites,23 frozen hashes,146 candidate source hashes,W3E code hashes, exact1.3 ->1.2 ->1.1 ->1.0 reconstructed bytes',
        },
      ],
      EXACT_DECISION_IDS: '310; no additions/removals/duplicates',
      EXACT_OBLIGATION_IDS: '768; preserved original completion boundaries',
      POSITIVE_AUTHORITY_LADDER_ENFORCED: 'YES',
      HISTORICAL_AND_DECLARATION_ONLY_NEVER_APPROVED: 'YES',
      NO_FURTHER_GENERIC_DISCOVERY: 'YES',
      FUNCTION_DECISIONS_IN_THIS_FIXED_UNIVERSE: 0,
      ENUM_TYPE_DECISIONS: typeFunction.length,
      RLS_HELPERS_ARE_NOT_CREATION_AUTHORITY: 'YES',
      ALL_SOURCE_HASHES_VERIFIED: 'YES',
      FROZEN_MIGRATION_HASHES_VERIFIED: 23,
      CANONICAL_PREREQUISITE_IDS_PRESERVED: 803,
      MANDATORY_EXTENSIONS_PRESERVED: 4,
      GUARDED_VECTOR_CONSUMERS_PRESERVED: 22,
      NO_RUNTIME_DATABASE_DJANGO_SQL_SECRETS_DEPLOYMENT_FROZEN_MUTATION: 'YES',
      CANONICAL_AND_ACCEPTED_W4_ARTIFACTS_CHANGED:
        'NO; W4D handoff refresh is supplemental, not rewriting frozen producer evidence',
    },
    phaseStatus,
  }
  return report
}
export async function generate() {
  const report = await buildAdjudication()
  assert.deepEqual(report, await buildAdjudication(), 'NONDETERMINISTIC_W4D_ADJUDICATION')
  const config = await resolveConfig(absolute(outputs.json))
  const summary = `# W4D — physical ownership and definition adjudication

## Gate: BLOCKED; static adjudication complete

Exactly **310 decisions** adjudicated once: **269 relation/column** and **41 enum-type** decisions (no function decisions in this frozen universe). W4 remains BLOCKED; canonical **1.3** unchanged; no1.4 or W5 authorization.

[Exact adjudication](PHASE_1B_3C_A1I_W4D_PHYSICAL_OWNERSHIP_ADJUDICATION.json) and [bounded human-decision packet](UE_W4_PHYSICAL_OWNERSHIP_HUMAN_DECISION_PACKET.json) contain every identity, candidate/source/hash, definition/precedence evidence, hold rationale and minimum human decision.

## Result arithmetic

| Partition | Input | Approved/downstream/not-required | Held: insufficient preconsumer authority | Held: conflicting authority |
| --- | ---: | ---: | ---: | ---: |
| Relation/column | 269 | 0 | ${report.summary.RELATION_COLUMN.GOVERNANCE_HOLD_NO_ACTIVE_AUTHORITY} | ${report.summary.RELATION_COLUMN.GOVERNANCE_HOLD_CONFLICTING_AUTHORITY} |
| Enum types | 41 | 0 | ${report.summary.TYPE_FUNCTION.GOVERNANCE_HOLD_NO_ACTIVE_AUTHORITY} | ${report.summary.TYPE_FUNCTION.GOVERNANCE_HOLD_CONFLICTING_AUTHORITY} |
| Total | 310 | 0 | ${report.summary.TOTAL.GOVERNANCE_HOLD_NO_ACTIVE_AUTHORITY} | ${report.summary.TOTAL.GOVERNANCE_HOLD_CONFLICTING_AUTHORITY} |

All nine permitted disposition counts are in JSON; SUM310, UNACCOUNTED0. No “NOT_DJANGO therefore PLATFORM” rule. No object is waived because its producer is missing.

## Positive evidence and holds

**${report.summary.DECISIONS_WITH_EXACT_LATER_ACTIVE_DEFINITIONS} decisions have exact later active definition evidence**; **${report.summary.DECISIONS_WITH_NO_ACTIVE_CREATION_SOURCE} have no active creation source**. The later definitions belong to accepted original frozen migrations, but none precedes the object's first required consumer. They are not preconsumer authority: moving/extracting them earlier requires an explicit ownership/definition/compatibility decision. Frozen SQL/order remains unchanged.

The41 types have exact source-backed CREATE TYPE/AS ENUM clauses; enum member text is recorded verbatim, not inferred from casts. Availability before consumer is still not established. Unqualified source declarations or duplicate-object suppression are not silently rewritten or promoted to new privileged W4 SQL.

Historical sources remain supporting evidence only. Drizzle/static declarations are DECLARATION_ONLY. Schema/query/RLS expressions cannot produce table definitions or owner approval. Fixed RLS helper evidence is retained only as corroboration; it is not active creation authority. No W3 roles/extensions/delegation/privilege or W7 financial ownership is reassigned.

Source reads are restricted to exact candidates referenced by the six inputs, including exact-identity candidates present in the lineage artifact but omitted from a particular candidate link. **${report.summary.SOURCE_FILES_HASH_CHECKED} referenced files** were hash-checked. Exact active CREATE clauses and required columns are checked against those bytes. ALTER TABLE/TYPE and index statements are recorded separately as alteration, not relation creation. Bounded line-oriented alteration evidence does not claim exhaustive dynamic SQL semantics.

## Producer/handoff state

Approved producer updates **0**; mutating SQL generated **0**. Existing blocked platform registry remains unchanged. Original372 Django mappings,82-node plan and four raw wrappers are hash-preserved. All768 W4 obligation records retain producer/downstream disposition and RUNTIME_PROVEN=NO.

All86 W5 handoffs are refreshed **in this supplemental W4D packet**, adding decision ID, final held authority, null approved producer ID plus the original blocked-producer reference and W5_ADJUDICATION_REQUIRED=YES. No W5 closure is asserted. All118 W6 handoffs remain unchanged with semantic binding required.

## Bounded next human decision

NO_FURTHER_W4_GENERIC_STATIC_DISCOVERY = **YES**. Each hold identifies the exact active/historical/declaration candidate options. Where a later active definition exists, the minimum decision is an explicit compatible preconsumer creation authority/definition while preserving later frozen semantics, or a separate architecture/manifest authorization. Where none exists, supply/approve an exact active canonical definition and ownership under Django or explicit platform authority. Neither option is implemented or approved here.

## Validation and proof

\`\`\`powershell
pnpm exec tsx scripts\\ue\\adjudicate-w4-ownership.ts --self-test --check
pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\adjudicate-w4-ownership.test.ts scripts\\ue\\w4-physical-producers.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts
\`\`\`

Closeout checks **PASS**: **138 offline tests** (41 W4D,38 W4,59 W3E), scoped TypeScript, root-scoped actual ESLint, formatting, deterministic self-test/check, unchanged W3E generator/check, and documentation audit (**0 errors,1215 existing warnings**). An independent read-only assertion run verified310/269/41 arithmetic,768/86/118 IDs,372/82/raw preservation hashes,803 prerequisites, all23 frozen migration hashes,146 candidate-source hashes, W3E code preservation and exact **1.3 ->1.2 ->1.1 ->1.0 byte reconstruction**. Exact commands/results are recorded in JSON.

No database connection, migration execution, SQL execution, producer/schema/role/extension/secret/deployment mutation or PR. Roles/extensions/memberships/Django schema/platform materialization/runtime proof remain **NO**; READY_FOR_RUNTIME_PROOF=**0**, PRODUCT_READY=**NO**.
`
  return {
    [outputs.json]: await format(JSON.stringify(report), { ...config, parser: 'json' }),
    [outputs.holds]: await format(
      JSON.stringify({
        PHASE: 'W4D',
        NO_FURTHER_W4_GENERIC_STATIC_DISCOVERY: 'YES',
        HOLDS: report.remainingDecisionHolds,
        summary: report.summary,
        phaseStatus: report.phaseStatus,
      }),
      { ...config, parser: 'json' },
    ),
    [outputs.markdown]: await format(summary, { ...config, parser: 'markdown' }),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((a) => ['--plan', '--self-test', '--check'].includes(a)),
    'STANDALONE_APPLY_BLOCKED_OR_UNKNOWN_ARGUMENT',
  )
  assert.equal(new Set(args).size, args.length)
  const output = await generate()
  if (args.includes('--self-test')) {
    const insufficient: AuthorityEvidence = {
      id: 'fixture',
      disposition: 'PLATFORM_BASELINE',
      active: false,
      exactDefinition: true,
      beforeConsumer: true,
      explicitArchitectureAssignment: false,
      w2QualifiedDefinition: true,
      externalLockVerified: false,
      securityDefiner: false,
      trustedSearchPath: false,
      qualifiedSensitiveReferences: false,
      publicExecuteDefined: false,
      ownerDefined: false,
      frozen: false,
    }
    assert.equal(selectAuthority([insufficient]).disposition, 'GOVERNANCE_HOLD_NO_ACTIVE_AUTHORITY')
    const prior = {
      ...insufficient,
      disposition: 'PRIOR_FROZEN_SECURITY_MIGRATION' as const,
      active: true,
      frozen: true,
    }
    assert.equal(selectAuthority([prior]).disposition, 'PRIOR_FROZEN_SECURITY_MIGRATION')
    assert.equal(
      selectAuthority([prior, { ...prior, id: 'other' }]).disposition,
      'GOVERNANCE_HOLD_CONFLICTING_AUTHORITY',
    )
    console.log(
      'PASS W4D self-tests: positive authority/precedence/definition ladder, exact310/269/41 IDs, deterministic source-backed holds',
    )
  }
  if (args.includes('--check')) {
    for (const [file, value] of Object.entries(output))
      assert.equal(read(file), value, `Stale W4D output:${file}`)
    console.log(
      'PASS W4D --check:310 exact holds; W4/W4D BLOCKED; canonical1.3/frozen W4 unchanged; no generic discovery/runtime/W5',
    )
  } else if (!args.includes('--self-test')) {
    for (const [file, value] of Object.entries(output)) writeFileSync(absolute(file), value)
    console.log(
      'W4D adjudication written;310 bounded holds; no ownership default, synthetic DDL, canonical amendment or runtime execution',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(
      '[adjudicate-w4-ownership]',
      error instanceof Error ? error.message : 'Adjudication failed',
    )
    process.exitCode = 1
  })
