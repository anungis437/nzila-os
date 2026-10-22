import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { artifactName,createWorkerReceipt,validateShardReceipts,readShardReceipts,requireMatrixSuccess } from './ue-e2e-shard-receipts.mjs'

const expected={repository:'anungis437/nzila-os',headSha:'a'.repeat(40),headTree:'b'.repeat(40),runId:39797129559,runAttempt:3,mode:'synthetic-pr'}
const receipt=(shard,mode=expected.mode)=>createWorkerReceipt({...expected,mode,shard,outcomes:{job:'success',build:'success',playwright:'success',performance:mode==='synthetic-pr'&&shard===1?'success':'not-required'}})
const all=()=>[1,2,3,4].map(shard=>receipt(shard))
test('four unique successful shards pass without jobs API metadata',()=>{const result=validateShardReceipts(all().reverse(),expected);assert.equal(result.status,'success');assert.deepEqual(result.workers.map(r=>r.shard),[1,2,3,4])})
test('main canonical shards retain their actual contract',()=>assert.equal(validateShardReceipts([1,2,3,4].map(s=>receipt(s,'canonical-main')),{...expected,mode:'canonical-main'}).status,'success'))
test('workflow engine must confirm final matrix success, including post-job cleanup',()=>{requireMatrixSuccess('success');for(const result of ['failure','cancelled','skipped','in_progress',undefined])assert.throws(()=>requireMatrixSuccess(result))})
for(const [name,change]of [
 ['missing',rs=>rs.pop()],['duplicate',rs=>rs[3]=rs[0]],['extra',rs=>rs.push(receipt(1))],['failed job',rs=>rs[0].outcomes.job='failure'],['cancelled job',rs=>rs[0].outcomes.job='cancelled'],['failed tests',rs=>rs[0].outcomes.playwright='failure'],['skipped tests',rs=>rs[0].outcomes.playwright='skipped'],['failed build',rs=>rs[0].outcomes.build='failure'],['failed performance',rs=>rs[0].outcomes.performance='failure'],['omitted required performance',rs=>rs[0].outcomes.performance='not-required'],['failed receipt',rs=>rs[0].status='failure'],['foreign source',rs=>rs[0].headSha='c'.repeat(40)],['foreign tree',rs=>rs[0].headTree='c'.repeat(40)],['foreign run',rs=>rs[0].runId++],['stale attempt',rs=>rs[0].runAttempt--],['foreign repository',rs=>rs[0].repository='other/repository'],['wrong mode',rs=>rs[0].mode='canonical-main'],['unexpected shard',rs=>rs[0].shard=5],['wrong shard count',rs=>rs[0].totalShards=3],['malformed time',rs=>rs[0].observedAt='invalid'],['future time',rs=>rs[0].observedAt='2999-01-01T00:00:00Z'],['unexpected field',rs=>rs[0].override=true],['missing outcome',rs=>delete rs[0].outcomes.build],['unexpected outcome',rs=>rs[0].outcomes.override='success'],
])test('reject '+name,()=>{const rs=all();change(rs);assert.throws(()=>validateShardReceipts(rs,expected))})
test('writer records failed outcomes without manufacturing success',()=>{const r=createWorkerReceipt({...expected,shard:1,outcomes:{job:'failure',build:'success',playwright:'failure',performance:'skipped'}});assert.equal(r.status,'failure');assert.throws(()=>validateShardReceipts([r,...all().slice(1)],expected))})
for(const [name,override]of [['invalid run',{runId:0}],['invalid attempt',{runAttempt:0}],['invalid SHA',{headSha:'main'}],['wrong repository',{repository:'other/repo'}]])test('reject frozen identity '+name,()=>assert.throws(()=>validateShardReceipts(all(),{...expected,...override})))
function directory(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'ue-shards-'));t.after(()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true})});for(const r of all()){const d=path.join(root,artifactName(expected,r.shard));fs.mkdirSync(d);fs.writeFileSync(path.join(d,'receipt.json'),JSON.stringify(r))}return root}
test('only exact run-local artifact names are consumed',t=>assert.equal(readShardReceipts(directory(t),expected).workers.length,4))
test('missing artifact fails closed',t=>{const root=directory(t);fs.rmSync(path.join(root,artifactName(expected,4)),{recursive:true});assert.throws(()=>readShardReceipts(root,expected))})
test('extra artifact fails closed',t=>{const root=directory(t);fs.mkdirSync(path.join(root,'foreign'));assert.throws(()=>readShardReceipts(root,expected))})
test('artifact directory cannot smuggle another shard',t=>{const root=directory(t);fs.writeFileSync(path.join(root,artifactName(expected,4),'receipt.json'),JSON.stringify(receipt(1)));assert.throws(()=>readShardReceipts(root,expected))})
test('artifact cannot include additional files',t=>{const root=directory(t);fs.writeFileSync(path.join(root,artifactName(expected,4),'override.json'),'{}');assert.throws(()=>readShardReceipts(root,expected))})
test('truncated artifact receipt fails closed',t=>{const root=directory(t);fs.writeFileSync(path.join(root,artifactName(expected,4),'receipt.json'),'{');assert.throws(()=>readShardReceipts(root,expected))})
