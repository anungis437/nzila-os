import { createHash } from 'node:crypto'
import {
  ProvisioningError,
  rejectSecretFields,
  verifySnapshot,
  type ProvisioningPlan,
  type Snapshot,
  type TargetDescriptor,
} from './governed-provisioning'

export type PayloadKind = 'TYPE_DEFINITION' | 'CREATE_RELATION' | 'ADD_COLUMN'
export type InspectionState =
  | 'ABSENT'
  | 'PRESENT_MATCHING'
  | 'PRESENT_DRIFTED'
  | 'PRECONDITION_MISSING'
export type PlannedAction = 'APPLY_CANONICAL_PAYLOAD' | 'VERIFY_ONLY' | 'FAIL_CLOSED'
export interface CanonicalPayload {
  PAYLOAD_ID: string
  PAYLOAD_KIND: PayloadKind
  PHYSICAL_IDENTITIES_PRODUCED: string[]
  DEPENDENCY_PAYLOAD_IDS: string[]
  DEFINITION_OBLIGATION_IDS: string[]
  DEFERRED_CONSTRAINT_HANDOFF_IDS: string[]
  SQL: string
  SQL_SHA256: string
}
export interface ColumnInvariant {
  name: string
  postgresType: string
  notNull: boolean
  defaultExpression: string | null
  identity: string
  generated: string
}
export interface UniqueInvariant {
  name: string | null
  columns: string[]
  deferrable: boolean
  initiallyDeferred: boolean
}
export interface PayloadInvariant {
  payload: CanonicalPayload
  schema: 'public'
  name: string
  enumMembers: string[] | null
  columns: ColumnInvariant[]
  uniqueConstraints: UniqueInvariant[]
  parentIdentity: string | null
  requiredExistingColumns: string[]
}
export interface CatalogColumn extends ColumnInvariant {
  dropped: boolean
}
export interface CatalogUnique extends UniqueInvariant {
  validated: boolean
  indexValid: boolean
  indexReady: boolean
  indexLive: boolean
  nullsNotDistinct: boolean
}
export interface CatalogRelation {
  schema: string
  name: string
  kind: string
  columns: CatalogColumn[]
  uniqueConstraints: CatalogUnique[]
}
export interface CatalogType {
  schema: string
  name: string
  kind: string
  enumMembers: string[]
}
export interface CatalogState {
  relations: CatalogRelation[]
  types: CatalogType[]
}
export interface PromotionContext {
  expectedTarget: TargetDescriptor
  actualTarget: TargetDescriptor
  currentUser: string
  currentRole: string
  migrationLogin: string
  migrationPrincipal: string
  authenticated: boolean
  fullDjangoGraphVerified: boolean
  provisioningPlan: ProvisioningPlan
  provisioningSnapshot: Snapshot
}
export interface PromotionSpecification {
  contractVersion: string
  payloadRegistryDigest: string
  downstreamObligationDigest: string
  dependencyCutDigest: string
  invariants: PayloadInvariant[]
  obligationIds: string[]
  requiredExtensions: string[]
  searchPath: string[]
  targetBinding: {
    DATABASE_SCOPE_ID: string
    DATABASE_ACTOR_ID: string
    TARGET_ID: string
    SEARCH_PATH_CONTRACT_ID: string
  }
}
export interface Inspection {
  PAYLOAD_ID: string
  STATE: InspectionState
  PLANNED_ACTION: PlannedAction
  REASONS: string[]
  EXTRA_CONTEXTUAL_STATE: 'OBSERVED_NOT_REAUTHORED'
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const sqlHash = (value: string) => createHash('sha256').update(value).digest('hex')
export const canonicalPayloadCommitment =
  '6005cf57ee40d59a811947c61fa78652a89e6b66ca6222e8eddda92a430d80d5'
function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new ProvisioningError(code)
}
function splitClauses(value: string): string[] {
  const result: string[] = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let index = 0; index < value.length; index++) {
    const char = value[index]
    if (quote) {
      if (char === quote && value[index + 1] === quote) index++
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") quote = char
    else if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === ',' && depth === 0) {
      result.push(value.slice(start, index).trim())
      start = index + 1
    }
    requireCondition(depth >= 0, 'INVALID_CANONICAL_CLAUSE')
  }
  requireCondition(depth === 0 && !quote, 'INVALID_CANONICAL_CLAUSE')
  result.push(value.slice(start).trim())
  return result
}
export function compileInvariant(payload: CanonicalPayload): PayloadInvariant {
  requireCondition(sqlHash(payload.SQL) === payload.SQL_SHA256, 'CANONICAL_SQL_HASH_DRIFT')
  if (payload.PAYLOAD_KIND === 'TYPE_DEFINITION') {
    const match = /^CREATE TYPE "public"\."([a-z_][a-z0-9_]*)" AS ENUM \(([\s\S]+)\);$/.exec(
      payload.SQL,
    )
    requireCondition(match, 'UNSUPPORTED_CANONICAL_TYPE_DDL')
    const members = splitClauses(match[2]).map((member) => {
      requireCondition(/^'(?:[^']|'')*'$/.test(member), 'INVALID_CANONICAL_ENUM_MEMBER')
      return member.slice(1, -1).replaceAll("''", "'")
    })
    return {
      payload,
      schema: 'public',
      name: match[1],
      enumMembers: members,
      columns: [],
      uniqueConstraints: [],
      parentIdentity: null,
      requiredExistingColumns: [],
    }
  }
  const match =
    payload.PAYLOAD_KIND === 'CREATE_RELATION'
      ? /^CREATE TABLE "public"\."([a-z_][a-z0-9_]*)" \(\n([\s\S]+)\n\);$/.exec(payload.SQL)
      : /^ALTER TABLE "public"\."([a-z_][a-z0-9_]*)"\n([\s\S]+);$/.exec(payload.SQL)
  requireCondition(match, 'UNSUPPORTED_CANONICAL_RELATION_DDL')
  const columns: ColumnInvariant[] = []
  const uniqueConstraints: UniqueInvariant[] = []
  for (let clause of splitClauses(match[2])) {
    if (payload.PAYLOAD_KIND === 'ADD_COLUMN') {
      requireCondition(clause.startsWith('ADD '), 'UNSUPPORTED_CANONICAL_ALTER_OPERATION')
      clause = clause.slice(4).replace(/^COLUMN /, '')
    }
    const column =
      /^"([a-z_][a-z0-9_]*)" (uuid(?:\[\])?|text|character varying\(\d+\))(?: DEFAULT ('(?:[^']|'')*'))?( NOT NULL)?$/.exec(
        clause,
      )
    if (column) {
      columns.push({
        name: column[1],
        postgresType: column[2],
        notNull: !!column[4],
        defaultExpression: column[3] ?? null,
        identity: '',
        generated: '',
      })
      continue
    }
    const constraint = /^(?:CONSTRAINT "([a-z_][a-z0-9_]*)" )?UNIQUE \((.+)\)$/.exec(clause)
    requireCondition(constraint, 'UNSUPPORTED_CANONICAL_MATERIALIZED_INVARIANT')
    const names = splitClauses(constraint[2]).map((name) => {
      requireCondition(/^"[a-z_][a-z0-9_]*"$/.test(name), 'INVALID_UNIQUE_OPERAND')
      return name.slice(1, -1)
    })
    uniqueConstraints.push({
      name: constraint[1] ?? null,
      columns: names,
      deferrable: false,
      initiallyDeferred: false,
    })
  }
  requireCondition(columns.length > 0, 'REQUIRED_W4_COLUMNS_MISSING')
  const produced = new Set(payload.PHYSICAL_IDENTITIES_PRODUCED)
  for (const column of columns)
    requireCondition(
      produced.has(`union-eyes::COLUMN::public.${match[1]}.${column.name}`),
      'UNAUTHORIZED_COLUMN_IN_PAYLOAD',
    )
  const requiredExistingColumns = [
    ...new Set(
      uniqueConstraints
        .flatMap((constraint) => constraint.columns)
        .filter((name) => !columns.some((column) => column.name === name)),
    ),
  ]
  return {
    payload,
    schema: 'public',
    name: match[1],
    enumMembers: null,
    columns,
    uniqueConstraints,
    parentIdentity:
      payload.PAYLOAD_KIND === 'ADD_COLUMN' ? `union-eyes::RELATION::public.${match[1]}` : null,
    requiredExistingColumns,
  }
}
export function validateSpecification(specification: PromotionSpecification): void {
  const payloads = specification.invariants.map((invariant) => invariant.payload)
  requireCondition(payloads.length === 162, 'PAYLOAD162_ACCOUNTING_FAILED')
  for (const [kind, expected] of [
    ['TYPE_DEFINITION', 36],
    ['CREATE_RELATION', 57],
    ['ADD_COLUMN', 69],
  ] as const)
    requireCondition(
      payloads.filter((payload) => payload.PAYLOAD_KIND === kind).length === expected,
      'PAYLOAD_KIND_ACCOUNTING_FAILED',
    )
  requireCondition(
    new Set(payloads.map((payload) => payload.PAYLOAD_ID)).size === 162,
    'DUPLICATE_PAYLOAD_ID',
  )
  const links = payloads.flatMap((payload) => payload.DEFINITION_OBLIGATION_IDS)
  requireCondition(
    links.length === 183 && new Set(links).size === 183,
    'OBLIGATION183_LINKAGE_FAILED',
  )
  requireCondition(
    hash([...links].sort()) === hash([...specification.obligationIds].sort()),
    'OBLIGATION_IDENTITY_DRIFT',
  )
  requireCondition(
    new Set(payloads.flatMap((payload) => payload.DEFERRED_CONSTRAINT_HANDOFF_IDS)).size === 7,
    'DEFERRED7_HANDOFF_LINKAGE_FAILED',
  )
  requireCondition(
    ['1.3.2', '1.3.3'].includes(specification.contractVersion),
    'UNAUTHORIZED_CONTRACT_VERSION',
  )
  for (const invariant of specification.invariants) {
    const payload = invariant.payload
    requireCondition(
      hash(compileInvariant(payload)) === hash(invariant),
      'INSPECTOR_CANONICAL_INVARIANT_DRIFT',
    )
    requireCondition(sqlHash(payload.SQL) === payload.SQL_SHA256, 'CANONICAL_SQL_HASH_DRIFT')
    requireCondition(
      !/\bIF\s+NOT\s+EXISTS\b|\bEXCEPTION\b/i.test(payload.SQL),
      'SILENT_COMPATIBILITY_PROHIBITED',
    )
    requireCondition(
      invariant.schema === 'public' && /^[a-z_][a-z0-9_]*$/.test(invariant.name),
      'INVALID_PHYSICAL_IDENTITY',
    )
    requireCondition(
      payload.SQL.startsWith(
        payload.PAYLOAD_KIND === 'TYPE_DEFINITION'
          ? `CREATE TYPE "public"."${invariant.name}"`
          : payload.PAYLOAD_KIND === 'CREATE_RELATION'
            ? `CREATE TABLE "public"."${invariant.name}"`
            : `ALTER TABLE "public"."${invariant.name}"`,
      ),
      'CANONICAL_QUALIFIED_TARGET_DRIFT',
    )
    requireCondition(
      payload.PAYLOAD_KIND === 'TYPE_DEFINITION'
        ? invariant.enumMembers !== null
        : invariant.enumMembers === null && invariant.columns.length > 0,
      'INSPECTOR_INVARIANT_MISSING',
    )
  }
  const authoritativePayloads = payloads
    .map((payload) => ({
      PAYLOAD_ID: payload.PAYLOAD_ID,
      PAYLOAD_KIND: payload.PAYLOAD_KIND,
      PHYSICAL_IDENTITIES_PRODUCED: payload.PHYSICAL_IDENTITIES_PRODUCED,
      DEPENDENCY_PAYLOAD_IDS: payload.DEPENDENCY_PAYLOAD_IDS,
      DEFINITION_OBLIGATION_IDS: payload.DEFINITION_OBLIGATION_IDS,
      DEFERRED_CONSTRAINT_HANDOFF_IDS: payload.DEFERRED_CONSTRAINT_HANDOFF_IDS,
      SQL: payload.SQL,
      SQL_SHA256: payload.SQL_SHA256,
    }))
    .sort((a, b) => (a.PAYLOAD_ID < b.PAYLOAD_ID ? -1 : a.PAYLOAD_ID > b.PAYLOAD_ID ? 1 : 0))
  requireCondition(
    hash(authoritativePayloads) === canonicalPayloadCommitment,
    'W4FR4_PAYLOAD_COMMITMENT_DRIFT',
  )
  requireCondition(
    specification.payloadRegistryDigest ===
      '6f81fde1377714e0fb63177cd976a010ec6db197bb8365ad340b8b40d4629e2b' &&
      specification.dependencyCutDigest ===
        '5c46b455408385fc7f199f7a81ea1402e065d92ccd3c9ff0ebc5882988ca8c05' &&
      specification.downstreamObligationDigest ===
        '2e10f3e40761c6b93bca473b263c262c2222f7b3a875e41ab268fa1b4448e043',
    'AUTHORITATIVE_REGISTRY_OR_CUT_DRIFT',
  )
  requireCondition(
    hash([...specification.requiredExtensions].sort()) ===
      hash(['btree_gin', 'pg_trgm', 'pgcrypto', 'uuid-ossp']) &&
      hash(specification.searchPath) === hash(['public', 'pg_catalog']) &&
      specification.targetBinding.DATABASE_SCOPE_ID === 'UE_OPERATIONAL' &&
      specification.targetBinding.DATABASE_ACTOR_ID === 'UE-W2-ACTOR-DJANGO_MIGRATION' &&
      specification.targetBinding.TARGET_ID === 'UE-W2-TARGET-UE_OPERATIONAL' &&
      specification.targetBinding.SEARCH_PATH_CONTRACT_ID === 'UE-W2-PATH-DJANGO_MIGRATION',
    'AUTHORITATIVE_W2_W3_PRECONDITION_DRIFT',
  )
  topologicalOrder(specification.invariants)
}
export function topologicalOrder(invariants: PayloadInvariant[]): PayloadInvariant[] {
  const layer = (kind: PayloadKind) =>
    kind === 'TYPE_DEFINITION' ? 0 : kind === 'CREATE_RELATION' ? 1 : 2
  const byId = new Map(invariants.map((record) => [record.payload.PAYLOAD_ID, record]))
  requireCondition(byId.size === invariants.length, 'DUPLICATE_PAYLOAD_ID')
  for (const invariant of invariants)
    for (const dependency of invariant.payload.DEPENDENCY_PAYLOAD_IDS) {
      const target = byId.get(dependency)
      requireCondition(target, 'UNRESOLVED_PAYLOAD_DEPENDENCY')
      requireCondition(
        layer(target.payload.PAYLOAD_KIND) <= layer(invariant.payload.PAYLOAD_KIND),
        'DEPENDENCY_LAYER_CONFLICT',
      )
    }
  const ordered: PayloadInvariant[] = []
  const seen = new Set<string>()
  while (ordered.length < invariants.length) {
    const ready = invariants
      .filter(
        (record) =>
          !seen.has(record.payload.PAYLOAD_ID) &&
          record.payload.DEPENDENCY_PAYLOAD_IDS.every((id) => seen.has(id)),
      )
      .sort(
        (a, b) =>
          layer(a.payload.PAYLOAD_KIND) - layer(b.payload.PAYLOAD_KIND) ||
          a.payload.PAYLOAD_ID.localeCompare(b.payload.PAYLOAD_ID, 'en'),
      )
    requireCondition(ready.length > 0, 'PAYLOAD_GRAPH_CYCLE')
    const selected = ready[0]
    seen.add(selected.payload.PAYLOAD_ID)
    ordered.push(selected)
  }
  return ordered
}
export function normalizeDefault(expression: string | null, postgresType: string): string | null {
  if (expression === null) return null
  if (
    postgresType === 'character varying(50)' &&
    ["'private'", "'private'::character varying", "'private'::character varying(50)"].includes(
      expression.trim(),
    )
  )
    return "'private'"
  return expression.trim()
}
function uniqueMatches(expected: UniqueInvariant, actual: CatalogUnique): boolean {
  return (
    (expected.name === null || expected.name === actual.name) &&
    hash(expected.columns) === hash(actual.columns) &&
    expected.deferrable === actual.deferrable &&
    expected.initiallyDeferred === actual.initiallyDeferred &&
    actual.validated &&
    actual.indexValid &&
    actual.indexReady &&
    actual.indexLive &&
    !actual.nullsNotDistinct
  )
}
function columnDrift(expected: ColumnInvariant, actual: CatalogColumn): string[] {
  const reasons: string[] = []
  if (actual.postgresType !== expected.postgresType) reasons.push(`${expected.name}:TYPE_DRIFT`)
  if (actual.notNull !== expected.notNull) reasons.push(`${expected.name}:NULLABILITY_DRIFT`)
  if (
    normalizeDefault(actual.defaultExpression, actual.postgresType) !==
    normalizeDefault(expected.defaultExpression, expected.postgresType)
  )
    reasons.push(`${expected.name}:DEFAULT_DRIFT`)
  if (actual.identity !== expected.identity) reasons.push(`${expected.name}:IDENTITY_DRIFT`)
  if (actual.generated !== expected.generated) reasons.push(`${expected.name}:GENERATED_DRIFT`)
  return reasons
}
export function contextFailures(
  specification: PromotionSpecification,
  context: PromotionContext,
): string[] {
  rejectSecretFields(context.expectedTarget)
  rejectSecretFields(context.actualTarget)
  const failures: string[] = []
  const { PLAN_SHA256: provisioningDigest, ...provisioningBody } = context.provisioningPlan
  if (hash(provisioningBody) !== provisioningDigest)
    failures.push('W3_PROVISIONING_PLAN_DIGEST_DRIFT')
  if (context.provisioningPlan.GOVERNANCE_BLOCKERS.length) failures.push('W3_GOVERNANCE_BLOCKERS')
  if (
    context.provisioningPlan.DATABASE_SCOPE_ID !== 'UE_OPERATIONAL' ||
    !context.provisioningPlan.ROLE_SPECS.some(
      (role) =>
        role.ROLE_CLASS === 'MIGRATION_ADMIN' && role.SCHEMA_CREATE_EXPECTATION === 'public CREATE',
    ) ||
    context.provisioningPlan.PRINCIPALS.MIGRATION_ADMIN !== context.migrationPrincipal
  )
    failures.push('CANONICAL_W3_MIGRATION_AUTHORITY_REQUIRED')
  const binding = specification.targetBinding
  for (const key of [
    'DATABASE_SCOPE_ID',
    'DATABASE_ACTOR_ID',
    'TARGET_ID',
    'SEARCH_PATH_CONTRACT_ID',
  ] as const)
    if (context.expectedTarget[key] !== binding[key] || context.actualTarget[key] !== binding[key])
      failures.push(`TARGET_${key}_DRIFT`)
  if (hash(context.actualTarget) !== hash(context.expectedTarget))
    failures.push('EXACT_DEPLOYMENT_TARGET_DRIFT')
  if (
    !context.expectedTarget.HOST ||
    !context.expectedTarget.DATABASE_NAME ||
    !context.expectedTarget.ENVIRONMENT_ID ||
    !Number.isInteger(context.expectedTarget.PORT)
  )
    failures.push('EXPLICIT_DEPLOYMENT_BINDING_MISSING')
  if (hash(context.actualTarget.SEARCH_PATH) !== hash(specification.searchPath))
    failures.push('GOVERNED_SEARCH_PATH_DRIFT')
  if (
    context.actualTarget.ROLE_CLASS !== 'MIGRATION_ADMIN' ||
    context.expectedTarget.ROLE_CLASS !== 'MIGRATION_ADMIN'
  )
    failures.push('APPLICATION_RUNTIME_AUTHORITY_REJECTED')
  if (
    !context.authenticated ||
    context.currentUser !== context.migrationLogin ||
    context.currentRole !== context.migrationPrincipal ||
    !context.migrationLogin ||
    !context.migrationPrincipal
  )
    failures.push('AUTHENTICATED_MIGRATION_ACTOR_REQUIRED')
  if (!context.fullDjangoGraphVerified) failures.push('FULL_DJANGO_MACRO_PREDECESSOR_MISSING')
  const delegation = context.provisioningPlan.DELEGATION_BINDINGS.find(
    (record) =>
      record.ROLE_CLASS === 'MIGRATION_ADMIN' && record.DATABASE_SCOPE_ID === 'UE_OPERATIONAL',
  )
  if (
    !delegation ||
    delegation.AUTHORIZATION_ROLE !== context.migrationPrincipal ||
    delegation.LOGIN_PRINCIPAL !== context.migrationLogin
  )
    failures.push('EXACT_W3_DELEGATION_BINDING_REQUIRED')
  const extensions = context.provisioningPlan.EXTENSION_SPECS.map(
    (record) => record.EXTENSION,
  ).sort()
  if (hash(extensions) !== hash([...specification.requiredExtensions].sort()))
    failures.push('EXACT_W3_EXTENSION_SET_DRIFT')
  if (
    context.provisioningSnapshot.target.DATABASE_SCOPE_ID !== 'UE_OPERATIONAL' ||
    context.provisioningSnapshot.target.TARGET_ID !== context.actualTarget.TARGET_ID ||
    context.provisioningSnapshot.target.HOST !== context.actualTarget.HOST ||
    context.provisioningSnapshot.target.PORT !== context.actualTarget.PORT ||
    context.provisioningSnapshot.target.DATABASE_NAME !== context.actualTarget.DATABASE_NAME
  )
    failures.push('W3_SNAPSHOT_TARGET_DRIFT')
  try {
    verifySnapshot(context.provisioningPlan, context.provisioningSnapshot)
  } catch (error: unknown) {
    if (!(error instanceof ProvisioningError)) throw error
    failures.push(`W3_${error.code}`)
  }
  return failures
}
export function inspectPayload(
  invariant: PayloadInvariant,
  catalog: CatalogState,
  preconditionFailures: string[] = [],
): Inspection {
  const reasons = [...preconditionFailures]
  const result = (state: InspectionState, details: string[]): Inspection => ({
    PAYLOAD_ID: invariant.payload.PAYLOAD_ID,
    STATE: state,
    PLANNED_ACTION:
      state === 'ABSENT'
        ? 'APPLY_CANONICAL_PAYLOAD'
        : state === 'PRESENT_MATCHING'
          ? 'VERIFY_ONLY'
          : 'FAIL_CLOSED',
    REASONS: details,
    EXTRA_CONTEXTUAL_STATE: 'OBSERVED_NOT_REAUTHORED',
  })
  if (invariant.enumMembers) {
    if (reasons.length) return result('PRECONDITION_MISSING', reasons)
    const matches = catalog.types.filter(
      (type) => type.schema === invariant.schema && type.name === invariant.name,
    )
    requireCondition(matches.length <= 1, 'DUPLICATE_CATALOG_TYPE')
    if (!matches.length) return result('ABSENT', [])
    const type = matches[0]
    return type.kind === 'e' && hash(type.enumMembers) === hash(invariant.enumMembers)
      ? result('PRESENT_MATCHING', [])
      : result('PRESENT_DRIFTED', ['EXACT_ENUM_DEFINITION_DRIFT'])
  }
  const relations = catalog.relations.filter(
    (relation) => relation.schema === invariant.schema && relation.name === invariant.name,
  )
  requireCondition(relations.length <= 1, 'DUPLICATE_CATALOG_RELATION')
  const relation = relations[0]
  if (!relation && invariant.payload.PAYLOAD_KIND === 'ADD_COLUMN')
    reasons.push('ACCEPTED_PARENT_RELATION_ABSENT')
  if (relation && relation.kind !== 'r') return result('PRESENT_DRIFTED', ['RELATION_KIND_DRIFT'])
  const existing = relation?.columns.filter((column) => !column.dropped) ?? []
  if (relation)
    for (const name of invariant.requiredExistingColumns)
      if (!existing.some((column) => column.name === name))
        reasons.push(`MATERIALIZED_CONSTRAINT_OPERAND_MISSING:${name}`)
  if (reasons.length) return result('PRECONDITION_MISSING', reasons)
  if (!relation) return result('ABSENT', [])
  const missing = invariant.columns.filter(
    (column) => !existing.some((actual) => actual.name === column.name),
  )
  if (
    invariant.payload.PAYLOAD_KIND === 'ADD_COLUMN' &&
    missing.length === invariant.columns.length
  ) {
    if (
      invariant.uniqueConstraints.some((constraint) =>
        relation.uniqueConstraints.some(
          (actual) => constraint.name !== null && actual.name === constraint.name,
        ),
      )
    )
      return result('PRESENT_DRIFTED', ['CONSTRAINT_NAME_ALREADY_OCCUPIED'])
    return result('ABSENT', [])
  }
  const drift = missing.map((column) => `${column.name}:REQUIRED_W4_COLUMN_MISSING`)
  for (const column of invariant.columns) {
    const actual = existing.find((candidate) => candidate.name === column.name)
    if (actual) drift.push(...columnDrift(column, actual))
  }
  for (const constraint of invariant.uniqueConstraints)
    if (!relation.uniqueConstraints.some((actual) => uniqueMatches(constraint, actual)))
      drift.push(`MATERIALIZED_UNIQUE_DRIFT:${constraint.name ?? hash(constraint.columns)}`)
  return drift.length ? result('PRESENT_DRIFTED', drift) : result('PRESENT_MATCHING', [])
}
export interface PromotionPlan {
  PLAN_DIGEST: string
  CANONICAL_CONTRACT_VERSION: string
  PAYLOAD_REGISTRY_DIGEST: string
  DEPENDENCY_CUT_DIGEST: string
  PAYLOAD_ORDER: string[]
  PRECONDITIONS: string[]
  PRECONDITION_FAILURES: string[]
  PER_PAYLOAD_INSPECTION_RESULT: Inspection[]
  PER_PAYLOAD_PLANNED_ACTION: { PAYLOAD_ID: string; ACTION: PlannedAction }[]
  DEFERRED_POST_W4P_OBLIGATION_DIGEST: string
  MUTATION_COUNT: number
  PLAN_STATE: 'FAIL_CLOSED' | 'MUTATION_PLANNED' | 'REPLAY_NOOP'
}
export function planPromotion(
  specification: PromotionSpecification,
  catalog: CatalogState,
  context: PromotionContext,
): PromotionPlan {
  validateSpecification(specification)
  const preconditions = contextFailures(specification, context)
  const order = topologicalOrder(specification.invariants)
  const inspections: Inspection[] = []
  for (const invariant of order) {
    const missing = invariant.payload.DEPENDENCY_PAYLOAD_IDS.filter(
      (id) =>
        inspections.find((inspection) => inspection.PAYLOAD_ID === id)?.STATE !==
        'PRESENT_MATCHING',
    )
    inspections.push(
      inspectPayload(invariant, catalog, [
        ...preconditions,
        ...missing.map((id) => `PAYLOAD_DEPENDENCY_NOT_YET_SATISFIED:${id}`),
      ]),
    )
  }
  const mutationCount = inspections.filter((inspection) => inspection.STATE === 'ABSENT').length
  const body = {
    CANONICAL_CONTRACT_VERSION: specification.contractVersion,
    PAYLOAD_REGISTRY_DIGEST: specification.payloadRegistryDigest,
    DEPENDENCY_CUT_DIGEST: specification.dependencyCutDigest,
    PAYLOAD_ORDER: order.map((record) => record.payload.PAYLOAD_ID),
    PRECONDITIONS: [
      `EXACT_DEPLOYMENT_TARGET:${hash(context.expectedTarget)}`,
      `DATABASE_SCOPE:${specification.targetBinding.DATABASE_SCOPE_ID}`,
      `DATABASE_ACTOR:${specification.targetBinding.DATABASE_ACTOR_ID}`,
      `TARGET_ID:${specification.targetBinding.TARGET_ID}`,
      `GOVERNED_SEARCH_PATH:${specification.searchPath.join(',')}`,
      `AUTHENTICATED_MIGRATION_PRINCIPAL:${context.migrationPrincipal}`,
      `EXTERNAL_LOGIN_PRINCIPAL:${context.migrationLogin}`,
      `W3_PROVISIONING_PLAN:${context.provisioningPlan.PLAN_SHA256}`,
      `W3_REQUIRED_EXTENSIONS:${[...specification.requiredExtensions].sort().join(',')}`,
      'FULL_CANONICAL_DJANGO_GRAPH:REQUIRED',
      ...order.flatMap((invariant) => [
        ...(invariant.parentIdentity
          ? [`ACCEPTED_PARENT_RELATION:${invariant.parentIdentity}`]
          : []),
        ...invariant.requiredExistingColumns.map(
          (name) => `MATERIALIZED_UNIQUE_OPERAND:public.${invariant.name}.${name}`,
        ),
        ...invariant.payload.DEPENDENCY_PAYLOAD_IDS.map((id) => `PAYLOAD_DEPENDENCY:${id}`),
      ]),
    ],
    PRECONDITION_FAILURES: preconditions,
    PER_PAYLOAD_INSPECTION_RESULT: inspections,
    PER_PAYLOAD_PLANNED_ACTION: inspections.map((inspection) => ({
      PAYLOAD_ID: inspection.PAYLOAD_ID,
      ACTION: inspection.PLANNED_ACTION,
    })),
    DEFERRED_POST_W4P_OBLIGATION_DIGEST: specification.downstreamObligationDigest,
    MUTATION_COUNT: mutationCount,
    PLAN_STATE: inspections.some((inspection) =>
      ['PRESENT_DRIFTED', 'PRECONDITION_MISSING'].includes(inspection.STATE),
    )
      ? ('FAIL_CLOSED' as const)
      : mutationCount
        ? ('MUTATION_PLANNED' as const)
        : ('REPLAY_NOOP' as const),
  }
  return { PLAN_DIGEST: hash(body), ...body }
}
export function verifyBaseline(
  specification: PromotionSpecification,
  catalog: CatalogState,
  context: PromotionContext,
) {
  const plan = planPromotion(specification, catalog, context)
  requireCondition(
    plan.PER_PAYLOAD_INSPECTION_RESULT.every((result) => result.STATE === 'PRESENT_MATCHING'),
    'FINAL_BASELINE_VERIFICATION_FAILED',
  )
  return {
    DEFINITIONS_VERIFIED: 183,
    TYPES_VERIFIED: 36,
    W4_OWNED_DRIFT: 0,
    MISSING_W4_PREREQUISITES: 0,
    DEFERRED_CONSTRAINTS_MATERIALIZED_ASSERTED: 0,
  }
}
export interface CatalogReader {
  query(sql: string, parameters: string[]): Promise<unknown[]>
}
export const catalogQueries = {
  type: `SELECT t.typtype AS kind, COALESCE((SELECT pg_catalog.json_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_catalog.pg_enum e WHERE e.enumtypid=t.oid), '[]'::pg_catalog.json) AS members FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=$1 AND t.typname=$2`,
  relation: `SELECT c.relkind AS kind FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2`,
  columns: `SELECT a.attname AS name, pg_catalog.format_type(a.atttypid,a.atttypmod) AS postgres_type, a.attnotnull AS not_null, pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expression, a.attidentity AS identity, a.attgenerated AS generated FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname=$1 AND c.relname=$2 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,
  unique: `SELECT con.conname AS name, con.condeferrable AS deferrable, con.condeferred AS initially_deferred, con.convalidated AS validated, i.indisvalid AS index_valid, i.indisready AS index_ready, i.indislive AS index_live, pg_catalog.pg_get_constraintdef(con.oid) LIKE 'UNIQUE NULLS NOT DISTINCT%' AS nulls_not_distinct, (SELECT pg_catalog.json_agg(a.attname ORDER BY k.ordinality) FROM pg_catalog.unnest(con.conkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_catalog.pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=k.attnum) AS columns FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_index i ON i.indexrelid=con.conindid WHERE n.nspname=$1 AND c.relname=$2 AND con.contype='u' ORDER BY con.conname`,
}
function row(value: unknown): Record<string, unknown> {
  requireCondition(
    !!value && typeof value === 'object' && !Array.isArray(value),
    'INVALID_CATALOG_ROW',
  )
  return Object.fromEntries(Object.entries(value))
}
function string(value: unknown): string {
  requireCondition(typeof value === 'string', 'INVALID_CATALOG_STRING')
  return value
}
function boolean(value: unknown): boolean {
  requireCondition(typeof value === 'boolean', 'INVALID_CATALOG_BOOLEAN')
  return value
}
function stringList(value: unknown): string[] {
  requireCondition(
    Array.isArray(value) && value.every((item) => typeof item === 'string'),
    'INVALID_CATALOG_STRING_ARRAY',
  )
  return value
}
export async function readCatalog(
  reader: CatalogReader,
  specification: PromotionSpecification,
): Promise<CatalogState> {
  validateSpecification(specification)
  const result: CatalogState = { types: [], relations: [] }
  for (const invariant of topologicalOrder(specification.invariants)) {
    const parameters = [invariant.schema, invariant.name]
    if (invariant.enumMembers) {
      const rows = await reader.query(catalogQueries.type, parameters)
      requireCondition(rows.length <= 1, 'DUPLICATE_CATALOG_TYPE')
      if (rows.length) {
        const data = row(rows[0])
        result.types.push({
          schema: invariant.schema,
          name: invariant.name,
          kind: string(data.kind),
          enumMembers: stringList(data.members),
        })
      }
      continue
    }
    if (
      result.relations.some(
        (relation) => relation.schema === invariant.schema && relation.name === invariant.name,
      )
    )
      continue
    const rows = await reader.query(catalogQueries.relation, parameters)
    requireCondition(rows.length <= 1, 'DUPLICATE_CATALOG_RELATION')
    if (!rows.length) continue
    const columns = (await reader.query(catalogQueries.columns, parameters)).map((value) => {
      const data = row(value)
      requireCondition(
        data.default_expression === null || typeof data.default_expression === 'string',
        'INVALID_CATALOG_DEFAULT',
      )
      return {
        name: string(data.name),
        postgresType: string(data.postgres_type),
        notNull: boolean(data.not_null),
        defaultExpression: data.default_expression,
        identity: string(data.identity),
        generated: string(data.generated),
        dropped: false,
      }
    })
    requireCondition(
      new Set(columns.map((column) => column.name)).size === columns.length,
      'DUPLICATE_CATALOG_COLUMN',
    )
    const constraints = (await reader.query(catalogQueries.unique, parameters)).map((value) => {
      const data = row(value)
      return {
        name: string(data.name),
        columns: stringList(data.columns),
        deferrable: boolean(data.deferrable),
        initiallyDeferred: boolean(data.initially_deferred),
        validated: boolean(data.validated),
        indexValid: boolean(data.index_valid),
        indexReady: boolean(data.index_ready),
        indexLive: boolean(data.index_live),
        nullsNotDistinct: boolean(data.nulls_not_distinct),
      }
    })
    result.relations.push({
      schema: invariant.schema,
      name: invariant.name,
      kind: string(row(rows[0]).kind),
      columns,
      uniqueConstraints: constraints,
    })
  }
  return result
}
export interface PayloadReceipt {
  PAYLOAD_ID: string
  PHYSICAL_IDENTITIES: string[]
  INSPECTION_STATE_BEFORE: InspectionState
  PLANNED_ACTION: PlannedAction
  ACTION_TAKEN: 'MUTATED' | 'NO_MUTATION'
  SQL_SHA256: string
  POSTCONDITION_STATE: InspectionState
  ERROR_CLASS: string | null
  ERROR_DETAIL_DIGEST: string | null
}
export interface PromotionReceipt {
  PROMOTION_RUN_ID: string
  PLAN_DIGEST: string
  CONTRACT_VERSION: string
  STARTED_AT: string
  COMPLETED_AT: string
  ACTOR_CLASS: 'MIGRATION_ADMIN'
  DATABASE_SCOPE: 'UE_OPERATIONAL'
  PAYLOAD_TOTAL: number
  ABSENT_COUNT: number
  PRESENT_MATCHING_COUNT: number
  DRIFT_COUNT: number
  PRECONDITION_MISSING_COUNT: number
  MUTATED_COUNT: number
  NOOP_COUNT: number
  FINAL_VERIFICATION: ReturnType<typeof verifyBaseline>
  ROLLBACK_OCCURRED: boolean
  PAYLOADS: PayloadReceipt[]
}
export interface PromotionClient extends CatalogReader {
  context(): Promise<PromotionContext>
  execute(sql: string): Promise<void>
}
export interface PromotionAdapter {
  // Future W8 owns authentication, exclusive execution and rollback-on-rejection on one pinned client.
  withExclusiveTransaction<T>(work: (client: PromotionClient) => Promise<T>): Promise<T>
}
export interface ExecutionAuthorization {
  purpose: 'W4P_PLATFORM_BASELINE_APPLY'
  planDigest: string
  payloadRegistryDigest: string
  targetDigest: string
  actorPrincipal: string
  executionApproved: true
}
export class PromotionExecutionError extends ProvisioningError {
  constructor(
    code: string,
    public readonly failure: {
      PLAN_DIGEST: string
      ERROR_CLASS: string
      ERROR_DETAIL_DIGEST: string
      PAYLOADS: PayloadReceipt[]
      ROLLBACK_REQUIRED: true
    },
  ) {
    super(code)
  }
}
export async function applyPromotion(
  specification: PromotionSpecification,
  expectedPlan: PromotionPlan,
  expectedContext: PromotionContext,
  adapter: PromotionAdapter,
  authorization?: ExecutionAuthorization,
  clock: () => string = () => new Date().toISOString(),
): Promise<PromotionReceipt> {
  requireCondition(
    authorization?.executionApproved === true &&
      authorization.purpose === 'W4P_PLATFORM_BASELINE_APPLY',
    'EXPLICIT_EXECUTION_AUTHORIZATION_REQUIRED',
  )
  specification = structuredClone(specification)
  expectedPlan = structuredClone(expectedPlan)
  expectedContext = structuredClone(expectedContext)
  authorization = structuredClone(authorization)
  validateSpecification(specification)
  const { PLAN_DIGEST, ...body } = expectedPlan
  requireCondition(hash(body) === PLAN_DIGEST, 'PLAN_DIGEST_DRIFT')
  requireCondition(
    authorization.planDigest === PLAN_DIGEST &&
      authorization.payloadRegistryDigest === specification.payloadRegistryDigest &&
      authorization.targetDigest === hash(expectedContext.expectedTarget) &&
      authorization.actorPrincipal === expectedContext.migrationPrincipal,
    'EXECUTION_AUTHORIZATION_BINDING_DRIFT',
  )
  requireCondition(expectedPlan.PLAN_STATE !== 'FAIL_CLOSED', 'PROMOTION_PLAN_FAIL_CLOSED')
  requireCondition(
    contextFailures(specification, expectedContext).length === 0,
    'PROMOTION_CONTEXT_PRECONDITION_FAILED',
  )
  requireCondition(
    adapter && typeof adapter.withExclusiveTransaction === 'function',
    'EXTERNAL_CONCURRENCY_TRANSACTION_BOUNDARY_REQUIRED',
  )
  const receipts: PayloadReceipt[] = []
  const started = clock()
  try {
    return await adapter.withExclusiveTransaction(async (client) => {
      const context = await client.context()
      requireCondition(
        hash(context.actualTarget) === hash(expectedContext.actualTarget) &&
          context.migrationLogin === expectedContext.migrationLogin &&
          context.migrationPrincipal === expectedContext.migrationPrincipal,
        'AUTHENTICATED_EXECUTION_CONTEXT_DRIFT',
      )
      const before = await readCatalog(client, specification)
      const livePlan = planPromotion(specification, before, context)
      requireCondition(
        livePlan.PLAN_DIGEST === expectedPlan.PLAN_DIGEST && livePlan.PLAN_STATE !== 'FAIL_CLOSED',
        'PROMOTION_STATE_CHANGED_REPLAN_REQUIRED',
      )
      for (const invariant of topologicalOrder(specification.invariants)) {
        const initial = livePlan.PER_PAYLOAD_INSPECTION_RESULT.find(
          (result) => result.PAYLOAD_ID === invariant.payload.PAYLOAD_ID,
        )
        requireCondition(initial, 'PAYLOAD_INSPECTION_MISSING')
        requireCondition(
          sqlHash(invariant.payload.SQL) === invariant.payload.SQL_SHA256,
          'CANONICAL_SQL_HASH_DRIFT',
        )
        const receipt: PayloadReceipt = {
          PAYLOAD_ID: invariant.payload.PAYLOAD_ID,
          PHYSICAL_IDENTITIES: invariant.payload.PHYSICAL_IDENTITIES_PRODUCED,
          INSPECTION_STATE_BEFORE: initial.STATE,
          PLANNED_ACTION: initial.PLANNED_ACTION,
          ACTION_TAKEN: 'NO_MUTATION',
          SQL_SHA256: invariant.payload.SQL_SHA256,
          POSTCONDITION_STATE: initial.STATE,
          ERROR_CLASS: null,
          ERROR_DETAIL_DIGEST: null,
        }
        receipts.push(receipt)
        if (initial.STATE === 'ABSENT') {
          await client.execute(invariant.payload.SQL)
          receipt.ACTION_TAKEN = 'MUTATED'
        }
      }
      const afterContext = await client.context()
      requireCondition(
        hash(afterContext.expectedTarget) === hash(expectedContext.expectedTarget) &&
          hash(afterContext.actualTarget) === hash(expectedContext.actualTarget) &&
          afterContext.migrationLogin === expectedContext.migrationLogin &&
          afterContext.migrationPrincipal === expectedContext.migrationPrincipal,
        'FINAL_AUTHENTICATED_EXECUTION_CONTEXT_DRIFT',
      )
      const after = await readCatalog(client, specification)
      const verified = verifyBaseline(specification, after, afterContext)
      for (const receipt of receipts) receipt.POSTCONDITION_STATE = 'PRESENT_MATCHING'
      return {
        PROMOTION_RUN_ID: hash({ PLAN_DIGEST, started, target: authorization.targetDigest }),
        PLAN_DIGEST,
        CONTRACT_VERSION: specification.contractVersion,
        STARTED_AT: started,
        COMPLETED_AT: clock(),
        ACTOR_CLASS: 'MIGRATION_ADMIN',
        DATABASE_SCOPE: 'UE_OPERATIONAL',
        PAYLOAD_TOTAL: receipts.length,
        ABSENT_COUNT: receipts.filter((receipt) => receipt.INSPECTION_STATE_BEFORE === 'ABSENT')
          .length,
        PRESENT_MATCHING_COUNT: receipts.filter(
          (receipt) => receipt.INSPECTION_STATE_BEFORE === 'PRESENT_MATCHING',
        ).length,
        DRIFT_COUNT: 0,
        PRECONDITION_MISSING_COUNT: 0,
        MUTATED_COUNT: receipts.filter((receipt) => receipt.ACTION_TAKEN === 'MUTATED').length,
        NOOP_COUNT: receipts.filter((receipt) => receipt.ACTION_TAKEN === 'NO_MUTATION').length,
        FINAL_VERIFICATION: verified,
        ROLLBACK_OCCURRED: false,
        PAYLOADS: receipts,
      }
    })
  } catch (error: unknown) {
    const code =
      error instanceof ProvisioningError ? error.code : 'PROMOTION_FAILED_DETAILS_REDACTED'
    const last = receipts.at(-1)
    if (last) {
      last.ERROR_CLASS = code
      last.ERROR_DETAIL_DIGEST = hash(code)
    }
    throw new PromotionExecutionError(code, {
      PLAN_DIGEST,
      ERROR_CLASS: code,
      ERROR_DETAIL_DIGEST: hash(code),
      PAYLOADS: receipts,
      ROLLBACK_REQUIRED: true,
    })
  }
}
