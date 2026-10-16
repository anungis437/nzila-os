import {describe,expect,it} from 'vitest'
import {loadFrozenReplay} from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import {replayDigest,replayText,replayHash} from './post-w4p-replay'
import {noEffectContract,makeNoEffectReplayHandler} from './replay-enum-inspection'
import type{ReplayExecutionUnit,ReplayExecutionContext} from './post-w4p-execution'
const {frozen,sourceBytes}=loadFrozenReplay()
const nodes=frozen.nodes.filter((node)=>node.DATABASE_SCOPE==='FINANCIAL_SERVICE')
const node=nodes[0]
const sql=sourceBytes[replayText(node.SOURCE_FILE)]
const unit:ReplayExecutionUnit={
  node,sql,predecessors:[],transactionClass:'TRANSACTION_COMPATIBLE',
  contractDigest:noEffectContract(sql,replayText(node.EXACT_UNIT_SHA256)),
}
const context:ReplayExecutionContext={
  scope:'FINANCIAL_SERVICE',actorClass:'MIGRATION_ADMIN',actorPrincipal:'fake-finance-admin',
  targetDigest:replayDigest('fake-financial-target'),w4pPlanDigest:replayText(frozen.input.promotionPlan.PLAN_DIGEST),
  w4pVerificationDigest:replayDigest('fake-op-w4p'),supplementPlanDigest:replayDigest('fake-op-pkplan'),
  supplementVerificationDigest:replayDigest('fake-op-pkproof'),exclusiveExecutionReference:'fake-financial-exclusive',
}
describe('the one frozen financial-service no-executable-effect boundary',()=>{
  it('preserves the entire commented source and does not activate introspection design SQL',async()=>{
    expect(nodes).toHaveLength(1)
    const handler=makeNoEffectReplayHandler(unit)
    const result=await handler.inspect({async query(){throw new Error('NO_CATALOG_QUERY_REQUIRED')}},context,unit,null)
    expect(result.state).toBe('ALREADY_COMPLETE')
    expect(replayHash(sql)).toBe(node.SOURCE_SHA256)
  })
  it('cannot be attributed to the operational target',async()=>{
    const handler=makeNoEffectReplayHandler(unit)
    expect((await handler.inspect({async query(){throw new Error('NO_QUERY')}},{...context,scope:'UE_OPERATIONAL'},unit,null)).state).toBe('PRECONDITION_MISSING')
  })
  it('rejects any newly executable source and every source/contract binding change',()=>{
    const changed=sql+'\nSELECT 1;'
    expect(()=>noEffectContract(changed,replayHash(changed))).toThrow('REPLAY_NO_EFFECT_EXECUTABLE_SOURCE_FOUND')
    expect(()=>noEffectContract(changed,replayText(node.EXACT_UNIT_SHA256))).toThrow('REPLAY_NO_EFFECT_SOURCE_DRIFT')
    expect(()=>makeNoEffectReplayHandler({...unit,contractDigest:'wrong'})).toThrow('REPLAY_NO_EFFECT_CONTRACT_BINDING_DRIFT')
  })
})
