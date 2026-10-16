import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type pg from 'pg'
import { catalogDigest, canonicalType, type CatalogObject } from './installer'
import { compileSecurity } from './security'
import { hash, root, type V2Plan } from './source'
import {
  inspectNativeAddresses,
  producerBytes,
  type ExecutionTrace,
  type NativeAddress,
} from './manifest-trace'
import { qualifyNativePrivileges } from './manifest-security'
import { verifyDeclaredDefaults } from './manifest-defaults'

export interface PortableDependency {
  canonicalId: string | null
  nativeType: string
  nativeIdentity: string
  dependencyType: string
  scope: 'DATABASE' | 'CLUSTER'
}
interface AddressEdge {
  address: string
  referencedAddress: string
  nativeType: string
  nativeIdentity: string
  dependencyType: string
  scope: 'DATABASE' | 'CLUSTER'
}
export interface ManifestObject {
  CANONICAL_ID: string
  SOURCE_AUTHORITY: {
    producerId: string
    source: string
    producerCodeDigest: string | null
    sqlDigest: string | null
    binding: string
  }[]
  SOURCE_DIGEST: string[]
  DATABASE_SCOPE: string
  DEPENDENCIES: PortableDependency[]
  SECURITY_CLASS: string
  CREATION_ORDER: { execution: number | null; basis: string }
  VERIFICATION_RULE: {
    nativeCatalogKind: string
    exactDefinition: unknown
    declaredSourceChecks: string[]
  }
}

async function addressEdges(client: pg.Client): Promise<AddressEdge[]> {
  const result = await client.query<AddressEdge>(`
    SELECT d.classid::regclass::text||':'||d.objid::text||':'||d.objsubid::text AS address,
      d.refclassid::regclass::text||':'||d.refobjid::text||':'||d.refobjsubid::text AS "referencedAddress",
      target.type AS "nativeType",target.identity AS "nativeIdentity",
      d.deptype AS "dependencyType",'DATABASE' AS scope
    FROM pg_depend d CROSS JOIN LATERAL pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid) target
    UNION ALL
    SELECT d.classid::regclass::text||':'||d.objid::text||':'||d.objsubid::text,
      d.refclassid::regclass::text||':'||d.refobjid::text||':0',
      target.type,target.identity,d.deptype,'CLUSTER'
    FROM pg_shdepend d CROSS JOIN LATERAL pg_identify_object(d.refclassid,d.refobjid,0) target
    WHERE d.dbid=(SELECT oid FROM pg_database WHERE datname=current_database())
    UNION ALL
    SELECT 'pg_class:'||a.attrelid::text||':'||a.attnum::text,
      'pg_class:'||a.attrelid::text||':0',target.type,target.identity,'catalog:attrelid','DATABASE'
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    CROSS JOIN LATERAL pg_identify_object('pg_class'::regclass,a.attrelid,0) target
    WHERE c.relnamespace IN ('public'::regnamespace,to_regnamespace('user_management'))
      AND a.attnum>0 AND NOT a.attisdropped
    UNION ALL
    SELECT 'pg_class:'||a.attrelid::text||':'||a.attnum::text,
      'pg_type:'||a.atttypid::text||':0',target.type,target.identity,'catalog:atttypid','DATABASE'
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    CROSS JOIN LATERAL pg_identify_object('pg_type'::regclass,a.atttypid,0) target
    WHERE c.relnamespace IN ('public'::regnamespace,to_regnamespace('user_management'))
      AND a.attnum>0 AND NOT a.attisdropped
  `)
  return result.rows
}

export function bindCreation(
  address: NativeAddress,
  trace: ExecutionTrace,
  edges: AddressEdge[],
  indexed?: {
    first: Map<string, number>
    baseline: Set<string>
    parents: Map<string, string[]>
  },
): { order: number | null; basis: string; address: string } {
  const first = indexed?.first ?? new Map<string, number>()
  const baseline = indexed?.baseline ?? new Set(trace.baseline.map((entry) => entry.address))
  const parents = indexed?.parents ?? new Map<string, string[]>()
  if (!indexed) {
    for (const event of trace.events)
      first.set(event.address, Math.min(first.get(event.address) ?? Infinity, event.order))
    for (const edge of edges)
      if (['i', 'a'].includes(edge.dependencyType))
        parents.set(edge.address, [...(parents.get(edge.address) ?? []), edge.referencedAddress])
  }
  const visited = new Set<string>()
  const queue = [address.address]
  while (queue.length) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    if (baseline.has(current))
      return { order: null, basis: 'PREEXISTING_PREREQUISITE', address: current }
    const order = first.get(current)
    if (order !== undefined)
      return {
        order,
        basis: current === address.address ? 'DDL_EVENT' : 'NATIVE_AUTOMATIC_DEPENDENCY',
        address: current,
      }
    if (
      current === address.address &&
      (address.address.startsWith('pg_attrdef:') ||
        address.canonicalId.startsWith('index:') ||
        address.canonicalId.startsWith('constraint:'))
    )
      break
    queue.push(...(parents.get(current) ?? []).sort())
  }
  return { order: null, basis: 'UNRESOLVED', address: address.address }
}

export function renderManifestMarkdown(manifest: {
  objects: ManifestObject[]
  blockers: string[]
  catalogDigest: string
}) {
  const cell = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ')
  return [
    '# Current-state bootstrap V2 native inventory',
    '',
    'Local synthetic candidate evidence only. This is not SaaS, engineering, or production-security acceptance.',
    'Django remains the owner of its current models; prospective supplements retain their own source authority.',
    'Creation order is a measured statement execution, not catalog sort order. Several automatic objects share one execution.',
    'Pre-existing cluster roles and image prerequisites have no per-database creation order.',
    'Dependencies are PostgreSQL identities (including built-ins and cluster ownership); edges are not counted as objects.',
    'The restricted event-trigger trace is dropped before verification. No trace namespace is ignored by drift checks.',
    'Run the local clean-room CLI with UE_V2_WHEELHOUSE. Its exit 1 intentionally reflects incomplete whole-mission gates.',
    '',
    `Catalog SHA-256: \`${manifest.catalogDigest}\``,
    `Objects: ${manifest.objects.length}; manifest blockers: ${manifest.blockers.length}`,
    ...manifest.blockers.map((blocker) => `- ${cell(blocker)}`),
    '',
    '| Canonical object | Scope | Creation execution / basis | Producer authority / byte SHA-256 | Dependencies | Security | Verification |',
    '|---|---|---|---|---|---|---|',
    ...manifest.objects.map((object) =>
      [
        object.CANONICAL_ID,
        object.DATABASE_SCOPE,
        `${object.CREATION_ORDER.execution ?? 'not measured'} / ${object.CREATION_ORDER.basis}`,
        object.SOURCE_AUTHORITY.map(
          (authority, i) =>
            `${authority.producerId}: ${authority.source} (${object.SOURCE_DIGEST[i]})`,
        ).join('; '),
        object.DEPENDENCIES.map(
          (dependency) =>
            `${dependency.dependencyType}:${dependency.canonicalId ?? `${dependency.nativeType}:${dependency.nativeIdentity}`} [${dependency.scope}]`,
        ).join('; ') || 'none recorded by PostgreSQL',
        object.SECURITY_CLASS,
        `${object.VERIFICATION_RULE.nativeCatalogKind}: exact native definition; ${object.VERIFICATION_RULE.declaredSourceChecks.join('; ')}`,
      ]
        .map(cell)
        .map((value) => ` ${value} `)
        .join('|')
        .replace(/^/, '|')
        .replace(/$/, '|'),
    ),
    '',
    'See UE_CANONICAL_SCHEMA_V2.json for complete native definitions, source byte hashes, dependency targets and qualification results.',
    'See UE_BOOTSTRAP_V2_RUNTIME_EVIDENCE.json for fresh, no-op, drift/partial denial, three rollback phases and destroy/recreate outcomes.',
    '',
  ].join('\n')
}

export async function buildNativeManifest(
  client: pg.Client,
  plan: V2Plan,
  objects: CatalogObject[],
  trace: ExecutionTrace,
  prerequisites: { image: string; roleSql: string },
) {
  const addresses = await inspectNativeAddresses(client)
  const edges = await addressEdges(client)
  const addressMap = new Map<string, NativeAddress[]>()
  const canonicalMap = new Map<string, NativeAddress[]>()
  const edgeMap = new Map<string, AddressEdge[]>()
  const eventMap = new Map<string, number[]>()
  const first = new Map<string, number>()
  const parents = new Map<string, string[]>()
  for (const address of addresses) {
    addressMap.set(address.address, [...(addressMap.get(address.address) ?? []), address])
    canonicalMap.set(address.canonicalId, [
      ...(canonicalMap.get(address.canonicalId) ?? []),
      address,
    ])
  }
  for (const edge of edges) {
    edgeMap.set(edge.address, [...(edgeMap.get(edge.address) ?? []), edge])
    if (['i', 'a'].includes(edge.dependencyType))
      parents.set(edge.address, [...(parents.get(edge.address) ?? []), edge.referencedAddress])
  }
  for (const event of trace.events) {
    eventMap.set(event.address, [...(eventMap.get(event.address) ?? []), event.order])
    first.set(event.address, Math.min(first.get(event.address) ?? Infinity, event.order))
  }
  const indexed = {
    first,
    parents,
    baseline: new Set(trace.baseline.map((entry) => entry.address)),
  }
  const security = compileSecurity(plan)
  const blockers: string[] = []
  for (const execution of trace.executions) {
    const file = path.join(root, ...execution.producer.source.split('/'))
    if (
      execution.producerCodeDigest &&
      (!existsSync(file) || hash(readFileSync(file, 'utf8')) !== execution.producerCodeDigest)
    )
      blockers.push(`SOURCE_PRODUCER_BYTES_CHANGED_DURING_EXECUTION:${execution.producer.source}`)
  }
  for (const [source, digest] of Object.entries(plan.sourceCommitments)) {
    if (source.startsWith('python:')) continue
    const file = path.join(root, ...source.split('/'))
    if (!existsSync(file)) blockers.push(`SOURCE_FILE_MISSING:${source}`)
    else if (hash(readFileSync(file, 'utf8')) !== digest)
      blockers.push(`SOURCE_BYTES_CHANGED_SINCE_PLAN:${source}`)
  }
  const inventory: ManifestObject[] = objects.map((object) => {
    const id = `${object.kind}:${object.id}`
    const candidates = canonicalMap.get(id) ?? []
    const primary =
      candidates.find((entry) => entry.address.startsWith('pg_class:')) ?? candidates[0]
    const binding = primary
      ? bindCreation(primary, trace, edges, indexed)
      : { order: null, basis: 'UNRESOLVED', address: '' }
    const orders = [
      ...new Set([
        binding.order,
        ...candidates.flatMap((address) => eventMap.get(address.address) ?? []),
      ]),
    ]
      .filter((order): order is number => order !== null)
      .sort((a, b) => a - b)
    const authorities: ManifestObject['SOURCE_AUTHORITY'] = []
    const digests: string[] = []
    if (binding.basis === 'PREEXISTING_PREREQUISITE') {
      const role = object.kind === 'role' || object.kind === 'role_membership'
      authorities.push({
        producerId: role ? 'LOCAL_CLUSTER_ROLE_PREREQUISITE' : 'PINNED_POSTGRES_IMAGE_PREREQUISITE',
        source: role ? 'apps/union-eyes/scripts/bootstrap-v2/clean-room.ts' : prerequisites.image,
        producerCodeDigest: role
          ? producerBytes('apps/union-eyes/scripts/bootstrap-v2/clean-room.ts')
          : null,
        sqlDigest: role ? hash(prerequisites.roleSql) : null,
        binding: 'OBSERVED_BEFORE_DATABASE_INSTALL',
      })
      digests.push(role ? hash(prerequisites.roleSql) : prerequisites.image.split('@sha256:')[1])
    }
    for (const order of orders) {
      const execution = trace.executions.find((entry) => entry.order === order)
      if (!execution) {
        blockers.push(`TRACE_EXECUTION_MISSING:${id}:${order}`)
        continue
      }
      const producer = execution.producer
      authorities.push({
        producerId: producer.canonicalId,
        source: producer.source,
        producerCodeDigest: execution.producerCodeDigest,
        sqlDigest: execution.sqlDigest,
        binding: order === binding.order ? binding.basis : 'DDL_OBSERVATION_EVENT',
      })
      digests.push(producer.sourceDigest)
    }
    if (!authorities.length) blockers.push(`SOURCE_BINDING_UNRESOLVED:${id}`)
    const table = plan.tables.find(
      (entry) =>
        object.id === (entry.name.includes('.') ? entry.name : `public.${entry.name}`) ||
        object.id.startsWith(
          `${entry.name.includes('.') ? entry.name : `public.${entry.name}`}.`,
        ) ||
        object.id.startsWith(`${entry.name}.`),
    )
    const rule = table && security.rules.find((entry) => entry.table === table.name)
    const dependencies = candidates
      .flatMap((address) => edgeMap.get(address.address) ?? [])
      .map(
        (edge): PortableDependency => ({
          canonicalId:
            addressMap.get(edge.referencedAddress)?.find((entry) => entry.canonicalId !== id)
              ?.canonicalId ?? null,
          nativeType: edge.nativeType,
          nativeIdentity: edge.nativeIdentity,
          dependencyType: edge.dependencyType,
          scope: edge.scope,
        }),
      )
    if (table) {
      authorities.push({
        producerId: `DECLARED_TABLE:${table.name}`,
        source: table.source,
        producerCodeDigest: existsSync(path.join(root, ...table.source.split('/')))
          ? producerBytes(table.source)
          : null,
        sqlDigest: null,
        binding: 'CURRENT_DECLARED_TABLE_AUTHORITY',
      })
      digests.push(table.sourceDigest)
    }
    return {
      CANONICAL_ID: id,
      SOURCE_AUTHORITY: authorities,
      SOURCE_DIGEST: digests,
      DATABASE_SCOPE:
        object.kind === 'role' || object.kind === 'role_membership'
          ? 'CLUSTER_PREREQUISITE'
          : plan.scope,
      DEPENDENCIES: [
        ...new Map(dependencies.map((edge) => [JSON.stringify(edge), edge])).values(),
      ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      SECURITY_CLASS:
        rule?.classification ??
        (object.kind === 'role' ? 'RESTRICTED_CLUSTER_ROLE' : 'BOOTSTRAP_OR_EXTENSION'),
      CREATION_ORDER: { execution: binding.order, basis: binding.basis },
      VERIFICATION_RULE: {
        nativeCatalogKind: object.kind,
        exactDefinition: object.definition,
        declaredSourceChecks: table
          ? [
              'declared columns and nullability',
              'declared primary/unique/foreign keys',
              'source-declared server defaults and canonical UUID/audit generators',
            ]
          : ['native definition and producer trace'],
      },
    }
  })
  const declared = await verifyDeclaredSource(client, plan)
  const privileges = await qualifyNativePrivileges(client, plan)
  blockers.push(...declared.mismatches)
  blockers.push(...privileges.mismatches)
  return {
    contractVersion: '2.0',
    lineage: plan.lineage,
    databaseScope: plan.scope,
    status: blockers.length ? 'MANIFEST_QUALIFICATION_FAILED' : 'LOCAL_NATIVE_MANIFEST_QUALIFIED',
    engineeringReadiness: 'NOT_PROVEN',
    productionSecurityReadiness: 'NOT_PROVEN',
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    workingTreeBytesAuthoritative: true,
    objectCount: objects.length,
    catalogDigest: catalogDigest(objects),
    sources: plan.sourceCommitments,
    objects: inventory,
    executionTrace: trace.executions.map((entry) => ({
      order: entry.order,
      producerId: entry.producer.canonicalId,
      source: entry.producer.source,
      sourceDigest: entry.producer.sourceDigest,
      producerCodeDigest: entry.producerCodeDigest,
      sqlDigest: entry.sqlDigest,
    })),
    qualification: declared,
    nativePrivilegeQualification: privileges,
    sourceDecisions: plan.decisions,
    exclusions: plan.exclusions,
    blockers: [...new Set(blockers)].sort(),
  }
}

export async function verifyDeclaredSource(client: pg.Client, plan: V2Plan) {
  const catalog = await client.query<{
    table: string
    column: string
    type: string
    notnull: boolean
    primary: boolean
    unique: boolean
  }>(`
    SELECT CASE WHEN n.nspname='public' THEN c.relname ELSE n.nspname||'.'||c.relname END AS table,
      a.attname AS column,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS notnull,
      EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conrelid=c.oid AND k.contype='p' AND a.attnum=ANY(k.conkey)) AS primary,
      EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conrelid=c.oid AND k.contype IN ('p','u') AND k.conkey=ARRAY[a.attnum]::smallint[]) AS unique
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','user_management') AND a.attnum>0 AND NOT a.attisdropped
  `)
  const foreignKeys = await client.query<{
    table: string
    column: string
    target: string
    targetColumn: string
  }>(`
    SELECT CASE WHEN c.relnamespace='public'::regnamespace THEN c.relname ELSE c.relnamespace::regnamespace::text||'.'||c.relname END AS table,
      a.attname AS column,
      CASE WHEN r.relnamespace='public'::regnamespace THEN r.relname ELSE r.relnamespace::regnamespace::text||'.'||r.relname END AS target,b.attname AS "targetColumn"
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_class r ON r.oid=k.confrelid
    CROSS JOIN LATERAL unnest(k.conkey,k.confkey) key(column_id,target_id)
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=key.column_id
    JOIN pg_attribute b ON b.attrelid=r.oid AND b.attnum=key.target_id
    WHERE k.contype='f' AND c.relnamespace IN ('public'::regnamespace,to_regnamespace('user_management'))
  `)
  const keys = await client.query<{
    table: string
    name: string
    type: string
    columns: string[]
  }>(`
    SELECT CASE WHEN c.relnamespace='public'::regnamespace THEN c.relname ELSE c.relnamespace::regnamespace::text||'.'||c.relname END AS table,
      k.conname AS name,k.contype AS type,
      ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY key(attnum,position)
        JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=key.attnum ORDER BY key.position) AS columns
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
    WHERE c.relnamespace IN ('public'::regnamespace,to_regnamespace('user_management'))
    UNION ALL
    SELECT CASE WHEN c.relnamespace='public'::regnamespace THEN c.relname ELSE c.relnamespace::regnamespace::text||'.'||c.relname END,
      idx.relname,'u',
      ARRAY(SELECT a.attname::text FROM unnest(i.indkey::smallint[]) WITH ORDINALITY key(attnum,position)
        JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=key.attnum
        WHERE key.position<=i.indnkeyatts ORDER BY key.position)
    FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_class idx ON idx.oid=i.indexrelid
    WHERE c.relnamespace IN ('public'::regnamespace,to_regnamespace('user_management'))
      AND i.indisunique AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
  `)
  const mismatches: string[] = []
  let checkedColumns = 0
  let checkedConstraints = 0
  for (const table of plan.tables) {
    for (const column of table.columns) {
      checkedColumns++
      const actual = catalog.rows.find(
        (row) => row.table === table.name && row.column === column.name,
      )
      if (
        !actual ||
        normalizeDeclaredType(actual.type) !== normalizeDeclaredType(column.type) ||
        actual.notnull !== column.notNull
      )
        mismatches.push(`DECLARED_COLUMN_MISMATCH:${table.name}.${column.name}`)
    }

    for (const key of table.foreignKeys) {
      checkedConstraints++
      if (
        !foreignKeys.rows.some(
          (row) =>
            row.table === table.name &&
            row.column === key.column &&
            row.target === key.table &&
            row.targetColumn === key.referencedColumn,
        )
      )
        mismatches.push(`DECLARED_FOREIGN_KEY_MISMATCH:${table.name}.${key.column}`)
    }
  }
  for (const model of plan.currentModels.models) {
    for (const column of model.columns) {
      const actual = catalog.rows.find(
        (row) => row.table === model.table && row.column === column.name,
      )
      if (column.primaryKey || column.unique) {
        checkedConstraints++
        if (!actual || (column.primaryKey && !actual.primary) || (column.unique && !actual.unique))
          mismatches.push(`CURRENT_MODEL_KEY_MISMATCH:${model.table}.${column.name}`)
      }
    }
    const physicalColumn = (field: string) =>
      model.columns.find((column) => column.name === field)?.name ??
      model.columns.find((column) => column.name === `${field}_id`)?.name ??
      field
    for (const declared of model.uniqueTogether ?? []) {
      checkedConstraints++
      if (!Array.isArray(declared) || !declared.every((field) => typeof field === 'string')) {
        mismatches.push(`CURRENT_MODEL_COMPOSITE_UNRESOLVED:${model.table}`)
        continue
      }
      const expected = declared.map(physicalColumn)
      if (
        !keys.rows.some(
          (key) =>
            key.table === model.table &&
            key.type === 'u' &&
            JSON.stringify(key.columns) === JSON.stringify(expected),
        )
      )
        mismatches.push(`CURRENT_MODEL_COMPOSITE_KEY_MISMATCH:${model.table}:${expected.join(',')}`)
    }
    for (const declared of model.constraints ?? []) {
      checkedConstraints++
      const options = Array.isArray(declared)
        ? (declared[1] as { name?: string; fields?: string[] })
        : null
      const actual = keys.rows.find(
        (key) => key.table === model.table && key.name === options?.name,
      )
      if (
        !actual ||
        (options?.fields &&
          (actual.type !== 'u' ||
            JSON.stringify(actual.columns) !== JSON.stringify(options.fields.map(physicalColumn))))
      )
        mismatches.push(
          `CURRENT_MODEL_NAMED_CONSTRAINT_MISMATCH:${model.table}:${options?.name ?? 'unresolved'}`,
        )
    }
  }
  const defaults = await verifyDeclaredDefaults(client, plan)
  mismatches.push(...defaults.mismatches)
  return {
    status: mismatches.length ? 'FAIL' : 'PASS_DECLARED_SOURCE_SUBSET',
    checkedColumns,
    checkedConstraints,
    defaults,
    mismatches,
  }
}

export function normalizeDeclaredType(type: string) {
  return canonicalType(type)
    .replace(/^timestamp(\(\d+\))?(\[\])?$/, 'timestamp$1 without time zone$2')
    .replace(/^timestamptz(\(\d+\))?(\[\])?$/, 'timestamp$1 with time zone$2')
    .replace(/^time(\(\d+\))?(\[\])?$/, 'time$1 without time zone$2')
    .replace(/^bool(\[\])?$/, 'boolean$1')
    .replace(/^int(?:4)?(\[\])?$/, 'integer$1')
    .replace(/^int8(\[\])?$/, 'bigint$1')
    .replace(/^decimal/, 'numeric')
    .replaceAll('"', '')
    .replace(/^public\./, '')
}
