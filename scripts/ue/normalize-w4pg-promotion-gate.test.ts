import { describe, expect, it } from 'vitest'
import {
  buildCut,
  classifyLocation,
  dependencyPaths,
  emittedUniqueOperands,
  files,
  fixedHashes,
  generate,
  loadInputs,
  main,
  outputs,
} from './normalize-w4pg-promotion-gate'
import type { Edge } from './normalize-w4pg-promotion-gate'
import { digest, read, sha } from './w4-physical-producers'

const model = buildCut()
const inputs = loadInputs()
const source = {
  SOURCE_FILE: 'fixture',
  SOURCE_SHA256: 'fixture',
  JSON_POINTER: '/requires',
  RECORDED_VALUE: ['target'],
}
const edge = (from: string, to: string): Edge => ({
  FROM: from,
  TO: to,
  KIND: 'FIXTURE_RECORDED_REQUIREMENT',
  SOURCE: { ...source, RECORDED_VALUE: [to] },
})

describe('W4PG promotion-gate dependency cut', () => {
  it('covers precisely183 definitions,183 producer records and162 payloads', () => {
    expect(model.cut.definitionSubjects).toHaveLength(183)
    expect(new Set(model.cut.definitionSubjects.map((record) => record.SUBJECT_ID)).size).toBe(183)
    expect(new Set(model.cut.definitionSubjects.map((record) => record.PRODUCER_ID)).size).toBe(183)
    expect(model.cut.payloadSubjects).toHaveLength(162)
    expect(new Set(model.cut.payloadSubjects.map((record) => record.SUBJECT_ID)).size).toBe(162)
    expect(model.report.summary).toMatchObject({
      TYPE_PAYLOADS: 36,
      CREATE_RELATION_PAYLOADS: 57,
      ADD_COLUMN_PAYLOADS: 69,
      ACCEPTED_PARENT_PRECONDITIONS: 69,
    })
  })
  it.each(model.cut.definitionSubjects)(
    'enumerates exact dependency/precondition/postcondition fields:$SUBJECT_ID',
    (record) => {
      for (const key of [
        'DEFINITION_DEPENDENCIES',
        'PAYLOAD_DEPENDENCIES',
        'TYPE_DEPENDENCIES',
        'PRODUCER_PRECONDITIONS',
        'PROMOTION_PRECONDITIONS',
        'REQUIRED_POSTCONDITIONS',
        'DEFERRED_CONSTRAINT_REFERENCES',
      ] as const)
        expect(Array.isArray(record[key])).toBe(true)
      expect(record.SOURCE.SOURCE_SHA256).toBe(fixedHashes[files.definitions])
      expect(record.PRODUCER_SOURCE.SOURCE_SHA256).toBe(fixedHashes[files.producer])
      expect(record.PAYLOAD_DEPENDENCIES[0].RECORDED_VALUE).toBe(record.PAYLOAD_ID)
      expect(record.REQUIRED_POSTCONDITIONS.length).toBeGreaterThan(0)
      for (const key of [
        'DATABASE_SCOPE_ID',
        'DATABASE_ACTOR_ID',
        'TARGET_ID',
        'SEARCH_PATH_CONTRACT_ID',
        'ROLE_CLASS',
      ])
        expect(
          record.PRODUCER_PRECONDITIONS.some((entry) => entry.JSON_POINTER.endsWith(`/${key}`)),
        ).toBe(true)
      expect(
        record.RECORDED_FIELD_INVENTORY.some((entry) =>
          entry.JSON_POINTER.endsWith('/REQUIRED_W3_PRECONDITIONS'),
        ),
      ).toBe(true)
    },
  )
  it.each(model.cut.payloadSubjects)(
    'accounts for exact payload obligations and output signature:$SUBJECT_ID',
    (record) => {
      for (const key of [
        'DEFINITION_DEPENDENCIES',
        'PAYLOAD_DEPENDENCIES',
        'TYPE_DEPENDENCIES',
        'PRODUCER_PRECONDITIONS',
        'PROMOTION_PRECONDITIONS',
        'REQUIRED_POSTCONDITIONS',
        'DEFERRED_CONSTRAINT_REFERENCES',
      ] as const)
        expect(Array.isArray(record[key])).toBe(true)
      expect(record.SOURCE.SOURCE_SHA256).toBe(fixedHashes[files.payloads])
      expect(record.REQUIRED_POSTCONDITIONS[0].RECORDED_VALUE).toEqual(
        record.PHYSICAL_IDENTITIES_PRODUCED,
      )
      expect(record.EXECUTION_ALLOWED).toBe('NO')
    },
  )
  it.each(model.cut.setA)(
    'places exact late record downstream without mechanic mutation:$COMPATIBILITY_OBLIGATION_ID',
    (record) => {
      expect(record.PROMOTION_GATE_LOCATION).toBe('POST_W4P_REPLAY')
      expect(record.DIRECT_W4P_DEPENDENCY).toBe('NO')
      expect(record.TRANSITIVE_W4P_DEPENDENCY).toBe('NO')
      expect(record.EXACT_DEPENDENCY_PATHS).toEqual([])
      expect(record.COMPATIBILITY_CLASS).toBe('OTHER_EXPLICIT')
      expect(record.OTHER_COMPATIBILITY_CLASS).toBe(
        'NO_W4FR4_PRECREATION_COLLISION_EXACT_LATE_PROMOTION_REPLAY_REQUIRED',
      )
      expect(record.W4P_EFFECT).toBe('NONE')
      expect(record.LATER_REPLAY_EFFECT).toBe('EXACT_STATE_VALIDATION_AND_LATE_PROMOTION')
      expect(record.SOURCE.RECORDED_VALUE).toEqual({
        RECORD_SHA256: digest(record.ORIGINAL_RECORD),
      })
      expect(record.EXECUTION_ALLOWED).toBe('NO')
    },
  )
  it.each(model.cut.setB)(
    'separates promotion ordering from exact later replay ordering:$ORDERING_OBLIGATION_ID',
    (record) => {
      expect(record.PRE_W4P_ORDERING_REQUIRED).toBe('NO')
      expect(record.PROMOTION_GATE_LOCATION).toBe('POST_W4P_ORDERING')
      expect(record.DIRECT_W4P_DEPENDENCY).toBe('NO')
      expect(record.TRANSITIVE_W4P_DEPENDENCY).toBe('NO')
      expect(record.EXACT_DEPENDENCY_PATHS).toEqual([])
      expect(record.RELATED_SET_A_OBLIGATION_IDS.length).toBeGreaterThan(0)
      expect(record.ORIGINAL_HANDOFF.ORDERING_OBLIGATION_ID).toBe(record.ORDERING_OBLIGATION_ID)
      expect(record.SOURCE.RECORDED_VALUE).toEqual({
        RECORD_SHA256: digest(record.ORIGINAL_HANDOFF),
      })
      expect(record.EXECUTION_ALLOWED).toBe('NO')
    },
  )
  it.each(model.cut.setC)(
    'keeps complete deferred constraint and negative binding proof downstream:$DEFERRED_CONSTRAINT_HANDOFF_ID',
    (record) => {
      expect(record.PROMOTION_GATE_LOCATION).toBe('POST_W4P_DEFERRED_CONSTRAINT')
      expect(record.DIRECT_W4P_DEPENDENCY).toBe('NO')
      expect(record.TRANSITIVE_W4P_DEPENDENCY).toBe('NO')
      expect(record.POST_W4P_OBLIGATION).toBe('MATERIALIZE_ONLY_AFTER_ALL_OPERANDS_EXIST')
      expect(record.ORIGINAL_BINDING_RESULT.CANONICAL_HANDOFF).toEqual(record.ORIGINAL_HANDOFF)
      expect(record.ORIGINAL_BINDING_RESULT.HANDOFF_BINDING_CLASS).toBe(
        'BLOCKED_MISSING_OPERAND_BINDING',
      )
      expect(record.REFERENCING_BASELINE_PAYLOAD_IDS.length).toBeGreaterThan(0)
      expect(record.DEFERRED_CONSTRAINTS_MATERIALIZED).toBe(0)
      expect(record.DEFERRED_CONSTRAINTS_RUNTIME_PROVEN).toBe('NO')
      expect(
        model.cut.dependencyGraph.EDGES.some(
          (edge) => edge.TO === record.DEFERRED_CONSTRAINT_HANDOFF_ID,
        ),
      ).toBe(false)
    },
  )
  it.each(model.cut.operandEffects)(
    'preserves exact unresolved operand without inbound prerequisite:$PHYSICAL_OPERAND_IDENTITY',
    (record) => {
      expect(record.W4P_REQUIRES_OPERAND_EXISTENCE).toBe('NO')
      expect(record.OPERAND_BINDING_STATUS).toBe('UNRESOLVED_DOWNSTREAM')
      expect(record.DIRECT_W4P_DEPENDENCY).toBe('NO')
      expect(record.TRANSITIVE_W4P_DEPENDENCY).toBe('NO')
      expect(record.EXACT_DEPENDENCY_PATHS).toEqual([])
      expect(record.MISSING_FACT).toBeTruthy()
      expect(record.PRODUCER_ID).toBeNull()
      expect(record.BOUNDARY_ID).toBeNull()
      expect(record.EXECUTION_ALLOWED).toBe('NO')
    },
  )
  it('freezes the corrected denominator and all nine exact identities', () => {
    expect(model.cut.operandEffects.map((record) => record.PHYSICAL_OPERAND_IDENTITY)).toEqual([
      'union-eyes::COLUMN::public.org_entitlements.feature_key',
      'union-eyes::COLUMN::public.billing_periods.label',
      'union-eyes::COLUMN::public.org_configurations.category',
      'union-eyes::COLUMN::public.org_configurations.key',
      'union-eyes::COLUMN::public.pilot_checklist_items.item_id',
      'union-eyes::COLUMN::public.member_jurisdiction_preferences.user_id',
      'union-eyes::COLUMN::public.contract_covered_orgs.contract_id',
      'union-eyes::COLUMN::public.duplicate_group_members.record_type',
      'union-eyes::COLUMN::public.duplicate_group_members.record_id',
    ])
    expect(model.report.summary.SYNTHETIC_TENTH_OPERAND).toBe('NONE')
  })
  it('accounts for every preserved downstream record in three distinct evidence sets', () => {
    expect(model.downstream.SET_A_POST_W4P_REPLAY.map((record) => record.ORIGINAL_RECORD)).toEqual(
      inputs.late.records,
    )
    expect(
      model.downstream.SET_B_POST_W4P_ORDERING.map((record) => record.ORIGINAL_HANDOFF),
    ).toEqual(inputs.producer.w5OrderingHandoff)
    expect(
      model.downstream.SET_C_POST_W4P_DEFERRED_CONSTRAINT.map((record) => record.ORIGINAL_HANDOFF),
    ).toEqual(inputs.deferred.handoffs)
    expect(
      model.downstream.SET_C_POST_W4P_DEFERRED_CONSTRAINT.map(
        (record) => record.ORIGINAL_BINDING_RESULT,
      ),
    ).toEqual(inputs.bindings.records)
    expect(model.downstream.UNRESOLVED_DOWNSTREAM_OPERANDS).toHaveLength(9)
    expect(model.downstream.OPERAND_RESIDUALS_SHA256).toBe(digest(inputs.operands.records))
    expect(model.downstream.EXECUTION_ALLOWED).toBe('NO')
    expect(model.downstream.OBLIGATIONS_RESOLVED_BY_AUTHORIZATION).toBe('NO')
  })
  it('does not infer preconditions from relation similarity,output identity or deferred-reference links', () => {
    expect(
      dependencyPaths(
        ['public.org_configurations.organization_id'],
        [],
        ['public.org_configurations.key'],
      ).EXACT_DEPENDENCY_PATHS,
    ).toEqual([])
    expect(
      dependencyPaths(['payload'], [edge('other-payload', 'target')], ['target'])
        .EXACT_DEPENDENCY_PATHS,
    ).toEqual([])
    expect(model.cut.contextualTypeReferences.PRE_W4P_CONSUMER_EDGES).toBe(0)
    expect(model.cut.contextualTypeReferences.RECORDS).toHaveLength(38)
    expect(
      model.cut.definitionSubjects.every(
        (record) =>
          record.TYPE_DEPENDENCIES[0].RECORDED_VALUE &&
          Array.isArray(record.TYPE_DEPENDENCIES[0].RECORDED_VALUE),
      ),
    ).toBe(true)
  })
  it('finds an exact direct path and makes it a promotion prerequisite', () => {
    const result = dependencyPaths(['payload'], [edge('payload', 'target')], ['target'])
    expect(result.DIRECT_W4P_DEPENDENCY).toBe('YES')
    expect(result.TRANSITIVE_W4P_DEPENDENCY).toBe('NO')
    expect(result.EXACT_DEPENDENCY_PATHS[0].PATH).toEqual(['payload', 'target'])
    expect(classifyLocation('A', result)).toBe('PRE_W4P_REQUIRED')
    expect(classifyLocation('C', result)).toBe('PRE_W4P_REQUIRED')
  })
  it('finds exact transitive paths without inferring an absent dependency', () => {
    const result = dependencyPaths(
      ['payload'],
      [edge('payload', 'parent'), edge('parent', 'producer'), edge('producer', 'target')],
      ['target'],
    )
    expect(result.DIRECT_W4P_DEPENDENCY).toBe('NO')
    expect(result.TRANSITIVE_W4P_DEPENDENCY).toBe('YES')
    expect(result.EXACT_DEPENDENCY_PATHS[0].PATH).toEqual([
      'payload',
      'parent',
      'producer',
      'target',
    ])
    expect(result.EXACT_DEPENDENCY_PATHS[0].EDGES).toHaveLength(3)
    expect(
      dependencyPaths(['payload'], [edge('parent', 'target')], ['target']).EXACT_DEPENDENCY_PATHS,
    ).toEqual([])
  })
  it('terminates on cycles and retains exact evidence for each path edge', () => {
    const result = dependencyPaths(
      ['payload'],
      [edge('payload', 'parent'), edge('parent', 'payload'), edge('parent', 'target')],
      ['target'],
    )
    expect(result.EXACT_DEPENDENCY_PATHS).toHaveLength(1)
    expect(
      result.EXACT_DEPENDENCY_PATHS[0].EDGES.every(
        (edge) => edge.SOURCE.JSON_POINTER === '/requires',
      ),
    ).toBe(true)
  })
  it('records both direct and transitive paths to the same required target', () => {
    const result = dependencyPaths(
      ['payload'],
      [edge('payload', 'target'), edge('payload', 'parent'), edge('parent', 'target')],
      ['target'],
    )
    expect(result.DIRECT_W4P_DEPENDENCY).toBe('YES')
    expect(result.TRANSITIVE_W4P_DEPENDENCY).toBe('YES')
    expect(result.EXACT_DEPENDENCY_PATHS.map((record) => record.PATH)).toEqual([
      ['payload', 'target'],
      ['payload', 'parent', 'target'],
    ])
  })
  it('retains69 parent requirements and the82-node Django-first external boundary', () => {
    expect(model.cut.externalPrerequisites.MACRO_ORDER.RECORDED_VALUE).toEqual([
      'W3_PROVISIONING',
      'FULL_CANONICAL_DJANGO_GRAPH',
      'APPROVED_PLATFORM_BASELINE',
      'FROZEN_SCOPED_SECURITY_MIGRATIONS',
    ])
    expect(model.cut.dependencyGraph.MACRO_PREDECESSOR_ROOTS).toHaveLength(82)
    expect(model.cut.externalPrerequisites.DJANGO_EXECUTION_PRECONDITIONS).toHaveLength(82)
    expect(
      model.cut.dependencyGraph.EDGES.filter(
        (edge) => edge.KIND === 'ACCEPTED_PARENT_RELATION_PRECONDITION',
      ),
    ).toHaveLength(69)
    expect(model.cut.externalPrerequisites.W3_PRECONDITIONS.RECORDED_VALUE).toEqual(
      inputs.producer.w3Preconditions,
    )
    expect(model.cut.externalPrerequisites.W2_TARGET_BINDINGS.RECORDED_VALUE).toEqual(
      inputs.producer.w2TargetBindings,
    )
  })
  it('ties every graph edge to its exact hash-bound recorded source,with explicit obligation resolution', () => {
    const sourceInputs = new Map(Object.entries(files).map(([name, file]) => [file, inputs[name]]))
    const contains = (value: unknown, target: string): boolean => {
      if (value === target) return true
      return (
        !!value &&
        typeof value === 'object' &&
        Object.values(value).some((child) => contains(child, target))
      )
    }
    for (const edge of model.cut.dependencyGraph.EDGES) {
      let current: unknown = sourceInputs.get(edge.SOURCE.SOURCE_FILE)
      for (const segment of edge.SOURCE.JSON_POINTER.split('/').slice(1)) {
        expect(current && typeof current === 'object').toBeTruthy()
        if (!current || typeof current !== 'object') throw new Error('INVALID_EDGE_SOURCE_POINTER')
        current = Object.entries(current).find(([key]) => key === segment)?.[1]
      }
      expect(current).toEqual(edge.SOURCE.RECORDED_VALUE)
      expect(edge.SOURCE.SOURCE_SHA256).toBe(fixedHashes[edge.SOURCE.SOURCE_FILE])
      if (edge.KIND === 'PAYLOAD_DEFINITION_LINK') {
        const definition = model.cut.definitionSubjects.find(
          (record) => record.SUBJECT_ID === edge.TO,
        )
        expect(definition).toBeDefined()
        expect(contains(current, String(definition?.DEFINITION_OBLIGATION_ID))).toBe(true)
        expect(definition?.PAYLOAD_ID).toBe(edge.FROM)
      } else if (edge.KIND === 'MATERIALIZED_UNIQUE_OPERAND_PRECONDITION') {
        const payload = model.cut.payloadSubjects.find((record) => record.SUBJECT_ID === edge.FROM)
        expect(
          payload?.MATERIALIZED_CONSTRAINT_OPERAND_PRECONDITIONS.some(
            (record) => record.PHYSICAL_IDENTITY === edge.TO,
          ),
        ).toBe(true)
        expect(current).toBe(payload?.MATERIALIZED_CONSTRAINT_SOURCE.RECORDED_VALUE)
      } else expect(contains(current, edge.TO)).toBe(true)
    }
  })
  it('accounts for emitted compound-unique operand preconditions without promoting deferred operands', () => {
    const emitted = model.cut.payloadSubjects.flatMap(
      (record) => record.MATERIALIZED_CONSTRAINT_OPERAND_PRECONDITIONS,
    )
    expect(
      emitted.some(
        (record) =>
          record.PHYSICAL_IDENTITY === 'union-eyes::COLUMN::public.integration_configs.provider',
      ),
    ).toBe(true)
    expect(
      emitted.some(
        (record) =>
          record.PHYSICAL_IDENTITY ===
          'union-eyes::COLUMN::public.social_accounts.platform_user_id',
      ),
    ).toBe(true)
    const excluded = new Set(
      model.cut.operandEffects.map((record) => record.PHYSICAL_OPERAND_IDENTITY),
    )
    expect(emitted.every((record) => !excluded.has(record.PHYSICAL_IDENTITY))).toBe(true)
    for (const payload of model.cut.payloadSubjects) {
      if (
        !Array.isArray(payload.PHYSICAL_IDENTITIES_PRODUCED) ||
        !payload.PHYSICAL_IDENTITIES_PRODUCED.every((value) => typeof value === 'string')
      )
        throw new Error('INVALID_PRODUCED_IDENTITIES')
      expect(
        emittedUniqueOperands(
          String(payload.MATERIALIZED_CONSTRAINT_SOURCE.RECORDED_VALUE),
          payload.PHYSICAL_IDENTITIES_PRODUCED,
        ),
      ).toEqual(payload.MATERIALIZED_CONSTRAINT_OPERAND_PRECONDITIONS)
    }
  })
  it('preserves broad historical gate wording while normalizing placement,not runtime truth', () => {
    expect(
      model.cut.historicalGateNormalization.CANONICAL_LAYER_EXIT_GATE.RECORDED_VALUE,
    ).toContain('later frozen provider compatibility established')
    expect(model.cut.historicalGateNormalization.PRIOR_W4LC_GATE.RECORDED_VALUE).toEqual(
      inputs.w4lc.phaseStatus,
    )
    expect(model.cut.historicalGateNormalization.PRIOR_W4LB_GATE.RECORDED_VALUE).toEqual(
      inputs.w4lb.phaseStatus,
    )
    expect(model.cut.doctrine.UNKNOWN_DOWNSTREAM_PRODUCER_ALONE_IS_NOT_W4PG_BLOCKER).toBe('YES')
  })
  it('proves the exact empty minimum pre-W4P slice rather than running it', () => {
    expect(model.cut.minimumPreW4PW5Slice.HANDOFF_IDS).toEqual([])
    expect(model.cut.minimumPreW4PW5Slice.COUNT).toBe(0)
    expect(
      model.cut.setB
        .filter((record) => record.PRE_W4P_ORDERING_REQUIRED === 'YES')
        .map((record) => record.ORDERING_OBLIGATION_ID),
    ).toEqual([])
    expect(model.report.summary).toMatchObject({
      SET_A_TOTAL: 127,
      SET_A_PRE_W4P_REQUIRED: 0,
      SET_A_POST_W4P_REPLAY: 127,
      SET_B_TOTAL: 86,
      SET_B_PRE_W4P_ORDERING_REQUIRED: 0,
      SET_B_POST_W4P_ORDERING: 86,
      SET_C_TOTAL: 7,
      SET_C_PRE_W4P_REQUIRED: 0,
      SET_C_POST_W4P_DEFERRED_CONSTRAINT: 7,
      DISTINCT_UNBOUND_OPERAND_IDENTITIES: 9,
      OPERANDS_REQUIRED_BY_W4P: 0,
      PRE_W4P_COMPATIBILITY_BLOCKERS: 0,
      INBOUND_PATHS_FROM_UNRESOLVED_SETS: 0,
      INVENTED_DEPENDENCY_EDGES: 0,
    })
  })
  it.each(Object.entries(fixedHashes))(
    'preserves exact authorized input bytes:%s',
    (file, hash) => {
      expect(sha(read(file))).toBe(hash)
      expect(model.report.preservation.BYTE_COMMITMENTS[file]).toBe(hash)
    },
  )
  it('retains exactly the authorized eleven JSON inputs,without producer discovery', () => {
    expect(Object.keys(files)).toHaveLength(11)
    expect(Object.keys(fixedHashes)).toEqual(Object.values(files))
    expect(model.cut.metadata.GENERAL_DISCOVERY).toBe('NO')
    expect(model.report.preservation.UPSTREAM_BYTES_CHANGED).toBe(0)
    expect(model.report.DEPENDENCY_CUT_SHA256).toBe(digest(model.cut))
    expect(model.report.DOWNSTREAM_REGISTER_SHA256).toBe(digest(model.downstream))
  })
  it('authorizes only unstarted W4P and preserves the incomplete W4/runtime boundary', () => {
    expect(model.report.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W4PG_GATE: 'PASS',
      W4P_DEPENDENCY_CUT_COMPLETE: 'YES',
      ALL_INBOUND_W4P_DEPENDENCIES_ACCOUNTED: 'YES',
      W4P: 'AUTHORIZED_NOT_STARTED',
      W5_COMPATIBILITY_SLICE: 'NOT_REQUIRED_BEFORE_W4P',
      W5: 'NOT_AUTHORIZED',
      W4: 'BLOCKED_ORDERING_COMPATIBILITY_PENDING',
      CANONICAL_CONTRACT_VERSION: '1.3.2',
    })
    expect(model.report.proofBoundaries).toMatchObject({
      SQL_EXECUTED: 0,
      W4P_EXECUTED: 'NO',
      COMPATIBILITY_MECHANICS_EXECUTED: 'NO',
      W5_EXECUTED: 'NO',
      DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
      PRODUCERS_ACTIVATED: 0,
      BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    })
  })
  it('keeps every execution-authority flag inactive', () => {
    const check = (value: unknown): void => {
      if (!value || typeof value !== 'object') return
      for (const [key, child] of Object.entries(value)) {
        if (key === 'EXECUTION_ALLOWED') expect(child).toBe('NO')
        if (key === 'MUTATING_OPERATIONS') expect(child).toEqual([])
        check(child)
      }
    }
    check(model)
  })
  it('is deterministic in cut digests and all six exact generated byte streams', async () => {
    expect(digest(buildCut())).toBe(digest(model))
    const first = await generate()
    expect(Object.keys(first)).toEqual([
      outputs.cut,
      outputs.downstream,
      outputs.report,
      outputs.cutMarkdown,
      outputs.downstreamMarkdown,
      outputs.markdown,
    ])
    expect(first).toEqual(await generate())
  }, 120000)
  it.each([
    '--execute',
    '--discover',
    '--rewrite',
    '--sql',
    '--w4p',
    '--w5',
    '--publish',
    '--apply',
  ])('rejects unauthorized flag:%s', async (flag) => {
    await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_W4PG_FLAG')
  })
})
