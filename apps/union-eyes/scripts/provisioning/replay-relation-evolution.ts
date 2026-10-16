import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash, replayText } from './post-w4p-replay'
import { originalBoundaryContractDigest, type compileReplayUnitPlan } from './replay-unit-plan'
import {
  compileCompositeRelations,
  type CompositeRelationContract,
} from './replay-composite-relations'
import type { OriginalRelation } from './replay-original-relation'

export interface EvolvedOriginalRelation {
  relation: OriginalRelation
  sourceUnits: {
    unitId: string
    unitHash: string
    unitContractDigest: string
    effects: CompositeRelationContract['sourceEffects']
  }[]
  contractDigest: string
}
export function compileOriginalRelationEvolution(
  plan: ReturnType<typeof compileReplayUnitPlan>,
  throughUnitId: string,
): EvolvedOriginalRelation[] {
  const end = plan.specification.units.findIndex(
    (unit) => unit.node.REPLAY_UNIT_ID === throughUnitId,
  )
  if (end < 0) throw new ProvisioningError('REPLAY_RELATION_EVOLUTION_POSITION_UNKNOWN')
  const relations = new Map<string, Omit<EvolvedOriginalRelation, 'contractDigest'>>()
  for (const unit of plan.specification.units.slice(0, end + 1)) {
    const id = replayText(unit.node.REPLAY_UNIT_ID)
    const effects = plan.components.effects.filter((effect) => effect.boundaryId === id)
    if (
      unit.node.REPLAY_UNIT_CLASS !== 'FROZEN_MIGRATION_UNIT' ||
      unit.node.EXACT_UNIT_SHA256 !== replayHash(unit.sql) ||
      unit.contractDigest !== originalBoundaryContractDigest(unit.node, unit.sql, effects) ||
      effects.some(
        (effect, index) =>
          effect.ordinal !== index + 1 ||
          effect.boundaryHash !== replayHash(unit.sql) ||
          replayHash(effect.source) !== effect.sourceHash ||
          Buffer.from(unit.sql)
            .subarray(...effect.byteRange)
            .toString() !== effect.source,
      )
    )
      throw new ProvisioningError('REPLAY_RELATION_EVOLUTION_BOUNDARY_BINDING_INVALID')
    const provenance = {
      unitId: id,
      unitHash: replayHash(unit.sql),
      unitContractDigest: unit.contractDigest,
    }
    if (
      effects.every((effect) => ['RELATION', 'FOREIGN_KEY', 'INDEX'].includes(effect.compiled.kind))
    ) {
      for (const composed of compileCompositeRelations(effects)) {
        const key = JSON.stringify([composed.relation.schema, composed.relation.name])
        if (relations.has(key))
          throw new ProvisioningError('REPLAY_RELATION_EVOLUTION_DUPLICATE_BIRTH')
        relations.set(key, {
          relation: structuredClone(composed.relation),
          sourceUnits: [{ ...provenance, effects: structuredClone(composed.sourceEffects) }],
        })
      }
      continue
    }
    if (!effects.every((effect) => ['COLUMN', 'INDEX'].includes(effect.compiled.kind)))
      throw new ProvisioningError('REPLAY_RELATION_EVOLUTION_TYPED_OPERATION_REQUIRED')
    for (const effect of effects) {
      if (effect.compiled.kind === 'INDEX') continue
      if (effect.compiled.kind !== 'COLUMN')
        throw new ProvisioningError('REPLAY_RELATION_EVOLUTION_COLUMN_REQUIRED')
      const column = effect.compiled.contract
      const target = relations.get(JSON.stringify([column.schema, column.table]))
      if (!target)
        throw new ProvisioningError(
          'REPLAY_RELATION_EVOLUTION_EXTERNAL_RELATION_AUTHORITY_REQUIRED',
        )
      if (
        column.guarded ||
        column.column.notNull ||
        column.column.normalizedDefault.kind !== 'NONE' ||
        target.relation.columns.some((existing) => existing.name === column.column.name)
      )
        throw new ProvisioningError('REPLAY_RELATION_EVOLUTION_UNCONDITIONAL_ADD_NOT_PROVEN')
      target.relation.columns.push({
        ...structuredClone(column.column),
        sourceDefinitionHash: replayHash(effect.source),
      })
      const { contractDigest: _prior, ...body } = target.relation
      target.relation = { ...body, contractDigest: replayDigest(body) }
      let receipt = target.sourceUnits.find((receipt) => receipt.unitId === id)
      if (!receipt) {
        receipt = { ...provenance, effects: [] }
        target.sourceUnits.push(receipt)
      }
      receipt.effects.push({
        effectId: effect.effectId,
        sourceHash: effect.sourceHash,
        ordinal: effect.ordinal,
      })
    }
  }
  return [...relations.values()].map((contract) => ({
    ...contract,
    contractDigest: replayDigest(contract),
  }))
}
