import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash, replayText } from './post-w4p-replay'
import type { ReplayEffectComponent } from './replay-effect-registry'
import type { ReplayPositionPin } from './replay-position-authority'
import type {
  ReplayExecutionUnit,
  ReplayUnitHandler,
  ReplayUnitObservation,
} from './post-w4p-execution'
import { compileCompositeRelations } from './replay-composite-relations'
import { inspectOriginalRelation, originalRelationQueries } from './replay-original-relation'
import { inspectReplayEffect } from './replay-effect-inspection'
import { proceduralQueries } from './replay-procedural-inspection'
import { createCatalogQueries } from './replay-create-inspection'
import { originalBoundaryContractDigest } from './replay-unit-plan'
import {inspectSourceDdlType,resolvedDdlTypeQuery} from './replay-ddl-type-preflight'
export const declarativeQueries = {
  creationSchema: 'SELECT current_schema()::text AS creation_schema',
  schemaPrivilege:
    "SELECT pg_catalog.has_schema_privilege($1,$2,'USAGE') AS usage,pg_catalog.has_schema_privilege($1,$2,'CREATE') AS create",
  eventTriggers:
    "SELECT evtname AS name,evtenabled AS enabled FROM pg_catalog.pg_event_trigger WHERE evtenabled<>'D' ORDER BY oid",
  resolvedType:resolvedDdlTypeQuery,
}
/** A whole-byte declarative boundary, with separately verified named indexes/FKs and no partial replay. */
export function makeDeclarativeBoundaryHandler(
  incomingUnit: ReplayExecutionUnit,
  incomingEffects: readonly ReplayEffectComponent[],
  incomingPin: ReplayPositionPin,
): ReplayUnitHandler {
  const unit = structuredClone(incomingUnit),
    effects = structuredClone(incomingEffects),
    pin = structuredClone(incomingPin)
  const id = replayText(unit.node.REPLAY_UNIT_ID)
  if (
    unit.node.REPLAY_UNIT_CLASS !== 'FROZEN_MIGRATION_UNIT' ||
    effects.length === 0 ||
    unit.node.EXACT_UNIT_SHA256 !== replayHash(unit.sql) ||
    unit.contractDigest !== originalBoundaryContractDigest(unit.node, unit.sql, effects) ||
    effects.some(
      (effect) =>
        effect.boundaryId !== id ||
        effect.boundaryHash !== replayHash(unit.sql) ||
        Buffer.from(unit.sql)
          .subarray(...effect.byteRange)
          .toString() !== effect.source,
    )
  )
    throw new ProvisioningError('REPLAY_DECLARATIVE_BOUNDARY_SOURCE_BINDING_INVALID')
  const composites = compileCompositeRelations(effects)
  if (!composites.length)
    throw new ProvisioningError('REPLAY_DECLARATIVE_BOUNDARY_RELATIONS_REQUIRED')
  const byTable = new Map(
    composites.map((contract) => [
      JSON.stringify([contract.relation.schema, contract.relation.name]),
      contract.relation,
    ]),
  )
  for (const contract of composites)
    for (const key of contract.relation.constraints.filter((key) => key.kind === 'f')) {
      const parent = key.parent!
      const definition = byTable.get(JSON.stringify([parent.schema, parent.name]))
      if (!definition)
        throw new ProvisioningError('REPLAY_DECLARATIVE_EXTERNAL_PARENT_REQUIRES_PRIOR_AUTHORITY')
      const childColumns = key.columns.map((name) =>
        contract.relation.columns.find((column) => column.name === name),
      )
      if (
        !definition.constraints.some(
          (constraint) =>
            ['p', 'u'].includes(constraint.kind) &&
            replayDigest(constraint.columns) === replayDigest(parent.columns),
        ) ||
        parent.columns.some((name, index) => {
          const column = definition.columns.find((column) => column.name === name),
            child = childColumns[index]
          return (
            !column ||
            !child ||
            column.type.schema !== child.type.schema ||
            column.type.name !== child.type.name
          )
        })
      )
        throw new ProvisioningError('REPLAY_DECLARATIVE_PARENT_KEY_SOURCE_NOT_PROVEN')
    }
  return {
    unitId: id,
    contractDigest: unit.contractDigest,
    async inspect(reader, context, incoming, receipt) {
      if (
        replayDigest(incoming) !== replayDigest(unit) ||
        replayDigest(context) !== replayDigest(pin.execution)
      )
        throw new ProvisioningError('REPLAY_DECLARATIVE_POSITION_BINDING_INVALID')
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
        owned: unknown,
      ): ReplayUnitObservation => {
        const body = { unitId: id, contractDigest: unit.contractDigest, state, owned }
        const sorted = [...reads].sort((left, right) =>
          replayDigest(left).localeCompare(replayDigest(right)),
        )
        return {
          state,
          ownedStateDigest: replayDigest(body),
          verificationDigest: replayDigest({ body, reads: sorted }),
        }
      }
      const identity = await recording.query(proceduralQueries.identity, [])
      if (
        replayDigest(identity) !==
        replayDigest([
          { actor: context.actorPrincipal, database: pin.database, search_path: pin.searchPath },
        ])
      )
        throw new ProvisioningError('REPLAY_DECLARATIVE_CATALOG_IDENTITY_DRIFT')
      const presence = await Promise.all(
        composites.map(async (contract) => {
          const relation = contract.relation
          const rows = await recording.query(originalRelationQueries.relation, [
            relation.schema,
            relation.name,
          ])
          if (rows.length > 1)
            throw new ProvisioningError('REPLAY_DECLARATIVE_RELATION_CARDINALITY_INVALID')
          return { name: relation.name, rows }
        }),
      )
      const absent = presence.filter((entry) => entry.rows.length === 0).length
      if (absent !== 0 && absent !== composites.length)
        return outcome('PARTIAL_OR_AMBIGUOUS', presence)
      if (absent === 0) {
        const relations = await Promise.all(
          composites.map(async (contract) => ({
            name: contract.relation.name,
            observation: await inspectOriginalRelation(recording, contract.relation),
          })),
        )
        const named = await Promise.all(
          effects
            .filter(
              (effect) =>
                effect.compiled.kind === 'FOREIGN_KEY' || effect.compiled.kind === 'INDEX',
            )
            .map((effect) => inspectReplayEffect(recording, effect)),
        )
        const all = [
          ...relations.map((entry) => entry.observation.definition),
          ...named.map((entry) => entry.definition),
        ]
        return outcome(
          all.every((state) => state === 'EXACT')
            ? 'ALREADY_COMPLETE'
            : all.some((state) => state === 'PRECONDITION_MISSING')
              ? 'PRECONDITION_MISSING'
              : 'DRIFTED',
          { relations, named },
        )
      }
      if (receipt) return outcome('PARTIAL_OR_AMBIGUOUS', presence)
      const schema = await recording.query(declarativeQueries.creationSchema, [])
      if (replayDigest(schema) !== replayDigest([{ creation_schema: 'public' }]))
        return outcome('PRECONDITION_MISSING', { presence, schema })
      if ((await recording.query(declarativeQueries.eventTriggers, [])).length)
        return outcome('PRECONDITION_MISSING', {
          presence,
          eventTriggers: 'UNQUALIFIED_SIDE_EFFECTS',
        })
      const prerequisites: unknown[] = []
      for (const name of new Set(composites.map((contract) => contract.relation.schema))) {
        const rows = await recording.query(declarativeQueries.schemaPrivilege, [
          context.actorPrincipal,
          name,
        ])
        if (replayDigest(rows) !== replayDigest([{ usage: true, create: true }]))
          return outcome('PRECONDITION_MISSING', { presence, rows })
      }
      for (const table of composites)
        for (const column of table.relation.columns) {
          const type=await inspectSourceDdlType(recording,column.type)
          if(type.state!=='QUALIFIED')return outcome('PRECONDITION_MISSING',{presence,type})
          prerequisites.push(type)
        }
      const random = await recording.query(createCatalogQueries.deployedRandom, [
        'gen_random_uuid()',
      ])
      const clock = await recording.query(createCatalogQueries.clock, [])
      if (
        random.length !== 1 ||
        random[0] === null ||
        typeof random[0] !== 'object' ||
        !('executable' in random[0]) ||
        random[0].executable !== true ||
        !('origin' in random[0]) ||
        !['POSTGRES_BUILTIN', 'PGCRYPTO_EXTENSION'].includes(String(random[0].origin)) ||
        replayDigest(clock) !==
          replayDigest([
            {
              schema: 'pg_catalog',
              name: 'now',
              language: 'internal',
              result: 'timestamptz',
              executable: true,
            },
          ])
      )
        return outcome('PRECONDITION_MISSING', { presence, random, clock })
      for (const effect of effects.filter(
        (effect) => effect.compiled.kind === 'INDEX' || effect.compiled.kind === 'FOREIGN_KEY',
      )) {
        const observation = await inspectReplayEffect(recording, effect)
        if (observation.definition !== 'ABSENT')
          return outcome('PARTIAL_OR_AMBIGUOUS', { presence, observation })
      }
      return outcome('REPLAY_REQUIRED', { presence, prerequisites, random, clock })
    },
  }
}
