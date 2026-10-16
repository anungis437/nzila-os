import { ProvisioningError } from './governed-provisioning'
import {
  replayDigest,
  replayHash,
  replayObject,
  replayRecords,
  replayStrings,
  replayText,
  type FrozenReplay,
  type JsonRecord,
} from './post-w4p-replay'
import { compileEnumWrapper } from './replay-enum-inspection'
import { compileCreateStatement, type NamedEnumAuthority } from './replay-create-inspection'
import { compileOriginalRelation } from './replay-original-relation'
import {
  compileSchema,
  compileAddedColumn,
  compileForeignKey,
  compileSimpleIndex,
} from './replay-structural-effects'
import { compileRlsToggle, compilePolicyDrop } from './replay-rls-primitives'
import { compileLiteralPolicy } from './replay-literal-policy'
import { compileFunctionEffect } from './replay-function-inspection'
import { compilePolicyHelper, frozenHelperSources } from './replay-policy-helper-inspection'
import { compileAclEffect } from './replay-acl-inspection'
import { compileDefaultEffect } from './replay-default-inspection'
import { compileBackfill } from './replay-backfill-inspection'
import { compileProceduralEffect } from './replay-procedural-inspection'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'

function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new ProvisioningError(code)
}
function sourceRange(value: unknown, length: number, code: string): [number, number] {
  requireCondition(
    Array.isArray(value) &&
      value.length === 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number' &&
      Number.isSafeInteger(value[0]) &&
      Number.isSafeInteger(value[1]) &&
      value[0] >= 0 &&
      value[1] > value[0] &&
      value[1] <= length,
    code,
  )
  return [value[0], value[1]]
}
export function exactReplaySource(
  frozen: FrozenReplay,
  sourceBytes: Record<string, string>,
  node: JsonRecord,
) {
  const file = replayText(node.SOURCE_FILE),
    source = sourceBytes[file]
  requireCondition(
    typeof source === 'string' && replayHash(source) === node.SOURCE_SHA256,
    'REPLAY_REGISTRY_BOUNDARY_SOURCE_DRIFT',
  )
  if (node.REPLAY_UNIT_CLASS === 'FROZEN_MIGRATION_UNIT') {
    requireCondition(
      replayHash(source) === node.EXACT_UNIT_SHA256,
      'REPLAY_REGISTRY_UNIT_SOURCE_DRIFT',
    )
    return source
  }
  const bindings = replayRecords(frozen.register.BOUND_REPLAY_RECORDS).filter(
    (entry) => entry.REPLAY_UNIT_ID === node.REPLAY_UNIT_ID,
  )
  requireCondition(bindings.length > 0, 'REPLAY_REGISTRY_SOURCE_BINDING_INVALID')
  const range = sourceRange(
    bindings[0].SOURCE_RANGE,
    source.length,
    'REPLAY_REGISTRY_SOURCE_RANGE_INVALID',
  )
  requireCondition(
    bindings.every(
      (binding) =>
        replayDigest(
          sourceRange(binding.SOURCE_RANGE, source.length, 'REPLAY_REGISTRY_SOURCE_RANGE_INVALID'),
        ) === replayDigest(range),
    ),
    'REPLAY_REGISTRY_SOURCE_BINDING_INVALID',
  )
  const sql = source.slice(range[0], range[1])
  requireCondition(replayHash(sql) === node.EXACT_UNIT_SHA256, 'REPLAY_REGISTRY_UNIT_SOURCE_DRIFT')
  return sql
}
export function replayEnumAuthority(
  frozen: FrozenReplay,
  sourceBytes: Record<string, string>,
): NamedEnumAuthority[] {
  const authority: NamedEnumAuthority[] = replayRecords(
    frozen.input.promotionImplementation.registry,
  ).flatMap((entry) => {
    const invariant = replayObject(entry.MATCHING_INVARIANTS)
    return Array.isArray(invariant.enumMembers)
      ? [
          {
            schema: replayText(invariant.schema),
            name: replayText(invariant.name),
            members: replayStrings(invariant.enumMembers),
            definitionDigest: replayDigest(invariant),
          },
        ]
      : []
  })
  for (const node of frozen.nodes.filter(
    (node) => node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT',
  )) {
    const spec = compileEnumWrapper(
      exactReplaySource(frozen, sourceBytes, node),
      replayText(node.EXACT_UNIT_SHA256),
    )
    authority.push({
      schema: spec.schema,
      name: spec.name,
      members: spec.members,
      definitionDigest: spec.contractDigest,
    })
  }
  const unique = new Map<string, NamedEnumAuthority>()
  for (const entry of authority) {
    const key = `${entry.schema}.${entry.name}`,
      previous = unique.get(key)
    requireCondition(
      !previous || replayDigest(previous.members) === replayDigest(entry.members),
      'REPLAY_REGISTRY_ENUM_AUTHORITY_CONFLICT',
    )
    if (!previous) unique.set(key, entry)
  }
  return [...unique.values()]
}
type ContractMap = {
  SCHEMA: ReturnType<typeof compileSchema>
  RELATION: ReturnType<typeof compileOriginalRelation>
  COLUMN: ReturnType<typeof compileAddedColumn>
  FOREIGN_KEY: ReturnType<typeof compileForeignKey>
  INDEX: ReturnType<typeof compileSimpleIndex>
  RLS: ReturnType<typeof compileRlsToggle>
  POLICY_DROP: ReturnType<typeof compilePolicyDrop>
  POLICY_CREATE: ReturnType<typeof compileLiteralPolicy>
  POLICY_HELPER: ReturnType<typeof compilePolicyHelper>
  FUNCTION: ReturnType<typeof compileFunctionEffect>
  ACL: ReturnType<typeof compileAclEffect>
  DEFAULT: ReturnType<typeof compileDefaultEffect>
  BACKFILL: ReturnType<typeof compileBackfill>
  PROCEDURAL: ReturnType<typeof compileProceduralEffect>
}
export type ReplayCompiledEffect = {
  [K in keyof ContractMap]: { kind: K; contract: ContractMap[K] }
}[keyof ContractMap]
export interface ReplayEffectBinding {
  effectId: string
  boundaryId: string
  boundaryHash: string
  sourcePath: string
  sourceHash: string
  ordinal: number
  effectClass: string
  source: string
  byteRange: [number, number]
}
export type ReplayEffectComponent = ReplayEffectBinding & { compiled: ReplayCompiledEffect }
export const frozenEffectCounts = {
  RELATION_DDL: 78,
  CONSTRAINT_DDL: 17,
  INDEX_DDL: 89,
  COLUMN_DDL: 43,
  POLICY_OR_RLS: 415,
  ACL_CHANGE: 21,
  DO_OR_PROCEDURAL_BLOCK: 75,
  FUNCTION_OR_PROCEDURE: 13,
  DEFAULT_OR_NULLABILITY_CHANGE: 7,
  DATA_BACKFILL: 4,
}
function compileComponent(
  binding: ReplayEffectBinding,
  enums: NamedEnumAuthority[],
): ReplayCompiledEffect {
  const { source, sourceHash, effectClass } = binding,
    tokens = sqlTokens(source)
  const word = (index: number) =>
    tokens[index]?.kind === 'WORD' ? tokens[index].value.toUpperCase() : null
  switch (effectClass) {
    case 'RELATION_DDL':
      return word(1) === 'SCHEMA'
        ? { kind: 'SCHEMA', contract: compileSchema(source, sourceHash) }
        : { kind: 'RELATION', contract: compileOriginalRelation(source, sourceHash, enums) }
    case 'CONSTRAINT_DDL':
      return { kind: 'FOREIGN_KEY', contract: compileForeignKey(source, sourceHash) }
    case 'INDEX_DDL':
      return { kind: 'INDEX', contract: compileSimpleIndex(source, sourceHash) }
    case 'COLUMN_DDL':
      return { kind: 'COLUMN', contract: compileAddedColumn(source, sourceHash) }
    case 'POLICY_OR_RLS':
      if (word(0) === 'ALTER')
        return { kind: 'RLS', contract: compileRlsToggle(source, sourceHash) }
      if (word(0) === 'DROP')
        return { kind: 'POLICY_DROP', contract: compilePolicyDrop(source, sourceHash) }
      if (word(0) === 'CREATE')
        return { kind: 'POLICY_CREATE', contract: compileLiteralPolicy(source, sourceHash) }
      requireCondition(word(0) === 'SELECT', 'REPLAY_REGISTRY_POLICY_GRAMMAR_UNSUPPORTED')
      const sources = frozenHelperSources(),
        calls = sources.calls.filter((entry) => entry.effectId === binding.effectId)
      requireCondition(
        calls.length === 1 && calls[0].source === source && calls[0].sourceHash === sourceHash,
        'REPLAY_REGISTRY_HELPER_CALL_DRIFT',
      )
      const functions = sources.functions.filter(
        (entry) => compileFunctionEffect(entry.source, entry.sourceHash).name === tokens[1]?.value,
      )
      requireCondition(
        functions.length === 1,
        'REPLAY_REGISTRY_HELPER_FUNCTION_AUTHORITY_AMBIGUOUS',
      )
      return { kind: 'POLICY_HELPER', contract: compilePolicyHelper(calls[0], functions[0]) }
    case 'FUNCTION_OR_PROCEDURE':
      return { kind: 'FUNCTION', contract: compileFunctionEffect(source, sourceHash) }
    case 'ACL_CHANGE':
      return { kind: 'ACL', contract: compileAclEffect(source, sourceHash) }
    case 'DEFAULT_OR_NULLABILITY_CHANGE':
      return { kind: 'DEFAULT', contract: compileDefaultEffect(source, sourceHash) }
    case 'DATA_BACKFILL':
      return { kind: 'BACKFILL', contract: compileBackfill(source, sourceHash) }
    case 'DO_OR_PROCEDURAL_BLOCK':
      return { kind: 'PROCEDURAL', contract: compileProceduralEffect(source, sourceHash) }
    default:
      throw new ProvisioningError('REPLAY_REGISTRY_EFFECT_CLASS_UNSUPPORTED')
  }
}
export function bindFrozenEffects(
  frozen: FrozenReplay,
  sourceBytes: Record<string, string>,
  ledgerBytes: string,
): ReplayEffectBinding[] {
  requireCondition(
    replayHash(ledgerBytes) === '41ff4487e83c831dd94c6dbc50a2fe48de3f26af6b3c31453a188e975e423787',
    'REPLAY_REGISTRY_LEDGER_DRIFT',
  )
  const ledger = replayObject(JSON.parse(ledgerBytes)),
    boundaries = replayRecords(ledger.BOUNDARIES)
  requireCondition(boundaries.length === 23, 'REPLAY_REGISTRY_BOUNDARY_COVERAGE_INVALID')
  const bindings: ReplayEffectBinding[] = []
  const ids = new Set<string>(),
    boundaryIds = new Set<string>()
  const classes = new Map<string, number>()
  for (const boundary of boundaries) {
    const boundaryId = replayText(boundary.BOUNDARY_ID),
      file = replayText(boundary.SOURCE_PATH)
    const nodes = frozen.nodes.filter(
      (node) =>
        node.REPLAY_UNIT_ID === boundaryId && node.REPLAY_UNIT_CLASS === 'FROZEN_MIGRATION_UNIT',
    )
    requireCondition(
      nodes.length === 1 && !boundaryIds.has(boundaryId),
      'REPLAY_REGISTRY_BOUNDARY_BINDING_INVALID',
    )
    boundaryIds.add(boundaryId)
    const sql = exactReplaySource(frozen, sourceBytes, nodes[0]),
      bytes = Buffer.from(sql, 'utf8')
    requireCondition(
      replayHash(sql) === boundary.SOURCE_SHA256 &&
        nodes[0].DATABASE_SCOPE === boundary.DATABASE_SCOPE,
      'REPLAY_REGISTRY_BOUNDARY_BINDING_INVALID',
    )
    const effects = replayRecords(boundary.EFFECTS)
    requireCondition(
      effects.length === boundary.EFFECT_COUNT,
      'REPLAY_REGISTRY_EFFECT_COVERAGE_INVALID',
    )
    for (const [index, effect] of effects.entries()) {
      const effectId = replayText(effect.EFFECT_ID),
        source = replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS)
      const range = sourceRange(
        effect.SOURCE_BYTE_RANGE,
        bytes.length,
        'REPLAY_REGISTRY_EFFECT_RANGE_INVALID',
      )
      requireCondition(
        !ids.has(effectId) &&
          effect.BOUNDARY_ID === boundaryId &&
          effect.SOURCE_ORDINAL === index + 1 &&
          bytes.subarray(range[0], range[1]).toString('utf8') === source &&
          replayHash(source) === effect.EXACT_EFFECT_SHA256,
        'REPLAY_REGISTRY_EFFECT_BINDING_INVALID',
      )
      ids.add(effectId)
      const effectClass = replayText(effect.EFFECT_CLASS)
      classes.set(effectClass, (classes.get(effectClass) ?? 0) + 1)
      bindings.push({
        effectId,
        boundaryId,
        boundaryHash: replayHash(sql),
        sourcePath: file,
        sourceHash: replayHash(source),
        ordinal: index + 1,
        effectClass,
        source,
        byteRange: [range[0], range[1]],
      })
    }
  }
  requireCondition(
    bindings.length === 762 &&
      classes.size === Object.keys(frozenEffectCounts).length &&
      Object.entries(frozenEffectCounts).every(([name, count]) => classes.get(name) === count),
    'REPLAY_REGISTRY_EFFECT_DENOMINATOR_DRIFT',
  )
  return bindings
}
export function compileReplayComponents(
  frozen: FrozenReplay,
  sourceBytes: Record<string, string>,
  ledgerBytes: string,
) {
  const enums = replayEnumAuthority(frozen, sourceBytes),
    bindings = bindFrozenEffects(frozen, sourceBytes, ledgerBytes)
  const effects: ReplayEffectComponent[] = bindings.map((binding) => ({
    ...binding,
    compiled: compileComponent(binding, enums),
  }))
  const creates = frozen.nodes
    .filter((node) => node.REPLAY_UNIT_CLASS === 'FROZEN_STATEMENT_UNIT')
    .map((node) => ({
      unitId: replayText(node.REPLAY_UNIT_ID),
      contract: compileCreateStatement(
        exactReplaySource(frozen, sourceBytes, node),
        replayText(node.EXACT_UNIT_SHA256),
        enums,
      ),
    }))
  const wrappers = frozen.nodes
    .filter((node) => node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT')
    .map((node) => ({
      unitId: replayText(node.REPLAY_UNIT_ID),
      contract: compileEnumWrapper(
        exactReplaySource(frozen, sourceBytes, node),
        replayText(node.EXACT_UNIT_SHA256),
      ),
    }))
  requireCondition(
    creates.length === 43 && wrappers.length === 41 && effects.length === 762,
    'REPLAY_REGISTRY_COMPONENT_COVERAGE_INVALID',
  )
  return {
    enums,
    effects,
    creates,
    wrappers,
    proceduralBindings: bindings.filter(
      (binding) => binding.effectClass === 'DO_OR_PROCEDURAL_BLOCK',
    ),
    digest: replayDigest({ enums, effects, creates, wrappers }),
    wholeBoundaryQualification: 'NOT_ESTABLISHED' as const,
  }
}
