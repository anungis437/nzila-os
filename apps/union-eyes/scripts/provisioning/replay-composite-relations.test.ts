import {describe,expect,it} from 'vitest'
import {loadFrozenReplay} from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import {read} from '../../../../scripts/ue/w4-physical-producers'
import {compileReplayUnitPlan} from './replay-unit-plan'
import {replayDigest} from './post-w4p-replay'
import {compileCompositeRelations} from './replay-composite-relations'
import {FakeReplayCatalog} from './replay-fake-catalog'
import {inspectOriginalRelation} from './replay-original-relation'
import {inspectReplayEffect} from './replay-effect-inspection'
const {frozen,sourceBytes}=loadFrozenReplay()
const plan=compileReplayUnitPlan(frozen,sourceBytes,read(
  'docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
),replayDigest('fake-only'))
const first=plan.specification.units[0]
const effects=plan.components.effects.filter(effect=>effect.boundaryId===first.node.REPLAY_UNIT_ID)
const composites=compileCompositeRelations(effects)
const catalog=()=>new FakeReplayCatalog({schemas:['pg_catalog','public'],roles:['fake_admin'],database:'fake_db',
  functionContext:{actor:'fake_admin',creationSchema:'public',searchPath:['pg_catalog','public'],defaultAcl:[]}})
describe('whole first-boundary declarative composition,not full107qualification',()=>{
  it('composes the actual ten CREATE declarations with later named foreign keys',()=>{
    expect(composites).toHaveLength(10)
    expect(effects.filter(effect=>effect.compiled.kind==='RELATION')).toHaveLength(10)
    const sources=composites.flatMap(contract=>contract.sourceEffects)
    expect(sources.length).toBe(effects.filter(effect=>['RELATION','FOREIGN_KEY'].includes(effect.compiled.kind)).length)
    expect(new Set(sources.map(source=>source.effectId)).size).toBe(sources.length)
    expect(composites.every(contract=>contract.relation.contractDigest!==''&&contract.contractDigest!=='')).toBe(true)
  })
  it('sends exact first-boundary bytes once through the independent interpreter and verifies real final net state',async()=>{
    const fake=catalog()
    await fake.applyFrozenUnit(first.sql,String(first.node.EXACT_UNIT_SHA256))
    expect(fake.trace).toEqual([`FAKE_UNIT_TRANSITION:${first.node.EXACT_UNIT_SHA256}`])
    for(const contract of composites)
      expect((await inspectOriginalRelation(fake,contract.relation)).definition,contract.relation.name).toBe('EXACT')
    for(const effect of effects.filter(effect=>effect.compiled.kind==='INDEX'||effect.compiled.kind==='FOREIGN_KEY'))
      expect((await inspectReplayEffect(fake,effect)).definition,effect.effectId).toBe('EXACT')
  })
  it('retains observed unique keys rather than treating only primary keys as constraints',async()=>{
    const fake=catalog()
    await fake.applyFrozenUnit(first.sql,String(first.node.EXACT_UNIT_SHA256))
    const group=fake.inspectTable('public','icra_benchmark_groups')!
    expect(group.uniqueConstraints?.length).toBeGreaterThan(0)
    group.uniqueConstraints=[]
    fake.replaceTable(group)
    const contract=composites.find(contract=>contract.relation.name==='icra_benchmark_groups')!
    expect((await inspectOriginalRelation(fake,contract.relation)).definition).toBe('DRIFTED')
  })
  it('denies unknown foreign-key changes through both named and composite comparisons',async()=>{
    const fake=catalog()
    await fake.applyFrozenUnit(first.sql,String(first.node.EXACT_UNIT_SHA256))
    const effect=effects.find(effect=>effect.compiled.kind==='FOREIGN_KEY')!
    if(effect.compiled.kind!=='FOREIGN_KEY')throw new Error('EXPECTED_REAL_FOREIGN_KEY')
    const c=effect.compiled.contract
    const fk=fake.inspectForeignKey(c.schema,c.table,c.name)!
    fk.delete_action='c'
    fake.replaceForeignKey(fk)
    expect((await inspectReplayEffect(fake,effect)).definition).toBe('DRIFTED')
    const contract=composites.find(contract=>contract.relation.schema===c.schema&&contract.relation.name===c.table)!
    expect((await inspectOriginalRelation(fake,contract.relation)).definition).toBe('DRIFTED')
  })
  it('rolls back actual entire-boundary state and staged receipts on commit failure',async()=>{
    const fake=catalog(),before=fake.digest()
    await expect(fake.transaction(async working=>{
      await working.applyFrozenUnit(first.sql,String(first.node.EXACT_UNIT_SHA256))
      working.stageReceipt(String(first.node.REPLAY_UNIT_ID),{fake:true})
      for(const contract of composites)
        expect((await inspectOriginalRelation(working,contract.relation)).definition).toBe('EXACT')
    },true)).rejects.toThrow('FAKE_COMMIT_FAILED')
    expect(fake.digest()).toBe(before)
    expect(fake.readReceipt(String(first.node.REPLAY_UNIT_ID))).toBeNull()
    expect(fake.inspectTable('public','icra_anonymized_metrics')).toBeNull()
  })
  it('rejects order/source drift and unimplemented evolution instead of silently excluding effects',()=>{
    expect(()=>compileCompositeRelations([...effects].reverse())).toThrow('REPLAY_RELATION_COMPOSITION')
    const drifted=structuredClone(effects)
    drifted[0].source+=' '
    expect(()=>compileCompositeRelations(drifted)).toThrow('REPLAY_RELATION_COMPOSITION_SOURCE_ORDER_DRIFT')
    const other=plan.components.effects.find(effect=>effect.compiled.kind==='POLICY_HELPER')!
    expect(()=>compileCompositeRelations([other])).toThrow('REQUIRES_TYPED_EVOLUTION')
  })
})
