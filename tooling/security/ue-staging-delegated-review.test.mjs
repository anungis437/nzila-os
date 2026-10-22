import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { allowedPath, BASE, DOMAIN, KEY_PATH, PR_BINDINGS, RECEIPT_PATH, SIGNATURE_PATH, RESOURCES, sha256, validateManifest, verifyDetached, verifyEnvelope, verifyPullRequest } from './ue-staging-delegated-review.mjs'

const NOW=Date.parse('2026-10-22T14:00:00Z'), S='1'.repeat(40), TREE='2'.repeat(40), E='3'.repeat(40), BLOB='4'.repeat(40)
const report='Actual separate agent review; source risks assessed, no unresolved P0/P1. Production and runtime proof remain separate.'
const bytes=Buffer.from('reviewed source bytes')
const publicPem=fs.readFileSync(new URL('../../'+KEY_PATH,import.meta.url))
const keyBlob='8'.repeat(40)
function manifest(){return { version:1,purpose:'staging-security-review',repository:'anungis437/nzila-os',pullRequest:984,branch:'ops/ue-staging-recovery-20261022',baseSha:BASE,sourceSha:S,sourceTree:TREE,mission:'UE-STAGING-RECOVERY-TO-GO',changeRecordId:'CHG-2026-0112',environment:'STAGING',owner:'anungis437',operator:'Codex',instructionSha256:'681844e4f18424c1e592dfd1db205afc66d5c7a3d647c91006dc8f5d2dcbb2e3',issuedAt:'2026-10-22T13:00:00Z',expiresAt:'2026-10-23T13:00:00Z',resources:{...RESOURCES},productionAuthorized:false,runtimeProofRequired:true,signedReleaseRequired:true,files:[KEY_PATH,'.github/workflows/security-design-review.yml','tooling/security/ue-staging-delegated-review.mjs'].map(path=>({path,status:'added',previousPath:null,blobSha:path===KEY_PATH?keyBlob:BLOB,sha256:sha256(path===KEY_PATH?publicPem:bytes),baseBlobSha:null,baseSha256:null})),reviews:[{kind:'separate-agent-review',agentTask:'/root/acceptance',reviewedAt:'2026-10-22T12:00:00Z',report,reportSha256:sha256(Buffer.from(report)),unresolvedP0:0,unresolvedP1:0}],tests:[{command:'node --test tooling/security/ue-staging-delegated-review.test.mjs',result:'PASS',passed:20,logSha256:'a'.repeat(64)}],limitations:['Agent review is not independent human security review; no runtime certification.']}}

test('actual Ed25519 signature primitive binds domain and raw bytes',()=>{
 const key=crypto.generateKeyPairSync('ed25519'),pem=key.publicKey.export({type:'spki',format:'pem'}),data=Buffer.from(JSON.stringify(manifest()))
 const sig=crypto.sign(null,Buffer.concat([Buffer.from(DOMAIN),data]),key.privateKey).toString('base64')
 verifyDetached(data,sig,pem)
 assert.throws(()=>verifyDetached(Buffer.concat([data,Buffer.from(' ')]),sig,pem),/invalid/)
 assert.throws(()=>verifyDetached(data,crypto.sign(null,data,key.privateKey).toString('base64'),pem),/invalid/)
 assert.throws(()=>verifyDetached(data,sig.replace('==',''),pem),/Noncanonical/)
 assert.throws(()=>verifyEnvelope(data,sig,pem,NOW),/Untrusted/)
})
test('non-Ed25519 key rejected',()=>{const k=crypto.generateKeyPairSync('rsa',{modulusLength:2048});assert.throws(()=>verifyDetached(bytes,'A'.repeat(86)+'==',k.publicKey.export({type:'spki',format:'pem'})),/algorithm/)})
test('bounded explicit mission manifest passes semantics',()=>assert.equal(validateManifest(manifest(),NOW).sourceSha,S))
for(const [name,change]of [
 ['production',m=>m.productionAuthorized=true],['proof waiver',m=>m.runtimeProofRequired=false],['release waiver',m=>m.signedReleaseRequired=false],
 ['wrong purpose',m=>m.purpose='runtime-release'],['wrong repo',m=>m.repository='other/repo'],['wrong PR',m=>m.pullRequest=986],['wrong branch',m=>m.branch='main'],['wrong base',m=>m.baseSha=S],['wrong mission',m=>m.mission='other'],['wrong CHG',m=>m.changeRecordId='other'],['wrong owner',m=>m.owner='github-actions[bot]'],['wrong environment',m=>m.environment='PROD'],['wrong instruction',m=>m.instructionSha256='a'.repeat(64)],
 ['wrong resource',m=>m.resources.server='prod'],['expired',m=>m.expiresAt='2026-10-22T13:59:59Z'],['future issued',m=>m.issuedAt='2026-10-23T14:00:00Z'],['beyond custody',m=>m.expiresAt='2026-10-28T00:00:00Z'],['unknown key',m=>m.trustKey='mykey'],
 ['unreviewed production source',m=>m.files[0].path='apps/cfo/auth.ts'],['path traversal',m=>m.files[0].path='apps/union-eyes/../cfo/auth.ts'],['path injection',m=>m.files[0].path='apps/union-eyes/x\ny'],['duplicate coverage',m=>m.files.push(m.files[0])],['invalid blob',m=>m.files[0].blobSha='fake'],['unreviewed gate',m=>m.files.pop()],
 ['fake human attribution',m=>m.reviews[0].kind='independent-human'],['missing actual report',m=>m.reviews[0].report=''],['tampered report',m=>m.reviews[0].report+='tamper'],['unresolved P1',m=>m.reviews[0].unresolvedP1=1],['unresolved P0',m=>m.reviews[0].unresolvedP0=1],['future review',m=>m.reviews[0].reviewedAt='2026-10-24T12:00:00Z'],['missing reviews',m=>m.reviews=[]],['failed tests',m=>m.tests[0].result='FAIL'],['no actual test count',m=>m.tests[0].passed=0],['invalid test digest',m=>m.tests[0].logSha256='fake'],
])test(`reject ${name}`,()=>{const m=manifest();change(m);assert.throws(()=>validateManifest(m,NOW))})

function apiFixture(m){
 const pr={number:m.pullRequest,state:'open',changed_files:m.files.length+2,user:{login:PR_BINDINGS[m.pullRequest].author},base:{ref:'main',sha:m.baseSha,repo:{full_name:m.repository}},head:{sha:E,ref:m.branch,repo:{full_name:m.repository}}}
 const evidence={parents:[{sha:S}]}, source={tree:{sha:TREE}},base={tree:{sha:'5'.repeat(40)}}
 const allFiles=m.files.map(f=>({filename:f.path,status:f.status,sha:f.blobSha}))
 const evidenceFiles=[RECEIPT_PATH,SIGNATURE_PATH].map(filename=>({filename,status:'added'}))
 const sourceTree={truncated:false,tree:m.files.map(f=>({path:f.path,type:'blob',sha:f.blobSha}))}
 const objects={[`pulls/${m.pullRequest}`]:pr,[`git/commits/${E}`]:evidence,[`git/commits/${S}`]:source,[`git/commits/${m.baseSha}`]:base,[`git/trees/${TREE}?recursive=1`]:sourceTree,[`git/trees/${base.tree.sha}?recursive=1`]:{truncated:false,tree:[]},[`git/blobs/${BLOB}`]:{encoding:'base64',sha:BLOB,content:bytes.toString('base64')}}
 if(m.pullRequest===986){const key={path:KEY_PATH,type:'blob',sha:keyBlob};sourceTree.tree.push(key);objects[`git/trees/${base.tree.sha}?recursive=1`].tree.push({...key})}
 objects[`git/blobs/${keyBlob}`]={encoding:'base64',sha:keyBlob,content:publicPem.toString('base64')}
 return {pr,evidence,sourceTree,allFiles,evidenceFiles,objects,get:async endpoint=>{assert(endpoint in objects,endpoint);return objects[endpoint]},pages:async(endpoint,field)=>{if(endpoint===`commits/${E}`){assert.equal(field,'files');return evidenceFiles}assert.equal(endpoint,`pulls/${m.pullRequest}/files`);return [...allFiles,...evidenceFiles]}}
}

function followup(){
 const m=manifest();m.pullRequest=986;m.branch=PR_BINDINGS[986].branch;m.baseSha=PR_BINDINGS[986].base
 m.files=m.files.filter(f=>f.path!==KEY_PATH)
 m.reviews.push({...m.reviews[0],kind:'primary-agent-review',agentTask:'/root'})
 return m
}
test('follow-up binds exact PR, branch, merged base, actual connector author and unchanged trust',async()=>{
 const m=followup();validateManifest(m,NOW);assert.equal((await verifyPullRequest(m,apiFixture(m))).evidenceSha,E)
})
for(const [name,change]of [
 ['unlisted PR',m=>m.pullRequest=987],['superseded PR',m=>m.pullRequest=985],['historical base',m=>m.baseSha=BASE],['historical branch',m=>m.branch=PR_BINDINGS[984].branch],
 ['trust-key mutation',m=>m.files.push(manifest().files[0])],['missing attributed primary review',m=>m.reviews=m.reviews.filter(r=>r.kind!=='primary-agent-review')],
 ['false primary agent identity',m=>m.reviews.find(r=>r.kind==='primary-agent-review').agentTask='/root/another'],
])test(`follow-up rejects ${name}`,()=>{const m=followup();change(m);assert.throws(()=>validateManifest(m,NOW))})
for(const [name,change]of [
 ['owner impersonation',a=>a.pr.user.login='anungis437'],
 ['changed trust blob',a=>a.sourceTree.tree.find(t=>t.path===KEY_PATH).sha=BLOB],
 ['missing base trust',a=>a.objects[`git/trees/${'5'.repeat(40)}?recursive=1`].tree=[]],
 ['modified trust bytes',a=>a.objects[`git/blobs/${keyBlob}`].content=bytes.toString('base64')],
])test(`follow-up API rejects ${name}`,async()=>{const m=followup(),a=apiFixture(m);change(a);await assert.rejects(verifyPullRequest(m,a))})
test('follow-up metadata allowlist permits only the two reviewed declarations',()=>{
 for(const name of ['duplicate-declarations.ts','entries.ts'])assert.equal(allowedPath('packages/db/src/auth-storage-authority/'+name),true)
 for(const name of ['bootstrap-sql.ts','execution-boundary.ts','other.ts'])assert.equal(allowedPath('packages/db/src/auth-storage-authority/'+name),false)
})
test('actual PR API coverage and sole-parent evidence commit pass',async()=>{const m=manifest();assert.equal((await verifyPullRequest(m,apiFixture(m))).evidenceSha,E)})
for(const [name,change]of [
 ['fork',a=>a.pr.head.repo.full_name='attacker/repo'],['wrong author',a=>a.pr.user.login='other'],['wrong actual base',a=>a.pr.base.sha=S],['wrong E parent',a=>a.evidence.parents[0].sha=BASE],['merge E',a=>a.evidence.parents.push({sha:BASE})],['source edit in E',a=>a.evidenceFiles.push({filename:'tooling/security/ue-staging-delegated-review.mjs',status:'modified'})],['wrong fixed evidence paths',a=>a.evidenceFiles[0].filename='other.json'],['missing API coverage',a=>a.pr.changed_files++],['unlisted PR file',a=>{a.allFiles.push({filename:'apps/union-eyes/extra.ts',status:'added',sha:BLOB});a.pr.changed_files++}],['different blob',a=>a.sourceTree.tree[0].sha='6'.repeat(40)],['truncated tree',a=>a.sourceTree.truncated=true],['tampered actual content',a=>a.objects[`git/blobs/${BLOB}`].content=Buffer.from('changed').toString('base64')],
])test(`reject actual ${name}`,async()=>{const m=manifest(),a=apiFixture(m);change(a);await assert.rejects(verifyPullRequest(m,a))})
test('network/API failures never pass',async()=>{const m=manifest(),a=apiFixture(m);a.pages=async()=>{throw Error('network')};await assert.rejects(verifyPullRequest(m,a),/network/)})
test('unreviewed source changes after fetch are rejected',async()=>{const m=manifest(),a=apiFixture(m);let reads=0;const get=a.get;a.get=async endpoint=>{const result=await get(endpoint);if(endpoint==='pulls/984'&&++reads>1)return {...result,head:{...result.head,sha:'7'.repeat(40)}};return result};await assert.rejects(verifyPullRequest(m,a),/head changed/)})
test('allowlist does not allow other production trust or applications',()=>{for(const name of ['.github/workflows/deploy-other.yml','ops/policies/production.json','apps/cfo/auth.ts','packages/platform-auth/src/auth-db.ts','apps/union-eyes/../cfo/auth.ts','tooling/scripts/lib/ue-staging-0017-ownership-extra.mjs'])assert.equal(allowedPath(name),false)})
test('E2E correction review coverage is limited to its exact workflow, validator and tests',()=>{for(const name of ['.github/workflows/e2e.yml','tooling/ci/ue-e2e-shard-receipts.mjs','tooling/ci/ue-e2e-shard-receipts.test.mjs','tooling/contract-tests/ci-feedback-performance.test.ts'])assert.equal(allowedPath(name),true);for(const name of ['.github/workflows/e2e-extra.yml','tooling/ci/unreviewed.mjs','tooling/ci/ue-e2e-shard-receipts-extra.mjs','tooling/contract-tests/unreviewed.test.ts'])assert.equal(allowedPath(name),false)})
test('only four canonical inventory outputs are permitted, not adjacent generated reports',()=>{
 for(const name of ['inventory.json','inventory.md','repo-inventory.json','repo-inventory.md'])assert.equal(allowedPath('tooling/repo-inventory/output/'+name),true)
 for(const name of ['tooling/repo-inventory/output/extra.json','tooling/repo-inventory/output/inventory.ts','reports/doc-consistency.json','docs/documentation-index.md'])assert.equal(allowedPath(name),false)
})
test('recovery and label fixes permit only their exact reviewed files',()=>{
 for(const name of ['ue-staging-0017-ownership','ue-staging-clone-qualification','union-eyes-deployment-safety']) {
  for(const suffix of ['.mjs','.test.mjs'])assert.equal(allowedPath('tooling/scripts/lib/'+name+suffix),true)
  assert.equal(allowedPath('tooling/scripts/lib/'+name+'-extra.mjs'),false)
 }
 assert.equal(allowedPath('.github/workflows/deploy-union-eyes.yml'),true)
 assert.equal(allowedPath('.github/workflows/deploy-production.yml'),false)
})
for(const extra of [false,true])test(`gitattributes exact key byte-preservation scope (extra edit=${extra})`,async()=>{
 const m=manifest(),baseBytes=Buffer.from('* text=auto eol=lf\n'),newBytes=Buffer.from(baseBytes.toString().trimEnd()+'\n'+KEY_PATH+' -text\n'+(extra?'*.ts -text\n':'')),newSha='a'.repeat(40),oldSha='b'.repeat(40)
 m.files.push({path:'.gitattributes',status:'modified',previousPath:null,blobSha:newSha,sha256:sha256(newBytes),baseBlobSha:oldSha,baseSha256:sha256(baseBytes)})
 const a=apiFixture(m);a.objects[`git/trees/${'5'.repeat(40)}?recursive=1`].tree.push({path:'.gitattributes',type:'blob',sha:oldSha});a.objects[`git/blobs/${newSha}`]={encoding:'base64',sha:newSha,content:newBytes.toString('base64')};a.objects[`git/blobs/${oldSha}`]={encoding:'base64',sha:oldSha,content:baseBytes.toString('base64')}
 if(extra)await assert.rejects(verifyPullRequest(m,a),/Only exact/);else await verifyPullRequest(m,a)
})
