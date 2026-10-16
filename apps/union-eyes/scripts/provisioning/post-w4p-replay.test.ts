import { describe, expect, it } from 'vitest'
import {
  denyReplayExecution,
  implementationBlockers,
  inspectBlockedReplay,
  replayClass,
  replayDigest,
  replayInputFiles,
  replayObject,
  replayRecords,
  replayText,
  replayTransactionCompatibility,
  validateFrozenReplay,
  validateReplayTopology,
  type JsonRecord,
} from './post-w4p-replay'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'

const loaded = loadFrozenReplay()
const { frozen, inputBytes, sourceBytes } = loaded
const mutatedInput = (file: string, change: (value: JsonRecord) => void) => {
  const value = replayObject(JSON.parse(inputBytes[file]))
  change(value)
  return { ...inputBytes, [file]: JSON.stringify(value) }
}

describe('W5B fixed commitments deny topology/definition mutation', () => {
  for (const [name, file] of Object.entries(replayInputFiles)) {
    it(`denies byte drift in authoritative input:${name}`, () => {
      expect(() =>
        validateFrozenReplay({ ...inputBytes, [file]: inputBytes[file] + ' ' }, sourceBytes),
      ).toThrow('FROZEN_REPLAY_INPUT_DRIFT')
    })
  }
  for (const node of frozen.nodes)
    it(`verifies frozen class,source and exact unit range:${node.REPLAY_UNIT_ID}`, () => {
      expect([
        'EXACT_CREATE_STATEMENT',
        'ENUM_DO_WRAPPER',
        'ORIGINAL_POSITION_MIGRATION_BOUNDARY',
      ]).toContain(replayClass(node))
      expect(node.EXECUTION_ALLOWED).toBe('NO')
      expect(replayTransactionCompatibility(node)).toBe(
        replayClass(node) === 'ORIGINAL_POSITION_MIGRATION_BOUNDARY'
          ? 'TRANSACTION_COMPATIBILITY_UNPROVEN'
          : 'TRANSACTION_COMPATIBLE',
      )
      expect(sourceBytes[replayText(node.SOURCE_FILE)]).toBeTruthy()
      if (replayClass(node) !== 'ORIGINAL_POSITION_MIGRATION_BOUNDARY') {
        const records = replayRecords(frozen.register.BOUND_REPLAY_RECORDS).filter(
          (record) => record.REPLAY_UNIT_ID === node.REPLAY_UNIT_ID,
        )
        expect(records.map((record) => record.COMPATIBILITY_OBLIGATION_ID)).toEqual(
          node.COMPATIBILITY_OBLIGATION_IDS,
        )
      }
    })
  for (const file of Object.keys(sourceBytes))
    it(`denies frozen source drift before any execution:${file}`, () => {
      expect(() =>
        validateFrozenReplay(inputBytes, {
          ...sourceBytes,
          [file]: sourceBytes[file] + '-- changed',
        }),
      ).toThrow('FROZEN_REPLAY_SOURCE_DRIFT')
    })
  const edits: Record<string, (graph: JsonRecord) => void> = {
    'missing node': (graph) => {
      graph.nodes = replayRecords(graph.nodes).slice(1)
    },
    'duplicate node': (graph) => {
      const nodes = replayRecords(graph.nodes)
      nodes[1] = nodes[0]
      graph.nodes = nodes
    },
    'missing endpoint': (graph) => {
      replayRecords(graph.edges)[0].TO = 'absent'
    },
    'edge direction': (graph) => {
      const e = replayRecords(graph.edges)[0]
      ;[e.FROM, e.TO] = [e.TO, e.FROM]
    },
    'cycle injection': (graph) => {
      const e = replayRecords(graph.edges)[0]
      e.TO = e.FROM
    },
    'handoff loss': (graph) => {
      const r = replayObject(graph.downstreamRegister)
      r.BOUND_ORDERING_HANDOFFS = replayRecords(r.BOUND_ORDERING_HANDOFFS).slice(1)
    },
    'mechanic loss': (graph) => {
      const r = replayObject(graph.downstreamRegister)
      r.BOUND_REPLAY_RECORDS = replayRecords(r.BOUND_REPLAY_RECORDS).slice(1)
    },
    'wrapper downgrade': (graph) => {
      replayRecords(graph.nodes).find(
        (node) => node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT',
      )!.REPLAY_UNIT_CLASS = 'FROZEN_STATEMENT_UNIT'
    },
    'scope drift': (graph) => {
      replayRecords(graph.nodes)[0].DATABASE_SCOPE = 'FINANCIAL_SERVICE'
    },
    'range drift': (graph) => {
      const r = replayRecords(replayObject(graph.downstreamRegister).BOUND_REPLAY_RECORDS)[0]
      r.SOURCE_RANGE = [0, 1]
    },
    'deferred erasure': (graph) => {
      const r = replayObject(graph.downstreamRegister)
      r.DEFERRED_CONSTRAINT_HANDOFFS = replayRecords(r.DEFERRED_CONSTRAINT_HANDOFFS).slice(1)
    },
    'operand erasure': (graph) => {
      const r = replayObject(graph.downstreamRegister)
      r.UNRESOLVED_OPERAND_BINDINGS = replayRecords(r.UNRESOLVED_OPERAND_BINDINGS).slice(1)
    },
  }
  for (const [name, change] of Object.entries(edits))
    it(`rejects caller-rewritten graph:${name}`, () => {
      expect(() =>
        validateFrozenReplay(mutatedInput(replayInputFiles.graph, change), sourceBytes),
      ).toThrow('FROZEN_REPLAY_INPUT_DRIFT')
    })
  it('rejects rewritten topology instead of semantically generating another', () => {
    expect(() =>
      validateFrozenReplay(
        mutatedInput(replayInputFiles.topology, (plan) => {
          const order = replayRecords(plan.ORDER)
          ;[order[0], order[1]] = [order[1], order[0]]
          plan.ORDER = order
        }),
        sourceBytes,
      ),
    ).toThrow('FROZEN_REPLAY_INPUT_DRIFT')
  })
  it('rejects forged graph and report even when caller recomputes all claimed commitments', () => {
    const graph = replayObject(JSON.parse(inputBytes[replayInputFiles.graph]))
    const edge = replayRecords(graph.edges)[0]
    edge.TO = edge.FROM
    const report = replayObject(JSON.parse(inputBytes[replayInputFiles.w5a]))
    replayObject(report.determinismDigests).REPLAY_GRAPH_SHA256 = replayDigest(graph)
    expect(() =>
      validateFrozenReplay(
        {
          ...inputBytes,
          [replayInputFiles.graph]: JSON.stringify(graph),
          [replayInputFiles.w5a]: JSON.stringify(report),
        },
        sourceBytes,
      ),
    ).toThrow()
  })
})

describe('W5B structural verification without semantic re-extraction', () => {
  it('accepts the exact fixed107/231/107 topology', () => {
    expect(() => validateReplayTopology(frozen.nodes, frozen.edges, frozen.order)).not.toThrow()
  })
  it('rejects missing node or edge', () => {
    expect(() => validateReplayTopology(frozen.nodes.slice(1), frozen.edges, frozen.order)).toThrow(
      'FROZEN_REPLAY_DENOMINATOR_DRIFT',
    )
    expect(() => validateReplayTopology(frozen.nodes, frozen.edges.slice(1), frozen.order)).toThrow(
      'FROZEN_REPLAY_DENOMINATOR_DRIFT',
    )
  })
  it('rejects duplicate node', () => {
    const nodes = structuredClone(frozen.nodes)
    nodes[1] = nodes[0]
    expect(() => validateReplayTopology(nodes, frozen.edges, frozen.order)).toThrow(
      'DUPLICATE_FROZEN_REPLAY_UNIT',
    )
  })
  it('rejects duplicate plan identity', () => {
    const order = structuredClone(frozen.order)
    order[1].REPLAY_UNIT_ID = order[0].REPLAY_UNIT_ID
    expect(() => validateReplayTopology(frozen.nodes, frozen.edges, order)).toThrow(
      'FROZEN_PLAN_NODE_LOSS_OR_DUPLICATION',
    )
  })
  it('rejects missing edge endpoint', () => {
    const edges = structuredClone(frozen.edges)
    edges[0].TO = 'not-a-unit'
    expect(() => validateReplayTopology(frozen.nodes, edges, frozen.order)).toThrow(
      'FROZEN_REPLAY_ENDPOINT_MISSING',
    )
  })
  it('rejects an edge direction reversal', () => {
    const edges = structuredClone(frozen.edges)
    const edge = edges[0]
    ;[edge.FROM, edge.TO] = [edge.TO, edge.FROM]
    expect(() => validateReplayTopology(frozen.nodes, edges, frozen.order)).toThrow(
      'FROZEN_REPLAY_CYCLE_OR_ORDER_DRIFT',
    )
  })
  it('rejects cycle injection', () => {
    const edges = structuredClone(frozen.edges)
    edges[0].TO = edges[0].FROM
    expect(() => validateReplayTopology(frozen.nodes, edges, frozen.order)).toThrow(
      'FROZEN_REPLAY_CYCLE_OR_ORDER_DRIFT',
    )
  })
  it('rejects topological position drift', () => {
    const order = structuredClone(frozen.order)
    order[0].REQUIRED_REPLAY_POSITION = 2
    expect(() => validateReplayTopology(frozen.nodes, frozen.edges, order)).toThrow(
      'FROZEN_TOPOLOGICAL_POSITION_DRIFT',
    )
  })
  it('rejects cross-scope transaction fiction', () => {
    const nodes = structuredClone(frozen.nodes)
    const edge = frozen.edges[0]
    nodes.find((node) => node.REPLAY_UNIT_ID === edge.TO)!.DATABASE_SCOPE = 'FINANCIAL_SERVICE'
    expect(() => validateReplayTopology(nodes, frozen.edges, frozen.order)).toThrow(
      'CROSS_SCOPE_REPLAY_EDGE',
    )
  })
  it('rejects unsupported handler class rather than coercing it', () => {
    expect(() => replayClass({ REPLAY_UNIT_CLASS: 'GENERIC_SQL' })).toThrow(
      'UNSUPPORTED_FROZEN_REPLAY_CLASS',
    )
  })
})

describe('W5B inspection and transaction blockers are not hidden by fake claims', () => {
  const blockers = implementationBlockers(frozen)
  it('records exact23 boundary inspection deficiencies and23 transaction evidence deficiencies', () => {
    expect(
      blockers.filter(
        (blocker) =>
          blocker.ERROR_CLASS === 'COMPLETE_BOUNDARY_POSTCONDITION_SPECIFICATION_MISSING',
      ),
    ).toHaveLength(23)
    expect(
      blockers.filter(
        (blocker) => blocker.ERROR_CLASS === 'TRANSACTION_COMPATIBILITY_EVIDENCE_MISSING',
      ),
    ).toHaveLength(23)
    expect(new Set(blockers.map((blocker) => blocker.REPLAY_UNIT_ID)).size).toBe(23)
  })
  for (const blocker of blockers)
    it(`records exact missing facts:${blocker.ERROR_CLASS}:${blocker.REPLAY_UNIT_ID}`, () => {
      expect(
        frozen.nodes.some(
          (node) =>
            node.REPLAY_UNIT_ID === blocker.REPLAY_UNIT_ID &&
            node.SOURCE_FILE === blocker.SOURCE_FILE,
        ),
      ).toBe(true)
      expect(blocker.MISSING_FACTS.length).toBeGreaterThan(0)
      expect(blocker.RECORDED_EVIDENCE).toBeTruthy()
      if (blocker.ERROR_CLASS === 'COMPLETE_BOUNDARY_POSTCONDITION_SPECIFICATION_MISSING')
        expect(blocker.UNIT_CLASS).toBe('ORIGINAL_POSITION_MIGRATION_BOUNDARY')
    })
  it('does not list the seven/nine residuals as implementation blockers', () => {
    expect(
      blockers.every((blocker) =>
        frozen.nodes.some((node) => node.REPLAY_UNIT_ID === blocker.REPLAY_UNIT_ID),
      ),
    ).toBe(true)
    expect(replayRecords(frozen.register.DEFERRED_CONSTRAINT_HANDOFFS)).toHaveLength(7)
    expect(replayRecords(frozen.register.UNRESOLVED_OPERAND_BINDINGS)).toHaveLength(9)
  })
  it('never claims a complete unit based on a missing W4P receipt', () => {
    const states = inspectBlockedReplay(frozen)
    expect(states).toHaveLength(107)
    expect(
      states.every(
        (state) => state.STATE === 'PRECONDITION_MISSING' && state.PLANNED_ACTION === 'FAIL_CLOSED',
      ),
    ).toBe(true)
    expect(
      states.every((state) => state.ERROR_CLASSES.includes('W4P_BASELINE_VERIFICATION_REQUIRED')),
    ).toBe(true)
  })
  it('does not use an unverified W4P completion assertion as a receipt', () => {
    const states = inspectBlockedReplay(frozen, 'UNVERIFIED_ASSERTION')
    expect(states.every((state) => state.STATE === 'PRECONDITION_MISSING')).toBe(true)
    expect(
      states.every((state) =>
        state.ERROR_CLASSES.includes('W4P_COMPLETION_ASSERTION_IS_NOT_VERIFICATION'),
      ),
    ).toBe(true)
  })
  it('denies execution explicitly instead of exposing an unimplemented adapter path', () => {
    expect(() => denyReplayExecution()).toThrow(
      'W5B_IMPLEMENTATION_BLOCKED_EXECUTION_NOT_AUTHORIZED',
    )
  })
  it('does not label any generic preservation text a deterministic boundary invariant', () => {
    const boundary = frozen.nodes.find(
      (node) => replayClass(node) === 'ORIGINAL_POSITION_MIGRATION_BOUNDARY',
    )!
    expect(boundary.POSTCONDITIONS).toEqual([
      'Every original non-CREATE/postcreate statement and enclosing wrapper remains in original scope/relative order;only accepted exact state-aware CREATE recheck may avoid redundant creation.',
    ])
    expect(
      implementationBlockers(frozen).some(
        (blocker) =>
          blocker.REPLAY_UNIT_ID === boundary.REPLAY_UNIT_ID &&
          blocker.ERROR_CLASS === 'COMPLETE_BOUNDARY_POSTCONDITION_SPECIFICATION_MISSING',
      ),
    ).toBe(true)
  })
})
