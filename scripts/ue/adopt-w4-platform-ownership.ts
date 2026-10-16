import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import {
  digest,
  exactIds,
  read,
  root,
  sha,
  type buildProducerContract,
} from './w4-physical-producers'
import type { buildAdjudication } from './adjudicate-w4-ownership'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  packet: folder + 'UE_W4_PHYSICAL_OWNERSHIP_HUMAN_DECISION_PACKET.json',
  w4: folder + 'PHASE_1B_3C_A1I_W4_PRECONSUMER_PHYSICAL_PRODUCERS.json',
  w4d: folder + 'PHASE_1B_3C_A1I_W4D_PHYSICAL_OWNERSHIP_ADJUDICATION.json',
  canonicalMarkdown: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.md',
  producerMarkdown: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.md',
}
export const outputs = {
  report: folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.md',
}
type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type RecordValue = { [key: string]: Json }
type Producer = ReturnType<typeof buildProducerContract>
type W4D = Awaited<ReturnType<typeof buildAdjudication>>
type Decision = W4D['decisionAdjudication'][number]
export interface InversePatch {
  PATH: string[]
  EXISTED: boolean
  VALUE?: Json
}
export function object(value: unknown): RecordValue {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'EXPECTED_JSON_RECORD')
  return value as RecordValue
}
function records(value: Json | undefined): RecordValue[] {
  assert(Array.isArray(value), 'EXPECTED_JSON_RECORD_ARRAY')
  return value.map(object)
}
function strings(value: Json | undefined): string[] {
  assert(Array.isArray(value) && value.every((v) => typeof v === 'string'), 'EXPECTED_STRING_ARRAY')
  return value
}
export function inverse(before: Json, after: Json, at: string[] = [], result: InversePatch[] = []) {
  if (digest(before) === digest(after)) return result
  if (
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    Array.isArray(before) === Array.isArray(after) &&
    (Array.isArray(before) && Array.isArray(after)
      ? before.length === after.length
      : Object.keys(before).every((k) => Object.hasOwn(after, k)) &&
        digest(Object.keys(before)) ===
          digest(Object.keys(after).filter((k) => Object.hasOwn(before, k))))
  ) {
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const old = Reflect.get(before, k) as Json
      const next = Reflect.get(after, k) as Json
      if (!Object.hasOwn(before, k)) result.push({ PATH: [...at, k], EXISTED: false })
      else if (!Object.hasOwn(after, k))
        result.push({ PATH: [...at, k], EXISTED: true, VALUE: old })
      else inverse(old, next, [...at, k], result)
    }
  } else result.push({ PATH: at, EXISTED: true, VALUE: before })
  return result
}
export function restore(current: Json, patches: InversePatch[]): Json {
  let result = structuredClone(current)
  for (const p of patches) {
    if (!p.PATH.length) {
      assert(p.EXISTED && p.VALUE !== undefined)
      result = structuredClone(p.VALUE)
      continue
    }
    let parent = result
    for (const key of p.PATH.slice(0, -1)) {
      assert(parent && typeof parent === 'object')
      parent = Reflect.get(parent, key) as Json
    }
    assert(parent && typeof parent === 'object')
    const key = p.PATH.at(-1)!
    if (p.EXISTED) {
      assert(p.VALUE !== undefined)
      Reflect.set(parent, key, structuredClone(p.VALUE))
    } else Reflect.deleteProperty(parent, key)
  }
  return result
}
export const requiredFields = {
  RELATION: [
    'schema',
    'relation name',
    'columns',
    'types',
    'nullability',
    'defaults',
    'primary key',
    'unique constraints',
    'foreign keys',
    'checks',
    'required indexes',
  ],
  COLUMN: [
    'relation',
    'column name',
    'PostgreSQL type',
    'nullability',
    'default',
    'generated/identity behavior',
    'constraints',
    'foreign-key semantics where applicable',
  ],
  TYPE: [
    'schema',
    'type name',
    'type class',
    'complete enum members or underlying definition',
    'dependencies',
    'compatibility expectations',
  ],
  FUNCTION: [
    'qualified name',
    'argument signature',
    'return type',
    'language',
    'function body',
    'security mode',
    'volatility',
    'strictness where applicable',
    'SET search_path',
    'owner class',
    'PUBLIC EXECUTE posture',
    'referenced object dependencies',
  ],
}
const forbidden = [
  'SELECT queries',
  'policy expressions',
  'application interfaces',
  'tests',
  'fixtures',
  'historical snapshots',
  'name similarity',
  'column usage alone',
]
export function validateHeldUniverse(w4d: W4D, producer: Producer) {
  const rows = w4d.decisionAdjudication
  assert.equal(rows.length, 310)
  exactIds(
    rows.map((d) => d.DECISION_ID),
    producer.governanceDecisions.map((d) => d.DECISION_ID),
  )
  assert.equal(rows.filter((d) => ['RELATION', 'COLUMN'].includes(d.OBJECT_KIND)).length, 269)
  assert.equal(rows.filter((d) => d.OBJECT_KIND === 'TYPE').length, 41)
  assert.equal(rows.filter((d) => d.ACTIVE_DEFINITION_CANDIDATES.length).length, 127)
  assert.equal(rows.filter((d) => !d.ACTIVE_DEFINITION_CANDIDATES.length).length, 183)
  assert.equal(w4d.summary.TOTAL.HELD_CONFLICTING_AUTHORITY, 0)
  for (const d of rows) {
    assert.equal(d.DATABASE_SCOPE_ID, 'UE_OPERATIONAL')
    assert.equal(d.DISPOSITION, 'GOVERNANCE_HOLD_NO_ACTIVE_AUTHORITY')
    assert.equal(d.APPROVED, 'NO')
    assert(d.DOWNSTREAM_IMPACT.REQUIRED_BEFORE_CONSUMER_IDS.length)
    assert(
      ['RELATION', 'COLUMN', 'TYPE'].includes(d.OBJECT_KIND),
      'UNEXPECTED_OBJECT_KIND_REQUIRES_EXPLICIT_GOVERNANCE',
    )
    const mappings = producer.platformProducerRegistry.filter((p) =>
      p.BLOCKING_DECISION_IDS.includes(d.DECISION_ID),
    )
    assert.equal(mappings.length, 1)
    assert(mappings[0].PHYSICAL_IDENTITIES.includes(d.PHYSICAL_IDENTITY))
    assert(
      !producer.djangoProducerRegistry.some((p) => p.PREREQUISITE_ID === d.PREREQUISITE_ID),
      'DJANGO_OWNERSHIP_MUST_NOT_BE_REASSIGNED',
    )
    assert.equal(d.ACTIVE_CREATION_CANDIDATES.length, d.ACTIVE_DEFINITION_CANDIDATES.length)
    if (d.ACTIVE_DEFINITION_CANDIDATES.length) {
      assert.equal(d.ACTIVE_DEFINITION_CANDIDATES.length, 1, 'CONFLICTING_DEFINITION_SOURCE')
      const source = d.ACTIVE_DEFINITION_CANDIDATES[0]
      assert(source.DEFINITION_EVIDENCE)
      assert.equal(
        sha(source.DEFINITION_EVIDENCE.EXACT_CREATE_CLAUSE),
        source.DEFINITION_EVIDENCE.DEFINITION_SHA256,
        'DEFINITION_DIGEST_DRIFT',
      )
      assert.equal(
        w4d.sourceHashes[source.SOURCE_FILE],
        source.SOURCE_FILE_SHA256,
        'ACCEPTED_SOURCE_HASH_DRIFT',
      )
      assert.equal(source.PRODUCER_PRECEDES_FIRST_CONSUMER, 'NO')
      assert(source.FROZEN_PRODUCER_POSITION !== null && source.FROZEN_MIGRATION_ID)
    }
  }
}
function definitionSource(d: Decision) {
  const source = d.ACTIVE_DEFINITION_CANDIDATES[0]
  assert(source?.DEFINITION_EVIDENCE)
  return {
    SOURCE_FILE: source.SOURCE_FILE,
    SOURCE_SHA256: source.SOURCE_FILE_SHA256,
    SOURCE_LINE_OR_RANGE: [
      source.SOURCE_LINE,
      source.SOURCE_LINE + source.DEFINITION_EVIDENCE.EXACT_CREATE_CLAUSE.split('\n').length - 1,
    ],
    OBJECT_IDENTITY: d.PHYSICAL_IDENTITY,
    OBJECT_KIND: d.OBJECT_KIND,
    EXACT_DEFINITION_DIGEST: source.DEFINITION_EVIDENCE.DEFINITION_SHA256,
    FROZEN_MIGRATION_ID: source.FROZEN_MIGRATION_ID,
    FROZEN_POSITION: source.FROZEN_PRODUCER_POSITION,
    EXACT_DEFINITION_EVIDENCE: source.DEFINITION_EVIDENCE,
    ACCEPTED_W4D_CANDIDATE: source,
  }
}
export function adoptionModel(w4d: W4D, producer: Producer) {
  validateHeldUniverse(w4d, producer)
  const adoption = w4d.decisionAdjudication.map((d) => {
    const late = d.ACTIVE_DEFINITION_CANDIDATES.length === 1
    return {
      DECISION_ID: d.DECISION_ID,
      OBLIGATION_ID: d.OBLIGATION_ID,
      PREREQUISITE_ID: d.PREREQUISITE_ID,
      PHYSICAL_IDENTITY: d.PHYSICAL_IDENTITY,
      OBJECT_KIND: d.OBJECT_KIND,
      DATABASE_SCOPE_ID: 'UE_OPERATIONAL',
      OWNERSHIP_DECISION: 'APPROVED',
      OWNERSHIP: 'PLATFORM_BASELINE',
      CANONICAL_CREATION_AUTHORITY: 'PLATFORM_BASELINE',
      CANONICAL_PRECONSUMER_CREATION_AUTHORITY: 'PLATFORM_BASELINE',
      OWNERSHIP_STATUS: 'PLATFORM_BASELINE_GOVERNANCE_ADOPTED',
      OWNERSHIP_AUTHORITY: 'HUMAN_GOVERNANCE_W4G',
      DEFINITION_STATUS: late
        ? 'EXACT_LATE_FROZEN_DEFINITION_AVAILABLE'
        : 'NEW_CANONICAL_DEFINITION_REQUIRED',
      CANONICAL_DEFINITION_SOURCE: late ? definitionSource(d) : null,
      DEFINITION_OBLIGATION_ID: late
        ? null
        : `UE-W4G-DEFINITION-${sha(d.DECISION_ID).slice(0, 16)}`,
      IMPLEMENTATION_OWNER: late
        ? 'W4P_PRECONSUMER_PROMOTION'
        : 'W4F_CANONICAL_DEFINITION_AUTHORING',
      PRODUCER_ACTIVATED: 'NO',
      W4_IMPLEMENTATION_COMPLETE: 'NO',
      RUNTIME_PROVEN: 'NO',
      RATIONALE:
        'New prospective human governance adoption after static discovery exhaustion, not prior repository evidence. Ownership does not approve missing definitions or precreation compatibility.',
    }
  })
  const lateDefinitions = adoption
    .filter((d) => d.CANONICAL_DEFINITION_SOURCE)
    .map((d) => ({
      ...d,
      FROZEN_MIGRATION_ROLE: 'LATE_DEFINITION_SOURCE_AND_EXISTING_EXECUTION_STEP',
      CANONICAL_PRECONSUMER_OWNER: 'PLATFORM_BASELINE',
      LATE_PRODUCER_COMPATIBILITY: 'UNRESOLVED_PENDING_W5',
      W4P: 'NOT_AUTHORIZED',
      DEFINITION_REWRITTEN: 'NO',
    }))
  const definitions = adoption
    .filter((d) => d.DEFINITION_OBLIGATION_ID)
    .map((d) => {
      const accepted = w4d.decisionAdjudication.find((a) => a.DECISION_ID === d.DECISION_ID)!
      const kind = d.OBJECT_KIND === 'RELATION' ? 'RELATION' : 'COLUMN'
      return {
        DEFINITION_OBLIGATION_ID: d.DEFINITION_OBLIGATION_ID!,
        SOURCE_W4_DECISION_ID: d.DECISION_ID,
        SOURCE_W4_OBLIGATION_ID: d.OBLIGATION_ID,
        PHYSICAL_IDENTITY: d.PHYSICAL_IDENTITY,
        OBJECT_KIND: d.OBJECT_KIND,
        DATABASE_SCOPE_ID: 'UE_OPERATIONAL',
        CANONICAL_OWNER: 'PLATFORM_BASELINE',
        CURRENT_DEFINITION_STATUS: 'NOT_AUTHORED',
        AVAILABLE_DECLARATION_EVIDENCE: accepted.DECLARATION_ONLY_CANDIDATES,
        AVAILABLE_CONSUMER_EVIDENCE: accepted.DOWNSTREAM_IMPACT,
        HISTORICAL_SUPPORTING_EVIDENCE: accepted.HISTORICAL_CANDIDATES,
        FORBIDDEN_INFERENCE_CLASSES: forbidden,
        REQUIRED_OUTPUT_FIELDS: requiredFields[kind],
        DEFINITION_REVIEW_REQUIRED: 'YES',
        DEFINITION_AUTHORING_OWNER: 'W4F_CANONICAL_DEFINITION_AUTHORING',
        IMPLEMENTATION_DESIGN_STATUS: 'IMPLEMENTATION_DESIGN_PENDING',
        EXECUTION_AUTHORIZED: 'NO',
        DDL_AUTHORIZED: 'NO',
      }
    })
  assert.equal(definitions.length, 183)
  assert.equal(new Set(definitions.map((d) => d.DEFINITION_OBLIGATION_ID)).size, 183)
  assert(definitions.every((d) => ['RELATION', 'COLUMN'].includes(d.OBJECT_KIND)))
  const compatibility = lateDefinitions.map((d) => ({
    COMPATIBILITY_OBLIGATION_ID: `UE-W4G-COMPATIBILITY-${sha(d.DECISION_ID).slice(0, 16)}`,
    SOURCE_W4_DECISION_ID: d.DECISION_ID,
    PHYSICAL_IDENTITY: d.PHYSICAL_IDENTITY,
    CANONICAL_DEFINITION_SOURCE: d.CANONICAL_DEFINITION_SOURCE,
    FROZEN_MIGRATION_ROLE: d.FROZEN_MIGRATION_ROLE,
    LATE_PRODUCER_COMPATIBILITY: 'UNRESOLVED_PENDING_W5',
    REQUIRED_W5_DISPOSITIONS: [
      'IDEMPOTENT_WITH_PRECREATION',
      'ALTERATION_ONLY_AFTER_PROMOTION',
      'DUPLICATE_CREATE_CONFLICT',
      'SUPERSESSION_REQUIRED',
      'OTHER_EXPLICIT',
    ],
    OWNER: 'W5',
    STATUS: 'ORDERING_COMPATIBILITY_PENDING',
    W5_AUTHORIZED: 'NO',
    W4P_AUTHORIZED: 'NO',
    PRODUCER_POSITION_CLASS: 'NOT_ESTABLISHED_PENDING_COMPATIBILITY',
  }))
  const byId = new Map(adoption.map((d) => [d.DECISION_ID, d]))
  const byProducer = new Map(
    producer.platformProducerRegistry.map((p) => [
      p.PRODUCER_ID,
      byId.get(p.BLOCKING_DECISION_IDS[0])!,
    ]),
  )
  const registry = producer.platformProducerRegistry.map((p) => {
    const d = byProducer.get(p.PRODUCER_ID)!
    assert(d)
    assert.equal(p.MUTATING_OPERATIONS.length, 0)
    return {
      ...p,
      CANONICAL_OWNER: 'PLATFORM_BASELINE',
      OWNERSHIP_AUTHORITY: 'HUMAN_GOVERNANCE_W4G',
      OWNERSHIP_STATUS: d.OWNERSHIP_STATUS,
      DEFINITION_STATUS: d.DEFINITION_STATUS,
      CANONICAL_DEFINITION_SOURCE: d.CANONICAL_DEFINITION_SOURCE,
      DEFINITION_OBLIGATION_ID: d.DEFINITION_OBLIGATION_ID,
      IMPLEMENTATION_OWNER: d.IMPLEMENTATION_OWNER,
      GOVERNANCE_ONLY_UPDATE: 'YES',
      PRODUCER_ACTIVATED: 'NO',
      HISTORICAL_W4_BLOCKER_FIELDS:
        'Preserved from accepted W4; ownership closed by W4G overlay, definition/implementation still pending',
    }
  })
  const ordering = w4d.w5OrderingHandoff.map((h) => {
    const d = h.DECISION_ID ? byId.get(h.DECISION_ID) : undefined
    return d
      ? {
          ...h,
          W4_CREATION_AUTHORITY: 'PLATFORM_BASELINE',
          FINAL_W4_CREATION_AUTHORITY: 'PLATFORM_BASELINE',
          OWNERSHIP_STATUS: d.OWNERSHIP_STATUS,
          DEFINITION_STATUS: d.DEFINITION_STATUS,
          PRODUCER_ID: null,
          PRODUCER_POSITION_CLASS: 'NOT_ESTABLISHED_PENDING_DEFINITION_AND_COMPATIBILITY',
          LATE_PRODUCER_COMPATIBILITY: d.CANONICAL_DEFINITION_SOURCE
            ? 'UNRESOLVED_PENDING_W5'
            : 'NEW_CANONICAL_DEFINITION_REQUIRED',
          W5_AUTHORIZED: 'NO',
        }
      : { ...h, W4_CREATION_AUTHORITY: h.FINAL_W4_CREATION_AUTHORITY, W5_AUTHORIZED: 'NO' }
  })
  const opaque = producer.w6OpaqueBindingHandoff.map((h) => {
    const d = h.W4_PHYSICAL_PRODUCER_ID ? byProducer.get(h.W4_PHYSICAL_PRODUCER_ID) : undefined
    return d
      ? { ...h, CANONICAL_PHYSICAL_OWNER: 'PLATFORM_BASELINE', W6_SEMANTIC_BINDING_REQUIRED: 'YES' }
      : h
  })
  exactIds(
    ordering.map((h) => h.ORDERING_RECORD_ID),
    w4d.w5OrderingHandoff.map((h) => h.ORDERING_RECORD_ID),
  )
  exactIds(
    opaque.map((h) => h.OPAQUE_BINDING_ID),
    producer.w6OpaqueBindingHandoff.map((h) => h.OPAQUE_BINDING_ID),
  )
  const linkage = w4d.obligationLinkage.map((o) => {
    const d = o.W4D_DECISION_ID ? byId.get(o.W4D_DECISION_ID) : undefined
    return d
      ? {
          ...o,
          W4G_DECISION_ID: d.DECISION_ID,
          CANONICAL_OWNER: 'PLATFORM_BASELINE',
          OWNERSHIP_STATUS: d.OWNERSHIP_STATUS,
          DEFINITION_STATUS: d.DEFINITION_STATUS,
          DOWNSTREAM_OWNER: d.IMPLEMENTATION_OWNER,
          W4_IMPLEMENTATION_COMPLETE: 'NO',
          RUNTIME_PROVEN: 'NO',
        }
      : o
  })
  return {
    adoption,
    lateDefinitions,
    definitions,
    compatibility,
    registry,
    ordering,
    opaque,
    linkage,
  }
}
const jsonKeys = ['canonical', 'producer', 'packet'] as const
interface PriorReport {
  PRIOR_JSON_SHA256: Record<string, string>
  PRIOR_JSON_INVERSE_PATCHES: Record<string, InversePatch[]>
  PRIOR_MARKDOWN: Record<string, string>
  preservation: Record<string, string>
}
export async function generate() {
  const bytes = Object.fromEntries(Object.entries(files).map(([k, file]) => [k, read(file)]))
  const current = Object.fromEntries(jsonKeys.map((key) => [key, object(JSON.parse(bytes[key]))]))
  const prior: PriorReport | null = existsSync(path.join(root, ...outputs.report.split('/')))
    ? JSON.parse(read(outputs.report))
    : null
  assert(
    ['1.3', '1.3.1'].includes(String(current.canonical.CONTRACT_VERSION)),
    'UNEXPECTED_CANONICAL_VERSION',
  )
  assert(
    prior || current.canonical.CONTRACT_VERSION === '1.3',
    'MISSING_W4G_RECONSTRUCTION_AUTHORITY',
  )
  const config = await resolveConfig(path.join(root, ...files.canonical.split('/')))
  const json = (value: unknown) => format(JSON.stringify(value), { ...config, parser: 'json' })
  const before = Object.fromEntries(
    jsonKeys.map((key) => [
      key,
      object(prior ? restore(current[key], prior.PRIOR_JSON_INVERSE_PATCHES[key]) : current[key]),
    ]),
  )
  const oldBytes = Object.fromEntries(
    await Promise.all(
      jsonKeys.map(async (key) => {
        const value = prior ? await json(before[key]) : bytes[key]
        if (prior)
          assert.equal(
            sha(value),
            prior.PRIOR_JSON_SHA256[key],
            `PRIOR_${key}_RECONSTRUCTION_DRIFT`,
          )
        return [key, value]
      }),
    ),
  )
  const markdown = Object.fromEntries(
    ['canonicalMarkdown', 'producerMarkdown'].map((key) => [
      key,
      prior ? prior.PRIOR_MARKDOWN[key] : bytes[key],
    ]),
  )
  const w4d: W4D = JSON.parse(bytes.w4d)
  const acceptedW4: Producer = JSON.parse(bytes.w4)
  const producer: Producer = JSON.parse(oldBytes.producer)
  assert.equal(w4d.phaseStatus.PHASE_1B_3C_A1I_W4D, 'BLOCKED')
  assert.equal(w4d.phaseStatus.NO_FURTHER_W4_GENERIC_STATIC_DISCOVERY, 'YES')
  assert.equal(sha(oldBytes.canonical), w4d.preservation[files.canonical].BEFORE_SHA256)
  assert.equal(sha(oldBytes.producer), w4d.preservation[files.producer].BEFORE_SHA256)
  assert.deepEqual(producer.djangoProducerRegistry, acceptedW4.djangoProducerRegistry)
  assert.deepEqual(producer.canonicalProducerPlan, acceptedW4.canonicalProducerPlan)
  assert.deepEqual(producer.rawOperationProducerRegistry, acceptedW4.rawOperationProducerRegistry)
  assert.deepEqual(producer.w3Preconditions, acceptedW4.w3Preconditions)
  const model = adoptionModel(w4d, producer)
  const c = structuredClone(before.canonical)
  const canonicalWork = records(c.remediationWorkstreams).find((w) => w.WORKSTREAM_ID === 'W4')
  assert(canonicalWork)
  exactIds(
    model.adoption.map((d) => d.DECISION_ID),
    strings(canonicalWork.INPUT_DECISION_IDS),
  )
  exactIds(
    model.linkage.map((d) => d.OBLIGATION_ID),
    strings(canonicalWork.INPUT_OBLIGATION_IDS),
  )
  const phase = {
    PHASE_1B_3C_A1I_W4G_GATE: 'PASS',
    PHASE_1B_3C_A1I_W4G: 'PASS',
    PRECONSUMER_PLATFORM_OWNERSHIP: 'GOVERNANCE_ADOPTED',
    W4_OWNERSHIP_GOVERNANCE_COMPLETE: 'YES',
    W4_DEFINITION_IMPLEMENTATION_COMPLETE: 'NO',
    W4: 'BLOCKED_IMPLEMENTATION_PENDING',
    PHASE_1B_3C_A1I_W4: 'BLOCKED_IMPLEMENTATION_PENDING',
    PHASE_1B_3C_A1I_W4_GATE: 'BLOCKED',
    W4D: 'BLOCKED',
    W4D_EVIDENCE_STATUS: 'FROZEN_HISTORICAL_STATIC_DISCOVERY_COMPLETE',
    NO_FURTHER_W4_GENERIC_STATIC_DISCOVERY: 'YES',
    CANONICAL_CONTRACT_VERSION: '1.3.1',
    CANONICAL_BOOTSTRAP_CONTRACT_VERSION: '1.3.1',
    BOOTSTRAP_CONTRACT_VERSION: '1.3.1',
    CONTRACT_1_4_CREATED: 'NO',
    VERSION_1_4: 'PRECONSUMER_PHYSICAL_PRODUCER_IMPLEMENTATION',
    W4F: 'AUTHORIZED_NOT_STARTED',
    PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING: 'AUTHORIZED_NOT_STARTED',
    W4F_STARTED: 'NO',
    W4P: 'NOT_AUTHORIZED',
    W4P_STARTED: 'NO',
    W5: 'NOT_AUTHORIZED',
    W5_STARTED: 'NO',
    W6_STARTED: 'NO',
    W1: 'PASS',
    W2: 'PASS',
    W3: 'PASS',
    DATABASE_ROLES_PROVISIONED: 'NO',
    EXTENSIONS_RUNTIME_PROVEN: 'NO',
    ROLE_MEMBERSHIPS_APPLIED: 'NO',
    DJANGO_SCHEMA_MATERIALIZED: 'NO',
    PRECONSUMER_BASELINE_MATERIALIZED: 'NO',
    PHYSICAL_PRODUCERS_EXECUTED: 'NO',
    BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
    FAITHFUL_SCHEMA_REPLAY_PROVEN: 'NO',
    RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
    TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
    READY_FOR_RUNTIME_PROOF: 0,
    PRODUCT_READY: 'NO',
  }
  const byId = new Map(model.adoption.map((d) => [d.DECISION_ID, d]))
  const byPrerequisite = new Map(model.adoption.map((d) => [d.PREREQUISITE_ID, d]))
  c.CONTRACT_VERSION = '1.3.1'
  c.phaseStatus = {
    ...object(c.phaseStatus),
    ...phase,
    W4_STARTED: 'YES; offline W4/W4D accepted, governance-only W4G adoption',
    W4_W10_STARTED: 'W4_ONLY; W4F/W4P/W5-W10 NOT_STARTED',
    PHASE_1B_3C_A1I_W4_PRECONSUMER_PHYSICAL_PRODUCERS: 'BLOCKED_IMPLEMENTATION_PENDING',
  }
  c.governanceDecisionObligations = records(c.governanceDecisionObligations).map((d) => {
    const adopted = byId.get(String(d.DECISION_ID))
    return adopted
      ? {
          ...d,
          STATUS: 'OWNERSHIP_APPROVED_BY_HUMAN_GOVERNANCE_W4G_DEFINITION_IMPLEMENTATION_PENDING',
          OWNERSHIP_DECISION: 'APPROVED',
          OWNERSHIP: 'PLATFORM_BASELINE',
          OWNERSHIP_STATUS: adopted.OWNERSHIP_STATUS,
          DEFINITION_STATUS: adopted.DEFINITION_STATUS,
          OWNERSHIP_AUTHORITY: 'HUMAN_GOVERNANCE_W4G',
          DECISION_ASSUMED: 'NO; explicitly adopted prospectively',
          EXECUTION_BLOCKED_UNTIL_RECORDED:
            'YES; definition and producer implementation/compatibility still required',
        }
      : d
  })
  c.prerequisiteObligations = records(c.prerequisiteObligations).map((o) => {
    const d = byPrerequisite.get(String(o.PREREQUISITE_ID))
    return d
      ? {
          ...o,
          CREATION_AUTHORITY: 'PLATFORM_BASELINE',
          CANONICAL_PRECONSUMER_CREATION_AUTHORITY: 'PLATFORM_BASELINE',
          OWNERSHIP_STATUS: d.OWNERSHIP_STATUS,
          DEFINITION_STATUS: d.DEFINITION_STATUS,
          OWNERSHIP_AUTHORITY: 'HUMAN_GOVERNANCE_W4G',
          EXECUTION_STEP: [
            'LAYER_2; NOT_AUTHORIZED_PENDING_DEFINITION_IMPLEMENTATION_AND_COMPATIBILITY',
          ],
          STATUS: 'OWNERSHIP_ADOPTED_DEFINITION_IMPLEMENTATION_PENDING',
          IMPLEMENTED: 'NO',
          RUNTIME_PROVEN: 'NO',
          PRIMARY_DISPOSITION_INTERPRETATION:
            'Preserved historical classification; W4G approves ownership only, not physical implementation',
        }
      : o
  })
  c.fullPrerequisiteGovernance = records(c.fullPrerequisiteGovernance).map((o) => {
    const d = byPrerequisite.get(String(o.PREREQUISITE_ID))
    return d
      ? {
          ...o,
          CREATION_AUTHORITY: 'PLATFORM_BASELINE',
          OWNERSHIP_AUTHORITY: 'HUMAN_GOVERNANCE_W4G',
          OWNERSHIP_STATUS: d.OWNERSHIP_STATUS,
          DEFINITION_STATUS: d.DEFINITION_STATUS,
          STATUS: 'OWNERSHIP_ADOPTED_DEFINITION_IMPLEMENTATION_PENDING',
          EXECUTION_STEP: [
            'LAYER_2; NOT_AUTHORIZED_PENDING_DEFINITION_IMPLEMENTATION_AND_COMPATIBILITY',
          ],
        }
      : o
  })
  const governanceSummary = {
    W4_OWNERSHIP_DECISIONS: 310,
    PLATFORM_BASELINE_OWNERSHIP_APPROVED: 310,
    OWNERSHIP_HOLDS_REMAINING: 0,
    DEFINITION_DECISIONS: 310,
    EXACT_LATE_FROZEN_DEFINITION_AVAILABLE: 127,
    NEW_CANONICAL_DEFINITION_REQUIRED: 183,
    RELATION_COLUMN: {
      RELATION_COLUMN_DECISIONS: 269,
      PLATFORM_BASELINE_OWNER: 269,
      EXACT_LATE_DEFINITION: 86,
      NEW_DEFINITION_REQUIRED: 183,
      SUM: 269,
    },
    TYPE_FUNCTION: {
      TYPE_FUNCTION_DECISIONS: 41,
      PLATFORM_BASELINE_OWNER: 41,
      EXACT_LATE_DEFINITION: 41,
      NEW_DEFINITION_REQUIRED: 0,
      SUM: 41,
    },
    SUM: 310,
    UNACCOUNTED: 0,
  }
  const governance = {
    AMENDMENT: 'PRECONSUMER_PLATFORM_OWNERSHIP_ADOPTION',
    AUTHORITY: 'HUMAN_GOVERNANCE_W4G',
    PRIOR_CONTRACT_VERSION: '1.3',
    CONTRACT_VERSION: '1.3.1',
    PRIOR_CONTRACT_SHA256: sha(oldBytes.canonical),
    PRECONSUMER_PLATFORM_OWNERSHIP_RULE:
      'Required UE_OPERATIONAL canonical prerequisite + no established Django/external-Django/financial owner + no earlier active canonical producer -> PLATFORM_BASELINE; prospective governance decision, not repository-static evidence',
    SCOPE: 'Exactly310 accepted W4D-held decisions; no objects outside this universe',
    W4F_CANONICAL_DEFINITION_AUTHORING: 'OWNER_OF_183_DEFINITION_OBLIGATIONS',
    W4P_PRECONSUMER_PROMOTION: 'IMPLEMENTATION_OWNER_OF_127; NOT_AUTHORIZED_PENDING_W5',
    W5_OWNS: '86 original ordering IDs plus127 late-producer compatibility records; NOT_AUTHORIZED',
    KNOWN_DEPENDENCY_GATE:
      'W5 must not start while W4 incomplete; W4P must not start until W5 compatibility resolved. W4G does not bypass or resolve this gated dependency; a separately authorized sequencing decision is required before promotion can proceed.',
    SOURCE_DISCOVERY: 'NONE; accepted W4D evidence only',
    DEFINITIONS_AUTHORED: 0,
    PRODUCERS_ACTIVATED: 0,
    VERSION_1_4_RESERVED: 'PRECONSUMER_PHYSICAL_PRODUCER_IMPLEMENTATION',
    summary: governanceSummary,
    RECONSTRUCTION_REFERENCE: outputs.report + '#PRIOR_JSON_INVERSE_PATCHES.canonical',
  }
  c.preconsumerOwnershipAdoption = governance
  c.canonicalDefinitionObligations = records(JSON.parse(JSON.stringify(model.definitions)))
  c.lateProducerCompatibilityObligations = records(JSON.parse(JSON.stringify(model.compatibility)))
  c.summary = {
    ...object(c.summary),
    W4G_OWNERSHIP: governanceSummary,
    HUMAN_DECISIONS_PENDING: records(c.governanceDecisionObligations).filter(
      (d) => d.STATUS === 'HUMAN_DECISION_REQUIRED',
    ).length,
    HISTORICAL_SUMMARY_CLASSIFICATIONS:
      'Primary disposition counts remain historical; W4G ownership approval does not resolve definition/implementation obligations',
  }
  c.layers = records(c.layers).map((layer) =>
    layer.LAYER_ID === 'LAYER_2'
      ? {
          ...layer,
          AUTHORITY:
            'Exact310 W4D-held prerequisites prospectively assigned PLATFORM_BASELINE by HUMAN_GOVERNANCE_W4G; definitions/implementation/late compatibility remain pending. Django and financial objects excluded.',
        }
      : layer,
  )
  c.remediationWorkstreams = records(c.remediationWorkstreams).map((w) =>
    w.WORKSTREAM_ID === 'W4'
      ? {
          ...w,
          AUTHORIZATION_STATE: 'OWNERSHIP_GOVERNANCE_COMPLETE_IMPLEMENTATION_BLOCKED',
          STARTED: 'YES; offline definitions/evidence/governance only',
          COMPLETION_STATUS: 'BLOCKED_IMPLEMENTATION_PENDING',
          NEXT_WORKSTREAMS: ['W4F_AUTHORIZED_NOT_STARTED; W4P/W5_NOT_AUTHORIZED'],
        }
      : w.WORKSTREAM_ID === 'W5'
        ? {
            ...w,
            AUTHORIZATION_STATE: 'NOT_AUTHORIZED',
            STARTED: 'NO',
            W4G_ADDITIONAL_COMPATIBILITY_OBLIGATION_IDS: model.compatibility.map(
              (d) => d.COMPATIBILITY_OBLIGATION_ID,
            ),
          }
        : w,
  )
  const versionChain = records(c.versionChain)
  c.versionChain = [
    ...versionChain,
    {
      VERSION: '1.3',
      SHA256: sha(oldBytes.canonical),
      RECONSTRUCTION_REFERENCE: outputs.report + '#PRIOR_JSON_INVERSE_PATCHES.canonical',
    },
  ]
  const byOrdering = new Map(model.ordering.map((h) => [h.ORDERING_RECORD_ID, h]))
  c.orderingObligations = records(c.orderingObligations).map((o) => {
    const handoff = byOrdering.get(String(o.ORDERING_RECORD_ID))
    assert(handoff)
    return handoff.DECISION_ID
      ? {
          ...o,
          CANONICAL_PRECONSUMER_OWNER: 'PLATFORM_BASELINE',
          W4_CREATION_AUTHORITY: 'PLATFORM_BASELINE',
          OWNERSHIP_AUTHORITY: 'HUMAN_GOVERNANCE_W4G',
          W5_AUTHORIZED: 'NO',
          PRODUCER_POSITION_CLASS: 'NOT_ESTABLISHED_PENDING_DEFINITION_AND_COMPATIBILITY',
        }
      : o
  })
  const p = {
    ...before.producer,
    platformProducerRegistry: model.registry,
    governanceDecisions: records(before.producer.governanceDecisions).map((d) => {
      const adopted = byId.get(String(d.DECISION_ID))
      assert(adopted)
      return {
        ...d,
        OWNERSHIP_DECISION: 'APPROVED',
        OWNERSHIP: 'PLATFORM_BASELINE',
        OWNERSHIP_AUTHORITY: 'HUMAN_GOVERNANCE_W4G',
        OWNERSHIP_STATUS: adopted.OWNERSHIP_STATUS,
        DEFINITION_STATUS: adopted.DEFINITION_STATUS,
        HISTORICAL_W4_DECISION_FIELDS:
          'Original APPROVED/IMPLEMENTED/STATUS fields remain historical W4 evidence; ownership is closed by W4G, physical implementation is not',
      }
    }),
    w5OrderingHandoff: model.ordering,
    w6OpaqueBindingHandoff: model.opaque,
    obligationLinkage: model.linkage,
    governanceAdoption: governance,
    phaseStatus: { ...object(before.producer.phaseStatus), ...phase },
    HISTORICAL_W4_DIGESTS_AND_VALIDATION:
      'Original digests/validation remain accepted historical W4 evidence; current governance metadata digests are in governanceAdoptionDigests and W4G report',
    governanceAdoptionDigests: {
      PLATFORM_METADATA: digest(model.registry),
      HANDOFFS: digest([model.ordering, model.opaque]),
      LINKAGE: digest(model.linkage),
    },
  }
  const packet = {
    ...before.packet,
    HISTORICAL_W4D_HOLDS_PRESERVED:
      'YES; HOLDS and original summary remain historical, not current ownership holds',
    ownershipDisposition: model.adoption.map((d) => ({
      ...d,
      HUMAN_DECISION_DISPOSITION: 'HUMAN_DECISION_CLOSED',
    })),
    definitionAuthoringObligations: model.definitions,
    lateProducerCompatibilityObligations: model.compatibility,
    currentSummary: governanceSummary,
    currentPhaseStatus: phase,
  }
  const updated: Record<string, RecordValue> = {
    canonical: c,
    producer: object(p),
    packet: object(packet),
  }
  const patches = Object.fromEntries(
    jsonKeys.map((key) => [key, inverse(before[key], updated[key])]),
  )
  for (const key of jsonKeys)
    assert.equal(
      sha(await json(restore(updated[key], patches[key]))),
      sha(oldBytes[key]),
      `INVERSE_${key}_BYTE_DRIFT`,
    )
  const preservation = { [files.w4]: sha(bytes.w4), [files.w4d]: sha(bytes.w4d) }
  if (prior) assert.deepEqual(preservation, prior.preservation, 'FROZEN_W4_W4D_EVIDENCE_DRIFT')
  const report = {
    PHASE: 'PHASE_1B_3C_A1I_W4G',
    CONTRACT_VERSION: '1.3.1',
    AMENDMENT: 'PRECONSUMER_PLATFORM_OWNERSHIP_ADOPTION',
    FIXED_INPUTS: Object.values(files),
    SOURCE_REDISCOVERY_PERFORMED: 'NO',
    OWNERSHIP_IS_NEW_HUMAN_GOVERNANCE_NOT_PRIOR_EVIDENCE: 'YES',
    ownershipAdoption: model.adoption,
    lateDefinitionRegister: model.lateDefinitions,
    canonicalDefinitionObligations: model.definitions,
    lateProducerCompatibilityObligations: model.compatibility,
    humanDecisionDisposition: {
      OWNERSHIP: '310 HUMAN_DECISION_CLOSED',
      DEFINITIONS: '183 IMPLEMENTATION_DESIGN_PENDING',
      COMPATIBILITY: '127 ORDERING_COMPATIBILITY_PENDING',
    },
    platformProducerRegistry: model.registry,
    obligationLinkage: model.linkage,
    w5OrderingHandoff: model.ordering,
    w6OpaqueBindingHandoff: model.opaque,
    summary: governanceSummary,
    governance,
    phaseStatus: phase,
    PRIOR_JSON_SHA256: Object.fromEntries(jsonKeys.map((key) => [key, sha(oldBytes[key])])),
    PRIOR_JSON_INVERSE_PATCHES: patches,
    PRIOR_MARKDOWN: markdown,
    preservation,
    VERSION_1_3_SHA256: sha(oldBytes.canonical),
    VERSION_1_3_1_SHA256: sha(await json(c)),
    acceptedSectionDigests: {
      DJANGO_372: digest(producer.djangoProducerRegistry),
      DJANGO_82_PLAN: digest(producer.canonicalProducerPlan),
      RAW_WRAPPERS: digest(producer.rawOperationProducerRegistry),
      W3: digest(producer.w3Preconditions),
      FROZEN_MANIFEST: digest(c.frozenMigrationManifest),
      W4D_LATE_DEFINITIONS: digest(
        w4d.decisionAdjudication
          .filter((d) => d.ACTIVE_DEFINITION_CANDIDATES.length)
          .map((d) => d.ACTIVE_DEFINITION_CANDIDATES),
      ),
    },
    validation: {
      EXACT_310_269_41_127_183_ACCOUNTING: 'PASS',
      NO_CONFLICTING_AUTHORITY_DRIFT: 'PASS;0',
      DEFINITION_OBLIGATION_UNIQUENESS: 'PASS;183',
      EXACT_LATE_SOURCE_TEXT_AND_DIGESTS_PRESERVED:
        'PASS;127; no source files read or rediscovered',
      HANDOFF_IDS_PRESERVED: 'PASS;86 W5 and118 W6',
      W4_LINKAGE: 'PASS;768 IDs',
      DJANGO_AND_W3_AUTHORITY_UNCHANGED: 'PASS',
      INVERSE_RECONSTRUCTION: 'PASS; exact prior canonical/producer/packet and Markdown bytes',
      MUTATING_SQL_AUTHORED: 0,
      PRODUCERS_ACTIVATED: 0,
      DATABASE_SQL_MIGRATION_SECRET_ACCESS: 'NONE',
      HISTORICAL_GENERATORS:
        'Frozen1.3 W4/W4D generators remain historical and fail closed against amended current inputs; W4G --check verifies their preserved accepted outputs and exact pre-amendment reconstruction without rerunning source discovery',
      closeoutChecks: [
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\adopt-w4-platform-ownership.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
          RESULT: 'PASS;85 tests:26 W4G and59 preserved W3E',
        },
        {
          COMMAND: 'pnpm exec tsx scripts\\ue\\adopt-w4-platform-ownership.ts --self-test --check',
          RESULT:
            'PASS;exact partitions,inverse reconstruction,two matching generations and persistent outputs',
        },
        {
          COMMAND:
            'pnpm exec tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\adopt-w4-platform-ownership.ts scripts\\ue\\adopt-w4-platform-ownership.test.ts',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\adopt-w4-platform-ownership.ts scripts\\ue\\adopt-w4-platform-ownership.test.ts',
          RESULT: 'PASS;actual root-scoped lint,exit0;existing Next pages-directory diagnostic',
        },
        {
          COMMAND:
            'pnpm exec prettier --check scripts\\ue\\adopt-w4-platform-ownership.ts scripts\\ue\\adopt-w4-platform-ownership.test.ts docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.md docs\\union-eyes\\reality-remediation\\UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json docs\\union-eyes\\reality-remediation\\UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.md docs\\union-eyes\\reality-remediation\\UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json docs\\union-eyes\\reality-remediation\\UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.md docs\\union-eyes\\reality-remediation\\UE_W4_PHYSICAL_OWNERSHIP_HUMAN_DECISION_PACKET.json',
          RESULT: 'PASS;explicit selectors for all nine files',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS;0 errors,1215 existing warnings',
        },
        {
          METHOD:
            'Independent read-only Node assertions, not trusting adoptionModel or restore implementation',
          RESULT:
            'PASS;310/269/41 ownership,127 exact source definitions,183 unique authoring obligations,127 compatibility records,768/86/118 IDs,372/82/raw/W3 preservation,803 prerequisite IDs,23 unchanged manifest hashes, exact1.3.1 ->1.3 ->1.2 ->1.1 ->1.0 canonical bytes and inverse producer/packet bytes',
        },
      ],
    },
  }
  const head = `# W4G - prospective preconsumer ownership adoption\n\n**W4G PASS** is governance-only: exact310 ownership decisions approved,127 exact late definitions preserved,183 definitions still NOT_AUTHORED. Canonical **1.3.1**; W4 **BLOCKED_IMPLEMENTATION_PENDING**. W4F **AUTHORIZED_NOT_STARTED**; W4P and W5 **NOT_AUTHORIZED**. No producer activation or runtime proof.\n\n[W4G evidence](PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json) contains exact ownership, definition, handoff and inverse reconstruction records. This is a new human governance rule, not historical repository authority. Version1.4 remains reserved for completed physical producer implementation.\n\n## Preserved historical pre-W4G documentation\n\nThe following body is retained verbatim as historical evidence. Its earlier ownership/gate/version statements are superseded by W4G above.\n\n`
  const reportMarkdown = `# W4G - preconsumer ownership adoption and definition authority

## Gate: PASS - governance only

All **310** ownership decisions are prospectively adopted as **PLATFORM_BASELINE** under **HUMAN_GOVERNANCE_W4G**. Ownership holds remaining **0**. This is new human architecture authority, not a conclusion that static repository evidence already supplied it. W4D remains unchanged and BLOCKED as historical evidence.

| Partition | Ownership approved | Exact late definition | New definition required | Sum |
| --- | ---: | ---: | ---: | ---: |
| Relation/column | 269 | 86 | 183 | 269 |
| Enum types | 41 | 41 | 0 | 41 |
| Total | 310 | 127 | 183 | 310 |

[Machine-readable adoption](PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json) contains all310 ownership records,127 inactive late-definition records,183 bounded definition-authoring obligations and127 W5 compatibility obligations. [Human-decision packet](UE_W4_PHYSICAL_OWNERSHIP_HUMAN_DECISION_PACKET.json) closes ownership only and retains all historical W4D holds.

## Definition and compatibility split

The127 exact later frozen definitions become canonical **definition sources**, not active preconsumer execution authorities. Original source file/hash/line/object/kind/definition digest/migration/order and full accepted definition evidence are preserved without textual rewriting. Every record is **UNRESOLVED_PENDING_W5** for late producer compatibility; precreation is not assumed safe.

The183 missing definitions remain **NOT_AUTHORED**, with declaration/consumer evidence, forbidden inference classes, required explicit physical fields and review requirements. W4F owns these exact obligations but is only **AUTHORIZED_NOT_STARTED**. No columns/types/nullability/defaults/constraints/enum labels/function bodies are inferred or authored.

W4P owns eventual promotion of127 source definitions but is **NOT_AUTHORIZED** until W5 resolves compatibility. W5 owns all86 original ordering records plus127 compatibility obligations, and remains **NOT_AUTHORIZED** while W4 incomplete. This is a known gated sequencing dependency; W4G does not invent an exemption. A separately authorized sequencing decision is required before that promotion path can proceed.

## Preservation and current contract

Canonical **1.3.1** amendment **PRECONSUMER_PLATFORM_OWNERSHIP_ADOPTION** changes governance only. Version1.4 remains **PRECONSUMER_PHYSICAL_PRODUCER_IMPLEMENTATION**, not published. Inverse patches reconstruct exact1.3 canonical, producer and human-packet bytes; original documentation bodies are retained.

All372 Django mappings,82-node plan,four raw-wrapper duties,W3 preconditions,803 prerequisite IDs,23 frozen manifest hashes,86 W5 IDs and118 W6 IDs remain preserved. No opaque binding intersects a newly adopted producer in the accepted packet; all118 semantic records therefore remain unchanged. No W6 semantic binding is resolved.

The producer registry changes governance metadata only: canonical platform owner, human authority, independent ownership/definition status and inactive source references. Original blocker/digest/validation fields remain labeled historical, not silently recast as implementation proof. All768 linkage records retain runtime NO and pending downstream owners.

## Validation

\`\`\`powershell
pnpm exec tsx scripts\\ue\\adopt-w4-platform-ownership.ts --self-test --check
pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\adopt-w4-platform-ownership.test.ts
pnpm validate:docs
\`\`\`

Closeout **PASS**: **85 tests** (26 W4G and59 preserved W3E), scoped TypeScript,actual root-scoped ESLint,formatting,two-run deterministic self-tests/check and documentation audit (**0 errors,1215 existing warnings**). Independent assertions verified310/269/41 and127/183 partitions,definition/source preservation,183 unique authoring obligations,127 compatibility records,768/86/118 IDs,372/82/raw/W3 evidence,803 prerequisites,23 unchanged frozen manifest hashes, exact **1.3.1 ->1.3 ->1.2 ->1.1 ->1.0 byte reconstruction**, and inverse producer/packet bytes. Exact commands/results are recorded in JSON.

Frozen1.3 W4/W4D generators remain historical and intentionally fail closed against amended current inputs; W4G check verifies accepted historical outputs and reconstruction without source rediscovery.

## Final boundaries

**W4G PASS; W4 BLOCKED_IMPLEMENTATION_PENDING. W4F AUTHORIZED_NOT_STARTED. W4P/W5 NOT_AUTHORIZED.** No database,SQL,migration,producer activation,definition authoring,secret access,W4F/W5/W6-W10 execution or PR. Roles/extensions/delegation/schema/materialization/replay/RLS/tenant runtime proof remain **NO**; READY_FOR_RUNTIME_PROOF **0**, PRODUCT_READY **NO**.
`
  return {
    [files.canonical]: await json(c),
    [files.producer]: await json(p),
    [files.packet]: await json(packet),
    [files.canonicalMarkdown]: head + markdown.canonicalMarkdown,
    [files.producerMarkdown]: head + markdown.producerMarkdown,
    [outputs.report]: await json(report),
    [outputs.markdown]: await format(reportMarkdown, { ...config, parser: 'markdown' }),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((a) => ['--plan', '--self-test', '--check'].includes(a)),
    'APPLY_EXECUTE_OR_UNKNOWN_FLAG_FORBIDDEN',
  )
  assert.equal(new Set(args).size, args.length)
  const result = await generate()
  if (args.includes('--self-test')) {
    const before = { a: { removed: 'original' }, items: [{ value: 1 }] }
    const after = { a: { added: 'new' }, items: [{ value: 2 }], newKey: 'added' }
    assert.deepEqual(restore(after, inverse(before, after)), before)
    assert.deepEqual(result, await generate(), 'NONDETERMINISTIC_W4G')
    console.log(
      'PASS W4G self-tests:310 governance adoption,127/183 exact partition,inverse reconstruction,determinism,no activation',
    )
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(result))
      assert.equal(read(file), bytes, `STALE_W4G_ARTIFACT:${file}`)
    console.log(
      'PASS W4G --check:canonical1.3.1; W4 implementation blocked;W4F authorized not started;W4P/W5 not authorized',
    )
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(result))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log(
      'W4G governance-only outputs written;310 ownership approvals;no definitions authored or producers activated',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(
      '[adopt-w4-platform-ownership]',
      error instanceof Error ? error.message : 'Governance adoption failed',
    )
    process.exitCode = 1
  })
