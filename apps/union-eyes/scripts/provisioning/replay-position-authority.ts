import { readFileSync } from 'node:fs'
import { ProvisioningError } from './governed-provisioning'
import type { CatalogReader } from './platform-baseline-promotion'
import type { ReplayExecutionContext } from './post-w4p-execution'
import { replayDigest, replayHash } from './post-w4p-replay'
import type { ReplayEffectComponent } from './replay-effect-registry'
import type { ReplayEffectPositionAuthority } from './replay-effect-inspection'
import { createCatalogQueries } from './replay-create-inspection'
import { compileOriginalRelation } from './replay-original-relation'
import {
  compileSchema,
  compileAddedColumn,
  compileForeignKey,
  compileSimpleIndex,
} from './replay-structural-effects'
import { compileRlsToggle, compilePolicyDrop } from './replay-rls-primitives'
import { compileLiteralPolicy } from './replay-literal-policy'
import { compileDefaultEffect } from './replay-default-inspection'
import { compileBackfill } from './replay-backfill-inspection'
import {
  compileFunctionEffect,
  functionCatalogQueries,
  inspectFunctionEffect,
  type FunctionAcl,
  type FunctionEffect,
  type FunctionPrerequisites,
} from './replay-function-inspection'
import { compileAclEffect, aclQueries, type AclPositionAuthority } from './replay-acl-inspection'
import {
  compilePolicyHelper,
  frozenHelperSources,
  helperCatalogQueries,
  inspectPolicyHelper,
  type HelperExpression,
  type HelperPositionContext,
} from './replay-policy-helper-inspection'
import {
  compileProceduralEffect,
  inspectProceduralEffect,
  proceduralQueries,
  categoryAggregateQuery,
  type ProceduralContext,
} from './replay-procedural-inspection'

/** These pins supplement, never replace, external target/W4P/supplement attestations.
 * Catalog observation cannot authenticate the baseline or acquire an exclusive lease.
 * The caller must run both captures inside its attested exclusive execution window. */
export interface ReplayPositionPin {
  execution: ReplayExecutionContext
  database: string
  searchPath: string[]
}
export interface ReplayPositionRead {
  sql: string
  parameters: string[]
  rows: unknown[]
}
export interface ReplayPositionSnapshot {
  phase: 'PREDECESSOR'
  bindingDigest: string
  pinDigest: string
  snapshotDigest: string
  reads: readonly ReplayPositionRead[]
  sourcePredecessorDigests: readonly string[]
}
export interface ReplayTriggerFunctionPredecessor {
  effect: ReplayEffectComponent
  predecessor: ReplayPositionSnapshot
}
export interface ReplayPositionDependencies {
  triggerFunction?: ReplayTriggerFunctionPredecessor
}
export type {
  CatalogReader,
  ReplayExecutionContext,
  ReplayEffectComponent,
  ReplayEffectPositionAuthority,
  FunctionAcl,
  FunctionPrerequisites,
  HelperPositionContext,
  AclPositionAuthority,
  ProceduralContext,
}
export type { ProceduralPredecessor } from './replay-procedural-inspection'
export interface ReplayPositionEvidence {
  authority: ReplayEffectPositionAuthority
  snapshotDigest: string
  predecessorDigest: string
  readSetDigest: string
  reads: readonly ReplayPositionRead[]
  sourcePredecessorDigests: readonly string[]
}

/** Only read-only catalog statements; exported so offline catalogs can implement
 * this exact observation protocol without running a database. */
export const positionAuthorityQueries = {
  snapshot: `SELECT pg_catalog.pg_current_snapshot()::text AS snapshot,pg_catalog.statement_timestamp()::text AS observed_at,pg_catalog.pg_backend_pid()::text AS backend`,
  schemas: `SELECT n.nspname AS name,pg_catalog.has_schema_privilege(n.oid,'USAGE') AS usable,pg_catalog.has_schema_privilege(n.oid,'CREATE') AS creatable FROM pg_catalog.pg_namespace n ORDER BY n.nspname`,
  actor: `SELECT rolname AS name,rolsuper AS superuser,rolbypassrls AS bypass_rls FROM pg_catalog.pg_roles WHERE rolname=current_user`,
  creation: `SELECT pg_catalog.current_schema()::text AS schema,pg_catalog.current_schemas(false)::text[] AS explicit_path`,
  ownerUsage: `SELECT rolname AS name,pg_catalog.pg_has_role(oid,'USAGE') AS usable FROM pg_catalog.pg_roles WHERE rolname=$1`,
  inventory: `SELECT n.nspname AS schema,c.relname AS name,c.relkind AS kind,r.rolname AS owner,c.relrowsecurity AS enabled,c.relforcerowsecurity AS forced,pg_catalog.pg_has_role(c.relowner,'USAGE') AS owner_usage,CASE WHEN c.relkind='S' THEN pg_catalog.has_sequence_privilege(c.oid,'SELECT') ELSE pg_catalog.has_table_privilege(c.oid,'SELECT') END AS selectable,pg_catalog.pg_table_is_visible(c.oid) AS visible FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_roles r ON r.oid=c.relowner WHERE c.relkind IN ('r','p','v','m','f','S') ORDER BY n.nspname,c.relname`,
  functionDefaults: `SELECT grantor.rolname AS grantor,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,a.privilege_type AS privilege,a.is_grantable AS grantable FROM pg_catalog.pg_roles owner JOIN pg_catalog.pg_namespace n ON n.nspname=$2 CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE((SELECT d.defaclacl FROM pg_catalog.pg_default_acl d WHERE d.defaclrole=owner.oid AND d.defaclnamespace=0 AND d.defaclobjtype='f'),pg_catalog.acldefault('f',owner.oid)) || COALESCE((SELECT d.defaclacl FROM pg_catalog.pg_default_acl d WHERE d.defaclrole=owner.oid AND d.defaclnamespace=n.oid AND d.defaclobjtype='f'),'{}'::pg_catalog.aclitem[])) a LEFT JOIN pg_catalog.pg_roles grantor ON grantor.oid=a.grantor LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid=a.grantee WHERE owner.rolname=$1 ORDER BY grantor.rolname,a.grantee,a.privilege_type,a.is_grantable`,
  schemaGrantor: `SELECT owner.rolname AS grantor FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_roles owner ON owner.oid=n.nspowner WHERE n.nspname=$1 AND pg_catalog.pg_has_role(owner.oid,'USAGE')`,
  databaseGrantor: `SELECT owner.rolname AS grantor FROM pg_catalog.pg_database d JOIN pg_catalog.pg_roles owner ON owner.oid=d.datdba WHERE d.datname=$1 AND pg_catalog.pg_has_role(owner.oid,'USAGE')`,
  foreignKeys: `SELECT con.oid::text AS oid,con.conname AS name,n.nspname AS child_schema,c.relname AS child_name,con.contype AS kind,con.convalidated AS validated,con.condeferrable AS deferrable,con.condeferred AS deferred,con.conislocal AS local,con.coninhcount AS inherited,con.confdeltype AS delete_action,con.confupdtype AS update_action,con.confmatchtype AS match,pn.nspname AS parent_schema,pc.relname AS parent_name,(SELECT pg_catalog.json_agg(a.attname ORDER BY k.ordinality) FROM pg_catalog.unnest(con.conkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_catalog.pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=k.attnum) AS columns,(SELECT pg_catalog.json_agg(a.attname ORDER BY k.ordinality) FROM pg_catalog.unnest(con.confkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_catalog.pg_attribute a ON a.attrelid=con.confrelid AND a.attnum=k.attnum) AS parent_columns FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_class pc ON pc.oid=con.confrelid JOIN pg_catalog.pg_namespace pn ON pn.oid=pc.relnamespace WHERE n.nspname=$1 AND c.relname=$2 AND con.contype='f' ORDER BY con.oid`,
}

type Row = Record<string, unknown>
type Facts = {
  reader: CatalogReader
  rawReader: CatalogReader
  reads: ReplayPositionRead[]
  pin: ReplayPositionPin
  effect: ReplayEffectComponent
  marker: Row
  creation: Row
  schemas: Row[]
  actor: Row
  inventory: Row[]
  function?: FunctionPrerequisites
  acl?: AclPositionAuthority
  relations: Record<string, string>
  visibility: Record<string, string>
  databaseGrantor?: string
  triggerFunction?: FunctionPrerequisites
  inlineForeignKey?: { name: string; oid: string }
  inlineColumnPresent?: boolean
  dependencies: ReplayPositionDependencies
  sourcePredecessorDigests: string[]
}
const snapshots = new WeakMap<ReplayPositionSnapshot, Facts>()
function ensure(value: unknown, code: string): asserts value {
  if (!value) throw new ProvisioningError(`REPLAY_POSITION_${code}`)
}
function row(value: unknown): Row {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), 'ROW_INVALID')
  return value as Row
}
function text(value: unknown): string {
  ensure(typeof value === 'string' && value.length > 0, 'TEXT_INVALID')
  return value
}
function boolean(value: unknown): boolean {
  ensure(typeof value === 'boolean', 'BOOLEAN_INVALID')
  return value
}
function equal(a: unknown, b: unknown): boolean {
  return replayDigest(a) === replayDigest(b)
}
function cloneInput<T>(value: T): T {
  try {
    return structuredClone(value)
  } catch {
    throw new ProvisioningError('REPLAY_POSITION_INPUT_NOT_CLONEABLE')
  }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}
function binding(effect: ReplayEffectComponent): string {
  try {
    return sourceBinding(effect)
  } catch (error) {
    if (error instanceof ProvisioningError) throw error
    throw new ProvisioningError('REPLAY_POSITION_SOURCE_CONTRACT_MALFORMED')
  }
}
function sourceBinding(effect: ReplayEffectComponent): string {
  row(effect)
  text(effect.source)
  text(effect.sourceHash)
  text(effect.effectId)
  text(effect.boundaryId)
  text(effect.sourcePath)
  row(effect.compiled)
  row(effect.compiled.contract)
  ensure(replayHash(effect.source) === effect.sourceHash, 'SOURCE_HASH_DRIFT')
  ensure(
    /^[a-f0-9]{64}$/.test(effect.boundaryHash) &&
      Number.isSafeInteger(effect.ordinal) &&
      effect.ordinal > 0 &&
      effect.effectId.length > 0 &&
      effect.boundaryId.length > 0 &&
      effect.sourcePath.length > 0,
    'BINDING_INVALID',
  )
  ensure(
    Array.isArray(effect.byteRange) &&
      effect.byteRange.length === 2 &&
      effect.byteRange.every((n) => Number.isSafeInteger(n) && n >= 0) &&
      effect.byteRange[1] - effect.byteRange[0] === Buffer.byteLength(effect.source),
    'SOURCE_BYTE_RANGE_INVALID',
  )
  const spec = effect.compiled
  switch (spec.kind) {
    case 'SCHEMA':
      ensure(
        equal(compileSchema(effect.source, effect.sourceHash), spec.contract),
        'CONTRACT_DRIFT',
      )
      break
    case 'RELATION': {
      // Recompile with the contract's declared named-type inputs, not observed
      // catalog types. This binds inputs; it does not authenticate enum authority.
      const enums = new Map<
        string,
        NonNullable<(typeof spec.contract.columns)[number]['type']['enum']>
      >()
      for (const column of spec.contract.columns) {
        const declaration = column.type.enum
        if (!declaration) continue
        const key = replayDigest([declaration.schema, declaration.name])
        ensure(
          !enums.has(key) || equal(enums.get(key), declaration),
          'CONTRACT_NAMED_TYPE_CONFLICT',
        )
        enums.set(key, declaration)
      }
      ensure(
        equal(
          compileOriginalRelation(effect.source, effect.sourceHash, [...enums.values()]),
          spec.contract,
        ),
        'CONTRACT_DRIFT',
      )
      break
    }
    case 'COLUMN':
      ensure(
        equal(compileAddedColumn(effect.source, effect.sourceHash), spec.contract),
        'CONTRACT_DRIFT',
      )
      break
    case 'FOREIGN_KEY':
      ensure(
        equal(compileForeignKey(effect.source, effect.sourceHash), spec.contract),
        'CONTRACT_DRIFT',
      )
      break
    case 'INDEX':
      ensure(
        equal(compileSimpleIndex(effect.source, effect.sourceHash), spec.contract),
        'CONTRACT_DRIFT',
      )
      break
    case 'RLS':
      ensure(
        equal(compileRlsToggle(effect.source, effect.sourceHash), spec.contract),
        'CONTRACT_DRIFT',
      )
      break
    case 'POLICY_DROP':
      ensure(
        equal(compilePolicyDrop(effect.source, effect.sourceHash), spec.contract),
        'CONTRACT_DRIFT',
      )
      break
    case 'POLICY_CREATE':
      ensure(
        equal(compileLiteralPolicy(effect.source, effect.sourceHash), spec.contract),
        'CONTRACT_DRIFT',
      )
      break
    case 'DEFAULT':
      ensure(
        equal(compileDefaultEffect(effect.source, effect.sourceHash), spec.contract),
        'CONTRACT_DRIFT',
      )
      break
    case 'BACKFILL':
      ensure(
        equal(compileBackfill(effect.source, effect.sourceHash), spec.contract),
        'CONTRACT_DRIFT',
      )
      break
    case 'FUNCTION':
      ensure(
        equal(compileFunctionEffect(effect.source, effect.sourceHash), spec.contract),
        'CONTRACT_DRIFT',
      )
      break
    case 'ACL':
      ensure(
        equal(compileAclEffect(effect.source, effect.sourceHash), spec.contract),
        'CONTRACT_DRIFT',
      )
      break
    case 'POLICY_HELPER': {
      const source = frozenHelperSources().functions.find(
        (s) => s.sourceHash === spec.contract.function.sourceHash,
      )
      ensure(source, 'SOURCE_HELPER_FUNCTION_BINDING_MISSING')
      ensure(
        equal(compilePolicyHelper(spec.contract.call, source), spec.contract) &&
          spec.contract.call.effectId === effect.effectId &&
          spec.contract.call.boundaryId === effect.boundaryId &&
          spec.contract.call.ordinal === effect.ordinal &&
          spec.contract.call.source === effect.source &&
          spec.contract.call.sourceHash === effect.sourceHash,
        'CONTRACT_DRIFT',
      )
      break
    }
    case 'PROCEDURAL':
      ensure(
        equal(compileProceduralEffect(effect.source, effect.sourceHash), spec.contract),
        'CONTRACT_DRIFT',
      )
      ensure(
        spec.contract.binding.effectId === effect.effectId &&
          spec.contract.binding.boundaryId === effect.boundaryId &&
          spec.contract.binding.sourcePath === effect.sourcePath &&
          spec.contract.binding.boundaryHash === effect.boundaryHash &&
          spec.contract.binding.ordinal === effect.ordinal,
        'BINDING_DRIFT',
      )
      break
    default:
      throw new ProvisioningError(`REPLAY_POSITION_EFFECT_KIND_UNSUPPORTED:${text(row(spec).kind)}`)
  }
  return replayDigest(effect)
}
function primitive(effect: ReplayEffectComponent): boolean {
  return !['FUNCTION', 'POLICY_HELPER', 'ACL', 'PROCEDURAL'].includes(effect.compiled.kind)
}
function validatePin(pin: ReplayPositionPin): void {
  row(pin)
  row(pin.execution)
  const e = pin.execution
  ensure(
    ['UE_OPERATIONAL', 'FINANCIAL_SERVICE'].includes(e.scope) &&
      e.actorClass === 'MIGRATION_ADMIN' &&
      text(e.actorPrincipal) &&
      text(e.exclusiveExecutionReference) &&
      [
        e.targetDigest,
        e.w4pPlanDigest,
        e.w4pVerificationDigest,
        e.supplementPlanDigest,
        e.supplementVerificationDigest,
      ].every((v) => /^[a-f0-9]{64}$/.test(v)),
    'EXTERNAL_ATTESTATION_BINDING_REQUIRED',
  )
  text(pin.database)
  ensure(
    Array.isArray(pin.searchPath) &&
      pin.searchPath.length > 0 &&
      pin.searchPath.every((s) => typeof s === 'string' && s.length > 0 && !/^pg_temp/.test(s)) &&
      new Set(pin.searchPath).size === pin.searchPath.length,
    'EXPECTED_PATH_INVALID',
  )
}
async function single(reader: CatalogReader, sql: string, params: string[]): Promise<Row> {
  const rows = await reader.query(sql, params)
  ensure(rows.length === 1, 'FACT_MISSING_OR_AMBIGUOUS')
  return row(rows[0])
}
async function capture(
  inputReader: CatalogReader,
  inputPin: ReplayPositionPin,
  inputEffect: ReplayEffectComponent,
  dependencies: ReplayPositionDependencies = {},
): Promise<Facts> {
  validatePin(inputPin)
  binding(inputEffect)
  const pin = cloneInput(inputPin)
  const effect = cloneInput(inputEffect)
  const reads: ReplayPositionRead[] = []
  const reader: CatalogReader = {
    async query(sql, parameters) {
      try {
        const rows = await inputReader.query(sql, [...parameters])
        ensure(Array.isArray(rows), 'ROWS_INVALID')
        const copied = structuredClone(rows)
        copied.forEach(row)
        reads.push(freeze({ sql, parameters: [...parameters], rows: copied }))
        return structuredClone(copied)
      } catch (error) {
        if (error instanceof ProvisioningError) throw error
        throw new ProvisioningError(`REPLAY_POSITION_CATALOG_READ_FAILED:${sql}`)
      }
    },
  }
  const marker = await single(reader, positionAuthorityQueries.snapshot, [])
  text(marker.snapshot)
  text(marker.observed_at)
  ensure(/^[1-9]\d*$/.test(text(marker.backend)), 'SNAPSHOT_BACKEND_INVALID')
  const identity = await single(reader, proceduralQueries.identity, [])
  ensure(
    identity.actor === pin.execution.actorPrincipal &&
      identity.database === pin.database &&
      equal(identity.search_path, pin.searchPath),
    'ACTUAL_IDENTITY_OR_PATH_DRIFT',
  )
  const facts: Facts = {
    reader,
    rawReader: inputReader,
    reads,
    pin,
    effect,
    marker,
    creation: {},
    schemas: [],
    actor: {},
    inventory: [],
    relations: {},
    visibility: {},
    dependencies,
    sourcePredecessorDigests: [],
  }
  if (primitive(effect)) return facts
  const creation = await single(reader, positionAuthorityQueries.creation, [])
  text(creation.schema)
  ensure(
    Array.isArray(creation.explicit_path) &&
      creation.explicit_path.length > 0 &&
      creation.explicit_path.every((s) => typeof s === 'string' && pin.searchPath.includes(s)) &&
      creation.explicit_path[0] === creation.schema,
    'ACTUAL_CREATION_PATH_INVALID',
  )
  const schemas = (await reader.query(positionAuthorityQueries.schemas, [])).map(row)
  const actor = await single(reader, positionAuthorityQueries.actor, [])
  ensure(actor.name === pin.execution.actorPrincipal, 'ACTOR_DRIFT')
  boolean(actor.superuser)
  boolean(actor.bypass_rls)
  ensure(new Set(schemas.map((s) => text(s.name))).size === schemas.length, 'SCHEMA_AMBIGUOUS')
  schemas.forEach((s) => {
    boolean(s.usable)
    boolean(s.creatable)
  })
  ensure(
    pin.searchPath.every((name) => schemas.some((s) => s.name === name && s.usable)),
    'PATH_SCHEMA_UNUSABLE',
  )
  const inventory = (await reader.query(positionAuthorityQueries.inventory, [])).map(row)
  for (const r of inventory) {
    text(r.schema)
    text(r.name)
    text(r.kind)
    text(r.owner)
    for (const field of ['enabled', 'forced', 'owner_usage', 'selectable', 'visible'])
      boolean(r[field])
    ensure(
      schemas.some((s) => s.name === r.schema),
      'INVENTORY_SCHEMA_DRIFT',
    )
  }
  ensure(
    new Set(inventory.map((r) => `${r.schema}.${r.name}`)).size === inventory.length,
    'INVENTORY_AMBIGUOUS',
  )
  return {
    ...facts,
    creation,
    schemas,
    actor,
    inventory,
  }
}
function creationSchema(f: Facts, explicit: string | null): string {
  // PostgreSQL chooses the first valid explicit search_path schema, not the
  // first schema on which CREATE succeeds.
  const schema = explicit ?? text(f.creation.schema)
  ensure(schema, 'CREATION_SCHEMA_MISSING')
  ensure(
    f.schemas.some((s) => s.name === schema && s.creatable),
    'SCHEMA_CREATE_PRIVILEGE_MISSING',
  )
  return schema
}
function acl(value: unknown): FunctionAcl[] {
  ensure(Array.isArray(value), 'FUNCTION_ACL_INVALID')
  const merged = new Map<string, FunctionAcl>()
  for (const v of value) {
    const r = row(v)
    ensure(r.privilege === 'EXECUTE', 'FUNCTION_ACL_INVALID')
    const entry: FunctionAcl = {
      grantor: text(r.grantor),
      grantee: text(r.grantee),
      privilege: 'EXECUTE',
      grantable: boolean(r.grantable),
    }
    const key = replayDigest([entry.grantor, entry.grantee])
    const prior = merged.get(key)
    merged.set(key, { ...entry, grantable: entry.grantable || prior?.grantable === true })
  }
  return [...merged.values()].sort(
    (a, b) =>
      a.grantor.localeCompare(b.grantor) ||
      a.grantee.localeCompare(b.grantee) ||
      Number(a.grantable) - Number(b.grantable),
  )
}
async function functionPrestate(f: Facts, spec: FunctionEffect): Promise<FunctionPrerequisites> {
  const schema = await functionSchema(f, spec)
  const candidates = (
    await f.reader.query(functionCatalogQueries.functions, [schema, spec.name])
  ).map(row)
  const signature = spec.arguments.map((a) => ({ schema: a.type.schema, name: a.type.name }))
  const matching = candidates.filter((r) => {
    ensure(r.schema === schema && r.name === spec.name, 'FUNCTION_IDENTITY_DRIFT')
    ensure(Array.isArray(r.argument_types), 'FUNCTION_SIGNATURE_INVALID')
    return equal(
      r.argument_types.map((t) => {
        const v = row(t)
        return { schema: text(v.schema), name: text(v.name) }
      }),
      signature,
    )
  })
  ensure(matching.length <= 1, 'FUNCTION_SIGNATURE_AMBIGUOUS')
  // Unknown literals/default arguments in helper calls can select another overload.
  ensure(candidates.length <= 1, 'FUNCTION_OVERLOAD_AMBIGUOUS')
  let owner = f.pin.execution.actorPrincipal
  let grants: FunctionAcl[]
  if (matching.length) {
    owner = text(matching[0].owner)
    grants = acl(matching[0].acl)
  } else {
    grants =
      spec.action === 'DROP_IF_EXISTS'
        ? []
        : acl(await f.reader.query(positionAuthorityQueries.functionDefaults, [owner, schema]))
  }
  const role = await single(f.reader, functionCatalogQueries.owner, [owner])
  ensure(role.name === owner, 'FUNCTION_OWNER_ROLE_DRIFT')
  const usage = await single(f.reader, positionAuthorityQueries.ownerUsage, [owner])
  ensure(usage.name === owner && boolean(usage.usable), 'FUNCTION_OWNER_MEMBERSHIP_REQUIRED')
  return { sourceHash: spec.sourceHash, schema, owner, acl: grants }
}
async function functionSchema(f: Facts, spec: FunctionEffect): Promise<string> {
  if (spec.action !== 'DROP_IF_EXISTS') return creationSchema(f, spec.schema)
  if (spec.schema) {
    ensure(
      f.schemas.some((s) => s.name === spec.schema),
      'DROP_SCHEMA_MISSING',
    )
    return spec.schema
  }
  const signature = spec.arguments.map((a) => ({ schema: a.type.schema, name: a.type.name }))
  const matches: string[] = []
  for (const schema of f.pin.searchPath) {
    const rows = await f.reader.query(functionCatalogQueries.functions, [schema, spec.name])
    for (const value of rows) {
      const r = row(value)
      ensure(r.schema === schema && r.name === spec.name, 'FUNCTION_IDENTITY_DRIFT')
      ensure(Array.isArray(r.argument_types), 'FUNCTION_SIGNATURE_INVALID')
      const args = r.argument_types.map((v) => {
        const t = row(v)
        return { schema: text(t.schema), name: text(t.name) }
      })
      if (equal(args, signature)) matches.push(schema)
    }
  }
  ensure(matches.length <= 1, 'DROP_FUNCTION_SHADOW_OR_AMBIGUITY')
  return matches[0] ?? text(f.creation.schema)
}
function resolve(f: Facts, name: string, required: boolean): string {
  const candidates = f.inventory.filter(
    (r) => r.name === name && f.pin.searchPath.includes(text(r.schema)),
  )
  const winner = candidates.sort(
    (a, b) => f.pin.searchPath.indexOf(text(a.schema)) - f.pin.searchPath.indexOf(text(b.schema)),
  )[0]
  ensure(!required || winner, `REQUIRED_RELATION_MISSING:${name}`)
  if (!winner) return f.pin.searchPath.find((s) => s !== 'pg_catalog') ?? f.pin.searchPath[0]
  // Conservative: never silently accept an earlier shadow of the source's public target.
  ensure(winner.visible && candidates.length === 1, `RELATION_SHADOW_OR_AMBIGUITY:${name}`)
  return text(winner.schema)
}
function helperParents(expression: HelperExpression | null, output: Set<string>): void {
  if (!expression) return
  for (const [key, value] of Object.entries(expression)) {
    if (expression.kind === 'exists' && key === 'table') output.add(text(value))
    if (Array.isArray(value))
      value.forEach((v) => {
        if (v && typeof v === 'object') helperParents(v as HelperExpression, output)
      })
    else if (value && typeof value === 'object') helperParents(value as HelperExpression, output)
  }
}
async function aclPrestate(f: Facts): Promise<AclPositionAuthority> {
  ensure(f.effect.compiled.kind === 'ACL', 'ACL_CONTRACT_REQUIRED')
  const spec = f.effect.compiled.contract
  ensure(spec.schema, 'SOURCE_ACL_SCHEMA_EVIDENCE_MISSING')
  for (const name of spec.roles.filter((r) => r !== 'public')) {
    ensure((await single(f.reader, aclQueries.role, [name])).name === name, 'ACL_ROLE_DRIFT')
  }
  ensure(
    f.schemas.some((s) => s.name === spec.schema),
    'ACL_SCHEMA_MISSING',
  )
  const objects: AclPositionAuthority['objects'] = []
  if (!spec.defaults) {
    if (spec.kind === 'SCHEMA') {
      const grantor = text(
        (await single(f.reader, positionAuthorityQueries.schemaGrantor, [spec.schema])).grantor,
      )
      objects.push({ schema: spec.schema, name: spec.schema, kind: 'SCHEMA', grantor })
    } else {
      const candidates = f.inventory.filter(
        (r) =>
          r.schema === spec.schema &&
          (spec.kind === 'SEQUENCE'
            ? r.kind === 'S'
            : ['r', 'p', 'v', 'm', 'f'].includes(text(r.kind))) &&
          (spec.all || r.name === spec.name),
      )
      ensure(spec.all || candidates.length === 1, 'ACL_OBJECT_MISSING')
      for (const r of candidates) {
        // Delegated grant-option chains need an independently resolved selected
        // grantor; ownership membership is the bounded unambiguous case here.
        ensure(r.owner_usage, `ACL_SELECTED_GRANTOR_EVIDENCE_MISSING:${r.schema}.${r.name}`)
        objects.push({
          schema: spec.schema,
          name: text(r.name),
          kind: spec.kind,
          grantor: text(r.owner),
        })
      }
    }
  }
  return {
    sourceHash: f.effect.sourceHash,
    actor: f.pin.execution.actorPrincipal,
    defaultOwner: f.pin.execution.actorPrincipal,
    objects,
  }
}
function proceduralRelations(f: Facts): void {
  ensure(f.effect.compiled.kind === 'PROCEDURAL', 'PROCEDURAL_CONTRACT_REQUIRED')
  const g = f.effect.compiled.contract.geometry
  const names = new Set<string>()
  if ('table' in g) names.add(g.table)
  if (g.kind === 'GUARD') {
    ;[...g.tables, ...g.parents, ...g.columns.map(([name]) => name)].forEach((n) => names.add(n))
  }
  if (g.kind === 'BACKFILL') {
    names.add('organizations')
    names.add('organization_members')
  }
  for (const name of names) {
    f.relations[name] = resolve(
      f,
      name,
      g.kind === 'DEFAULTS' || (g.kind === 'GUARD' && g.mode === 'REQUIRED_RELATIONS'),
    )
  }
}
function fullRows(f: Facts, name: string): void {
  const schema = f.relations[name]
  const r = f.inventory.find((v) => v.schema === schema && v.name === name)
  ensure(r && r.selectable, `FULL_ROW_SELECT_EVIDENCE_MISSING:${schema}.${name}`)
  const basis = f.actor.superuser
    ? 'ACTUAL_SUPERUSER'
    : f.actor.bypass_rls
      ? 'ACTUAL_BYPASSRLS'
      : !r.enabled
        ? 'ACTUAL_RLS_DISABLED'
        : r.owner_usage && !r.forced
          ? 'ACTUAL_OWNER_MEMBERSHIP_WITHOUT_FORCE_RLS'
          : null
  ensure(basis, `RLS_FILTERED_FULL_ROW_VISIBILITY_DENIED:${schema}.${name}`)
  f.visibility[`${schema}.${name}`] = basis
}
function validateTriggerDependency(f: Facts): ReplayTriggerFunctionPredecessor {
  ensure(
    f.effect.compiled.kind === 'PROCEDURAL' &&
      f.effect.compiled.contract.geometry.kind === 'TRIGGER',
    'TRIGGER_CONTRACT_REQUIRED',
  )
  const g = f.effect.compiled.contract.geometry
  const dependency = f.dependencies.triggerFunction
  ensure(dependency, `SOURCE_TRIGGER_FUNCTION_PREDECESSOR_BINDING_REQUIRED:${g.functionName}`)
  const prior = snapshots.get(dependency.predecessor)
  ensure(prior?.function, 'TRIGGER_FUNCTION_MINTED_PREDECESSOR_REQUIRED')
  ensure(
    binding(dependency.effect) === dependency.predecessor.bindingDigest &&
      dependency.predecessor.pinDigest === replayDigest(f.pin),
    'TRIGGER_FUNCTION_PREDECESSOR_DRIFT',
  )
  const fn = dependency.effect
  ensure(
    fn.compiled.kind === 'FUNCTION' &&
      fn.compiled.contract.action === 'CREATE_OR_REPLACE' &&
      fn.compiled.contract.name === g.functionName &&
      fn.compiled.contract.arguments.length === 0 &&
      fn.compiled.contract.returns?.schema === 'pg_catalog' &&
      fn.compiled.contract.returns.name === 'trigger' &&
      fn.boundaryId === f.effect.boundaryId &&
      fn.boundaryHash === f.effect.boundaryHash &&
      fn.sourcePath === f.effect.sourcePath &&
      fn.ordinal < f.effect.ordinal,
    'TRIGGER_FUNCTION_SOURCE_ORDER_OR_SIGNATURE_DRIFT',
  )
  let ledger: Row
  try {
    const bytes = readFileSync(
      new URL(
        '../../../../docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
        import.meta.url,
      ),
      'utf8',
    )
    ensure(
      replayHash(bytes) === '41ff4487e83c831dd94c6dbc50a2fe48de3f26af6b3c31453a188e975e423787',
      'TRIGGER_FUNCTION_FROZEN_LEDGER_DRIFT',
    )
    ledger = row(JSON.parse(bytes))
  } catch (error) {
    if (error instanceof ProvisioningError) throw error
    throw new ProvisioningError('REPLAY_POSITION_TRIGGER_FUNCTION_FROZEN_LEDGER_UNREADABLE')
  }
  ensure(Array.isArray(ledger.BOUNDARIES), 'TRIGGER_FUNCTION_FROZEN_LEDGER_INVALID')
  const boundary = ledger.BOUNDARIES.map(row).find((b) => b.BOUNDARY_ID === fn.boundaryId)
  ensure(
    boundary &&
      Array.isArray(boundary.EFFECTS) &&
      boundary.SOURCE_SHA256 === fn.boundaryHash &&
      boundary.SOURCE_PATH === fn.sourcePath,
    'TRIGGER_FUNCTION_FROZEN_BOUNDARY_DRIFT',
  )
  const matches = boundary.EFFECTS.map(row).filter((e) => e.EFFECT_ID === fn.effectId)
  ensure(matches.length === 1, 'TRIGGER_FUNCTION_FROZEN_EFFECT_MISSING')
  const source = matches[0]
  ensure(
    source.EFFECT_CLASS === 'FUNCTION_OR_PROCEDURE' &&
      source.SOURCE_ORDINAL === fn.ordinal &&
      source.EXACT_EFFECT_SHA256 === fn.sourceHash &&
      row(source.COMPARATOR).EXACT_SOURCE_SEMANTICS === fn.source &&
      equal(source.SOURCE_BYTE_RANGE, fn.byteRange),
    'TRIGGER_FUNCTION_FROZEN_SOURCE_DRIFT',
  )
  return dependency
}
async function observeInlineForeignKey(f: Facts): Promise<void> {
  ensure(
    /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+organization_id\s+UUID\s+REFERENCES\s+organizations\s*\(\s*id\s*\)/i.test(
      f.effect.source,
    ),
    'INLINE_FK_SOURCE_SEMANTICS_MISSING',
  )
  const columns = (
    await f.reader.query(createCatalogQueries.columns, [
      f.relations.member_documents,
      'member_documents',
    ])
  ).map(row)
  const names = columns.map((c) => text(c.name))
  ensure(new Set(names).size === names.length, 'INLINE_FK_COLUMN_INVENTORY_AMBIGUOUS')
  f.inlineColumnPresent = names.includes('organization_id')
  const rows = (
    await f.reader.query(positionAuthorityQueries.foreignKeys, [
      f.relations.member_documents,
      'member_documents',
    ])
  ).map(row)
  for (const r of rows) {
    ensure(
      /^[1-9]\d*$/.test(text(r.oid)) && /^[a-z_][a-z0-9_]*$/.test(text(r.name)),
      'INLINE_FK_IDENTITY_INVALID',
    )
    ensure(
      r.child_schema === f.relations.member_documents &&
        r.child_name === 'member_documents' &&
        r.kind === 'f' &&
        Array.isArray(r.columns) &&
        r.columns.every((s) => typeof s === 'string') &&
        Array.isArray(r.parent_columns) &&
        r.parent_columns.every((s) => typeof s === 'string') &&
        Number.isInteger(r.inherited),
      'INLINE_FK_ROW_INVALID',
    )
    for (const field of ['validated', 'deferrable', 'deferred', 'local']) boolean(r[field])
    for (const field of ['parent_schema', 'parent_name', 'delete_action', 'update_action', 'match'])
      text(r[field])
  }
  ensure(
    new Set(rows.map((r) => r.oid)).size === rows.length &&
      new Set(rows.map((r) => r.name)).size === rows.length,
    'INLINE_FK_CATALOG_AMBIGUOUS',
  )
  const matches = rows.filter(
    (r) =>
      equal(r.columns, ['organization_id']) &&
      equal(r.parent_columns, ['id']) &&
      r.parent_schema === f.relations.organizations &&
      r.parent_name === 'organizations' &&
      r.match === 's' &&
      r.delete_action === 'a' &&
      r.update_action === 'a' &&
      r.validated &&
      !r.deferrable &&
      !r.deferred &&
      r.local &&
      r.inherited === 0,
  )
  ensure(matches.length <= 1, 'INLINE_FK_SEMANTIC_IDENTITY_AMBIGUOUS')
  if (matches.length)
    f.inlineForeignKey = { name: text(matches[0].name), oid: text(matches[0].oid) }
}
async function prepare(f: Facts): Promise<void> {
  const spec = f.effect.compiled
  if (spec.kind === 'FUNCTION') f.function = await functionPrestate(f, spec.contract)
  if (spec.kind === 'POLICY_HELPER') {
    f.function = await functionPrestate(f, spec.contract.function)
    f.relations[spec.contract.table] = resolve(f, spec.contract.table, true)
    ensure(
      f.inventory.some((r) => r.schema === 'public' && r.name === spec.contract.table),
      'HELPER_PUBLIC_GUARD_MISSING',
    )
    const parents = new Set<string>()
    spec.contract.policies.forEach((p) => {
      helperParents(p.using, parents)
      helperParents(p.check, parents)
    })
    for (const name of parents) f.relations[name] = resolve(f, name, true)
    const resolution = await single(f.reader, helperCatalogQueries.functionResolution, [
      spec.contract.function.name,
    ])
    ensure(
      resolution.schema === f.function.schema &&
        resolution.visible === true &&
        resolution.name === spec.contract.function.name &&
        resolution.argument_oids ===
          spec.contract.function.arguments
            .map((a) => (a.type.name === 'text' ? '25' : '16'))
            .join(' '),
      'HELPER_FUNCTION_RESOLUTION_DRIFT',
    )
  }
  if (spec.kind === 'ACL') f.acl = await aclPrestate(f)
  if (spec.kind !== 'PROCEDURAL') return
  proceduralRelations(f)
  const g = spec.contract.geometry
  if (g.kind === 'ENUM') creationSchema(f, g.qualified ? g.enum.schema : null)
  if (g.kind === 'CONNECT') {
    f.databaseGrantor = text(
      (await single(f.reader, positionAuthorityQueries.databaseGrantor, [f.pin.database])).grantor,
    )
    for (const role of g.roles)
      ensure((await single(f.reader, aclQueries.role, [role])).name === role, 'CONNECT_ROLE_DRIFT')
  }
  if (g.kind === 'TRIGGER') {
    const dependency = validateTriggerDependency(f)
    const result = await deriveReplayEffectPositionAuthority(
      f.reader,
      f.pin,
      dependency.effect,
      dependency.predecessor,
    )
    ensure(result.authority.function, 'TRIGGER_FUNCTION_AUTHORITY_MISSING')
    const observation = await inspectFunctionEffect(
      f.reader,
      (dependency.effect.compiled as { kind: 'FUNCTION'; contract: FunctionEffect }).contract,
      result.authority.function,
    )
    ensure(observation.definition === 'EXACT', 'TRIGGER_FUNCTION_PREDECESSOR_NOT_EXACT')
    const resolution = await single(f.reader, helperCatalogQueries.functionResolution, [
      g.functionName,
    ])
    ensure(
      resolution.schema === result.authority.function.schema &&
        resolution.name === g.functionName &&
        resolution.visible === true &&
        resolution.argument_oids === '',
      'TRIGGER_FUNCTION_UNQUALIFIED_RESOLUTION_DRIFT',
    )
    f.triggerFunction = structuredClone(result.authority.function)
    f.sourcePredecessorDigests.push(dependency.predecessor.snapshotDigest)
  }
  if (g.kind === 'BACKFILL') {
    if (!f.inventory.some((r) => r.schema === 'public' && r.name === 'member_documents')) return
    fullRows(f, 'member_documents')
    fullRows(f, 'organization_members')
    await observeInlineForeignKey(f)
  }
  if (g.kind === 'DEFAULTS') {
    const schema = f.relations[g.table]
    await f.reader.query(helperCatalogQueries.relation, [schema, g.table])
    if (g.guard) {
      await f.reader.query(proceduralQueries.visibleColumn, ['public', g.table, 'id'])
      await f.reader.query(proceduralQueries.defaultColumn, ['public', g.table, 'id'])
    }
    for (const a of g.assignments) {
      const columns = await f.reader.query(proceduralQueries.defaultColumn, [
        schema,
        g.table,
        a.column,
      ])
      await f.reader.query(proceduralQueries.defaultPrivileges, [schema, g.table, a.column])
      ensure(columns.length <= 1, 'DEFAULT_COLUMN_AMBIGUOUS')
      if (columns.length && a.value === 'UUID_GENERATOR') {
        const column = row(columns[0])
        await f.reader.query(proceduralQueries.uuidAssignmentCast, [text(column.type_oid)])
        if (['varchar', 'bpchar'].includes(text(column.type_name))) {
          await f.reader.query(proceduralQueries.nativeTypmod, [
            text(column.type_name),
            text(column.type_oid),
          ])
        }
      }
    }
    if (g.assignments.some((a) => a.value === 'UUID_GENERATOR')) {
      await f.reader.query(proceduralQueries.defaultGenerator, [])
      await f.reader.query(proceduralQueries.defaultGeneratorCandidates, [])
    }
    if (g.updateNullCategory) {
      fullRows(f, g.table)
      await f.reader.query(categoryAggregateQuery(schema), [])
    }
  }
}
function digest(f: Facts): string {
  return replayDigest({
    binding: binding(f.effect),
    pin: f.pin,
    marker: f.marker,
    reads: f.reads,
    sourcePredecessorDigests: f.sourcePredecessorDigests,
  })
}
function frozenReader(f: Facts): CatalogReader {
  const captured = [...f.reads]
  return {
    async query(sql, parameters) {
      const matches = captured.filter((r) => r.sql === sql && equal(r.parameters, parameters))
      ensure(matches.length > 0, `PREDECESSOR_READ_EVIDENCE_MISSING:${sql}`)
      ensure(
        matches.every((m) => equal(m.rows, matches[0].rows)),
        'PREDECESSOR_READ_INCONSISTENT',
      )
      return structuredClone(matches[0].rows)
    },
  }
}
/** Mint a non-forgeable, immutable, source-bound pre-effect observation.
 * A digest copied into an arbitrary object cannot be used as a snapshot.
 * TRIGGER requires the preceding frozen FUNCTION component and its minted
 * pre-function snapshot. All reads must remain in the same externally attested
 * exclusive window. Other kinds do not accept source-dependency overrides. */
export async function captureReplayPositionPredecessor(
  reader: CatalogReader,
  pin: ReplayPositionPin,
  effect: ReplayEffectComponent,
  dependencies: ReplayPositionDependencies = {},
): Promise<ReplayPositionSnapshot> {
  binding(effect)
  row(dependencies)
  if (dependencies.triggerFunction !== undefined) {
    row(dependencies.triggerFunction)
    ensure(
      effect.compiled.kind === 'PROCEDURAL' && effect.compiled.contract.geometry.kind === 'TRIGGER',
      'TRIGGER_DEPENDENCY_ON_UNRELATED_EFFECT',
    )
  }
  const immutableDependencies: ReplayPositionDependencies = dependencies.triggerFunction
    ? {
        triggerFunction: {
          effect: freeze(cloneInput(dependencies.triggerFunction.effect)),
          predecessor: dependencies.triggerFunction.predecessor,
        },
      }
    : {}
  const f = await capture(reader, pin, effect, immutableDependencies)
  await prepare(f)
  const snapshot = freeze({
    phase: 'PREDECESSOR' as const,
    bindingDigest: binding(effect),
    pinDigest: replayDigest(pin),
    snapshotDigest: digest(f),
    reads: [...f.reads],
    sourcePredecessorDigests: [...f.sourcePredecessorDigests],
  })
  f.reader = frozenReader(f)
  snapshots.set(snapshot, f)
  return snapshot
}
/** Derive expected ownership from the authentic pre-effect capture, never the
 * current object. Comparator-native dependencies remain independently checked.
 * Primitive kinds return only effectId/sourceHash plus identity-read evidence.
 * They neither inspect completion nor issue semantic or source-mutation authority;
 * the caller must separately record the actual component inspector's read-set. */
export async function deriveReplayEffectPositionAuthority(
  reader: CatalogReader,
  pin: ReplayPositionPin,
  effect: ReplayEffectComponent,
  predecessor: ReplayPositionSnapshot,
): Promise<ReplayPositionEvidence> {
  const prior = snapshots.get(predecessor)
  ensure(prior, 'INDEPENDENT_PREDECESSOR_REQUIRED')
  ensure(
    binding(effect) === predecessor.bindingDigest && replayDigest(pin) === predecessor.pinDigest,
    'SNAPSHOT_SOURCE_OR_CONTEXT_DRIFT',
  )
  ensure(reader !== prior.rawReader, 'DISTINCT_SNAPSHOT_READER_REQUIRED')
  const f = await capture(reader, pin, effect, prior.dependencies)
  ensure(!equal(f.marker, prior.marker), 'DISTINCT_OBSERVED_SNAPSHOT_REQUIRED')
  const authority: ReplayEffectPositionAuthority = {
    effectId: effect.effectId,
    sourceHash: effect.sourceHash,
  }
  const spec = effect.compiled
  if (spec.kind === 'FUNCTION' || spec.kind === 'POLICY_HELPER') {
    const fn = spec.kind === 'FUNCTION' ? spec.contract : spec.contract.function
    ensure(prior.function, 'FUNCTION_PRESTATE_REQUIRED')
    ensure((await functionSchema(f, fn)) === prior.function.schema, 'CREATION_SCHEMA_DRIFT')
    const candidates = await f.reader.query(functionCatalogQueries.functions, [
      prior.function.schema,
      fn.name,
    ])
    ensure(candidates.length <= 1, 'FUNCTION_OVERLOAD_AMBIGUOUS')
    const observation = await inspectFunctionEffect(f.reader, fn, prior.function)
    ensure(
      observation.definition !== 'PRECONDITION_MISSING',
      `FUNCTION_PREREQUISITE_DENIED:${observation.denial}`,
    )
    if (spec.kind === 'FUNCTION') authority.function = structuredClone(prior.function)
    else {
      const targetSchema = resolve(f, spec.contract.table, true)
      ensure(
        targetSchema === prior.relations[spec.contract.table],
        'HELPER_TARGET_RESOLUTION_DRIFT',
      )
      ensure(
        f.inventory.some((r) => r.schema === 'public' && r.name === spec.contract.table),
        'HELPER_PUBLIC_GUARD_MISSING',
      )
      const parents = Object.fromEntries(
        Object.keys(prior.relations)
          .filter((n) => n !== spec.contract.table)
          .map((n) => {
            const schema = resolve(f, n, true)
            ensure(schema === prior.relations[n], 'HELPER_PARENT_RESOLUTION_DRIFT')
            return [n, schema]
          }),
      )
      const helper: HelperPositionContext = {
        effectId: effect.effectId,
        sourceHash: effect.sourceHash,
        functionHash: fn.sourceHash,
        searchPath: [...pin.searchPath],
        executionRole: pin.execution.actorPrincipal,
        targetSchema,
        parentSchemas: parents,
        function: structuredClone(prior.function),
      }
      authority.helper = helper
      const observation = await inspectPolicyHelper(f.reader, spec.contract, helper)
      ensure(
        observation.definition !== 'PRECONDITION_MISSING',
        `HELPER_PREREQUISITE_DENIED:${observation.denial}`,
      )
    }
  }
  if (spec.kind === 'ACL') {
    ensure(prior.acl, 'ACL_PRESTATE_REQUIRED')
    authority.acl = structuredClone(prior.acl)
  }
  if (spec.kind === 'PROCEDURAL') {
    await prepare(f)
    ensure(equal(f.relations, prior.relations), 'PROCEDURAL_RESOLUTION_DRIFT')
    if (prior.inlineForeignKey)
      ensure(
        equal(f.inlineForeignKey, prior.inlineForeignKey),
        'INLINE_FK_PREDECESSOR_IDENTITY_DRIFT',
      )
    if (spec.contract.geometry.kind === 'BACKFILL' && !f.inlineForeignKey) {
      ensure(!f.inlineColumnPresent, 'INLINE_FK_SOURCE_MATCHING_CATALOG_IDENTITY_MISSING')
    }
    if (spec.contract.geometry.kind === 'BACKFILL' && f.inlineForeignKey) {
      ensure(
        !prior.inlineColumnPresent || prior.inlineForeignKey,
        'INLINE_FK_ALLOCATION_NOT_OWNED_BY_SOURCE',
      )
    }
    const snapshotDigest = digest(f)
    const visibility = (facts: Facts, hash: string) =>
      Object.fromEntries(
        Object.entries(facts.visibility).map(([name, basis]) => [
          name,
          { snapshotDigest: hash, basis },
        ]),
      )
    const context: ProceduralContext = {
      effectId: effect.effectId,
      sourceHash: effect.sourceHash,
      boundaryHash: effect.boundaryHash,
      ordinal: effect.ordinal,
      window: 'IMMEDIATE_PRE_SUCCESSOR',
      snapshotDigest,
      actor: pin.execution.actorPrincipal,
      database: pin.database,
      searchPath: [...pin.searchPath],
      relations: { ...f.relations },
      catalogVisibility: {
        snapshotDigest,
        schemas: f.schemas.map((s) => text(s.name)),
        allSchemas: true,
      },
      dataVisibility: visibility(f, snapshotDigest),
      ...(f.databaseGrantor ? { databaseGrantor: f.databaseGrantor } : {}),
      ...(f.triggerFunction ? { triggerFunction: f.triggerFunction } : {}),
      ...(f.inlineForeignKey ? { memberDocumentsForeignKeyName: f.inlineForeignKey.name } : {}),
      ...(spec.contract.geometry.kind === 'ENUM'
        ? {
            creationSchema: creationSchema(
              f,
              spec.contract.geometry.qualified ? spec.contract.geometry.enum.schema : null,
            ),
          }
        : {}),
    }
    authority.procedural = context
    authority.predecessor = {
      reader: prior.reader,
      snapshotDigest: predecessor.snapshotDigest,
      dataVisibility: visibility(prior, predecessor.snapshotDigest),
    }
    const observation = await inspectProceduralEffect(
      f.reader,
      spec.contract,
      context,
      authority.predecessor,
    )
    ensure(
      observation.state !== 'MISSING_PREREQUISITE',
      `PROCEDURAL_PREREQUISITE_DENIED:${observation.branch}`,
    )
    // Include the actual source-defined probes in the final capture commitment,
    // then rebind visibility to that commitment (not to a caller's request label).
    context.snapshotDigest = digest(f)
    context.catalogVisibility.snapshotDigest = context.snapshotDigest
    context.dataVisibility = visibility(f, context.snapshotDigest)
  }
  const snapshotDigest = digest(f)
  return freeze({
    authority,
    snapshotDigest,
    predecessorDigest: predecessor.snapshotDigest,
    readSetDigest: replayDigest(f.reads),
    reads: [...f.reads],
    sourcePredecessorDigests: [...f.sourcePredecessorDigests],
  })
}
