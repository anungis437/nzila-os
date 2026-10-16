import { describe, expect, it } from 'vitest'
import {
  applyPromotion,
  catalogQueries,
  compileInvariant,
  contextFailures,
  inspectPayload,
  planPromotion,
  readCatalog,
  sqlHash,
  topologicalOrder,
  validateSpecification,
  verifyBaseline,
  type CatalogState,
  type ExecutionAuthorization,
  type PayloadInvariant,
  type PromotionAdapter,
  type PromotionClient,
  type PromotionContext,
} from './platform-baseline-promotion'
import {
  buildPlan,
  type BindingPacket,
  type BootstrapContract,
  type RoleDescriptor,
  type Snapshot,
  type TargetContract,
} from './governed-provisioning'
import {
  loadSpecification,
  originalInputs,
} from '../../../../scripts/ue/implement-w4p-platform-promotion'
import { digest } from '../../../../scripts/ue/w4-physical-producers'

const { specification } = await loadSpecification()
const original = await originalInputs()
const canonical: BootstrapContract & {
  searchPathContract: { MIGRATION_SEARCH_PATH: Record<string, string[]> }
} = JSON.parse(original.canonicalBytes)
function fixtureContext(): PromotionContext {
  const targetContract: TargetContract = {
    databaseActors: (['UE_OPERATIONAL', 'FINANCIAL_SERVICE'] as const).map((scope) => ({
      DATABASE_ACTOR_ID: `UE-W2-ACTOR-${scope === 'UE_OPERATIONAL' ? 'UE_PROVISIONING' : 'FINANCIAL_PROVISIONING'}`,
      ACTOR_PURPOSE: scope === 'UE_OPERATIONAL' ? 'PROVISIONING' : 'FINANCIAL_PROVISIONING',
      DATABASE_SCOPE_ID: scope,
      TARGET_ID: `UE-W2-TARGET-${scope}`,
      ROLE_CLASS: scope === 'UE_OPERATIONAL' ? 'MIGRATION_ADMIN' : 'FINANCIAL_MIGRATION',
      SEARCH_PATH_CONTRACT_ID:
        scope === 'UE_OPERATIONAL'
          ? 'UE-W2-PATH-UE_PROVISIONING'
          : 'UE-W2-PATH-FINANCIAL_PROVISIONING',
      HOST_BINDING: `${scope}_HOST`,
      PORT_BINDING: `${scope}_PORT`,
      DATABASE_NAME_BINDING: `${scope}_DATABASE`,
    })),
    searchPathContracts: Object.entries(canonical.searchPathContract.MIGRATION_SEARCH_PATH).map(
      ([SEARCH_PATH_CONTRACT_ID, SEARCH_PATH]) => ({ SEARCH_PATH_CONTRACT_ID, SEARCH_PATH }),
    ),
  }
  const bindings: BindingPacket = {
    targets: targetContract.databaseActors.map(({ ACTOR_PURPOSE: _purpose, ...actor }) => ({
      ...actor,
      ENVIRONMENT_ID: 'offline_fixture',
      HOST: 'offline.example.invalid',
      PORT: 5432,
      DATABASE_NAME:
        actor.DATABASE_SCOPE_ID === 'UE_OPERATIONAL' ? 'fixture_operational' : 'fixture_financial',
      SEARCH_PATH: ['pg_catalog'],
    })),
    principals: {
      MIGRATION_ADMIN: 'fixture_migration',
      APPLICATION_RUNTIME: 'union_eyes_runtime',
      SYSTEM_OR_INTERNAL_RUNTIME: 'union_eyes_system',
      FINANCIAL_MIGRATION: 'fixture_financial_migration',
      FINANCIAL_RUNTIME: 'fixture_financial_runtime',
    },
    loginPrincipals: {
      MIGRATION_ADMIN: 'fixture_migration_login',
      APPLICATION_RUNTIME: 'fixture_application_login',
      SYSTEM_OR_INTERNAL_RUNTIME: 'fixture_system_login',
      FINANCIAL_MIGRATION: 'fixture_financial_migration_login',
      FINANCIAL_RUNTIME: 'fixture_financial_runtime_login',
    },
    executorPrincipal: 'fixture_operator',
  }
  const provisioningPlan = buildPlan('UE_OPERATIONAL', bindings, canonical, targetContract)
  const delegation = provisioningPlan.DELEGATION_BINDINGS
  const role = (name: string): RoleDescriptor => ({
    name,
    login: false,
    superuser: false,
    bypassRls: false,
    createDb: false,
    createRole: false,
    replication: false,
    inherit: false,
    memberships: [],
    memberRoles: [],
    ownedObjects: [],
  })
  const snapshot: Snapshot = {
    target: provisioningPlan.TARGET,
    currentUser: provisioningPlan.EXECUTOR_PRINCIPAL,
    currentRole: provisioningPlan.EXECUTOR_PRINCIPAL,
    temporaryNamespacePresent: false,
    roles: [
      ...provisioningPlan.ROLE_SPECS.map((spec) =>
        role(provisioningPlan.PRINCIPALS[spec.ROLE_CLASS]!),
      ),
      ...delegation.map((binding) => ({ ...role(binding.LOGIN_PRINCIPAL), login: true })),
    ],
    membershipEdges: delegation.map((binding) => ({
      grantedRole: binding.AUTHORIZATION_ROLE,
      memberRole: binding.LOGIN_PRINCIPAL,
      adminOption: false,
      setOption: true,
    })),
    extensions: provisioningPlan.EXTENSION_SPECS.map((extension) => ({
      name: extension.EXTENSION,
      available: true,
      platformVersion: 'fixture-version',
      supportsPublicPlacement: true,
      installed: { schema: 'public', version: 'fixture-version' },
    })),
    privileges: provisioningPlan.ROLE_SPECS.map((spec) => ({
      principal: provisioningPlan.PRINCIPALS[spec.ROLE_CLASS]!,
      connect: true,
      temp: false,
      databaseCreate: false,
      schemaUsage: true,
      schemaCreate: spec.SCHEMA_CREATE_EXPECTATION === 'public CREATE',
      grantOptions: false,
      ownsDatabase: false,
      ownsPublicSchema: false,
    })),
    publicPrivileges: {
      connect: false,
      temp: false,
      databaseCreate: false,
      schemaUsage: false,
      schemaCreate: false,
      functionExecuteDefaults: false,
    },
    defaultPrivileges: provisioningPlan.ROLE_SPECS.filter(
      (spec) => spec.SCHEMA_CREATE_EXPECTATION === 'public CREATE',
    ).map((spec) => ({
      creator: provisioningPlan.PRINCIPALS[spec.ROLE_CLASS]!,
      publicFunctionExecute: false,
      unauthorizedRecipients: [],
    })),
  }
  for (const item of snapshot.roles) {
    item.memberships = snapshot.membershipEdges
      .filter((edge) => edge.memberRole === item.name)
      .map((edge) => edge.grantedRole)
    item.memberRoles = snapshot.membershipEdges
      .filter((edge) => edge.grantedRole === item.name)
      .map((edge) => edge.memberRole)
  }
  const expectedTarget = {
    ...bindings.targets[0],
    ...specification.targetBinding,
    DATABASE_SCOPE_ID: 'UE_OPERATIONAL' as const,
    ROLE_CLASS: 'MIGRATION_ADMIN' as const,
    SEARCH_PATH: specification.searchPath,
  }
  return {
    expectedTarget,
    actualTarget: structuredClone(expectedTarget),
    currentUser: bindings.loginPrincipals.MIGRATION_ADMIN,
    currentRole: bindings.principals.MIGRATION_ADMIN,
    migrationLogin: bindings.loginPrincipals.MIGRATION_ADMIN,
    migrationPrincipal: bindings.principals.MIGRATION_ADMIN,
    authenticated: true,
    fullDjangoGraphVerified: true,
    provisioningPlan,
    provisioningSnapshot: snapshot,
  }
}
function materialize(catalog: CatalogState, invariant: PayloadInvariant): void {
  if (invariant.enumMembers) {
    catalog.types.push({
      schema: 'public',
      name: invariant.name,
      kind: 'e',
      enumMembers: [...invariant.enumMembers],
    })
    return
  }
  let relation = catalog.relations.find(
    (record) => record.schema === invariant.schema && record.name === invariant.name,
  )
  if (!relation) {
    relation = {
      schema: 'public',
      name: invariant.name,
      kind: 'r',
      columns: [],
      uniqueConstraints: [],
    }
    catalog.relations.push(relation)
  }
  relation.columns.push(...invariant.columns.map((column) => ({ ...column, dropped: false })))
  relation.uniqueConstraints.push(
    ...invariant.uniqueConstraints.map((constraint) => ({
      ...constraint,
      name: constraint.name ?? `fixture_${constraint.columns.join('_')}_key`,
      validated: true,
      indexValid: true,
      indexReady: true,
      indexLive: true,
      nullsNotDistinct: false,
    })),
  )
}
function absentCatalog(): CatalogState {
  const catalog: CatalogState = { relations: [], types: [] }
  for (const invariant of specification.invariants.filter(
    (record) => record.payload.PAYLOAD_KIND === 'ADD_COLUMN',
  )) {
    if (catalog.relations.some((record) => record.name === invariant.name)) continue
    catalog.relations.push({
      schema: 'public',
      name: invariant.name,
      kind: 'r',
      columns: invariant.requiredExistingColumns.map((name) => ({
        name,
        postgresType: 'text',
        notNull: false,
        defaultExpression: null,
        identity: '',
        generated: '',
        dropped: false,
      })),
      uniqueConstraints: [],
    })
  }
  return catalog
}
function matchingCatalog(): CatalogState {
  const catalog = absentCatalog()
  for (const invariant of specification.invariants) materialize(catalog, invariant)
  return catalog
}
class FakeAdapter implements PromotionAdapter, PromotionClient {
  catalog: CatalogState
  contextValue = fixtureContext()
  executions: string[] = []
  transactions = 0
  rollbacks = 0
  commits = 0
  failAfter: number | null = null
  corruptAfter = false
  queryFailure = false
  constructor(catalog: CatalogState) {
    this.catalog = structuredClone(catalog)
  }
  async context() {
    return structuredClone(this.contextValue)
  }
  async query(sql: string, parameters: string[]): Promise<unknown[]> {
    if (this.queryFailure) throw new Error('fixture catalog transport failure')
    const [schema, name] = parameters
    if (sql === catalogQueries.type) {
      const type = this.catalog.types.find((type) => type.schema === schema && type.name === name)
      return type ? [{ kind: type.kind, members: type.enumMembers }] : []
    }
    const relation = this.catalog.relations.find(
      (relation) => relation.schema === schema && relation.name === name,
    )
    if (sql === catalogQueries.relation) return relation ? [{ kind: relation.kind }] : []
    if (sql === catalogQueries.columns)
      return (
        relation?.columns
          .filter((column) => !column.dropped)
          .map((column) => ({
            name: column.name,
            postgres_type: column.postgresType,
            not_null: column.notNull,
            default_expression: column.defaultExpression,
            identity: column.identity,
            generated: column.generated,
          })) ?? []
      )
    if (sql === catalogQueries.unique)
      return (
        relation?.uniqueConstraints.map((constraint) => ({
          name: constraint.name,
          columns: constraint.columns,
          deferrable: constraint.deferrable,
          initially_deferred: constraint.initiallyDeferred,
          validated: constraint.validated,
          index_valid: constraint.indexValid,
          index_ready: constraint.indexReady,
          index_live: constraint.indexLive,
          nulls_not_distinct: constraint.nullsNotDistinct,
        })) ?? []
      )
    throw new Error('unregistered query')
  }
  async execute(sql: string) {
    if (this.failAfter === this.executions.length) throw new Error('fixture DDL rejected')
    const invariant = specification.invariants.find((record) => record.payload.SQL === sql)
    if (!invariant) throw new Error('rewritten/unregistered canonical SQL')
    this.executions.push(sql)
    materialize(this.catalog, invariant)
    if (this.corruptAfter && this.executions.length === 1)
      this.catalog.types[0].enumMembers.reverse()
  }
  async withExclusiveTransaction<T>(work: (client: PromotionClient) => Promise<T>): Promise<T> {
    this.transactions++
    const before = structuredClone(this.catalog)
    try {
      const result = await work(this)
      this.commits++
      return result
    } catch (error: unknown) {
      this.catalog = before
      this.rollbacks++
      throw error
    }
  }
}
function authorization(
  plan: ReturnType<typeof planPromotion>,
  context: PromotionContext,
): ExecutionAuthorization {
  return {
    purpose: 'W4P_PLATFORM_BASELINE_APPLY',
    planDigest: plan.PLAN_DIGEST,
    payloadRegistryDigest: specification.payloadRegistryDigest,
    targetDigest: digest(context.expectedTarget),
    actorPrincipal: context.migrationPrincipal,
    executionApproved: true,
  }
}

describe('W4P platform baseline promotion - fake catalogs only', () => {
  it('represents exactly162 payloads and183 obligations without regenerated SQL', () => {
    validateSpecification(specification)
    expect(specification.invariants).toHaveLength(162)
    expect(specification.obligationIds).toHaveLength(183)
    expect(
      new Set(
        specification.invariants.flatMap((record) => record.payload.DEFINITION_OBLIGATION_IDS),
      ).size,
    ).toBe(183)
    expect(contextFailures(specification, fixtureContext())).toEqual([])
  })
  it.each(specification.invariants)(
    'inspects ABSENT exact immutable payload:$payload.PAYLOAD_ID',
    (invariant) => {
      expect(inspectPayload(invariant, absentCatalog()).STATE).toBe('ABSENT')
      expect(sqlHash(invariant.payload.SQL)).toBe(invariant.payload.SQL_SHA256)
      expect(compileInvariant(invariant.payload)).toEqual(invariant)
    },
  )
  it.each(specification.invariants)(
    'inspects PRESENT_MATCHING and verifies all applicable invariants:$payload.PAYLOAD_ID',
    (invariant) => {
      const inspection = inspectPayload(invariant, matchingCatalog())
      expect(inspection.STATE).toBe('PRESENT_MATCHING')
      expect(inspection.PLANNED_ACTION).toBe('VERIFY_ONLY')
    },
  )
  it.each(specification.invariants)(
    'classifies missing global precondition with no executable action:$payload.PAYLOAD_ID',
    (invariant) => {
      expect(
        inspectPayload(invariant, matchingCatalog(), ['NO_AUTHENTICATED_TARGET']),
      ).toMatchObject({ STATE: 'PRECONDITION_MISSING', PLANNED_ACTION: 'FAIL_CLOSED' })
    },
  )
  it.each(specification.invariants.filter((record) => record.enumMembers))(
    'rejects exact enum-order drift:$payload.PAYLOAD_ID',
    (invariant) => {
      const catalog = matchingCatalog()
      const type = catalog.types.find((record) => record.name === invariant.name)!
      type.enumMembers.reverse()
      expect(inspectPayload(invariant, catalog).STATE).toBe('PRESENT_DRIFTED')
    },
  )
  it.each(
    specification.invariants.filter((record) => record.payload.PAYLOAD_KIND === 'CREATE_RELATION'),
  )('matches contextual relation superset without reauthoring:$payload.PAYLOAD_ID', (invariant) => {
    const catalog = matchingCatalog()
    const relation = catalog.relations.find((record) => record.name === invariant.name)!
    relation.columns.push({
      name: 'contextual_downstream',
      postgresType: 'jsonb',
      notNull: false,
      defaultExpression: null,
      identity: '',
      generated: '',
      dropped: false,
    })
    expect(inspectPayload(invariant, catalog).STATE).toBe('PRESENT_MATCHING')
    relation.columns = relation.columns.filter(
      (column) => column.name !== invariant.columns[0].name,
    )
    expect(inspectPayload(invariant, catalog).STATE).toBe('PRESENT_DRIFTED')
  })
  it.each(
    specification.invariants.filter((record) => record.payload.PAYLOAD_KIND === 'ADD_COLUMN'),
  )('rejects missing accepted parent rather than creating it:$payload.PAYLOAD_ID', (invariant) => {
    expect(inspectPayload(invariant, { types: [], relations: [] })).toMatchObject({
      STATE: 'PRECONDITION_MISSING',
      PLANNED_ACTION: 'FAIL_CLOSED',
    })
  })
  it.each(['postgresType', 'notNull', 'defaultExpression', 'identity', 'generated'] as const)(
    'rejects column property drift:%s',
    (property) => {
      const invariant = specification.invariants.find(
        (record) => record.payload.PAYLOAD_KIND === 'ADD_COLUMN',
      )!
      const catalog = matchingCatalog()
      const column = catalog.relations
        .find((record) => record.name === invariant.name)!
        .columns.find((record) => record.name === invariant.columns[0].name)!
      if (property === 'notNull') column.notNull = !column.notNull
      else if (property === 'postgresType') column.postgresType = 'jsonb'
      else if (property === 'defaultExpression') column.defaultExpression = 'now()'
      else column[property] = 'a'
      expect(inspectPayload(invariant, catalog).STATE).toBe('PRESENT_DRIFTED')
    },
  )
  it('normalizes only the exact known PostgreSQL varchar literal default representation', () => {
    const invariant = specification.invariants.find(
      (record) => record.name === 'shared_clause_library',
    )!
    const catalog = matchingCatalog()
    const column = catalog.relations
      .find((record) => record.name === invariant.name)!
      .columns.find((column) => column.name === 'sharing_level')!
    column.defaultExpression = "'private'::character varying"
    expect(inspectPayload(invariant, catalog).STATE).toBe('PRESENT_MATCHING')
    column.defaultExpression = "'public'::character varying"
    expect(inspectPayload(invariant, catalog).STATE).toBe('PRESENT_DRIFTED')
  })
  it.each(specification.invariants.filter((record) => record.uniqueConstraints.length))(
    'verifies every actually emitted W4 UNIQUE,not deferred metadata:$payload.PAYLOAD_ID',
    (invariant) => {
      const catalog = matchingCatalog()
      const relation = catalog.relations.find((record) => record.name === invariant.name)!
      relation.uniqueConstraints[0].indexValid = false
      expect(inspectPayload(invariant, catalog).STATE).toBe('PRESENT_DRIFTED')
      relation.uniqueConstraints[0].indexValid = true
      relation.uniqueConstraints[0].nullsNotDistinct = true
      expect(inspectPayload(invariant, catalog).STATE).toBe('PRESENT_DRIFTED')
      relation.uniqueConstraints = []
      expect(inspectPayload(invariant, catalog).STATE).toBe('PRESENT_DRIFTED')
    },
  )
  it.each([
    ...new Set(
      specification.invariants.flatMap((record) => record.payload.DEFERRED_CONSTRAINT_HANDOFF_IDS),
    ),
  ])('keeps deferred constraint outside mutation and verification:%s', (id) => {
    const invariants = specification.invariants.filter((record) =>
      record.payload.DEFERRED_CONSTRAINT_HANDOFF_IDS.includes(id),
    )
    expect(invariants.length).toBeGreaterThan(0)
    expect(invariants.every((record) => record.uniqueConstraints.length === 0)).toBe(true)
    expect(
      invariants.every(
        (record) => inspectPayload(record, matchingCatalog()).STATE === 'PRESENT_MATCHING',
      ),
    ).toBe(true)
  })
  it('proves deterministic complete layered topological ordering', () => {
    const order = topologicalOrder(specification.invariants)
    expect(new Set(order.map((record) => record.payload.PAYLOAD_ID)).size).toBe(162)
    expect(
      order.slice(0, 36).every((record) => record.payload.PAYLOAD_KIND === 'TYPE_DEFINITION'),
    ).toBe(true)
    expect(
      order.slice(36, 93).every((record) => record.payload.PAYLOAD_KIND === 'CREATE_RELATION'),
    ).toBe(true)
    expect(order.slice(93).every((record) => record.payload.PAYLOAD_KIND === 'ADD_COLUMN')).toBe(
      true,
    )
    expect(topologicalOrder([...specification.invariants].reverse())).toEqual(order)
  })
  it('rejects missing DAG dependencies,cycles and layer inversions', () => {
    const fixtures = structuredClone(specification.invariants.slice(0, 2))
    fixtures[0].payload.DEPENDENCY_PAYLOAD_IDS = ['unknown']
    expect(() => topologicalOrder(fixtures)).toThrow('UNRESOLVED_PAYLOAD_DEPENDENCY')
    fixtures[0].payload.DEPENDENCY_PAYLOAD_IDS = [fixtures[1].payload.PAYLOAD_ID]
    fixtures[1].payload.DEPENDENCY_PAYLOAD_IDS = [fixtures[0].payload.PAYLOAD_ID]
    expect(() => topologicalOrder(fixtures)).toThrow('PAYLOAD_GRAPH_CYCLE')
    fixtures[1].payload.DEPENDENCY_PAYLOAD_IDS = []
    expect(topologicalOrder(fixtures)[0]).toBe(fixtures[1])
  })
  it('rejects SQL hash drift and inspector invariant tampering before access or mutation', () => {
    const changed = structuredClone(specification)
    changed.invariants[0].payload.SQL += '\n'
    expect(() => validateSpecification(changed)).toThrow('CANONICAL_SQL_HASH_DRIFT')
    const invariantChanged = structuredClone(specification)
    invariantChanged.invariants[0].enumMembers?.reverse()
    expect(() => validateSpecification(invariantChanged)).toThrow(
      'INSPECTOR_CANONICAL_INVARIANT_DRIFT',
    )
  })
  it('rejects rewritten DDL even if a caller recomputes its SQL hash and inspection invariants', () => {
    const changed = structuredClone(specification)
    const first = changed.invariants[0]
    first.payload.SQL = first.payload.SQL.replace("'per_member_count'", "'unauthorized_member'")
    first.payload.SQL_SHA256 = sqlHash(first.payload.SQL)
    changed.invariants[0] = compileInvariant(first.payload)
    expect(() => validateSpecification(changed)).toThrow('W4FR4_PAYLOAD_COMMITMENT_DRIFT')
  })
  it('rejects weakened exact governed W2/W3 preconditions rather than relying on ambient defaults', () => {
    const changed = structuredClone(specification)
    changed.requiredExtensions = []
    expect(() => validateSpecification(changed)).toThrow('AUTHORITATIVE_W2_W3_PRECONDITION_DRIFT')
    const wrongCut = structuredClone(specification)
    wrongCut.dependencyCutDigest = 'unapproved'
    expect(() => validateSpecification(wrongCut)).toThrow('AUTHORITATIVE_REGISTRY_OR_CUT_DRIFT')
  })
  it('rejects contextual compound-constraint operand absence as a precondition', () => {
    const invariant = specification.invariants.find(
      (record) => record.name === 'integration_configs',
    )!
    const catalog = absentCatalog()
    catalog.relations.find((record) => record.name === invariant.name)!.columns = []
    expect(inspectPayload(invariant, catalog).STATE).toBe('PRECONDITION_MISSING')
  })
  it.each(['actor', 'target', 'searchPath', 'extension', 'delegation', 'django', 'authenticated'])(
    'fails closed on exact W2/W3/macro authority precondition:%s',
    (kind) => {
      const context = fixtureContext()
      if (kind === 'actor') context.actualTarget.ROLE_CLASS = 'APPLICATION_RUNTIME'
      if (kind === 'target') context.actualTarget.DATABASE_NAME = 'wrong_database'
      if (kind === 'searchPath') context.actualTarget.SEARCH_PATH = ['public']
      if (kind === 'extension') context.provisioningSnapshot.extensions[0].installed = null
      if (kind === 'delegation') context.provisioningSnapshot.membershipEdges[0].adminOption = true
      if (kind === 'django') context.fullDjangoGraphVerified = false
      if (kind === 'authenticated') context.authenticated = false
      const plan = planPromotion(specification, absentCatalog(), context)
      expect(plan.PLAN_STATE).toBe('FAIL_CLOSED')
      expect(
        plan.PER_PAYLOAD_INSPECTION_RESULT.every(
          (record) => record.STATE === 'PRECONDITION_MISSING',
        ),
      ).toBe(true)
    },
  )
  it('reads all baseline catalog objects with registered read-only parameterized queries', async () => {
    const fake = new FakeAdapter(matchingCatalog())
    const catalog = await readCatalog(fake, specification)
    const expected = matchingCatalog()
    expect(catalog.types.sort((a, b) => a.name.localeCompare(b.name))).toEqual(
      expected.types.sort((a, b) => a.name.localeCompare(b.name)),
    )
    expect(catalog.relations.sort((a, b) => a.name.localeCompare(b.name))).toEqual(
      expected.relations.sort((a, b) => a.name.localeCompare(b.name)),
    )
    expect(fake.executions).toEqual([])
    expect(
      Object.values(catalogQueries).every(
        (sql) => sql.startsWith('SELECT ') && sql.includes('$1') && sql.includes('$2'),
      ),
    ).toBe(true)
  })
  it('propagates catalog transport errors rather than converting them to success or absence', async () => {
    const fake = new FakeAdapter(matchingCatalog())
    fake.queryFailure = true
    await expect(readCatalog(fake, specification)).rejects.toThrow(
      'fixture catalog transport failure',
    )
  })
  it('rejects incomplete catalog values instead of manufacturing defaults', async () => {
    await expect(
      readCatalog({ query: async () => [{ kind: 'e', members: null }] }, specification),
    ).rejects.toThrow('INVALID_CATALOG_STRING_ARRAY')
  })
  it('proves fake-only absent apply,exact SQL delivery,final full reread and immediate replay no-op', async () => {
    const fake = new FakeAdapter(absentCatalog())
    const context = fixtureContext()
    const plan = planPromotion(specification, fake.catalog, context)
    expect(plan.MUTATION_COUNT).toBe(162)
    const receipt = await applyPromotion(
      specification,
      plan,
      context,
      fake,
      authorization(plan, context),
      () => 'fixture-time',
    )
    expect(fake.executions).toEqual(
      topologicalOrder(specification.invariants).map((record) => record.payload.SQL),
    )
    expect(receipt).toMatchObject({
      PAYLOAD_TOTAL: 162,
      MUTATED_COUNT: 162,
      NOOP_COUNT: 0,
      ROLLBACK_OCCURRED: false,
      FINAL_VERIFICATION: { DEFINITIONS_VERIFIED: 183, TYPES_VERIFIED: 36, W4_OWNED_DRIFT: 0 },
    })
    const replay = planPromotion(specification, fake.catalog, context)
    expect(replay.PLAN_STATE).toBe('REPLAY_NOOP')
    expect(replay.MUTATION_COUNT).toBe(0)
    const replayReceipt = await applyPromotion(
      specification,
      replay,
      context,
      fake,
      authorization(replay, context),
      () => 'fixture-time',
    )
    expect(replayReceipt.MUTATED_COUNT).toBe(0)
    expect(replayReceipt.NOOP_COUNT).toBe(162)
    expect(fake.executions).toHaveLength(162)
    expect(verifyBaseline(specification, fake.catalog, context).DEFINITIONS_VERIFIED).toBe(183)
  })
  it('denies execution by default before entering a transaction', async () => {
    const fake = new FakeAdapter(absentCatalog())
    const context = fixtureContext()
    const plan = planPromotion(specification, fake.catalog, context)
    await expect(applyPromotion(specification, plan, context, fake)).rejects.toThrow(
      'EXPLICIT_EXECUTION_AUTHORIZATION_REQUIRED',
    )
    expect(fake.transactions).toBe(0)
    expect(fake.executions).toEqual([])
  })
  it('denies target/plan/actor authorization mismatch and missing concurrency boundary', async () => {
    const fake = new FakeAdapter(absentCatalog())
    const context = fixtureContext()
    const plan = planPromotion(specification, fake.catalog, context)
    const grant = authorization(plan, context)
    grant.targetDigest = 'wrong'
    await expect(applyPromotion(specification, plan, context, fake, grant)).rejects.toThrow(
      'EXECUTION_AUTHORIZATION_BINDING_DRIFT',
    )
    expect(fake.transactions).toBe(0)
    Reflect.set(fake, 'withExclusiveTransaction', undefined)
    await expect(
      applyPromotion(specification, plan, context, fake, authorization(plan, context)),
    ).rejects.toThrow('EXTERNAL_CONCURRENCY_TRANSACTION_BOUNDARY_REQUIRED')
  })
  it('rolls back fake mutations on intermediate DDL failure without duplicate tolerance', async () => {
    const fake = new FakeAdapter(absentCatalog())
    fake.failAfter = 4
    const before = structuredClone(fake.catalog)
    const context = fixtureContext()
    const plan = planPromotion(specification, before, context)
    await expect(
      applyPromotion(specification, plan, context, fake, authorization(plan, context)),
    ).rejects.toMatchObject({
      failure: { ROLLBACK_REQUIRED: true, ERROR_CLASS: 'PROMOTION_FAILED_DETAILS_REDACTED' },
    })
    expect(fake.rollbacks).toBe(1)
    expect(fake.commits).toBe(0)
    expect(fake.catalog).toEqual(before)
  })
  it('rolls back fake mutations when complete final revalidation detects drift', async () => {
    const fake = new FakeAdapter(absentCatalog())
    const before = structuredClone(fake.catalog)
    fake.corruptAfter = true
    const context = fixtureContext()
    const plan = planPromotion(specification, before, context)
    await expect(
      applyPromotion(specification, plan, context, fake, authorization(plan, context)),
    ).rejects.toThrow('FINAL_BASELINE_VERIFICATION_FAILED')
    expect(fake.rollbacks).toBe(1)
    expect(fake.commits).toBe(0)
    expect(fake.catalog).toEqual(before)
  })
  it('rejects concurrent catalog-state change inside transaction before any mutation', async () => {
    const fake = new FakeAdapter(absentCatalog())
    const context = fixtureContext()
    const plan = planPromotion(specification, fake.catalog, context)
    materialize(fake.catalog, specification.invariants[0])
    await expect(
      applyPromotion(specification, plan, context, fake, authorization(plan, context)),
    ).rejects.toThrow('PROMOTION_STATE_CHANGED_REPLAN_REQUIRED')
    expect(fake.executions).toEqual([])
    expect(fake.rollbacks).toBe(1)
  })
  it('pins exact validated payload bytes against caller mutation across asynchronous execution', async () => {
    const mutableSpecification = structuredClone(specification)
    const fake = new FakeAdapter(absentCatalog())
    const context = fixtureContext()
    const plan = planPromotion(mutableSpecification, fake.catalog, context)
    const execute = fake.execute.bind(fake)
    fake.execute = async (sql: string) => {
      mutableSpecification.invariants[1].payload.SQL += '\n'
      mutableSpecification.invariants[1].payload.SQL_SHA256 = sqlHash(
        mutableSpecification.invariants[1].payload.SQL,
      )
      await execute(sql)
    }
    const receipt = await applyPromotion(
      mutableSpecification,
      plan,
      context,
      fake,
      authorization(plan, context),
    )
    expect(receipt.MUTATED_COUNT).toBe(162)
    expect(fake.executions).toEqual(
      topologicalOrder(specification.invariants).map((record) => record.payload.SQL),
    )
  })
  it('fails closed for drift before transaction/mutation', async () => {
    const fake = new FakeAdapter(matchingCatalog())
    fake.catalog.types[0].enumMembers.reverse()
    const context = fixtureContext()
    const plan = planPromotion(specification, fake.catalog, context)
    await expect(
      applyPromotion(specification, plan, context, fake, authorization(plan, context)),
    ).rejects.toThrow('PROMOTION_PLAN_FAIL_CLOSED')
    expect(fake.transactions).toBe(0)
    expect(fake.executions).toEqual([])
  })
  it.each([
    'enum',
    'relation',
    'type',
    'nullability',
    'default',
    'identity',
    'generated',
    'constraint',
    'parent',
  ])(
    'rejects representative governed drift or missing prerequisite before any mutation:%s',
    async (kind) => {
      const fake = new FakeAdapter(matchingCatalog())
      const invariant = specification.invariants.find(
        (record) => record.payload.PAYLOAD_KIND === 'ADD_COLUMN',
      )!
      const relation = fake.catalog.relations.find((record) => record.name === invariant.name)!
      const column = relation.columns.find((record) => record.name === invariant.columns[0].name)!
      if (kind === 'enum') fake.catalog.types[0].enumMembers.reverse()
      if (kind === 'relation')
        fake.catalog.relations.find(
          (record) =>
            record.name ===
            specification.invariants.find(
              (item) => item.payload.PAYLOAD_KIND === 'CREATE_RELATION',
            )!.name,
        )!.columns = []
      if (kind === 'type') column.postgresType = 'jsonb'
      if (kind === 'nullability') column.notNull = !column.notNull
      if (kind === 'default') column.defaultExpression = 'now()'
      if (kind === 'identity') column.identity = 'a'
      if (kind === 'generated') column.generated = 's'
      if (kind === 'constraint')
        fake.catalog.relations.find(
          (record) => record.uniqueConstraints.length,
        )!.uniqueConstraints = []
      if (kind === 'parent')
        fake.catalog.relations = fake.catalog.relations.filter(
          (record) => record.name !== invariant.name,
        )
      const context = fixtureContext()
      const plan = planPromotion(specification, fake.catalog, context)
      expect(plan.PLAN_STATE).toBe('FAIL_CLOSED')
      await expect(
        applyPromotion(specification, plan, context, fake, authorization(plan, context)),
      ).rejects.toThrow('PROMOTION_PLAN_FAIL_CLOSED')
      expect(fake.executions).toEqual([])
      expect(fake.transactions).toBe(0)
    },
  )
  it('does not accept a weakened or tampered W3 verification model', () => {
    const context = fixtureContext()
    context.provisioningPlan.ROLE_SPECS = []
    expect(contextFailures(specification, context)).toContain('W3_PROVISIONING_PLAN_DIGEST_DRIFT')
    expect(contextFailures(specification, context)).toContain(
      'CANONICAL_W3_MIGRATION_AUTHORITY_REQUIRED',
    )
  })
  it('produces deterministic pure plan digests without receipts or mutations', () => {
    const context = fixtureContext()
    const catalog = matchingCatalog()
    const before = structuredClone(catalog)
    expect(planPromotion(specification, catalog, context)).toEqual(
      planPromotion(specification, catalog, context),
    )
    const plan = planPromotion(specification, catalog, context)
    expect(plan.PRECONDITION_FAILURES).toEqual([])
    expect(plan.PRECONDITIONS).toContain('FULL_CANONICAL_DJANGO_GRAPH:REQUIRED')
    expect(
      plan.PRECONDITIONS.filter((value) => value.startsWith('ACCEPTED_PARENT_RELATION:')),
    ).toHaveLength(69)
    expect(
      plan.PRECONDITIONS.filter((value) => value.startsWith('MATERIALIZED_UNIQUE_OPERAND:')),
    ).toHaveLength(12)
    expect(catalog).toEqual(before)
  })
})
