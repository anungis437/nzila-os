import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { allowedPath, BASE, DOMAIN, KEY_PATH, PR_BINDINGS, RECEIPT_PATH, SIGNATURE_PATH, RESOURCES, sha256, validateManifest, validateSanitizerPackageChange, validateToolDependencyChange, validateOtelPackageChange, verifyDetached, verifyEnvelope, verifyPullRequest } from './ue-staging-delegated-review.mjs'

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
 if([986,990,991,992,993].includes(m.pullRequest)){const key={path:KEY_PATH,type:'blob',sha:keyBlob};sourceTree.tree.push(key);objects[`git/trees/${base.tree.sha}?recursive=1`].tree.push({...key})}
 objects[`git/blobs/${keyBlob}`]={encoding:'base64',sha:keyBlob,content:publicPem.toString('base64')}
 return {pr,evidence,sourceTree,allFiles,evidenceFiles,objects,get:async endpoint=>{assert(endpoint in objects,endpoint);return objects[endpoint]},pages:async(endpoint,field)=>{if(endpoint===`commits/${E}`){assert.equal(field,'files');return evidenceFiles}assert.equal(endpoint,`pulls/${m.pullRequest}/files`);return [...allFiles,...evidenceFiles]}}
}

function followup(){
 const m=manifest();m.pullRequest=986;m.branch=PR_BINDINGS[986].branch;m.baseSha=PR_BINDINGS[986].base
 m.files=m.files.filter(f=>f.path!==KEY_PATH)
 m.reviews.push({...m.reviews[0],kind:'primary-agent-review',agentTask:'/root'})
 return m
}

function dependencyFollowup() {
 const m=followup()
 for(const path of ['package.json','pnpm-lock.yaml'])m.files.push({path,status:'modified',previousPath:null,blobSha:BLOB,sha256:sha256(bytes),baseBlobSha:BLOB,baseSha256:sha256(bytes)})
 return m
}

function nativeIntakeFollowup() {
 const m=followup();m.pullRequest=990;m.branch=PR_BINDINGS[990].branch;m.baseSha=PR_BINDINGS[990].base
 return m
}
function nativeWriteDefaultsFollowup() {
 const m=followup();m.pullRequest=991;m.branch=PR_BINDINGS[991].branch;m.baseSha=PR_BINDINGS[991].base
 return m
}
function timestampQueryFollowup() {
 const m=followup();m.pullRequest=992;m.branch=PR_BINDINGS[992].branch;m.baseSha=PR_BINDINGS[992].base
 return m
}
test('timestamp query review binds exact PR, branch, merged base, author and unchanged trust',async()=>{
 const m=timestampQueryFollowup();validateManifest(m,NOW)
 assert.equal((await verifyPullRequest(m,apiFixture(m))).evidenceSha,E)
})
for(const [name,change]of [
 ['another PR',m=>m.pullRequest=993],['another branch',m=>m.branch=PR_BINDINGS[991].branch],
 ['another base',m=>m.baseSha=PR_BINDINGS[991].base],['production authorization',m=>m.productionAuthorized=true],
 ['missing primary attribution',m=>m.reviews=m.reviews.filter(r=>r.kind!=='primary-agent-review')],
 ['invented human attribution',m=>m.reviews[0].kind='independent-human'],
 ['changed trust',m=>m.files.push(manifest().files[0])],
])test(`timestamp query review rejects ${name}`,()=>{const m=timestampQueryFollowup();change(m);assert.throws(()=>validateManifest(m,NOW))})
for(const name of ['apps/union-eyes/backend/grievances/models.py','apps/union-eyes/db/migrations-platform/0009_extra.sql',
 'apps/union-eyes/lib/auth/unreviewed.ts','packages/platform-auth/src/auth-db.ts','package.json','pnpm-lock.yaml',
 '.github/workflows/deploy-union-eyes.yml','ops/policies/production.json','apps/union-eyes/db/schema/claims-schema.ts'])test(`timestamp query review cannot expand to ${name}`,()=>{
 const m=timestampQueryFollowup();m.files.push({...m.files[0],path:name});assert.throws(()=>validateManifest(m,NOW))
})
for(const name of ['apps/union-eyes/db/queries/claims-queries.ts',
 'apps/union-eyes/db/queries/__tests__/canonical-claim-writes.pglite.test.ts'])test(`timestamp query signed coverage accepts exact repair ${name}`,()=>{
 const m=timestampQueryFollowup();m.files.push({...m.files[0],path:name});validateManifest(m,NOW)
})
for(const [name,change]of [
 ['owner impersonation',a=>a.pr.user.login='anungis437'],
 ['changed trust blob',a=>a.sourceTree.tree.find(t=>t.path===KEY_PATH).sha=BLOB],
 ['unreviewed evidence edit',a=>a.evidenceFiles.push({filename:'apps/union-eyes/db/schema/claims-schema.ts',status:'modified'})],
])test(`timestamp query actual API rejects ${name}`,async()=>{
 const m=timestampQueryFollowup(),a=apiFixture(m);change(a);await assert.rejects(verifyPullRequest(m,a))
})
test('native write-default review binds exact PR, branch, merged base, author and unchanged trust',async()=>{
 const m=nativeWriteDefaultsFollowup();validateManifest(m,NOW)
 assert.equal((await verifyPullRequest(m,apiFixture(m))).evidenceSha,E)
})
for(const [name,change]of [
 ['another PR',m=>m.pullRequest=992],['another branch',m=>m.branch=PR_BINDINGS[990].branch],
 ['another base',m=>m.baseSha=PR_BINDINGS[990].base],['production authorization',m=>m.productionAuthorized=true],
 ['missing primary attribution',m=>m.reviews=m.reviews.filter(r=>r.kind!=='primary-agent-review')],
 ['invented human attribution',m=>m.reviews[0].kind='independent-human'],
 ['changed trust',m=>m.files.push(manifest().files[0])],
])test(`native write-default review rejects ${name}`,()=>{const m=nativeWriteDefaultsFollowup();change(m);assert.throws(()=>validateManifest(m,NOW))})
for(const name of ['apps/union-eyes/backend/grievances/models.py','apps/union-eyes/db/migrations-platform/0009_extra.sql',
 'apps/union-eyes/lib/auth/unreviewed.ts','packages/platform-auth/src/auth-db.ts','package.json','pnpm-lock.yaml',
 '.github/workflows/deploy-union-eyes.yml','ops/policies/production.json','apps/union-eyes/app/api/cases/intake/route.ts'])test(`native write-default review cannot expand to ${name}`,()=>{
 const m=nativeWriteDefaultsFollowup();m.files.push({...m.files[0],path:name});assert.throws(()=>validateManifest(m,NOW))
})
for(const name of ['apps/union-eyes/lib/audit/canonical-audit-chain.ts',
 'apps/union-eyes/lib/cases/claim-history-reference.ts','apps/union-eyes/db/queries/claims-queries.ts',
 'apps/union-eyes/app/api/cases/[caseId]/transition/route.ts','apps/union-eyes/app/api/cases/[caseId]/assign/route.ts',
 'apps/union-eyes/app/api/cases/[caseId]/notes/route.ts','apps/union-eyes/app/api/cases/[caseId]/timeline/route.ts',
 'apps/union-eyes/app/api/cases/[caseId]/export/route.ts',
 'apps/union-eyes/lib/audit/__tests__/canonical-nar-proof.pglite.test.ts','apps/union-eyes/db/schema/claims-schema.ts',
 'apps/union-eyes/db/queries/__tests__/canonical-claim-writes.pglite.test.ts',
 'apps/union-eyes/db/queries/__tests__/fixtures/canonical-claim-write.sql'])test(`native write-default signed coverage accepts exact repair ${name}`,()=>{
 const m=nativeWriteDefaultsFollowup();m.files.push({...m.files[0],path:name});validateManifest(m,NOW)
})
for(const [name,change]of [
 ['owner impersonation',a=>a.pr.user.login='anungis437'],
 ['changed trust blob',a=>a.sourceTree.tree.find(t=>t.path===KEY_PATH).sha=BLOB],
 ['unreviewed evidence edit',a=>a.evidenceFiles.push({filename:'apps/union-eyes/db/schema/claims-schema.ts',status:'modified'})],
])test(`native write-default actual API rejects ${name}`,async()=>{
 const m=nativeWriteDefaultsFollowup(),a=apiFixture(m);change(a);await assert.rejects(verifyPullRequest(m,a))
})
test('native intake follow-up binds its exact PR, branch, merged base, author and unchanged trust',async()=>{
 const m=nativeIntakeFollowup();validateManifest(m,NOW)
 assert.equal((await verifyPullRequest(m,apiFixture(m))).evidenceSha,E)
})
for(const [name,change]of [
 ['another PR',m=>m.pullRequest=991],['another branch',m=>m.branch=PR_BINDINGS[986].branch],
 ['another base',m=>m.baseSha=PR_BINDINGS[986].base],['production authorization',m=>m.productionAuthorized=true],
 ['missing primary attribution',m=>m.reviews=m.reviews.filter(r=>r.kind!=='primary-agent-review')],
 ['invented human attribution',m=>m.reviews[0].kind='independent-human'],
 ['changed trust',m=>m.files.push(manifest().files[0])],
])test(`native intake review rejects ${name}`,()=>{const m=nativeIntakeFollowup();change(m);assert.throws(()=>validateManifest(m,NOW))})
for(const name of ['apps/union-eyes/backend/auth_core/models.py','apps/union-eyes/db/migrations-platform/0009_extra.sql',
 'apps/union-eyes/lib/auth/unreviewed.ts','packages/platform-auth/src/auth-db.ts','package.json',
 '.github/workflows/deploy-union-eyes.yml','ops/policies/production.json'])test(`native intake cannot expand to ${name}`,()=>{
 const m=nativeIntakeFollowup();m.files.push({...m.files[0],path:name});assert.throws(()=>validateManifest(m,NOW))
})
for(const name of ['packages/platform-auth/src/entra/session-policy.ts','packages/platform-auth/src/entra/session-policy.test.ts',
 'apps/union-eyes/lib/audit/canonical-nar-proof.ts'])test(`native intake signed coverage accepts exact repair ${name}`,()=>{
 const m=nativeIntakeFollowup();m.files.push({...m.files[0],path:name});validateManifest(m,NOW)
})
for(const [name,change]of [
 ['owner impersonation',a=>a.pr.user.login='anungis437'],
 ['changed trust blob',a=>a.sourceTree.tree.find(t=>t.path===KEY_PATH).sha=BLOB],
 ['unreviewed evidence edit',a=>a.evidenceFiles.push({filename:'apps/union-eyes/lib/audit/canonical-nar-proof.ts',status:'modified'})],
])test(`native intake actual API rejects ${name}`,async()=>{
 const m=nativeIntakeFollowup(),a=apiFixture(m);change(a);await assert.rejects(verifyPullRequest(m,a))
})
test('sanitizer repair requires exact paired follow-up dependency files',()=>validateManifest(dependencyFollowup(),NOW))
for(const [name,change]of [
 ['missing lock',m=>m.files.pop()],['missing package',m=>m.files.splice(-2,1)],
 ['added package',m=>m.files.at(-2).status='added'],['removed lock',m=>m.files.at(-1).status='removed'],
 ['adjacent package',m=>m.files.at(-2).path='packages/other/package.json'],
 ['historical PR',m=>{m.pullRequest=984;m.branch=PR_BINDINGS[984].branch;m.baseSha=BASE}],
])test(`sanitizer repair rejects ${name}`,()=>{const m=dependencyFollowup();change(m);assert.throws(()=>validateManifest(m,NOW))})
const packageBytes = floor=>Buffer.from(JSON.stringify({scripts:{test:'unchanged'},pnpm:{overrides:{dompurify:floor,other:'1.0.0',...(floor==='>=3.4.13'?{}:{'@sentry/nextjs':'10.75.2'})}}}))
test('sanitizer package repair accepts only the reviewed override floor change',()=>validateSanitizerPackageChange(packageBytes('>=3.4.13'),packageBytes('>=3.4.17')))
for(const floor of ['>=3.4.14','>=3.4.16','*','>=3.4.18'])test(`sanitizer package rejects unexpected floor ${floor}`,()=>assert.throws(()=>validateSanitizerPackageChange(packageBytes('>=3.4.13'),packageBytes(floor))))
test('sanitizer package rejects unrelated script edits',()=>{const source=JSON.parse(packageBytes('>=3.4.17'));source.scripts.test='bypass';assert.throws(()=>validateSanitizerPackageChange(packageBytes('>=3.4.13'),Buffer.from(JSON.stringify(source))),/Unrelated/)})
for (const version of [undefined,'10.47.0','*','10.75.3']) test(`Sentry repair rejects unexpected version ${version}`,()=>{
 const source=JSON.parse(packageBytes('>=3.4.17'));source.pnpm.overrides['@sentry/nextjs']=version
 assert.throws(()=>validateSanitizerPackageChange(packageBytes('>=3.4.13'),Buffer.from(JSON.stringify(source))),/Sentry/)
})
const toolManifest=()=>({name:'nzila-kilo-local-tooling',private:true,dependencies:{'@kilocode/plugin':'7.2.52'},overrides:{toml:'5.0.1'},engines:{node:'>=20'}})
const jsonBytes=value=>Buffer.from(JSON.stringify(value))
test('local tooling repair accepts only the reproducible manifest without scripts',()=>validateToolDependencyChange('.kilo/package.json',undefined,jsonBytes(toolManifest())))
for (const [name,change] of [
 ['install script',p=>p.scripts={postinstall:'execute'}],['broad override',p=>p.overrides.toml='*'],
 ['plugin change',p=>p.dependencies['@kilocode/plugin']='latest'],['public package',p=>p.private=false],
]) test(`local tooling manifest rejects ${name}`,()=>{const p=toolManifest();change(p);assert.throws(()=>validateToolDependencyChange('.kilo/package.json',undefined,jsonBytes(p)))})
const toolLocks=()=>{
 const old={version:'4.2.0',resolved:'https://registry.npmjs.org/toml/-/toml-4.2.0.tgz',integrity:'old',license:'MIT',engines:{node:'>=20'}}
 const base={name:'.kilo',lockfileVersion:3,requires:true,packages:{'':{dependencies:toolManifest().dependencies},'node_modules/toml':old,'node_modules/other':{version:'1'}}}
 const source=structuredClone(base);source.name=toolManifest().name;source.packages['']={name:toolManifest().name,dependencies:toolManifest().dependencies,engines:toolManifest().engines}
 Object.assign(source.packages['node_modules/toml'],{version:'5.0.1',resolved:'https://registry.npmjs.org/toml/-/toml-5.0.1.tgz',integrity:'sha512-EqYNA/YvUNndrA2B3O2ojzLQoTQrBxeZ9UIjQwk8t10oe6n7dwclBwd9IdZQTOKwe6vWX+AXtl6IntXRbepdxQ=='})
 return {base,source}
}
test('local tooling lock accepts only the exact published TOML artifact and root metadata',()=>{const {base,source}=toolLocks();validateToolDependencyChange('.kilo/package-lock.json',jsonBytes(base),jsonBytes(source))})
for(const [name,change]of [
 ['other package',p=>p.packages['node_modules/other'].version='2'],['new package',p=>p.packages['node_modules/extra']={version:'1'}],
 ['integrity',p=>p.packages['node_modules/toml'].integrity='wrong'],['registry',p=>p.packages['node_modules/toml'].resolved='https://attacker.invalid/toml.tgz'],
 ['license',p=>p.packages['node_modules/toml'].license='different'],['engine',p=>p.packages[''].engines.node='*'],
])test(`local tooling lock rejects ${name}`,()=>{const {base,source}=toolLocks();change(source);assert.throws(()=>validateToolDependencyChange('.kilo/package-lock.json',jsonBytes(base),jsonBytes(source)))})
function toolFollowup(){const m=dependencyFollowup();for(const path of ['.kilo/package.json','.kilo/package-lock.json'])m.files.push({path,status:path.endsWith('/package.json')?'added':'modified',previousPath:null,blobSha:BLOB,sha256:sha256(bytes),baseBlobSha:path.endsWith('/package.json')?null:BLOB,baseSha256:path.endsWith('/package.json')?null:sha256(bytes)});return m}
test('local tooling coverage requires the exact added manifest and modified lock',()=>validateManifest(toolFollowup(),NOW))
for(const [name,change]of [
 ['missing lock',m=>m.files.pop()],['missing manifest',m=>m.files.splice(-2,1)],['manifest modification',m=>m.files.at(-2).status='modified'],
 ['adjacent file',m=>m.files.at(-2).path='.kilo/other.json'],['historical PR',m=>{m.pullRequest=984;m.branch=PR_BINDINGS[984].branch;m.baseSha=BASE}],
])test(`local tooling review rejects ${name}`,()=>{const m=toolFollowup();change(m);assert.throws(()=>validateManifest(m,NOW))})
test('local tooling paths remain outside the general allowlist',()=>{for(const p of ['.kilo/package.json','.kilo/package-lock.json','.kilo/other.json'])assert.equal(allowedPath(p),false)})
const otelPackage=()=>({name:'@nzila/otel-core',scripts:{typecheck:'tsc --noEmit'},optionalDependencies:{'@opentelemetry/api':'^1.9.0'}})
const patchedOtelPackage=()=>{const p=otelPackage();p.optionalDependencies['@fastify/otel']='0.18.0';return p}
test('OTel manifest repair declares the previously hoisted optional dependency',()=>validateOtelPackageChange(jsonBytes(otelPackage()),jsonBytes(patchedOtelPackage())))
for(const [name,change]of [
 ['broad range',p=>p.optionalDependencies['@fastify/otel']='*'],['unrelated script',p=>p.scripts.typecheck='true'],
 ['wrong dependency scope',p=>{delete p.optionalDependencies['@fastify/otel'];p.dependencies={'@fastify/otel':'0.18.0'}}],
 ['unrelated dependency',p=>p.optionalDependencies['@opentelemetry/api']='*'],
])test(`OTel manifest rejects ${name}`,()=>{const p=patchedOtelPackage();change(p);assert.throws(()=>validateOtelPackageChange(jsonBytes(otelPackage()),jsonBytes(p)))})
const otelFile=()=>({path:'packages/otel-core/package.json',status:'modified',previousPath:null,blobSha:BLOB,sha256:sha256(bytes),baseBlobSha:BLOB,baseSha256:sha256(bytes)})
test('OTel manifest requires paired signed root lock coverage',()=>{const m=dependencyFollowup();m.files.push(otelFile());validateManifest(m,NOW);m.files=m.files.filter(f=>!['package.json','pnpm-lock.yaml'].includes(f.path));assert.throws(()=>validateManifest(m,NOW),/lock coverage/)})
for(const status of ['added','removed'])test(`OTel manifest rejects ${status} file`,()=>{const m=dependencyFollowup();m.files.push({...otelFile(),status});assert.throws(()=>validateManifest(m,NOW))})
test('OTel manifest remains excluded from general path allowlist',()=>assert.equal(allowedPath('packages/otel-core/package.json'),false))
for(const extra of [false,true])test(`actual API OTel package scope (unrelated edit=${extra})`,async()=>{
 const m=dependencyFollowup(),base=jsonBytes(otelPackage()),source=patchedOtelPackage()
 if(extra)source.scripts.typecheck='true'
 const current=jsonBytes(source),newSha='a'.repeat(40),oldSha='b'.repeat(40),rootNew='c'.repeat(40),rootOld='d'.repeat(40)
 m.files.push({...otelFile(),blobSha:newSha,sha256:sha256(current),baseBlobSha:oldSha,baseSha256:sha256(base)})
 Object.assign(m.files.find(f=>f.path==='package.json'),{blobSha:rootNew,sha256:sha256(packageBytes('>=3.4.17')),baseBlobSha:rootOld,baseSha256:sha256(packageBytes('>=3.4.13'))})
 const a=apiFixture(m)
 for(const f of m.files.filter(f=>['package.json','pnpm-lock.yaml','packages/otel-core/package.json'].includes(f.path)))a.objects[`git/trees/${'5'.repeat(40)}?recursive=1`].tree.push({path:f.path,type:'blob',sha:f.baseBlobSha})
 for(const [sha,content]of [[newSha,current],[oldSha,base],[rootNew,packageBytes('>=3.4.17')],[rootOld,packageBytes('>=3.4.13')]])a.objects[`git/blobs/${sha}`]={encoding:'base64',sha,content:content.toString('base64')}
 if(extra)await assert.rejects(verifyPullRequest(m,a),/Unrelated OTel/);else await verifyPullRequest(m,a)
})
for(const extra of [false,true])test(`actual API local tooling lock scope (unrelated edit=${extra})`,async()=>{
 const m=followup(),{base,source}=toolLocks()
 if(extra)source.packages['node_modules/other'].version='2'
 const manifestBytes=jsonBytes(toolManifest()),baseBytes=jsonBytes(base),sourceBytes=jsonBytes(source)
 const manifestSha='a'.repeat(40),baseSha='b'.repeat(40),sourceSha='c'.repeat(40)
 m.files.push({path:'.kilo/package.json',status:'added',previousPath:null,blobSha:manifestSha,sha256:sha256(manifestBytes),baseBlobSha:null,baseSha256:null},{path:'.kilo/package-lock.json',status:'modified',previousPath:null,blobSha:sourceSha,sha256:sha256(sourceBytes),baseBlobSha:baseSha,baseSha256:sha256(baseBytes)})
 const a=apiFixture(m)
 a.objects[`git/trees/${'5'.repeat(40)}?recursive=1`].tree.push({path:'.kilo/package-lock.json',type:'blob',sha:baseSha})
 for(const [sha,content]of [[manifestSha,manifestBytes],[baseSha,baseBytes],[sourceSha,sourceBytes]])a.objects[`git/blobs/${sha}`]={encoding:'base64',sha,content:content.toString('base64')}
 if(extra)await assert.rejects(verifyPullRequest(m,a),/Unrelated/);else await verifyPullRequest(m,a)
})
for(const extra of [false,true])test(`actual API sanitizer package blob scope (unrelated edit=${extra})`,async()=>{
 const m=dependencyFollowup(),base=packageBytes('>=3.4.13'),source=JSON.parse(packageBytes('>=3.4.17'))
 if(extra)source.scripts.test='bypass'
 const current=Buffer.from(JSON.stringify(source)),newSha='a'.repeat(40),oldSha='b'.repeat(40),file=m.files.find(f=>f.path==='package.json')
 Object.assign(file,{blobSha:newSha,sha256:sha256(current),baseBlobSha:oldSha,baseSha256:sha256(base)})
 const a=apiFixture(m)
 for(const f of m.files.filter(f=>['package.json','pnpm-lock.yaml'].includes(f.path)))a.objects[`git/trees/${'5'.repeat(40)}?recursive=1`].tree.push({path:f.path,type:'blob',sha:f.baseBlobSha})
 a.objects[`git/blobs/${newSha}`]={encoding:'base64',sha:newSha,content:current.toString('base64')}
 a.objects[`git/blobs/${oldSha}`]={encoding:'base64',sha:oldSha,content:base.toString('base64')}
 if(extra)await assert.rejects(verifyPullRequest(m,a),/Unrelated/);else await verifyPullRequest(m,a)
})
test('sanitizer root files remain excluded from the general path allowlist',()=>{assert.equal(allowedPath('package.json'),false);assert.equal(allowedPath('pnpm-lock.yaml'),false)})
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


function caseAuthorizationFollowup() {
 const m=followup();m.pullRequest=993;m.branch=PR_BINDINGS[993].branch;m.baseSha=PR_BINDINGS[993].base
 return m
}
test('case authorization review binds exact PR, source base, branch, author and unchanged trust',async()=>{
 const m=caseAuthorizationFollowup();validateManifest(m,NOW)
 assert.equal((await verifyPullRequest(m,apiFixture(m))).evidenceSha,E)
})
for(const [name,change]of [
 ['another PR',m=>m.pullRequest=994],['another branch',m=>m.branch=PR_BINDINGS[992].branch],
 ['another base',m=>m.baseSha=PR_BINDINGS[992].base],['production authorization',m=>m.productionAuthorized=true],
 ['missing primary attribution',m=>m.reviews=m.reviews.filter(r=>r.kind!=='primary-agent-review')],
 ['invented human attribution',m=>m.reviews[0].kind='independent-human'],
 ['changed trust',m=>m.files.push(manifest().files[0])],
])test(`case authorization review rejects ${name}`,()=>{const m=caseAuthorizationFollowup();change(m);assert.throws(()=>validateManifest(m,NOW))})
for(const name of [
 'packages/platform-auth/src/auth-db.ts','packages/db/src/auth-storage-authority/org-session-authority.ts',
 'apps/union-eyes/db/migrations-platform/0009_extra.sql','apps/union-eyes/backend/auth_core/models.py',
 'apps/union-eyes/lib/auth/unreviewed.ts','apps/union-eyes/db/auth/unreviewed-function.ts',
 'apps/union-eyes/db/schema/claims-schema.ts','package.json','pnpm-lock.yaml',
 '.github/workflows/deploy-union-eyes.yml','ops/policies/production.json',
])test(`case authorization review cannot expand to ${name}`,()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:name});assert.throws(()=>validateManifest(m,NOW))
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/__tests__/cases-assign.route.test.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/__tests__/cases-assign.route.test.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/__tests__/cases-audit.route.test.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/__tests__/cases-audit.route.test.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/__tests__/cases-caseId-export.route.test.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/__tests__/cases-caseId-export.route.test.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/__tests__/cases-evidence.route.test.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/__tests__/cases-evidence.route.test.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/__tests__/cases-next-actions.route.test.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/__tests__/cases-next-actions.route.test.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/__tests__/cases-notes.route.test.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/__tests__/cases-notes.route.test.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/__tests__/cases-route.route.test.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/__tests__/cases-route.route.test.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/__tests__/cases-timeline.route.test.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/__tests__/cases-timeline.route.test.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/__tests__/cases-transition.route.test.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/__tests__/cases-transition.route.test.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/cases/[caseId]/assign/route.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/cases/[caseId]/assign/route.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/cases/[caseId]/audit/route.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/cases/[caseId]/audit/route.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/cases/[caseId]/evidence/route.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/cases/[caseId]/evidence/route.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/cases/[caseId]/export/route.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/cases/[caseId]/export/route.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/cases/[caseId]/next-actions/route.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/cases/[caseId]/next-actions/route.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/cases/[caseId]/notes/route.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/cases/[caseId]/notes/route.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/cases/[caseId]/route.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/cases/[caseId]/route.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/cases/[caseId]/timeline/route.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/cases/[caseId]/timeline/route.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/cases/[caseId]/transition/route.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/cases/[caseId]/transition/route.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/app/api/cases/route.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/app/api/cases/route.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/db/auth/case-assignee-predicate.pglite.test.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/db/auth/case-assignee-predicate.pglite.test.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/db/auth/case-assignee-predicate.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/db/auth/case-assignee-predicate.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/lib/__tests__/organization-utils.test.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/lib/__tests__/organization-utils.test.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/lib/cases/case-authorization.pglite.test.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/lib/cases/case-authorization.pglite.test.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/lib/cases/case-authorization.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/lib/cases/case-authorization.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/lib/cases/case-evidence-query.pglite.test.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/lib/cases/case-evidence-query.pglite.test.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/lib/cases/case-evidence-query.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/lib/cases/case-evidence-query.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/lib/cases/case-permissions.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/lib/cases/case-permissions.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/lib/operations/canonical-catalog-admission.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/lib/operations/canonical-catalog-admission.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/lib/organization-utils.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/lib/organization-utils.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts apps/union-eyes/scripts/rls-verify.ts",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"apps/union-eyes/scripts/rls-verify.ts"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts tooling/repo-inventory/output/inventory.json",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"tooling/repo-inventory/output/inventory.json"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts tooling/repo-inventory/output/inventory.md",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"tooling/repo-inventory/output/inventory.md"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts tooling/repo-inventory/output/repo-inventory.json",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"tooling/repo-inventory/output/repo-inventory.json"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts tooling/repo-inventory/output/repo-inventory.md",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"tooling/repo-inventory/output/repo-inventory.md"});validateManifest(m,NOW)
})
test("case authorization signed coverage accepts tooling/security/ue-staging-delegated-review.test.mjs",()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:"tooling/security/ue-staging-delegated-review.test.mjs"});validateManifest(m,NOW)
})

for(const [name,change]of [
 ['owner impersonation',a=>a.pr.user.login='anungis437'],
 ['changed trust blob',a=>a.sourceTree.tree.find(t=>t.path===KEY_PATH).sha=BLOB],
 ['unreviewed evidence edit',a=>a.evidenceFiles.push({filename:'apps/union-eyes/db/auth/case-assignee-predicate.ts',status:'modified'})],
])test(`case authorization actual API rejects ${name}`,async()=>{
 const m=caseAuthorizationFollowup(),a=apiFixture(m);change(a);await assert.rejects(verifyPullRequest(m,a))
})

test('case authorization review accepts the exact authorization recognizer repair',()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:'tooling/contract-tests/vertical-governance.test.ts'});validateManifest(m,NOW)
})
test('case authorization review rejects other contract changes',()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:'tooling/contract-tests/ci-feedback-performance.test.ts'});assert.throws(()=>validateManifest(m,NOW))
})
for(const name of ['apps/union-eyes/app/api/cases/[caseId]/escalate/route.ts','apps/union-eyes/app/api/__tests__/cases-escalate.route.test.ts'])test(`case authorization review accepts scoped escalation ${name}`,()=>{
 const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path:name});validateManifest(m,NOW)
})

for(const path of ["tooling/contract-tests/api-authz-coverage.test.ts","tooling/contract-tests/cross-org-breach-http.test.ts","tooling/contract-tests/org-isolation.test.ts","tooling/contract-tests/org-isolation-runtime.test.ts","tooling/contract-tests/org-scope-enforcement.test.ts","tooling/contract-tests/union-eyes-fsm-enforcement.test.ts","apps/union-eyes/app/api/__tests__/dry-run-calibration.test.ts"])test('case authorization accepts exact follow-up test '+path,()=>{const m=caseAuthorizationFollowup();m.files.push({...m.files[0],path});validateManifest(m,NOW)})
