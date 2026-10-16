import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash, replayText } from './post-w4p-replay'
import type {
  ReplayExecutionUnit,
  ReplayUnitHandler,
  ReplayUnitObservation,
} from './post-w4p-execution'
import type { ReplayEffectComponent } from './replay-effect-registry'
import type { ReplayPositionPin } from './replay-position-authority'
import { originalBoundaryContractDigest } from './replay-unit-plan'
import { inspectReplayEffect } from './replay-effect-inspection'
import { proceduralQueries } from './replay-procedural-inspection'
import { declarativeQueries } from './replay-declarative-boundary'
import { inspectSourceDdlType } from './replay-ddl-type-preflight'
export const nullableColumnQueries = {
  target: `SELECT c.relkind AS kind,
    NOT(c.relispartition OR EXISTS(SELECT 1 FROM pg_catalog.pg_inherits i WHERE i.inhrelid=c.oid OR i.inhparent=c.oid)) AS standalone,
    pg_catalog.pg_table_is_visible(c.oid) AS visible,
    pg_catalog.pg_has_role(current_user,c.relowner,'USAGE') AS alterable
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname=$2`,
}
export function makeNullableColumnBoundaryHandler(
  incomingUnit: ReplayExecutionUnit,
  incomingEffects: readonly ReplayEffectComponent[],
  incomingPin: ReplayPositionPin,
): ReplayUnitHandler {
  const unit = structuredClone(incomingUnit),
    effects = structuredClone(incomingEffects),
    pin = structuredClone(incomingPin)
  const id = replayText(unit.node.REPLAY_UNIT_ID)
  const columns = effects.flatMap((effect) =>
    effect.compiled.kind === 'COLUMN' ? [effect.compiled.contract] : [],
  )
  if (
    unit.node.REPLAY_UNIT_CLASS !== 'FROZEN_MIGRATION_UNIT' ||
    unit.node.EXACT_UNIT_SHA256 !== replayHash(unit.sql) ||
    unit.contractDigest !== originalBoundaryContractDigest(unit.node, unit.sql, effects) ||
    columns.length === 0 ||
    effects.some(
      (effect) =>
        !['COLUMN', 'INDEX'].includes(effect.compiled.kind) ||
        effect.boundaryId !== id ||
        effect.boundaryHash !== replayHash(unit.sql) ||
        Buffer.from(unit.sql)
          .subarray(...effect.byteRange)
          .toString() !== effect.source,
    ) ||
    columns.some(
      (contract) =>
        contract.guarded ||
        contract.column.notNull ||
        contract.column.normalizedDefault.kind !== 'NONE',
    )
  )
    throw new ProvisioningError('REPLAY_NULLABLE_COLUMN_BOUNDARY_SOURCE_BINDING_INVALID')
  return {
    unitId: id,
    contractDigest: unit.contractDigest,
    async inspect(reader, context, incoming, receipt) {
      if (
        replayDigest(incoming) !== replayDigest(unit) ||
        replayDigest(context) !== replayDigest(pin.execution)
      )
        throw new ProvisioningError('REPLAY_NULLABLE_COLUMN_POSITION_BINDING_INVALID')
      const reads: { sql: string; parameters: string[]; rows: unknown[] }[] = []
      const recording = {
        async query(sql: string, parameters: string[]) {
          const rows = await reader.query(sql, parameters)
          reads.push(structuredClone({ sql, parameters, rows }))
          return rows
        },
      }
      const outcome = (
        state: ReplayUnitObservation['state'],
        facts: unknown,
      ): ReplayUnitObservation => {
        const body = { unitId: id, contractDigest: unit.contractDigest, state, facts }
        return {
          state,
          ownedStateDigest: replayDigest(body),
          verificationDigest: replayDigest({
            body,
            reads: reads.sort((a, b) => replayDigest(a).localeCompare(replayDigest(b))),
          }),
        }
      }
      const identity = await recording.query(proceduralQueries.identity, [])
      if (
        replayDigest(identity) !==
        replayDigest([
          { actor: context.actorPrincipal, database: pin.database, search_path: pin.searchPath },
        ])
      )
        throw new ProvisioningError('REPLAY_NULLABLE_COLUMN_CATALOG_IDENTITY_DRIFT')
      const observed = []
      for (const effect of effects) observed.push(await inspectReplayEffect(recording, effect))
      if (observed.every((observation) => observation.definition === 'EXACT'))
        return outcome('ALREADY_COMPLETE', observed)
      if (observed.some((observation) => observation.definition === 'PRECONDITION_MISSING'))
        return outcome('PRECONDITION_MISSING', observed)
      if (observed.some((observation) => observation.definition === 'DRIFTED'))
        return outcome('DRIFTED', observed)
      if (receipt || !observed.every((observation) => observation.definition === 'ABSENT'))
        return outcome('PARTIAL_OR_AMBIGUOUS', observed)
      const tables = new Map(
        columns.map((contract) => [JSON.stringify([contract.schema, contract.table]), contract]),
      )
      if (
        effects.some(
          (effect) =>
            effect.compiled.kind === 'INDEX' &&
            !tables.has(
              JSON.stringify([effect.compiled.contract.schema, effect.compiled.contract.table]),
            ),
        )
      )
        return outcome('PRECONDITION_MISSING', { observed, denial: 'UNQUALIFIED_INDEX_TARGET' })
      if ((await recording.query(declarativeQueries.eventTriggers, [])).length)
        return outcome('PRECONDITION_MISSING', { observed, denial: 'UNQUALIFIED_EVENT_TRIGGERS' })
      for (const table of tables.values()) {
        const rows = await recording.query(nullableColumnQueries.target, [
          table.schema,
          table.table,
        ])
        if (
          replayDigest(rows) !==
          replayDigest([{ kind: 'r', standalone: true, visible: true, alterable: true }])
        )
          return outcome('PRECONDITION_MISSING', { observed, rows })
      }
      for (const column of columns) {
        const type = await inspectSourceDdlType(recording, column.column.type)
        if (type.state !== 'QUALIFIED') return outcome('PRECONDITION_MISSING', { observed, type })
      }
      return outcome('REPLAY_REQUIRED', observed)
    },
  }
}
