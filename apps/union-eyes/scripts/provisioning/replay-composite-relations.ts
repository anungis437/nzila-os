import {ProvisioningError} from './governed-provisioning'
import {replayDigest,replayHash} from './post-w4p-replay'
import type {ReplayEffectComponent} from './replay-effect-registry'
import type {OriginalRelation,ReferentialAction} from './replay-original-relation'

export interface CompositeRelationContract {
  relation:OriginalRelation
  sourceEffects:{effectId:string;sourceHash:string;ordinal:number}[]
  contractDigest:string
}
/** Composes declarative relation/FK effects without changing any executable source bytes. */
export function compileCompositeRelations(effects:readonly ReplayEffectComponent[]):CompositeRelationContract[]{
  const tables=new Map<string,{relation:OriginalRelation;sourceEffects:CompositeRelationContract['sourceEffects']}>()
  let ordinal=0
  for(const effect of effects){
    if(effect.ordinal<=ordinal||replayHash(effect.source)!==effect.sourceHash)
      throw new ProvisioningError('REPLAY_RELATION_COMPOSITION_SOURCE_ORDER_DRIFT')
    ordinal=effect.ordinal
    const spec=effect.compiled
    const witness={effectId:effect.effectId,sourceHash:effect.sourceHash,ordinal:effect.ordinal}
    if(spec.kind==='RELATION'){
      const key=JSON.stringify([spec.contract.schema,spec.contract.name])
      if(tables.has(key))throw new ProvisioningError('REPLAY_RELATION_COMPOSITION_DUPLICATE_DECLARATION')
      tables.set(key,{relation:structuredClone(spec.contract),sourceEffects:[witness]})
    }else if(spec.kind==='FOREIGN_KEY'){
      const table=tables.get(JSON.stringify([spec.contract.schema,spec.contract.table]))
      if(!table)throw new ProvisioningError('REPLAY_RELATION_COMPOSITION_EXTERNAL_CHILD_REQUIRES_PRIOR_AUTHORITY')
      const c=spec.contract
      const actions:Record<string,ReferentialAction>={a:'NO ACTION',c:'CASCADE',r:'RESTRICT',n:'SET NULL',d:'SET DEFAULT'}
      if(!actions[c.updateAction]||!actions[c.deleteAction])
        throw new ProvisioningError('REPLAY_RELATION_COMPOSITION_FOREIGN_ACTION_UNSUPPORTED')
      if(table.relation.constraints.some(constraint=>constraint.kind==='f'&&
        replayDigest(constraint.columns)===replayDigest(c.columns)&&constraint.parent?.schema===c.parentSchema&&
        constraint.parent?.name===c.parent&&replayDigest(constraint.parent.columns)===replayDigest(c.parentColumns)))
        throw new ProvisioningError('REPLAY_RELATION_COMPOSITION_DUPLICATE_FOREIGN_KEY')
      // The separate named-FK inspector binds the source identifier to the native catalog name.
      table.relation.constraints.push({name:null,kind:'f',columns:[...c.columns],check:null,
        parent:{schema:c.parentSchema,name:c.parent,columns:[...c.parentColumns]},deleteAction:actions[c.deleteAction],
        ...(c.updateAction!=='a'?{updateAction:actions[c.updateAction]}:{})})
      table.sourceEffects.push(witness)
    }else if(spec.kind!=='INDEX'){
      throw new ProvisioningError(`REPLAY_RELATION_COMPOSITION_EFFECT_REQUIRES_TYPED_EVOLUTION:${spec.kind}`)
    }
  }
  return [...tables.values()].map(({relation,sourceEffects})=>{
    const {contractDigest:_original,...body}=relation
    const composed={...body,contractDigest:replayDigest(body)}
    const contract={relation:composed,sourceEffects}
    return {...contract,contractDigest:replayDigest(contract)}
  })
}
