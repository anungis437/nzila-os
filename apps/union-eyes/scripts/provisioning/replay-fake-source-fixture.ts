import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ProvisioningError } from './governed-provisioning'
import { replayHash, replayObject, replayRecords, replayText } from './post-w4p-replay'
import type { compileReplayUnitPlan } from './replay-unit-plan'
import {
  createSourceBoundDjangoCatalog,
  loadSourceBoundDjangoBaseline,
} from './replay-fake-django-baseline'
import type { ReplayPositionPin } from './replay-position-authority'
import { FakeReplayCatalog, parseFakeSourceColumn } from './replay-fake-catalog'
import { loadSpecification } from '../../../../scripts/ue/implement-w4p-platform-promotion'
import { inspectPayload, readCatalog, topologicalOrder } from './platform-baseline-promotion'
import { frozenStatements } from '../../../../scripts/ue/close-w5a-replay-graph'
import { tableDefinition } from '../../../../scripts/ue/w5bc-boundary-semantics'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'

function fakeFixtureContext(
  pin: ReplayPositionPin,
): Omit<ConstructorParameters<typeof FakeReplayCatalog>[0], 'tables' | 'enums'> {
  return {
    schemas: ['pg_catalog', 'public'],
    roles: [pin.execution.actorPrincipal, 'ue_runtime', 'union_eyes_runtime', 'union_eyes_system'],
    database: pin.database,
    schemaPermissions: [
      { schema: 'public', role: pin.execution.actorPrincipal, usage: true, create: true },
      { schema: 'pg_catalog', role: pin.execution.actorPrincipal, usage: true, create: false },
    ],
    functionContext: {
      actor: pin.execution.actorPrincipal,
      creationSchema: 'public',
      searchPath: [...pin.searchPath],
      defaultAcl: [
        {
          grantor: pin.execution.actorPrincipal,
          grantee: 'PUBLIC',
          privilege: 'EXECUTE',
          grantable: false,
        },
        {
          grantor: pin.execution.actorPrincipal,
          grantee: pin.execution.actorPrincipal,
          privilege: 'EXECUTE',
          grantable: false,
        },
      ],
    },
  }
}

/** Source-produced fake incoming state only; external Django ceilings remain visible and are not live proof. */
export async function createFakeSourceIncomingCatalog(
  plan: ReturnType<typeof compileReplayUnitPlan>,
  pin: ReplayPositionPin,
  repositoryRoot: string,
  wheelhouse: string,
) {
  if (pin.execution.scope !== 'UE_OPERATIONAL')
    throw new ProvisioningError('FAKE_SOURCE_FIXTURE_OPERATIONAL_SCOPE_REQUIRED')
  const baseline = loadSourceBoundDjangoBaseline({ repositoryRoot, wheelhouse })
  const payloads = replayObject(
    JSON.parse(
      readFileSync(
        resolve(
          repositoryRoot,
          'docs',
          'union-eyes',
          'reality-remediation',
          'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR4.json',
        ),
        'utf8',
      ),
    ),
  )
  const incomingNames = new Set(baseline.tables.map((table) => table.name))
  const helperTargets = plan.components.effects.flatMap((effect) =>
    effect.compiled.kind === 'POLICY_HELPER' ? [effect.compiled.contract.table] : [],
  )
  const columnPayloads = replayRecords(payloads.ADD_COLUMN_PAYLOADS)
  const names = new Set(helperTargets.filter((name) => incomingNames.has(name)))
  const incomingTarget = (name: string) => {
    if (incomingNames.has(name)) names.add(name)
  }
  for (const effect of plan.components.effects) {
    const compiled = effect.compiled
    switch (compiled.kind) {
      case 'COLUMN':
      case 'INDEX':
      case 'RLS':
      case 'POLICY_DROP':
      case 'POLICY_CREATE':
      case 'BACKFILL':
        incomingTarget(compiled.contract.table)
        break
      case 'FOREIGN_KEY':
        incomingTarget(compiled.contract.table)
        incomingTarget(compiled.contract.parent)
        break
      case 'DEFAULT':
        incomingTarget(
          compiled.contract.action === 'ADD_DEFAULT_COLUMN'
            ? compiled.contract.column.table
            : compiled.contract.table,
        )
        break
      case 'RELATION':
        for (const constraint of compiled.contract.constraints)
          if (constraint.parent) incomingTarget(constraint.parent.name)
        break
    }
  }
  for (const payload of columnPayloads) {
    const match = /^ALTER TABLE "public"\."([^"]+)"/.exec(replayText(payload.SQL))
    if (!match) throw new ProvisioningError('FAKE_SOURCE_FIXTURE_COLUMN_TARGET_REQUIRED')
    names.add(match[1])
  }
  const born = new Set([
    ...plan.components.creates.map((entry) => entry.contract.name),
    ...plan.components.effects.flatMap((effect) =>
      effect.compiled.kind === 'RELATION' ? [effect.compiled.contract.name] : [],
    ),
    ...replayRecords(payloads.RELATION_CREATE_PAYLOADS).map((payload) => {
      const match = /^CREATE TABLE "public"\."([^"]+)"/.exec(replayText(payload.SQL))
      if (!match) throw new ProvisioningError('FAKE_SOURCE_FIXTURE_RELATION_TARGET_REQUIRED')
      return match[1]
    }),
  ])
  const unresolvedTargets = [...new Set(helperTargets)].filter(
    (name) => !incomingNames.has(name) && !born.has(name),
  )
  if (unresolvedTargets.length)
    throw new ProvisioningError(
      `FAKE_SOURCE_FIXTURE_TARGET_PRODUCER_REQUIRED:${unresolvedTargets.join(',')}`,
    )
  const catalog = await createSourceBoundDjangoCatalog(
    baseline,
    [...names],
    fakeFixtureContext(pin),
  )
  return {
    catalog,
    baseline,
    helperTargets: helperTargets.length,
    sourceProducedIncomingTargets: helperTargets.filter((name) => incomingNames.has(name)).length,
    boundaryProducedTargets: helperTargets.filter((name) => !incomingNames.has(name)).length,
    unresolvedTargets,
    executionAuthorized: false as const,
  }
}

export async function createFakeSourceReplayPredecessor(
  plan: ReturnType<typeof compileReplayUnitPlan>,
  pin: ReplayPositionPin,
  repositoryRoot: string,
  wheelhouse: string,
) {
  const incoming = await createFakeSourceIncomingCatalog(plan, pin, repositoryRoot, wheelhouse)
  return promoteFakeSourceIncomingCatalog(incoming)
}

export async function promoteFakeSourceIncomingCatalog(
  incoming: Awaited<ReturnType<typeof createFakeSourceIncomingCatalog>>,
) {
  const catalog = incoming.catalog
  const { specification } = await loadSpecification()
  await catalog.transaction(async () => {
    let native = await readCatalog(catalog, specification)
    for (const invariant of topologicalOrder(specification.invariants)) {
      const inspection = inspectPayload(invariant, native)
      if (inspection.STATE === 'ABSENT') {
        await catalog.applyFrozenUnit(invariant.payload.SQL, invariant.payload.SQL_SHA256)
        native = await readCatalog(catalog, specification)
        if (inspectPayload(invariant, native).STATE !== 'PRESENT_MATCHING')
          throw new ProvisioningError(
            `FAKE_SOURCE_FIXTURE_PAYLOAD_POSTCONDITION:${invariant.payload.PAYLOAD_ID}`,
          )
      } else if (inspection.STATE !== 'PRESENT_MATCHING') {
        throw new ProvisioningError(
          `FAKE_SOURCE_FIXTURE_PAYLOAD_DENIED:${invariant.payload.PAYLOAD_ID}:${inspection.REASONS.join(',')}`,
        )
      }
    }
  })
  return {
    ...incoming,
    payloads: 162,
    executionAuthorized: false as const,
  }
}

export async function inspectFakeSourceW4pCompatibility(
  incoming: Awaited<ReturnType<typeof createFakeSourceIncomingCatalog>>,
) {
  const before = incoming.catalog.digest()
  const { specification } = await loadSpecification()
  const native = await readCatalog(incoming.catalog, specification)
  const records = specification.invariants.map((invariant) => ({
    payloadId: invariant.payload.PAYLOAD_ID,
    payloadKind: invariant.payload.PAYLOAD_KIND,
    sqlHash: invariant.payload.SQL_SHA256,
    schema: invariant.schema,
    name: invariant.name,
    expectedColumns: invariant.columns,
    expectedUniqueConstraints: invariant.uniqueConstraints,
    actualRelation:
      native.relations.find(
        (relation) => relation.schema === invariant.schema && relation.name === invariant.name,
      ) ?? null,
    sourceOrigins: incoming.baseline.provenance.filter((origin) => origin.table === invariant.name),
    inspection: inspectPayload(invariant, native),
  }))
  if (incoming.catalog.digest() !== before)
    throw new ProvisioningError('FAKE_SOURCE_FIXTURE_INSPECTION_MUTATED_CATALOG')
  return {
    records,
    denied: records.filter(
      (record) =>
        record.inspection.STATE === 'PRESENT_DRIFTED' ||
        record.inspection.STATE === 'PRECONDITION_MISSING',
    ),
    physicalDigest: incoming.catalog.physicalDigest(),
    executionAuthorized: false as const,
  }
}

/** Conditional W5 test input, not proof that the Django macro can reach a verified W4P state. */
export async function createFakeCanonicalW4pReplayPredecessor(
  plan: ReturnType<typeof compileReplayUnitPlan>,
  pin: ReplayPositionPin,
  repositoryRoot: string,
  wheelhouse: string,
) {
  const incoming = await createFakeSourceIncomingCatalog(plan, pin, repositoryRoot, wheelhouse)
  const { specification } = await loadSpecification()
  const file = resolve(
    repositoryRoot,
    'apps',
    'union-eyes',
    'db',
    'migrations-audit',
    '0000_familiar_silhouette.sql',
  )
  const historical = readFileSync(file, 'utf8')
  const historicalHash = replayHash(historical)
  if (historicalHash !== 'bd0e7ce522c7e0d9706b6d10d3e27bf5b93e874024c13eadb5e03c93efce5faa')
    throw new ProvisioningError('FAKE_CANONICAL_FIXTURE_CONTEXT_SOURCE_DRIFT')
  const statements = frozenStatements(historical)
  const declarations = statements.flatMap((statement) => {
    const definition = tableDefinition(statement.TEXT)
    return definition ? [{ definition, statement }] : []
  })
  const parents = specification.invariants.filter(
    (invariant) => invariant.payload.PAYLOAD_KIND === 'ADD_COLUMN',
  )
  const tables = incoming.catalog.tableInventory()
  const context = fakeFixtureContext(pin)
  const types = new FakeReplayCatalog(context)
  for (const invariant of specification.invariants.filter((entry) => entry.enumMembers))
    await types.applyFrozenUnit(invariant.payload.SQL, invariant.payload.SQL_SHA256)
  for (const statement of statements) {
    const tokens = sqlTokens(statement.TEXT)
    if (
      tokens[0]?.value.toUpperCase() !== 'CREATE' ||
      tokens[1]?.value.toUpperCase() !== 'TYPE' ||
      tokens[2]?.value !== 'public' ||
      tokens[3]?.value !== '.' ||
      tokens[5]?.value.toUpperCase() !== 'AS' ||
      tokens[6]?.value.toUpperCase() !== 'ENUM'
    )
      continue
    const name = tokens[4].value
    if (types.enumInventory().some((type) => type.name === name)) continue
    await types.applyFrozenUnit(statement.TEXT, replayHash(statement.TEXT))
  }
  const enums = types.enumInventory()
  const contextFields: { table: string; column: string; sourceHash: string; definition: string }[] =
    []
  for (const invariant of parents) {
    const table = tables.find(
      (entry) => entry.schema === invariant.schema && entry.name === invariant.name,
    )
    if (!table) throw new ProvisioningError('FAKE_CANONICAL_FIXTURE_ACCEPTED_PARENT_REQUIRED')
    const owned = new Set(invariant.columns.map((column) => column.name))
    table.columns = table.columns.filter((column) => !owned.has(column.name))
    table.uniqueConstraints = table.uniqueConstraints?.filter(
      (constraint) => !constraint.columns.some((column) => owned.has(column)),
    )
    table.checkConstraints = table.checkConstraints?.filter(
      (constraint) => !constraint.columns.some((column) => owned.has(column)),
    )
    if (table.primaryKey.some((column) => owned.has(column)))
      throw new ProvisioningError('FAKE_CANONICAL_FIXTURE_PARENT_KEY_CONFLICT')
    for (const column of invariant.requiredExistingColumns) {
      if (table.columns.some((entry) => entry.name === column)) continue
      const candidates = declarations.filter((entry) => entry.definition.name === invariant.name)
      if (candidates.length !== 1)
        throw new ProvisioningError('FAKE_CANONICAL_FIXTURE_EXACT_CONTEXT_DECLARATION_REQUIRED')
      const field = candidates[0].definition.fields.find((entry) => entry.name === column)
      if (!field) throw new ProvisioningError('FAKE_CANONICAL_FIXTURE_CONTEXT_FIELD_REQUIRED')
      const parsed = parseFakeSourceColumn(field, enums)
      if (parsed.primary)
        throw new ProvisioningError('FAKE_CANONICAL_FIXTURE_CONTEXT_PRIMARY_KEY_UNSUPPORTED')
      table.columns.push(parsed.column)
      contextFields.push({
        table: table.name,
        column,
        sourceHash: replayHash(candidates[0].statement.TEXT),
        definition: field.definition,
      })
    }
  }
  const contextualEnums = enums.filter(
    (type) =>
      !specification.invariants.some(
        (invariant) => invariant.enumMembers && invariant.name === type.name,
      ) &&
      tables.some((table) =>
        table.columns.some(
          (column) => column.type_schema === type.schema && column.type_name === type.name,
        ),
      ),
  )
  for (const table of tables) table.owner = pin.execution.actorPrincipal
  const catalog = new FakeReplayCatalog({
    ...context,
    tables,
    enums: contextualEnums,
    acl: {
      objects: [
        {
          kind: 'SCHEMA',
          schema: 'public',
          name: 'public',
          owner: pin.execution.actorPrincipal,
          grants: [],
        },
        ...tables.map((table) => ({
          kind: 'TABLE' as const,
          schema: table.schema,
          name: table.name,
          owner: pin.execution.actorPrincipal,
          grants: [],
        })),
      ],
      defaults: [],
    },
  })
  await catalog.transaction(async () => {
    for (const invariant of topologicalOrder(specification.invariants))
      await catalog.applyFrozenUnit(invariant.payload.SQL, invariant.payload.SQL_SHA256)
    const native = await readCatalog(catalog, specification)
    for (const invariant of specification.invariants)
      if (inspectPayload(invariant, native).STATE !== 'PRESENT_MATCHING')
        throw new ProvisioningError(
          `FAKE_CANONICAL_FIXTURE_W4P_POSTCONDITION:${invariant.payload.PAYLOAD_ID}`,
        )
  })
  return {
    catalog,
    historicalHash,
    contextFields,
    inputModel: 'ASSUMED_VERIFIED_CANONICAL_W4P' as const,
    djangoToW4pProven: false as const,
    executionAuthorized: false as const,
  }
}

export function createFakeFinancialReplayPredecessor(pin: ReplayPositionPin) {
  if (pin.execution.scope !== 'FINANCIAL_SERVICE')
    throw new ProvisioningError('FAKE_SOURCE_FIXTURE_FINANCIAL_SCOPE_REQUIRED')
  return new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public'],
    roles: [pin.execution.actorPrincipal],
    database: pin.database,
    functionContext: {
      actor: pin.execution.actorPrincipal,
      creationSchema: 'public',
      searchPath: [...pin.searchPath],
      defaultAcl: [],
    },
  })
}
