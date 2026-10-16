import { ProvisioningError } from './governed-provisioning'
import { catalogQueries } from './platform-baseline-promotion'
import { replayDigest, replayHash, replayText } from './post-w4p-replay'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { frozenStatements } from '../../../../scripts/ue/close-w5a-replay-graph'
import type {
  ReplayUnitHandler,
  ReplayExecutionUnit,
  ReplayUnitObservation,
} from './post-w4p-execution'

function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new ProvisioningError(code)
}
export function compileEnumWrapper(sql: string, expectedHash: string) {
  requireCondition(replayHash(sql) === expectedHash, 'REPLAY_ENUM_SOURCE_HASH_DRIFT')
  const tokens = sqlTokens(sql)
  let index = 0
  const word = (value: string) => {
    const token = tokens[index++]
    requireCondition(
      token?.kind === 'WORD' && token.value.toUpperCase() === value,
      'REPLAY_ENUM_WRAPPER_SEMANTICS_UNSUPPORTED',
    )
  }
  const symbol = (value: string) => {
    const token = tokens[index++]
    requireCondition(
      token?.kind === 'SYMBOL' && token.value === value,
      'REPLAY_ENUM_WRAPPER_SEMANTICS_UNSUPPORTED',
    )
  }
  const identifier = () => {
    const token = tokens[index++]
    requireCondition(
      token && (token.kind === 'WORD' || token.kind === 'IDENTIFIER'),
      'REPLAY_ENUM_WRAPPER_SEMANTICS_UNSUPPORTED',
    )
    return token.kind === 'WORD' ? token.value.toLowerCase() : token.value
  }
  word('DO')
  word('BEGIN')
  word('CREATE')
  word('TYPE')
  let schema = 'public',
    name = identifier()
  if (tokens[index]?.kind === 'SYMBOL' && tokens[index].value === '.') {
    symbol('.')
    schema = name
    name = identifier()
  }
  requireCondition(schema === 'public', 'REPLAY_ENUM_WRAPPER_SCHEMA_UNSUPPORTED')
  word('AS')
  word('ENUM')
  symbol('(')
  const members: string[] = []
  while (true) {
    const member = tokens[index++]
    requireCondition(member?.kind === 'STRING', 'REPLAY_ENUM_WRAPPER_SEMANTICS_UNSUPPORTED')
    members.push(member.value)
    if (tokens[index]?.value !== ',') break
    symbol(',')
  }
  symbol(')')
  symbol(';')
  word('EXCEPTION')
  word('WHEN')
  word('DUPLICATE_OBJECT')
  word('THEN')
  word('NULL')
  symbol(';')
  word('END')
  symbol(';')
  requireCondition(
    index === tokens.length && new Set(members).size === members.length,
    'REPLAY_ENUM_WRAPPER_SEMANTICS_UNSUPPORTED',
  )
  const body = {
    schema,
    name,
    members,
    sourceHash: expectedHash,
    unitClass: 'ENUM_DO_WRAPPER',
    query: catalogQueries.type,
  }
  return { ...body, contractDigest: replayDigest(body) }
}
const namespaceQuery = 'SELECT nspname AS name FROM pg_catalog.pg_namespace WHERE nspname=$1'
export function noEffectContract(sql: string, sourceHash: string) {
  requireCondition(replayHash(sql) === sourceHash, 'REPLAY_NO_EFFECT_SOURCE_DRIFT')
  requireCondition(frozenStatements(sql).length === 0, 'REPLAY_NO_EFFECT_EXECUTABLE_SOURCE_FOUND')
  return replayDigest({
    sourceHash,
    executableEffects: [],
    unitClass: 'ORIGINAL_POSITION_MIGRATION_BOUNDARY',
  })
}
export function makeNoEffectReplayHandler(unit: ReplayExecutionUnit): ReplayUnitHandler {
  requireCondition(
    unit.node.REPLAY_UNIT_CLASS === 'FROZEN_MIGRATION_UNIT' &&
      unit.node.DATABASE_SCOPE === 'FINANCIAL_SERVICE',
    'REPLAY_NO_EFFECT_SCOPE_CLASS_INVALID',
  )
  const sourceHash = replayText(unit.node.EXACT_UNIT_SHA256)
  const contractDigest = noEffectContract(unit.sql, sourceHash)
  requireCondition(
    unit.contractDigest === contractDigest,
    'REPLAY_NO_EFFECT_CONTRACT_BINDING_DRIFT',
  )
  const unitId = replayText(unit.node.REPLAY_UNIT_ID)
  return {
    unitId,
    contractDigest,
    async inspect(_reader, context, current) {
      requireCondition(
        current.node.REPLAY_UNIT_ID === unitId &&
          current.node.DATABASE_SCOPE === 'FINANCIAL_SERVICE' &&
          current.contractDigest === contractDigest &&
          replayHash(current.sql) === sourceHash,
        'REPLAY_NO_EFFECT_CONTRACT_BINDING_DRIFT',
      )
      const state =
        context.scope === 'FINANCIAL_SERVICE' &&
        context.actorClass === 'MIGRATION_ADMIN' &&
        !!context.actorPrincipal &&
        !!context.w4pVerificationDigest &&
        !!context.supplementVerificationDigest
          ? 'ALREADY_COMPLETE'
          : 'PRECONDITION_MISSING'
      return {
        state,
        ownedStateDigest: replayDigest({ sourceHash, effects: [] }),
        verificationDigest: replayDigest({ unitId, sourceHash, state, effects: [] }),
      }
    },
  }
}
export function makeEnumReplayHandler(unit: ReplayExecutionUnit): ReplayUnitHandler {
  requireCondition(
    unit.node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT',
    'REPLAY_ENUM_UNIT_CLASS_REQUIRED',
  )
  const contract = compileEnumWrapper(unit.sql, replayText(unit.node.EXACT_UNIT_SHA256))
  requireCondition(
    unit.contractDigest === contract.contractDigest,
    'REPLAY_ENUM_CONTRACT_BINDING_DRIFT',
  )
  const unitId = replayText(unit.node.REPLAY_UNIT_ID)
  const scope = replayText(unit.node.DATABASE_SCOPE)
  const observation = (
    state: ReplayUnitObservation['state'],
    data: unknown,
  ): ReplayUnitObservation => ({
    state,
    ownedStateDigest: replayDigest({ schema: contract.schema, name: contract.name, data }),
    verificationDigest: replayDigest({ unitId, contract: contract.contractDigest, state, data }),
  })
  return {
    unitId,
    contractDigest: contract.contractDigest,
    async inspect(reader, context, current) {
      requireCondition(
        current.node.REPLAY_UNIT_ID === unitId &&
          current.node.DATABASE_SCOPE === scope &&
          current.contractDigest === contract.contractDigest &&
          replayHash(current.sql) === contract.sourceHash,
        'REPLAY_ENUM_CONTRACT_BINDING_DRIFT',
      )
      if (
        context.scope !== scope ||
        context.actorClass !== 'MIGRATION_ADMIN' ||
        !context.actorPrincipal ||
        !context.w4pVerificationDigest ||
        !context.supplementVerificationDigest
      )
        return observation('PRECONDITION_MISSING', { context: 'UNVERIFIED' })
      const rows = await reader.query(catalogQueries.type, [contract.schema, contract.name])
      requireCondition(rows.length <= 1, 'REPLAY_ENUM_CATALOG_CARDINALITY_INVALID')
      if (!rows.length) {
        const namespaces = await reader.query(namespaceQuery, [contract.schema])
        requireCondition(namespaces.length <= 1, 'REPLAY_ENUM_CATALOG_CARDINALITY_INVALID')
        if (!namespaces.length)
          return observation('PRECONDITION_MISSING', { type: null, namespace: null })
        const namespace = namespaces[0]
        requireCondition(
          namespace &&
            typeof namespace === 'object' &&
            !Array.isArray(namespace) &&
            'name' in namespace &&
            namespace.name === contract.schema,
          'REPLAY_ENUM_CATALOG_ROW_INVALID',
        )
        return observation('REPLAY_REQUIRED', { type: null, namespace: contract.schema })
      }
      const row = rows[0]
      requireCondition(
        row && typeof row === 'object' && !Array.isArray(row),
        'REPLAY_ENUM_CATALOG_ROW_INVALID',
      )
      requireCondition(
        'kind' in row &&
          typeof row.kind === 'string' &&
          'members' in row &&
          Array.isArray(row.members) &&
          row.members.every((member) => typeof member === 'string'),
        'REPLAY_ENUM_CATALOG_ROW_INVALID',
      )
      return observation(
        row.kind === 'e' && replayDigest(row.members) === replayDigest(contract.members)
          ? 'ALREADY_COMPLETE'
          : 'DRIFTED',
        { kind: row.kind, members: row.members },
      )
    },
  }
}
