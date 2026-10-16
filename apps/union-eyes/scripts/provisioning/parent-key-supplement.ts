import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash } from './post-w4p-replay'
import { catalogQueries, type CatalogReader } from './platform-baseline-promotion'

export const authorizedParentRelations = [
  'allocation_rules',
  'allocation_runs',
  'commercial_contracts',
  'committee_meetings',
  'correspondence',
  'duplicate_groups',
  'ingestion_batches',
  'platform_invoices',
  'platform_payments',
  'reconciliation_runs',
] as const
export type ParentRelation = (typeof authorizedParentRelations)[number]
export type KeyInspectionState =
  | 'KEY_PRESENT_EXACT'
  | 'KEY_ABSENT_SAFE_TO_CREATE'
  | 'KEY_PRESENT_DRIFTED'
  | 'KEY_ABSENT_AMBIGUOUS_DATA_STATE'
  | 'PRECONDITION_MISSING'
export interface ParentKeyDefinition {
  relation: ParentRelation
  authorityDigest: string
  sql: string
  sqlDigest: string
  expectedBaselineDigest: string
  expectedBaselineColumns: string[]
}
export interface SupplementSpecification {
  supplementId: string
  graphDigest: string
  parentW4pDigest: string
  definitions: ParentKeyDefinition[]
}
export interface ParentKeyCatalog {
  relation: ParentRelation
  scope: string
  relationExists: boolean
  baselineDigest: string
  freshShapeMatches: boolean
  rowCount: string
  primaryKeyColumns: string[]
  primaryKeyValidated: boolean
  primaryIndexValid: boolean
  primaryIndexReady: boolean
  primaryIndexLive: boolean
  primaryKeyDeferrable: boolean
  conflictingUniqueOnId: boolean
  defaultFunctionAvailable: boolean
  column: null | {
    postgresType: string
    notNull: boolean
    defaultExpression: string | null
    defaultFunctionSchema: string | null
    defaultFunctionName: string | null
    defaultFunctionProvenance: string
    identity: string
    generated: string
    collation: string | null
    foreignKeys: string[]
    explicitAcl: string[]
  }
}
export interface SupplementContext {
  targetDigest: string
  scope: 'UE_OPERATIONAL'
  actorClass: 'MIGRATION_ADMIN'
  actorPrincipal: string
  w4pVerificationDigest: string
  w4pPlanDigest: string
  w4pVerified: boolean
  exclusiveExecutionReference: string
}
export interface SupplementAuthorization {
  purpose: 'PRE_W5_PARENT_KEY_SUPPLEMENT'
  planDigest: string
  authorityDigest: string
  graphDigest: string
  targetDigest: string
  actorPrincipal: string
  w4pVerificationDigest: string
  executionApproved: true
}
export interface ParentKeyClient extends CatalogReader {
  context(): Promise<SupplementContext>
  execute(sql: string): Promise<void>
}
export interface ParentKeyAdapter {
  withExclusiveTransaction<T>(work: (client: ParentKeyClient) => Promise<T>): Promise<T>
}
export interface SupplementReceipt {
  SUPPLEMENT_ID: string
  PLAN_DIGEST: string
  AUTHORITY_DIGEST: string
  GRAPH_DIGEST: string
  W4P_VERIFICATION_DIGEST: string
  TARGET_SCOPE: 'UE_OPERATIONAL'
  TARGET_DIGEST: string
  KEY_STATE_DIGESTS: { PHYSICAL_IDENTITY: string; DIGEST: string }[]
  EXECUTED_PRODUCER_IDS: string[]
  POSTCONDITION_DIGEST: string
  ACTOR_CLASS: 'MIGRATION_ADMIN'
  ACTOR_PRINCIPAL: string
  EXCLUSIVE_EXECUTION_REFERENCE: string
  RECEIPT_DIGEST: string
}
function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new ProvisioningError(code)
}
export function parentKeySql(relation: ParentRelation) {
  return `ALTER TABLE "public"."${relation}" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY;`
}
export function validateSupplement(specification: SupplementSpecification) {
  requireCondition(specification.definitions.length === 10, 'PARENT_KEY_EXACT_TEN_REQUIRED')
  const names = specification.definitions.map((entry) => entry.relation)
  requireCondition(
    new Set(names).size === 10 &&
      authorizedParentRelations.every((relation) => names.includes(relation)),
    'PARENT_KEY_AUTHORIZED_IDENTITY_DRIFT',
  )
  for (const entry of specification.definitions) {
    requireCondition(
      /^[a-f0-9]{64}$/.test(entry.authorityDigest),
      'PARENT_KEY_AUTHORITY_DIGEST_INVALID',
    )
    requireCondition(
      entry.sql === parentKeySql(entry.relation) && replayHash(entry.sql) === entry.sqlDigest,
      'PARENT_KEY_SQL_AUTHORITY_DRIFT',
    )
    requireCondition(
      entry.expectedBaselineColumns.length === 1 &&
        entry.expectedBaselineColumns[0] === 'organization_id',
      'PARENT_KEY_W4P_PROJECTION_INVALID',
    )
  }
}
export const supplementPlanDigest = (specification: SupplementSpecification) => {
  validateSupplement(specification)
  return replayDigest(specification)
}
export const supplementAuthorityDigest = (specification: SupplementSpecification) =>
  replayDigest(
    specification.definitions.map((entry) => ({
      relation: entry.relation,
      authorityDigest: entry.authorityDigest,
    })),
  )
function keyStateDigest(catalog: ParentKeyCatalog) {
  const { rowCount: _rows, freshShapeMatches: _shape, ...definition } = catalog
  return replayDigest(definition)
}
export function inspectParentKey(
  definition: ParentKeyDefinition,
  catalog: ParentKeyCatalog,
  context: SupplementContext,
): KeyInspectionState {
  requireCondition(/^(0|[1-9]\d*)$/.test(catalog.rowCount), 'PARENT_KEY_INVALID_ROW_COUNT')
  if (
    !context.w4pVerified ||
    context.scope !== 'UE_OPERATIONAL' ||
    context.actorClass !== 'MIGRATION_ADMIN' ||
    !context.actorPrincipal ||
    !/^[a-f0-9]{64}$/.test(context.w4pVerificationDigest) ||
    catalog.relation !== definition.relation ||
    catalog.scope !== 'UE_OPERATIONAL' ||
    !catalog.relationExists ||
    !catalog.defaultFunctionAvailable
  )
    return 'PRECONDITION_MISSING'
  if (catalog.baselineDigest !== definition.expectedBaselineDigest) return 'KEY_PRESENT_DRIFTED'
  const column = catalog.column
  if (column) {
    const defaultExpression = column.defaultExpression?.replace(/\s+/g, '')
    const schema = column.defaultFunctionSchema
    const canonicalExpressions = [
      'gen_random_uuid()',
      `${schema}.gen_random_uuid()`,
      `"${schema}".gen_random_uuid()`,
    ]
    return column.postgresType === 'uuid' &&
      column.notNull &&
      canonicalExpressions.includes(defaultExpression ?? '') &&
      column.defaultFunctionName === 'gen_random_uuid' &&
      ((schema === 'pg_catalog' && column.defaultFunctionProvenance === 'POSTGRES_BUILTIN') ||
        (!!schema && column.defaultFunctionProvenance === 'PGCRYPTO_EXTENSION')) &&
      column.identity === '' &&
      column.generated === '' &&
      column.collation === null &&
      column.foreignKeys.length === 0 &&
      column.explicitAcl.length === 0 &&
      replayDigest(catalog.primaryKeyColumns) === replayDigest(['id']) &&
      catalog.primaryKeyValidated &&
      catalog.primaryIndexValid &&
      catalog.primaryIndexReady &&
      catalog.primaryIndexLive &&
      !catalog.primaryKeyDeferrable &&
      !catalog.conflictingUniqueOnId
      ? 'KEY_PRESENT_EXACT'
      : 'KEY_PRESENT_DRIFTED'
  }
  if (catalog.primaryKeyColumns.length || catalog.conflictingUniqueOnId)
    return 'KEY_PRESENT_DRIFTED'
  if (!catalog.freshShapeMatches) return 'KEY_PRESENT_DRIFTED'
  return catalog.rowCount === '0' ? 'KEY_ABSENT_SAFE_TO_CREATE' : 'KEY_ABSENT_AMBIGUOUS_DATA_STATE'
}
export function verifySupplementReceipt(
  receipt: SupplementReceipt,
  specification: SupplementSpecification,
  context: SupplementContext,
  catalog: ParentKeyCatalog[],
) {
  validateSupplement(specification)
  const { RECEIPT_DIGEST, ...body } = receipt
  if (
    RECEIPT_DIGEST !== replayDigest(body) ||
    receipt.SUPPLEMENT_ID !== specification.supplementId ||
    receipt.PLAN_DIGEST !== supplementPlanDigest(specification) ||
    receipt.AUTHORITY_DIGEST !== supplementAuthorityDigest(specification) ||
    receipt.GRAPH_DIGEST !== specification.graphDigest ||
    receipt.W4P_VERIFICATION_DIGEST !== context.w4pVerificationDigest ||
    receipt.TARGET_SCOPE !== context.scope ||
    receipt.TARGET_DIGEST !== context.targetDigest ||
    receipt.ACTOR_CLASS !== context.actorClass ||
    receipt.ACTOR_PRINCIPAL !== context.actorPrincipal ||
    receipt.EXCLUSIVE_EXECUTION_REFERENCE !== context.exclusiveExecutionReference ||
    !context.exclusiveExecutionReference ||
    context.w4pPlanDigest !== specification.parentW4pDigest ||
    catalog.length !== 10 ||
    new Set(catalog.map((entry) => entry.relation)).size !== 10
  )
    return false
  const states = specification.definitions.map((definition) => {
    const entry = catalog.find((entry) => entry.relation === definition.relation)
    return entry && inspectParentKey(definition, entry, context) === 'KEY_PRESENT_EXACT'
      ? { PHYSICAL_IDENTITY: `public.${definition.relation}.id`, DIGEST: keyStateDigest(entry) }
      : null
  })
  if (states.some((state) => state === null)) return false
  const executed = receipt.EXECUTED_PRODUCER_IDS
  return (
    new Set(executed).size === executed.length &&
    executed.every((id) =>
      specification.definitions.some((definition) => id === `PRE_W5_PK:${definition.relation}`),
    ) &&
    replayDigest(states) === replayDigest(receipt.KEY_STATE_DIGESTS) &&
    receipt.POSTCONDITION_DIGEST === replayDigest(states)
  )
}
export async function applyParentKeySupplement(
  specification: SupplementSpecification,
  expectedContext: SupplementContext,
  adapter: ParentKeyAdapter | undefined,
  authorization: SupplementAuthorization | undefined,
): Promise<SupplementReceipt> {
  validateSupplement(specification)
  requireCondition(authorization?.executionApproved, 'PARENT_KEY_EXECUTION_NOT_AUTHORIZED')
  requireCondition(
    authorization.purpose === 'PRE_W5_PARENT_KEY_SUPPLEMENT' &&
      authorization.planDigest === supplementPlanDigest(specification) &&
      authorization.authorityDigest === supplementAuthorityDigest(specification) &&
      authorization.graphDigest === specification.graphDigest &&
      authorization.targetDigest === expectedContext.targetDigest &&
      authorization.actorPrincipal === expectedContext.actorPrincipal &&
      authorization.w4pVerificationDigest === expectedContext.w4pVerificationDigest,
    'PARENT_KEY_AUTHORIZATION_BINDING_MISMATCH',
  )
  requireCondition(
    adapter && expectedContext.exclusiveExecutionReference,
    'PARENT_KEY_EXCLUSIVE_ADAPTER_REQUIRED',
  )
  return adapter.withExclusiveTransaction(async (client) => {
    const context = await client.context()
    requireCondition(
      replayDigest(context) === replayDigest(expectedContext),
      'PARENT_KEY_PINNED_CONTEXT_DRIFT',
    )
    requireCondition(
      context.w4pPlanDigest === specification.parentW4pDigest,
      'PARENT_KEY_W4P_PLAN_MISMATCH',
    )
    const before: ParentKeyCatalog[] = []
    for (const definition of specification.definitions)
      before.push(await readParentKeyCatalog(client, definition))
    const states = before.map((catalog, index) =>
      inspectParentKey(specification.definitions[index], catalog, context),
    )
    requireCondition(
      states.every(
        (state) => state === 'KEY_PRESENT_EXACT' || state === 'KEY_ABSENT_SAFE_TO_CREATE',
      ),
      'PARENT_KEY_PREFLIGHT_DENIED',
    )
    const executed: string[] = []
    for (let index = 0; index < specification.definitions.length; index++) {
      if (states[index] !== 'KEY_ABSENT_SAFE_TO_CREATE') continue
      const definition = specification.definitions[index]
      const immediatelyBefore = await readParentKeyCatalog(client, definition)
      requireCondition(
        inspectParentKey(definition, immediatelyBefore, context) === 'KEY_ABSENT_SAFE_TO_CREATE',
        'PARENT_KEY_PRE_SEND_DRIFT',
      )
      await client.execute(definition.sql)
      requireCondition(
        inspectParentKey(definition, await readParentKeyCatalog(client, definition), context) ===
          'KEY_PRESENT_EXACT',
        'PARENT_KEY_POSTCONDITION_FAILED',
      )
      executed.push(`PRE_W5_PK:${definition.relation}`)
    }

    const final: ParentKeyCatalog[] = []
    for (const definition of specification.definitions)
      final.push(await readParentKeyCatalog(client, definition))
    requireCondition(
      final.every(
        (catalog, index) =>
          inspectParentKey(specification.definitions[index], catalog, context) ===
          'KEY_PRESENT_EXACT',
      ),
      'PARENT_KEY_FINAL_VERIFICATION_FAILED',
    )
    const keyStates = final.map((catalog) => ({
      PHYSICAL_IDENTITY: `public.${catalog.relation}.id`,
      DIGEST: keyStateDigest(catalog),
    }))
    const body = {
      SUPPLEMENT_ID: specification.supplementId,
      PLAN_DIGEST: supplementPlanDigest(specification),
      AUTHORITY_DIGEST: supplementAuthorityDigest(specification),
      GRAPH_DIGEST: specification.graphDigest,
      W4P_VERIFICATION_DIGEST: context.w4pVerificationDigest,
      TARGET_SCOPE: context.scope,
      TARGET_DIGEST: context.targetDigest,
      KEY_STATE_DIGESTS: keyStates,
      EXECUTED_PRODUCER_IDS: executed,
      POSTCONDITION_DIGEST: replayDigest(keyStates),
      ACTOR_CLASS: context.actorClass,
      ACTOR_PRINCIPAL: context.actorPrincipal,
      EXCLUSIVE_EXECUTION_REFERENCE: context.exclusiveExecutionReference,
    }
    return { ...body, RECEIPT_DIGEST: replayDigest(body) }
  })
}

const functionProvenance = (alias: string) => `CASE
  WHEN ${alias}.pronamespace='pg_catalog'::pg_catalog.regnamespace AND ${alias}.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='internal') THEN 'POSTGRES_BUILTIN'
  WHEN EXISTS(SELECT 1 FROM pg_catalog.pg_depend dep JOIN pg_catalog.pg_extension ext ON ext.oid=dep.refobjid WHERE dep.classid='pg_catalog.pg_proc'::pg_catalog.regclass AND dep.objid=${alias}.oid AND dep.refclassid='pg_catalog.pg_extension'::pg_catalog.regclass AND dep.deptype='e' AND ext.extname='pgcrypto') THEN 'PGCRYPTO_EXTENSION'
  ELSE 'UNPROVEN' END`
export const genRandomUuidQuery = `SELECT ns.nspname AS schema,${functionProvenance('p')} AS origin,pg_catalog.has_function_privilege(p.oid,'EXECUTE') AS executable FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace WHERE p.oid=pg_catalog.to_regprocedure('gen_random_uuid()') AND p.pronargs=0 AND p.prorettype='pg_catalog.uuid'::pg_catalog.regtype`
export const parentKeyQueries = {
  relation: `SELECT c.relkind AS kind, NOT c.relispartition AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_inherits inh WHERE inh.inhrelid=c.oid OR inh.inhparent=c.oid) AS standalone FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2`,
  columns: catalogQueries.columns,
  count: (relation: ParentRelation) => `SELECT count(*)::text AS count FROM "public"."${relation}"`,
  primary: `SELECT con.convalidated AS validated, con.condeferrable AS deferrable, i.indisvalid AS valid, i.indisready AS ready, i.indislive AS live,
    (SELECT pg_catalog.json_agg(a.attname ORDER BY k.ordinality) FROM pg_catalog.unnest(con.conkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_catalog.pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=k.attnum) AS columns
    FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_index i ON i.indexrelid=con.conindid
    WHERE n.nspname=$1 AND c.relname=$2 AND con.contype='p'`,
  metadata: `SELECT
    COALESCE(resolved.origin IN ('POSTGRES_BUILTIN','PGCRYPTO_EXTENSION') AND resolved.executable,false) AS function_available,
    resolved.schema AS resolved_function_schema,resolved.origin AS resolved_function_provenance,
    (NOT c.relrowsecurity OR (SELECT r.rolsuper OR r.rolbypassrls FROM pg_catalog.pg_roles r WHERE r.rolname=current_user) OR (NOT c.relforcerowsecurity AND pg_catalog.pg_has_role(c.relowner,'USAGE'))) AS row_count_visible,
    a.attcollation AS collation, a.attacl::text AS acl,
    (SELECT pg_catalog.json_agg(con.conname) FROM pg_catalog.pg_constraint con WHERE con.conrelid=c.oid AND con.contype='f' AND a.attnum=ANY(con.conkey)) AS foreign_keys,
    EXISTS(SELECT 1 FROM pg_catalog.pg_index i WHERE i.indrelid=c.oid AND i.indisunique AND NOT i.indisprimary AND a.attnum=ANY(i.indkey)) AS other_unique,
    deployed.schema AS default_function_schema,deployed.origin AS default_function_provenance
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attname='id' AND NOT a.attisdropped
    LEFT JOIN LATERAL (${genRandomUuidQuery}) resolved ON true
    LEFT JOIN LATERAL (SELECT ns.nspname AS schema,${functionProvenance('p')} AS origin FROM pg_catalog.pg_attrdef d JOIN pg_catalog.pg_depend dep ON dep.classid='pg_catalog.pg_attrdef'::pg_catalog.regclass AND dep.objid=d.oid AND dep.refclassid='pg_catalog.pg_proc'::pg_catalog.regclass JOIN pg_catalog.pg_proc p ON p.oid=dep.refobjid JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace WHERE d.adrelid=c.oid AND d.adnum=a.attnum AND p.proname='gen_random_uuid' AND p.pronargs=0 AND p.prorettype='pg_catalog.uuid'::pg_catalog.regtype LIMIT 1) deployed ON true
    WHERE n.nspname=$1 AND c.relname=$2`,
}
const row = (value: unknown) => {
  requireCondition(
    value && typeof value === 'object' && !Array.isArray(value),
    'PARENT_KEY_INVALID_CATALOG_ROW',
  )
  return Object.fromEntries(Object.entries(value))
}
const stringValue = (value: unknown) => {
  requireCondition(typeof value === 'string', 'PARENT_KEY_INVALID_CATALOG_STRING')
  return value
}
const bool = (value: unknown) => {
  requireCondition(typeof value === 'boolean', 'PARENT_KEY_INVALID_CATALOG_BOOLEAN')
  return value
}
const list = (value: unknown) => {
  requireCondition(
    Array.isArray(value) && value.every((entry) => typeof entry === 'string'),
    'PARENT_KEY_INVALID_CATALOG_LIST',
  )
  return value
}
export async function readParentKeyCatalog(
  reader: CatalogReader,
  definition: ParentKeyDefinition,
): Promise<ParentKeyCatalog> {
  const relation = definition.relation
  requireCondition(authorizedParentRelations.includes(relation), 'PARENT_KEY_UNAUTHORIZED_RELATION')
  const parameters = ['public', relation]
  const relations = await reader.query(parentKeyQueries.relation, parameters)
  requireCondition(
    relations.length === 1 &&
      row(relations[0]).kind === 'r' &&
      row(relations[0]).standalone === true,
    'PARENT_KEY_TARGET_RELATION_REQUIRED',
  )
  const columns = (await reader.query(parentKeyQueries.columns, parameters)).map(row)
  requireCondition(
    new Set(columns.map((entry) => entry.name)).size === columns.length,
    'PARENT_KEY_DUPLICATE_CATALOG_COLUMN',
  )
  const baseline = columns
    .filter((entry) => definition.expectedBaselineColumns.includes(stringValue(entry.name)))
    .map((entry) => ({
      name: stringValue(entry.name),
      postgresType: stringValue(entry.postgres_type),
      notNull: bool(entry.not_null),
      defaultExpression:
        entry.default_expression === null ? null : stringValue(entry.default_expression),
      identity: stringValue(entry.identity),
      generated: stringValue(entry.generated),
    }))
  const counts = await reader.query(parentKeyQueries.count(relation), [])
  const metadata = await reader.query(parentKeyQueries.metadata, parameters)
  const primary = await reader.query(parentKeyQueries.primary, parameters)
  requireCondition(
    counts.length === 1 && metadata.length === 1 && primary.length <= 1,
    'PARENT_KEY_CATALOG_CARDINALITY',
  )
  const m = row(metadata[0]),
    p = primary[0] ? row(primary[0]) : null
  requireCondition(m.row_count_visible === true, 'PARENT_KEY_ROW_COUNT_VISIBILITY_NOT_PROVEN')
  const id = columns.find((entry) => entry.name === 'id')
  const defaultExpression = id?.default_expression
  const resolvedSchema =
    m.resolved_function_schema === null ? null : stringValue(m.resolved_function_schema)
  const canonicalDefault = [
    'gen_random_uuid()',
    `${resolvedSchema}.gen_random_uuid()`,
    `"${resolvedSchema}".gen_random_uuid()`,
    `${m.default_function_schema}.gen_random_uuid()`,
    `"${m.default_function_schema}".gen_random_uuid()`,
  ].includes(typeof defaultExpression === 'string' ? defaultExpression : '')
  // PostgreSQL built-ins can lack a pg_depend edge; only an attested resolved built-in supports that case.
  const builtinWithoutDependency =
    m.default_function_schema === null &&
    canonicalDefault &&
    resolvedSchema === 'pg_catalog' &&
    m.resolved_function_provenance === 'POSTGRES_BUILTIN' &&
    m.function_available === true
  const functionSchema = builtinWithoutDependency ? 'pg_catalog' : m.default_function_schema
  const provenance = builtinWithoutDependency ? 'POSTGRES_BUILTIN' : m.default_function_provenance
  return {
    relation,
    scope: 'UE_OPERATIONAL',
    relationExists: true,
    baselineDigest: replayDigest(baseline),
    freshShapeMatches:
      columns.filter((entry) => entry.name !== 'id').length ===
      definition.expectedBaselineColumns.length,
    rowCount: stringValue(row(counts[0]).count),
    primaryKeyColumns: p ? list(p.columns) : [],
    primaryKeyValidated: p ? bool(p.validated) : false,
    primaryIndexValid: p ? bool(p.valid) : false,
    primaryIndexReady: p ? bool(p.ready) : false,
    primaryIndexLive: p ? bool(p.live) : false,
    primaryKeyDeferrable: p ? bool(p.deferrable) : false,
    conflictingUniqueOnId: bool(m.other_unique),
    defaultFunctionAvailable: bool(m.function_available),
    column: id
      ? {
          postgresType: stringValue(id.postgres_type),
          notNull: bool(id.not_null),
          defaultExpression: defaultExpression === null ? null : stringValue(defaultExpression),
          defaultFunctionSchema: functionSchema === null ? null : stringValue(functionSchema),
          defaultFunctionName: canonicalDefault ? 'gen_random_uuid' : null,
          defaultFunctionProvenance: provenance === null ? 'UNPROVEN' : stringValue(provenance),
          identity: stringValue(id.identity),
          generated: stringValue(id.generated),
          collation: String(m.collation) === '0' ? null : String(m.collation),
          foreignKeys: m.foreign_keys === null ? [] : list(m.foreign_keys),
          explicitAcl: m.acl === null ? [] : [stringValue(m.acl)],
        }
      : null,
  }
}
