import {describe,it,expect,vi} from 'vitest'
import {createReadBatchExecutor} from '../read-batch-executor'
import type {SqlExecutor} from '@/lib/authority/store/executor'

describe('request-local canonical fact read transport',()=>{
 it('coalesces identical reads and keeps distinct bound values and row ownership',async()=>{
  const query=vi.fn(async(text:string,params:unknown[])=>{
   expect(text).toContain('$1::uuid');expect(text).toContain('$2::uuid')
   expect(params).toEqual(['case-a','case-b'])
   return {rows:[{batchSlot:0,batchRow:{id:'a'}},{batchSlot:1,batchRow:{id:'b'}}]}
  })
  const batch=createReadBatchExecutor({query} as SqlExecutor)
  const [a,again,b]=await Promise.all([batch.executor.query('SELECT id FROM cases WHERE id=$1::uuid',['case-a']),batch.executor.query('SELECT id FROM cases WHERE id=$1::uuid',['case-a']),batch.executor.query('SELECT id FROM cases WHERE id=$1::uuid',['case-b'])])
  expect(query).toHaveBeenCalledTimes(1);expect(a.rows).toEqual([{id:'a'}]);expect(again).toEqual(a);expect(b.rows).toEqual([{id:'b'}]);batch.assertHealthy()
 })
 it('does not copy a result into another actor/request batch',async()=>{
  const query=vi.fn(async()=>({rows:[{id:'current'}]})),database={query} as SqlExecutor
  await createReadBatchExecutor(database).executor.query('SELECT id FROM cases WHERE actor=$1',['actor-a'])
  await createReadBatchExecutor(database).executor.query('SELECT id FROM cases WHERE actor=$1',['actor-b'])
  expect(query).toHaveBeenCalledTimes(2);expect(query.mock.calls).toEqual([['SELECT id FROM cases WHERE actor=$1',['actor-a']],['SELECT id FROM cases WHERE actor=$1',['actor-b']]])
 })
 it('re-reads the evaluator clock at its actual call point instead of retaining an earlier request timestamp',async()=>{
  let instant=1
  const query=vi.fn(async()=>({rows:[{now:instant++}]})),{executor}=createReadBatchExecutor({query} as SqlExecutor)
  expect((await executor.query('SELECT clock_timestamp() AS now')).rows).toEqual([{now:1}])
  expect((await executor.query('SELECT clock_timestamp() AS now')).rows).toEqual([{now:2}])
  expect(query).toHaveBeenCalledTimes(2)
 })
 it('retains injection-like strings as bound data, never interpolated query text',async()=>{
  const attack="x');DELETE FROM cases;--",query=vi.fn(async(text:string,params:unknown[])=>{
   expect(text).not.toContain(attack);expect(params).toEqual([attack,'safe']);return {rows:[]}
  })
  const {executor}=createReadBatchExecutor({query} as SqlExecutor)
  await Promise.all([executor.query('SELECT id FROM cases WHERE actor=$1',[attack]),executor.query('SELECT id FROM cases WHERE actor=$1',['safe'])])
 })
 it('fans query faults out and preserves unavailable status even when a policy loader catches its own error',async()=>{
  const {executor,assertHealthy}=createReadBatchExecutor({query:async()=>{throw new Error('database unavailable')}})
  await Promise.all([executor.query('SELECT id FROM cases WHERE id=$1',['a']).catch(()=>({rows:[]})),executor.query('SELECT id FROM cases WHERE id=$1',['b']).catch(()=>({rows:[]}))])
  expect(assertHealthy).toThrow('unavailable')
 })
 it('refuses write statements rather than suppressing or batching side effects',async()=>{
  const query=vi.fn(),{executor}=createReadBatchExecutor({query} as SqlExecutor)
  await expect(executor.query('UPDATE cases SET status=$1',['closed'])).rejects.toThrow('SELECT')
  expect(query).not.toHaveBeenCalled()
 })
})
