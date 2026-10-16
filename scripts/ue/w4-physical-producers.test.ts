import { describe, expect, it } from 'vitest'
import {
  buildProducerContract,
  loadInputs,
  prepareDjangoExecution,
  validateGraph,
  validateSql,
  validateAuthorities,
  digest,
  exactIds,
  type DjangoExecutionInput,
  type Inputs,
} from './w4-physical-producers'
import { generate, main } from './implement-w4-physical-producers'

const inputs = loadInputs()
function fixture(): DjangoExecutionInput {
  const actor = inputs.target.databaseActors.find((a) => a.ACTOR_PURPOSE === 'DJANGO_MIGRATION')!
  const path = inputs.target.searchPathContracts.find(
    (p) => p.SEARCH_PATH_CONTRACT_ID === actor.SEARCH_PATH_CONTRACT_ID,
  )!
  const bindings = {
    targets: (['UE_OPERATIONAL', 'FINANCIAL_SERVICE'] as const).map((scope) => {
      const provision = inputs.target.databaseActors.find(
        (a) =>
          a.ACTOR_PURPOSE ===
          (scope === 'UE_OPERATIONAL' ? 'PROVISIONING' : 'FINANCIAL_PROVISIONING'),
      )!
      return {
        TARGET_ID: provision.TARGET_ID,
        DATABASE_SCOPE_ID: scope,
        DATABASE_ACTOR_ID: provision.DATABASE_ACTOR_ID,
        ROLE_CLASS: provision.ROLE_CLASS,
        SEARCH_PATH_CONTRACT_ID: provision.SEARCH_PATH_CONTRACT_ID,
        HOST_BINDING: provision.HOST_BINDING,
        PORT_BINDING: provision.PORT_BINDING,
        DATABASE_NAME_BINDING: provision.DATABASE_NAME_BINDING,
        ENVIRONMENT_ID: 'w4_offline_fixture',
        HOST: 'fixture.invalid',
        PORT: 5432,
        DATABASE_NAME: scope === 'UE_OPERATIONAL' ? 'fixture_operational' : 'fixture_financial',
        SEARCH_PATH: ['pg_catalog'],
      }
    }),
    principals: {
      MIGRATION_ADMIN: 'fixture_migration',
      APPLICATION_RUNTIME: 'union_eyes_runtime',
      SYSTEM_OR_INTERNAL_RUNTIME: 'union_eyes_system',
      FINANCIAL_MIGRATION: 'fixture_financial_migration',
      FINANCIAL_RUNTIME: 'fixture_financial_runtime',
    },
    loginPrincipals: {
      MIGRATION_ADMIN: 'fixture_migration_login',
      APPLICATION_RUNTIME: 'fixture_runtime_login',
      SYSTEM_OR_INTERNAL_RUNTIME: 'fixture_system_login',
      FINANCIAL_MIGRATION: 'fixture_financial_migration_login',
      FINANCIAL_RUNTIME: 'fixture_financial_runtime_login',
    },
    executorPrincipal: 'fixture_operator',
  }
  return {
    bindings,
    target: {
      ...bindings.targets[0],
      DATABASE_ACTOR_ID: actor.DATABASE_ACTOR_ID,
      ROLE_CLASS: actor.ROLE_CLASS,
      SEARCH_PATH_CONTRACT_ID: actor.SEARCH_PATH_CONTRACT_ID,
      SEARCH_PATH: path.SEARCH_PATH,
    },
    settingsModule: 'config.settings',
    settingsFileSha256: inputs.w1.metadata.SETTINGS_SHA256,
    dependencyLockDigest: inputs.w1.digests.DJANGO_PACKAGE_LOCK_DIGEST,
    graphDigest: inputs.w1.digests.DJANGO_MIGRATION_GRAPH_DIGEST,
    planDigest: inputs.w1.digests.DJANGO_MIGRATION_PLAN_DIGEST,
    configuredAppIds: inputs.w1.configuredApps.map((a) => a.APP_ID),
    packageEnvironmentIdentity: inputs.w1.packageAuthority.TARGET,
    swappableConfigurationIdentity: digest(inputs.w1.swappableConfiguration),
    authorizationRole: bindings.principals.MIGRATION_ADMIN,
    loginPrincipal: bindings.loginPrincipals.MIGRATION_ADMIN,
  }
}
describe('W4 fixed producer definitions, no runtime execution', () => {
  it('maps372 exact physical obligations and retains all768 input IDs plus310 decisions', () => {
    const output = buildProducerContract(inputs)
    const work = inputs.canonical.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W4')!
    exactIds(
      output.obligationLinkage.map((o) => o.OBLIGATION_ID),
      work.INPUT_OBLIGATION_IDS,
    )
    exactIds(
      output.governanceDecisions.map((d) => d.DECISION_ID),
      work.INPUT_DECISION_IDS,
    )
    expect(output.djangoProducerRegistry).toHaveLength(372)
    expect(output.obligationLinkage).toHaveLength(768)
    expect(output.governanceDecisions).toHaveLength(310)
    expect(output.governanceDecisions.every((d) => d.APPROVED === 'NO')).toBe(true)
    expect(output.validation.MAPPED_TO_EXACT_DJANGO_PRODUCER).toBe(372)
    expect(output.validation.MAPPED_TO_EXTERNAL_DJANGO_PRODUCER).toBe(0)
    expect(output.validation.DJANGO_SUM).toBe(372)
    expect(output.phaseStatus.PHASE_1B_3C_A1I_W4_GATE).toBe('BLOCKED')
    expect(output.phaseStatus.CONTRACT_1_4_CREATED).toBe('NO')
  })
  it('only maps exact source hashes/operation lines/columns, not candidate proximity', () => {
    const output = buildProducerContract(inputs)
    for (const mapping of output.djangoProducerRegistry) {
      const node = inputs.w1.migrationNodes.find(
        (n) => n.MIGRATION_ID === mapping.DJANGO_PRODUCER_MIGRATION_ID,
      )!
      expect(node.FILE_SHA256).toBe(mapping.PRODUCER_FILE_SHA256)
      expect(
        node.OPERATIONS.some(
          (o) =>
            o.LINE === mapping.PRODUCER_SOURCE_LINE &&
            o.OPERATION_CLASS === mapping.PRODUCER_OPERATION_CLASS,
        ),
      ).toBe(true)
      expect(mapping.DATABASE_SCOPE_ID).toBe('UE_OPERATIONAL')
      expect(mapping.SEARCH_PATH_CONTRACT_ID).toBe('UE-W2-PATH-DJANGO_MIGRATION')
      expect(mapping.RUNTIME_PROVEN).toBe('NO')
    }
  })
  it('keeps external82-node canonical graph and87 locked identities without importing packages', () => {
    const output = buildProducerContract(inputs)
    expect(output.djangoExecutionRegistry).toHaveLength(82)
    expect(
      output.djangoExecutionRegistry.filter(
        (r) => r.PRODUCER_CLASS === 'EXTERNAL_PACKAGE_MIGRATION_PRODUCER',
      ),
    ).toHaveLength(53)
    expect(
      output.djangoExecutionRegistry
        .filter((r) => r.PRODUCER_CLASS === 'EXTERNAL_PACKAGE_MIGRATION_PRODUCER')
        .every(
          (r) =>
            r.PACKAGE_SOURCE_DIGEST &&
            r.LOCKED_VERSION &&
            r.DISTRIBUTION_NAME &&
            r.SOURCE_FILE_SHA256,
        ),
    ).toBe(true)
    expect(validateGraph(output.producerDependencyGraph.NODES)).toHaveLength(82)
    const positions = new Map(
      output.canonicalProducerPlan.map((r) => [r.PRODUCER_ID, r.ORDER_INDEX]),
    )
    for (const row of output.canonicalProducerPlan)
      for (const dep of row.REQUIRES_PRODUCER_IDS)
        expect(positions.get(dep)).toBeLessThan(row.ORDER_INDEX)
  })
  it('preserves raw16 operations and four original W4 wrappers without extracting or executing SQL', () => {
    const output = buildProducerContract(inputs)
    expect(output.rawOperationProducerRegistry).toHaveLength(16)
    expect(
      output.rawOperationProducerRegistry.filter((r) => r.W1N_WRAPPER_RESPONSIBILITY === 'YES'),
    ).toHaveLength(4)
    expect(
      output.rawOperationProducerRegistry.every(
        (r) => r.SEMANTIC_OWNER === 'W6' && r.EXECUTION === 'NO',
      ),
    ).toBe(true)
    expect(output.platformProducerRegistry.every((r) => r.MUTATING_OPERATIONS.length === 0)).toBe(
      true,
    )
    expect(output.platformProducerRegistry).toHaveLength(310)
  })
  it('does not close W5 ordering or W6 semantics when emitting full handoff censuses', () => {
    const output = buildProducerContract(inputs)
    exactIds(
      output.w5OrderingHandoff.map((r) => r.ORDERING_RECORD_ID),
      inputs.canonical.orderingObligations.map((o) => o.ORDERING_RECORD_ID),
    )
    expect(output.w5OrderingHandoff).toHaveLength(86)
    expect(
      output.w5OrderingHandoff.every((h) => h.ORDERING_CLOSED === 'NO' && h.W5_STARTED === 'NO'),
    ).toBe(true)
    exactIds(
      output.w6OpaqueBindingHandoff.map((r) => r.OPAQUE_BINDING_ID),
      inputs.canonical.opaqueBindingObligations.map((o) => o.OPAQUE_BINDING_ID),
    )
    expect(output.w6OpaqueBindingHandoff).toHaveLength(118)
    expect(output.w6OpaqueBindingHandoff.every((h) => h.BINDING_RESOLVED_BY_W4 === 'NO')).toBe(true)
    for (const handoff of output.w6OpaqueBindingHandoff)
      if (handoff.W4_INTERSECTION === 'YES') expect(handoff.W4_PHYSICAL_PRODUCER_ID).toBeTruthy()
      else expect(handoff.W4_PHYSICAL_PRODUCER_ID).toBeNull()
  })
  it('exposes only future read-only relation/column postcondition expectations', () => {
    const output = buildProducerContract(inputs)
    expect(output.postconditionDescriptors).toHaveLength(372)
    for (const descriptor of output.postconditionDescriptors) {
      expect(() => validateSql(descriptor.SQL)).not.toThrow()
      expect(descriptor.PARAMETER_VALUES[0]).toBe('public')
      expect(descriptor.EXPECTED_ROWS).toBe(1)
      expect(descriptor.RUNTIME_PROVEN).toBe('NO')
      expect(descriptor.EXPECTED_TYPE_NULLABILITY_DEFAULT).toContain('Locked Django')
    }
  })
  it('returns a bounded single Django invocation descriptor, never an executing client', () => {
    const result = prepareDjangoExecution(fixture(), inputs)
    expect(result.ARGV).toEqual(['manage.py', 'migrate', '--noinput', '--settings=config.settings'])
    expect(result.EXECUTION).toBe('NO')
    expect(result.STANDALONE_APPLY).toBe('BLOCKED')
    expect(result.ONE_INVOCATION_FOR_COMPLETE_GRAPH).toContain('YES')
  })
  const mutations: [string, (p: DjangoExecutionInput) => void][] = [
    [
      'settings module',
      (p) => {
        p.settingsModule = 'config.production'
      },
    ],
    [
      'settings bytes',
      (p) => {
        p.settingsFileSha256 = 'bad'
      },
    ],
    [
      'lock',
      (p) => {
        p.dependencyLockDigest = 'bad'
      },
    ],
    [
      'graph',
      (p) => {
        p.graphDigest = 'bad'
      },
    ],
    [
      'plan',
      (p) => {
        p.planDigest = 'bad'
      },
    ],
    [
      'apps',
      (p) => {
        p.configuredAppIds.pop()
      },
    ],
    [
      'package environment',
      (p) => {
        p.packageEnvironmentIdentity = {}
      },
    ],
    [
      'swappable',
      (p) => {
        p.swappableConfigurationIdentity = 'bad'
      },
    ],
    [
      'financial target',
      (p) => {
        p.target.DATABASE_SCOPE_ID = 'FINANCIAL_SERVICE'
      },
    ],
    [
      'target tuple',
      (p) => {
        p.target.DATABASE_NAME = 'other'
      },
    ],
    [
      'target actor',
      (p) => {
        p.target.DATABASE_ACTOR_ID = 'UE-W2-ACTOR-PROVISIONING'
      },
    ],
    [
      'target path',
      (p) => {
        p.target.SEARCH_PATH = ['pg_catalog']
      },
    ],
    [
      'target path identity',
      (p) => {
        p.target.SEARCH_PATH_CONTRACT_ID = 'ambient'
      },
    ],
    [
      'runtime role',
      (p) => {
        p.target.ROLE_CLASS = 'APPLICATION_RUNTIME'
      },
    ],
    [
      'authorization',
      (p) => {
        p.authorizationRole = 'wrong'
      },
    ],
    [
      'login missing',
      (p) => {
        p.loginPrincipal = ''
      },
    ],
    [
      'injected login',
      (p) => {
        p.bindings.loginPrincipals.MIGRATION_ADMIN = 'x";SELECT 1'
      },
    ],
    [
      'ambient host',
      (p) => {
        p.bindings.targets[0].HOST = ''
      },
    ],
    [
      'missing explicit setting',
      (p) => {
        Reflect.deleteProperty(p, 'settingsModule')
      },
    ],
    [
      'secret field',
      (p) => {
        Reflect.set(p, 'password', 'synthetic')
      },
    ],
  ]
  it.each(mutations)('rejects explicit adapter drift: %s', (_name, change) => {
    const packet = fixture()
    change(packet)
    expect(() => prepareDjangoExecution(packet, inputs)).toThrow()
  })
  const invalidEvidence: [string, (p: Inputs) => void][] = [
    [
      'graph digest',
      (p) => {
        p.w1.migrationNodes[0].FILE_SHA256 = 'drift'
      },
    ],
    [
      'candidate source digest',
      (p) => {
        const o = p.canonical.prerequisiteObligations.find(
          (o) => o.CREATION_AUTHORITY === 'DJANGO',
        )!
        p.lineage.creationSourceCandidates.find(
          (a) => a.CANDIDATE_ID === o.DJANGO_AUTHORITY_CANDIDATE_IDS![0],
        )!.SOURCE_EVIDENCE.FILE_SHA256 = 'drift'
      },
    ],
    [
      'candidate operation line',
      (p) => {
        const o = p.canonical.prerequisiteObligations.find(
          (o) => o.CREATION_AUTHORITY === 'DJANGO',
        )!
        p.lineage.creationSourceCandidates.find(
          (a) => a.CANDIDATE_ID === o.DJANGO_AUTHORITY_CANDIDATE_IDS![0],
        )!.SOURCE_EVIDENCE.LINE = -1
      },
    ],
    [
      'identity duplicate',
      (p) => {
        const work = p.canonical.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W4')!
        work.INPUT_OBLIGATION_IDS[1] = work.INPUT_OBLIGATION_IDS[0]
      },
    ],
    [
      'invented ownership approval',
      (p) => {
        const work = p.canonical.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W4')!
        p.canonical.governanceDecisionObligations.find(
          (d) => d.DECISION_ID === work.INPUT_DECISION_IDS[0],
        )!.STATUS = 'APPROVED'
      },
    ],
  ]
  it.each(invalidEvidence)(
    'fails closed on %s rather than lowering evidence thresholds',
    (_name, mutate) => {
      const copy = structuredClone(inputs)
      mutate(copy)
      expect(() => buildProducerContract(copy)).toThrow()
    },
  )
  it.each([
    [{ PRODUCER_ID: 'a', REQUIRES_PRODUCER_IDS: ['a'] }],
    [
      { PRODUCER_ID: 'a', REQUIRES_PRODUCER_IDS: ['b'] },
      { PRODUCER_ID: 'b', REQUIRES_PRODUCER_IDS: ['a'] },
    ],
    [{ PRODUCER_ID: 'a', REQUIRES_PRODUCER_IDS: ['missing'] }],
    [
      { PRODUCER_ID: 'a', REQUIRES_PRODUCER_IDS: [] },
      { PRODUCER_ID: 'a', REQUIRES_PRODUCER_IDS: [] },
    ],
  ])('rejects cycle/missing/duplicate producer graph %#', (...nodes) => {
    expect(() => validateGraph(nodes)).toThrow()
  })
  it('rejects competing creation authority and unsafe/destructive/non-readonly SQL', () => {
    expect(() =>
      validateAuthorities([
        { PHYSICAL_IDENTITY: 'public.organizations', CREATE_AUTHORITY: 'Django' },
        { PHYSICAL_IDENTITY: 'public.organizations', CREATE_AUTHORITY: 'platform SQL' },
      ]),
    ).toThrow('MULTIPLE_CREATION_AUTHORITIES')
    for (const sql of [
      'DROP SCHEMA public CASCADE',
      'CREATE EXTENSION vector',
      'CREATE ROLE x',
      'GRANT x TO y',
      'SELECT 1; DELETE FROM public.t;',
      'UPDATE public.t SET x=1',
      'TRUNCATE public.t',
    ])
      expect(() => validateSql(sql)).toThrow()
  })
  it('rejects standalone apply before creating outputs and produces two byte-identical generations', async () => {
    await expect(main(['--apply'])).rejects.toThrow('STANDALONE_APPLY_BLOCKED')
    expect(await generate()).toEqual(await generate())
  })
})
