import { describe, expect, it } from 'vitest'
import {
  buildImplementation,
  boundaryWitnesses,
  generate,
  loadFrozenReplay,
  main,
  outputs,
} from './implement-w5b-post-w4p-replay'
import { read } from './w4-physical-producers'
import {
  replayDigest,
  replayHash,
  replayRecords,
} from '../../apps/union-eyes/scripts/provisioning/post-w4p-replay'

const model = buildImplementation()
const { frozen } = loadFrozenReplay()

describe('W5B truthful blocked implementation registry', () => {
  it('resumption revalidates prior W5B BLOCKED and keeps G3 closed without inferring shared-worktree ownership', () => {
    expect(model.report.resumption).toMatchObject({
      REPOSITORY_HEAD: '1c337567635bb86ea0df7831557d8d2d22df1e6f',
      DISCOVERED_PRIOR_W5B_STATE: 'BLOCKED_PREFLIGHT_ONLY;not AUTHORIZED_NOT_STARTED',
      FROZEN_W5A_W4P_SOURCE_DRIFT: 0,
      G3_REOPENED: 'NO',
    })
    expect(model.report.resumption.G3_CAUSALITY_LIMIT).toContain('not inferred')
    expect(model.report.resumption.PRIOR_W5B_REPORT_SHA256).toMatch(/^[a-f0-9]{64}$/)
  })
  for (const witness of boundaryWitnesses)
    it(`binds actual original-boundary completion gap without SQL execution:${witness.SOURCE_FILE}`, () => {
      const entry = model.report.blockerEvidence.CONCRETE_ORIGINAL_BOUNDARY_EVIDENCE.find(
        (value) => value.SOURCE_FILE === witness.SOURCE_FILE,
      )
      expect(entry).toBeDefined()
      const node = frozen.nodes.find((value) => value.REPLAY_UNIT_ID === entry?.REPLAY_UNIT_ID)
      expect(node?.REPLAY_UNIT_CLASS).toBe('FROZEN_MIGRATION_UNIT')
      expect(entry?.SOURCE_SHA256).toBe(replayHash(read(witness.SOURCE_FILE)))
      expect(entry?.UNIT_CONTENT_DIGEST).toBe(node?.EXACT_UNIT_SHA256)
      const excerpt = read(witness.SOURCE_FILE)
        .split('\n')
        .slice(witness.SOURCE_LINES[0] - 1, witness.SOURCE_LINES[1])
        .join('\n')
      expect(excerpt).toContain(witness.REQUIRED_SOURCE_FRAGMENT)
      expect(entry?.EXCERPT_SHA256).toBe(replayHash(excerpt))
      expect(entry?.INSPECTOR_OR_COMPARATOR_IMPLEMENTED).toBe('NO')
      expect(entry?.SQL_EXECUTED).toBe(0)
    })
  it('distinguishes107 mapped units from0 implemented handlers', () => {
    expect(model.registryPacket.REGISTRY).toHaveLength(107)
    expect(model.report.summary).toMatchObject({
      REPLAY_UNITS_REGISTERED: 107,
      EXACT_CREATE_STATEMENT_UNITS_REGISTERED: 43,
      ENUM_WRAPPER_UNITS_REGISTERED: 41,
      ORIGINAL_POSITION_BOUNDARIES_REGISTERED: 23,
      IMPLEMENTED_REPLAY_UNITS: 0,
      COMPATIBILITY_RECORD_IMPLEMENTATION_COVERAGE: 0,
      ORDERING_HANDOFF_IMPLEMENTATION_COVERAGE: 0,
      REPLAY_NOOP_PROVEN: 'NO',
    })
  })
  for (const entry of model.registryPacket.REGISTRY)
    it(`preserves exact identity and failclosed status:${entry.REPLAY_UNIT_ID}`, () => {
      const node = frozen.nodes.find((node) => node.REPLAY_UNIT_ID === entry.REPLAY_UNIT_ID)!
      expect(entry.SOURCE_SHA256).toBe(node.SOURCE_SHA256)
      expect(entry.UNIT_CONTENT_DIGEST).toBe(node.EXACT_UNIT_SHA256)
      expect(entry.COMPATIBILITY_RECORD_IDS).toEqual(node.COMPATIBILITY_OBLIGATION_IDS)
      expect(entry.EXECUTION_STATUS).toBe('NOT_IMPLEMENTED_BLOCKED')
      expect(entry.IMPLEMENTATION_HANDLER).toBe('NOT_IMPLEMENTED')
      expect(entry.VERIFICATION_HANDLER).toBe('NOT_IMPLEMENTED')
      expect(entry.EXECUTION_ALLOWED).toBe('NO')
      expect(entry.MUTATING_OPERATIONS).toEqual([])
      expect(entry.TRANSACTION_COMPATIBILITY).toBe('TRANSACTION_COMPATIBLE')
      expect(entry.PREDECESSOR_UNIT_IDS).toEqual([
        ...new Set(
          frozen.edges.filter((edge) => edge.TO === entry.REPLAY_UNIT_ID).map((edge) => edge.FROM),
        ),
      ])
    })
  it('preserves127 complete mechanics,86 handoffs,and231 exact edges', () => {
    expect(model.registryPacket.PRESERVED_COMPATIBILITY_MECHANICS).toEqual(
      frozen.register.BOUND_REPLAY_RECORDS,
    )
    expect(model.registryPacket.PRESERVED_ORDERING_HANDOFFS).toEqual(
      frozen.register.BOUND_ORDERING_HANDOFFS,
    )
    expect(model.registryPacket.PRESERVED_EDGE_RECORDS).toEqual(frozen.edges)
    expect(
      model.registryPacket.REGISTRY.flatMap((entry) => entry.COMPATIBILITY_RECORD_IDS),
    ).toHaveLength(127)
    const handoffIds = new Set(
      model.registryPacket.REGISTRY.flatMap((entry) => entry.ORDERING_HANDOFF_IDS),
    )
    expect(handoffIds.size).toBe(86)
  })
  for (const constraint of replayRecords(model.registryPacket.DEFERRED_CONSTRAINT_HANDOFFS))
    it(`retains deferred constraint without materialization:${constraint.DEFERRED_CONSTRAINT_HANDOFF_ID}`, () => {
      expect(constraint.STATUS).toBe('DEFERRED_AFTER_REPLAY_OR_OPERAND_PRODUCTION')
      expect(constraint.MATERIALIZATION_POSITION).toBe('UNRESOLVED_DOWNSTREAM')
      expect(
        model.registryPacket.REGISTRY.some(
          (entry) => entry.REPLAY_UNIT_ID === constraint.DEFERRED_CONSTRAINT_HANDOFF_ID,
        ),
      ).toBe(false)
    })
  for (const operand of replayRecords(model.registryPacket.UNRESOLVED_OPERAND_BINDINGS))
    it(`retains unresolved operand without discovery:${operand.PHYSICAL_OPERAND_IDENTITY}`, () => {
      expect(operand.STATUS).toBe('UNRESOLVED_DOWNSTREAM')
      expect(operand.EXECUTION_ALLOWED).toBe('NO')
    })
  it('separates106 operational units from1 financial unit without changing frozen order', () => {
    expect(model.plan.SCOPE_EXECUTIONS.map((scope) => scope.UNIT_TOTAL)).toEqual([106, 1])
    expect(model.plan.UNIT_ORDER).toEqual(frozen.order.map((node) => node.REPLAY_UNIT_ID))
    expect(model.plan.PLAN_STATE).toBe('FAIL_CLOSED')
    expect(
      model.plan.EDGE_SATISFACTION.every(
        (edge) => edge.STATE === 'NOT_VERIFIED_NO_REPLAY_ELIGIBILITY',
      ),
    ).toBe(true)
  })
  it('never publishes1.3.4 or advertises complete producer implementation', () => {
    expect(model.report.phaseStatus.PHASE_1B_3C_A1I_W5B_GATE).toBe('BLOCKED')
    expect(model.report.phaseStatus.CANONICAL_CONTRACT_VERSION).toBe('1.3.3')
    expect(model.report.phaseStatus.W6).toBe('NOT_AUTHORIZED')
    expect(model.report.versionAmendment.VERSION_1_3_4_SHA256).toBeNull()
    expect(model.report.versionAmendment.PRIOR_JSON_INVERSE_PATCHES).toBeNull()
    expect(model.report.preservation.PRODUCER_IMPLEMENTATION_METADATA_CHANGED).toMatch(/^NO/)
    expect(model.report.proofBoundaries).toMatchObject({
      DATABASE_CONNECTIONS: 0,
      SQL_EXECUTED: 0,
      W4P_EXECUTED: 'NO',
      FROZEN_MIGRATIONS_EXECUTED: 0,
      COMPATIBILITY_MECHANICS_EXECUTED: 0,
      W5_REPLAY_EXECUTED: 'NO',
      DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
      PRODUCERS_ACTIVATED: 0,
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    })
  })
  for (const [file, hash] of Object.entries(model.report.preservation.BYTE_COMMITMENTS))
    it(`preserves upstream bytes:${file}`, () => {
      expect(replayHash(read(file))).toBe(hash)
    })
  it('records determinism digests for blocked artifacts and frozen W5A commitments', () => {
    const { REPLAY_PLAN_DIGEST, ...body } = model.plan
    expect(replayDigest(body)).toBe(REPLAY_PLAN_DIGEST)
    expect(replayDigest(model.registryPacket)).toBe(
      model.report.determinismDigests.W5B_REGISTRY_DIGEST,
    )
    expect(buildImplementation()).toEqual(model)
  })
  it('persists only ten requested final closure artifacts with identical bytes on two generations', async () => {
    const first = await generate()
    expect(Object.keys(first).sort()).toEqual(Object.values(outputs).sort())
    expect(first).toEqual(await generate())
  }, 30000)
  it('verifies persisted bytes without invoking a replay adapter', async () => {
    await expect(main(['--check'])).resolves.toBeUndefined()
  }, 30000)
  for (const flag of [
    '--apply',
    '--execute',
    '--connect',
    '--replay',
    '--activate',
    '--materialize',
    '--publish',
  ])
    it(`rejects unauthorized invocation:${flag}`, async () => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_W5B_FLAG')
    })
})
