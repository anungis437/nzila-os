import type { CatalogReader } from './platform-baseline-promotion'
import type { ReplayEffectComponent } from './replay-effect-registry'
import {
  inspectSchema,
  inspectAddedColumn,
  inspectForeignKey,
  inspectSimpleIndex,
  type StructuralObservation,
} from './replay-structural-effects'
import { inspectOriginalRelation } from './replay-original-relation'
import { inspectRlsToggle, inspectPolicyDrop } from './replay-rls-primitives'
import { inspectLiteralPolicy } from './replay-literal-policy'
import { inspectFunctionEffect, type FunctionPrerequisites } from './replay-function-inspection'
import { inspectPolicyHelper, type HelperPositionContext } from './replay-policy-helper-inspection'
import { inspectAclEffect, type AclPositionAuthority } from './replay-acl-inspection'
import { inspectDefaultEffect } from './replay-default-inspection'
import { inspectBackfill } from './replay-backfill-inspection'
import { replayDigest } from './post-w4p-replay'
import { ProvisioningError } from './governed-provisioning'
import {
  inspectProceduralEffect,
  type ProceduralContext,
  type ProceduralPredecessor,
} from './replay-procedural-inspection'

export interface ReplayEffectPositionAuthority {
  effectId: string
  sourceHash: string
  function?: FunctionPrerequisites
  helper?: HelperPositionContext
  acl?: AclPositionAuthority
  procedural?: ProceduralContext
  predecessor?: ProceduralPredecessor
}
export interface ReplayEffectObservation {
  definition: StructuralObservation['definition'] | 'PARTIAL'
  stateDigest: string
  effectId: string
  contractDigest: string
  observationDigest: string
}
export async function inspectReplayEffect(
  reader: CatalogReader,
  effect: ReplayEffectComponent,
  authority?: ReplayEffectPositionAuthority,
): Promise<ReplayEffectObservation> {
  if (
    authority &&
    (authority.effectId !== effect.effectId || authority.sourceHash !== effect.sourceHash)
  )
    throw new ProvisioningError('REPLAY_EFFECT_POSITION_AUTHORITY_DRIFT')
  const spec = effect.compiled
  const evaluate = async (): Promise<{
    definition: ReplayEffectObservation['definition']
    stateDigest: string
  }> => {
    switch (spec.kind) {
      case 'SCHEMA':
        return inspectSchema(reader, spec.contract)
      case 'RELATION':
        return inspectOriginalRelation(reader, spec.contract)
      case 'COLUMN':
        return inspectAddedColumn(reader, spec.contract)
      case 'FOREIGN_KEY':
        return inspectForeignKey(reader, spec.contract)
      case 'INDEX':
        return inspectSimpleIndex(reader, spec.contract)
      case 'POLICY_CREATE':
        return inspectLiteralPolicy(reader, spec.contract)
      case 'FUNCTION': {
        const observation = await inspectFunctionEffect(reader, spec.contract, authority?.function)
        return spec.contract.action === 'DROP_IF_EXISTS' && observation.definition === 'ABSENT'
          ? { ...observation, definition: 'EXACT' }
          : observation
      }
      case 'POLICY_HELPER':
        return inspectPolicyHelper(reader, spec.contract, authority?.helper)
      case 'ACL':
        return inspectAclEffect(reader, spec.contract, authority?.acl)
      case 'DEFAULT':
        return inspectDefaultEffect(reader, spec.contract)
      case 'BACKFILL':
        return inspectBackfill(reader, spec.contract)
      case 'PROCEDURAL': {
        const result = await inspectProceduralEffect(
          reader,
          spec.contract,
          authority?.procedural,
          authority?.predecessor,
        )
        const definition =
          result.state === 'UNSATISFIED'
            ? 'ABSENT'
            : result.state === 'MISSING_PREREQUISITE'
              ? 'PRECONDITION_MISSING'
              : result.state
        return { definition, stateDigest: result.stateDigest }
      }
      case 'RLS':
      case 'POLICY_DROP': {
        const result =
          spec.kind === 'RLS'
            ? await inspectRlsToggle(reader, spec.contract)
            : await inspectPolicyDrop(reader, spec.contract)
        const definition =
          result.state === 'ALREADY_COMPLETE'
            ? 'EXACT'
            : result.state === 'REPLAY_REQUIRED'
              ? 'ABSENT'
              : result.state
        return { definition, stateDigest: result.ownedStateDigest }
      }
    }
  }
  const observation = await evaluate()
  const result = {
    effectId: effect.effectId,
    contractDigest: spec.contract.contractDigest,
    ...observation,
  }
  return { ...result, observationDigest: replayDigest(result) }
}
