import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const index=JSON.parse(readFileSync(join(here,'index.json'),'utf8'));
assert.equal(index.recordCount,138);
assert.deepEqual(index.counts,{platform:46,'union default':65,product:27});
assert.deepEqual(index.dispositions,{acceptedUnchanged:79,revised:59});
const files=readdirSync(here).filter(x=>x.endsWith('.json')&&x!=='index.json');
assert.equal(files.length,138);
let accepted=0,revised=0;
const seen=new Set();
for(const filename of files){
 const d=JSON.parse(readFileSync(join(here,filename),'utf8'));
 assert.equal(filename,d.decisionId+'.json');
 assert.ok(!seen.has(d.decisionId)); seen.add(d.decisionId);
 assert.equal(d.sourceAnswerSheetSha256,index.sourceAnswerSheetSha256);
 assert.ok(d.decision.trim());
 assert.equal(d.productionReleaseAuthority,'NOT_GRANTED');
 assert.equal(d.implementationStatus,'NOT_ATTESTED');
 assert.equal(d.runtimeProofStatus,'NOT_ATTESTED');
 assert.equal(d.defectClosureStatus,'NOT_CLOSED');
 if(d.family==='union default'){
  assert.equal(d.tenantAdoptionRequired,true);
  assert.equal(d.tenantPolicyStatus,'UNADOPTED_BY_REAL_UNIONS');
 }else assert.equal(d.tenantAdoptionRequired,false);
 if(d.decisionDisposition==='ACCEPT_PROPOSAL'){assert.equal(d.decision,d.originalProposedDecision);accepted++;}
 else if(d.decisionDisposition==='APPROVE_REVISED_RESPONSE'){assert.notEqual(d.decision,d.originalProposedDecision);revised++;}
 else throw Error('Unknown disposition: '+d.decisionDisposition);
}
assert.equal(accepted,79);assert.equal(revised,59);
assert.deepEqual(new Set(index.decisions.map(d=>d.id)),seen);
console.log('UE 138 reviewed baselines: PASS; zero defect closures and zero release authorizations');
