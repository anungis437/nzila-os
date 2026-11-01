import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyOciProvenance, readSignedManifestFile } from './verify-oci-provenance.mjs'
import { mkdtempSync, writeFileSync, truncateSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SHA='a'.repeat(40), REPO='anungis437/nzila-os'
const IMAGE='nzilacanadaacr.azurecr.io/nzila/web@sha256:'+'b'.repeat(64)
const manifest=()=>({source_workflow:'deploy-staging',commit_sha:SHA,run_id:'123456',
  built_at:new Date().toISOString(),
  attestation_ref:'release-attestation.json',deployTargets:[{name:'nzila-os-web',image:IMAGE}]})
const proof=()=>JSON.stringify([{verificationResult:{
  signature:{certificate:{subject:'GitHub OIDC'}},
  verifiedTimestamps:[{timestamp:'2026-11-01T00:00:00Z'}],
  statement:{predicateType:'https://slsa.dev/provenance/v1',
    subject:[{name:IMAGE.split('@sha256:')[0],digest:{sha256:'b'.repeat(64)}}]},
}}])
const opts=extra=>({manifestRaw:JSON.stringify(manifest()),sourceSha:SHA,repository:REPO,
  stagingRunId:'123456',verifier:()=>proof(),...extra})

test('OCI CLI refuses oversized or symlinked manifest evidence before loading bytes',()=>{
  const directory=mkdtempSync(join(tmpdir(),'nzila-oci-manifest-'))
  try {
    const file=join(directory,'manifest.json')
    writeFileSync(file,JSON.stringify(manifest()))
    assert.equal(JSON.parse(readSignedManifestFile(file)).run_id,'123456')
    const symlink=join(directory,'redirect.json')
    symlinkSync(file,symlink)
    assert.throws(()=>readSignedManifestFile(symlink),/file size or type invalid/)
    truncateSync(file,2_097_153)
    assert.throws(()=>readSignedManifestFile(file),/file size or type invalid/)
    truncateSync(file,0)
    assert.throws(()=>readSignedManifestFile(file),/file size or type invalid/)
  } finally { rmSync(directory,{recursive:true,force:true}) }
})

test('signed OCI manifest reads retain exact bytes and reject replaced paths',()=>{
  const directory=mkdtempSync(join(tmpdir(),'nzila-oci-fd-'))
  try {
    const path=join(directory,'manifest.json')
    const target=join(directory,'other.json')
    const original=Buffer.from(JSON.stringify(manifest()) + String.fromCharCode(10))
    writeFileSync(path,original)
    writeFileSync(target,JSON.stringify({...manifest(),run_id:'999999'}))
    const read=readSignedManifestFile(path)
    assert.ok(Buffer.isBuffer(read))
    assert.deepEqual(read,original)
    rmSync(path)
    symlinkSync(target,path)
    assert.throws(()=>readSignedManifestFile(path),/file missing or unreadable|file size or type invalid/)
    assert.throws(()=>readSignedManifestFile(directory),/file size or type invalid|file missing or unreadable/)
  } finally { rmSync(directory,{recursive:true,force:true}) }
})

test('requires canonical GitHub signer, exact source/ref and digest subject',()=>{
  let args
  const receipt=verifyOciProvenance(opts({verifier:(cmd,a)=>{assert.equal(cmd,'gh');args=a;return proof()}}))
  assert.equal(receipt.verdict,'OCI_PROVENANCE_VERIFIED')
  assert.equal(receipt.targets[0].image,IMAGE)
  assert.equal(receipt.stagingRunId,'123456')
  assert.match(receipt.manifestSha256,/^[0-9a-f]{64}$/)
  assert.match(receipt.targets[0].verifiedOutputSha256,/^[0-9a-f]{64}$/)
  for(const value of ['--source-digest',SHA,'--source-ref','refs/heads/main',
    '--signer-workflow',REPO+'/.github/workflows/gitops-deploy.yml',
    '--deny-self-hosted-runners','--repo',REPO]) assert.ok(args.includes(value),value)
})
test('rejects forged/missing witnessed subjects despite a successful mocked command',()=>{
  const p=JSON.parse(proof())
  p[0].verificationResult.statement.subject[0].digest.sha256='f'.repeat(64)
  assert.throws(()=>verifyOciProvenance(opts({verifier:()=>JSON.stringify(p)})),/verified OCI subject/)
  p[0].verificationResult.statement.subject[0].digest.sha256='b'.repeat(64)
  p[0].verificationResult.verifiedTimestamps=[]
  assert.throws(()=>verifyOciProvenance(opts({verifier:()=>JSON.stringify(p)})),/witness missing/)
  assert.throws(()=>verifyOciProvenance(opts({verifier:()=> '[]'})),/witness missing/)
})
test('fails closed on offline verifier, malformed output and untrusted source',()=>{
  assert.throws(()=>verifyOciProvenance(opts({verifier:()=>{throw Error('offline')}})),/verification unavailable/)
  assert.throws(()=>verifyOciProvenance(opts({verifier:()=>'{'})),/verification unavailable/)
  assert.throws(()=>verifyOciProvenance(opts({repository:'attacker/repo'})),/untrusted source/)
  assert.throws(()=>verifyOciProvenance(opts({sourceSha:'f'.repeat(39)})),/untrusted source/)
})
test('rejects mutable, foreign, conflicting and duplicate targets',()=>{
  for(const bad of [
    [{name:'demo',image:'example.invalid/app@sha256:'+'b'.repeat(64)}],
    [{name:'demo',image:'nzilacanadaacr.azurecr.io/nzila/web:latest'}],
    [{name:'demo',image:IMAGE,imageRef:'other@sha256:'+'b'.repeat(64)}],
    [{name:'demo',image:IMAGE},{name:'demo',image:IMAGE}],
  ]) assert.throws(()=>verifyOciProvenance(opts({manifestRaw:JSON.stringify({...manifest(),deployTargets:bad})})),/noncanonical|duplicate/)
})
test('binds exact signed staging bytes, source SHA and run ID; rejects substitutions',()=>{
  const a=verifyOciProvenance(opts())
  const b=verifyOciProvenance(opts({manifestRaw:JSON.stringify(manifest(),null,2)}))
  assert.notEqual(a.manifestSha256,b.manifestSha256)
  for(const bad of [
    {stagingRunId:'999999'},
    {stagingRunId:'0'},
    {manifestRaw:JSON.stringify({...manifest(),run_id:'999999'})},
    {manifestRaw:JSON.stringify({...manifest(),commit_sha:'f'.repeat(40)})},
    {manifestRaw:JSON.stringify({...manifest(),source_workflow:'other'})},
    {manifestRaw:JSON.stringify({...manifest(),attestation_ref:'other.json'})},
  ]) assert.throws(()=>verifyOciProvenance(opts(bad)),/source\/run mismatch/)
  assert.throws(()=>verifyOciProvenance(opts({manifestRaw:'{'})),/malformed signed/)
  assert.throws(()=>verifyOciProvenance(opts({manifestRaw:undefined})),/manifest bytes required/)
})
test('rejects missing, stale and future signed staging build times before OCI verification',()=>{
  const now = new Date('2026-11-01T12:00:00.000Z')
  for (const built_at of [
    undefined, 'invalid', '2026-11-01T12:00:00Z',
    '2026-11-01T07:00:00.000-05:00', '2026-02-30T12:00:00.000Z',
    '2026-10-24T11:59:59.000Z',
    '2026-11-01T12:05:01.000Z',
  ]) {
    const m = manifest()
    if (built_at === undefined) delete m.built_at
    else m.built_at = built_at
    assert.throws(()=>verifyOciProvenance(opts({
      manifestRaw:JSON.stringify(m),now,
      verifier:()=>{throw Error('must reject before external verifier')},
    })),/build time is missing, stale or from future/)
  }
  const m = {...manifest(),built_at:'2026-11-01T12:00:00.000Z'}
  assert.equal(verifyOciProvenance(opts({manifestRaw:JSON.stringify(m),now})).verdict,
    'OCI_PROVENANCE_VERIFIED')
})
test('OCI receipt rejects signed but noncanonical Azure deployment identities',()=>{
  for(const name of [
    'Demo', 'demo--prod', 'demo' + String.fromCharCode(10) + 'prod',
    'demo' + String.fromCharCode(13) + 'prod',
    'demo' + String.fromCharCode(0) + 'prod',
    'demo/prod', '-demo', 'demo-', 'd', 'a'.repeat(33),
    'demo' + String.fromCharCode(92) + 'nprod',
  ]) {
    assert.throws(()=>verifyOciProvenance(opts({manifestRaw:JSON.stringify({
      ...manifest(),deployTargets:[{name,image:IMAGE}],
    })})),/noncanonical OCI deployment destination/,name)
  }
  const result=verifyOciProvenance(opts({manifestRaw:JSON.stringify({
    ...manifest(),deployTargets:[{name:'demo-prod-2',image:IMAGE}],
  })}))
  assert.equal(result.targets[0].name,'demo-prod-2')
})
// Mocked unit tests establish policy behavior only, never Sigstore or production certification.

test('OCI receipt denies noncanonical or unsafe staging coordinates',()=>{
  for (const bad of [123456, '0123456', '1e3', ' 123456', '9007199254740992', null]) {
    assert.throws(()=>verifyOciProvenance(opts({stagingRunId:bad})),/source\/run mismatch/,String(bad))
  }
  for (const bad of [123456, '0123456', '9007199254740992', null]) {
    assert.throws(()=>verifyOciProvenance(opts({
      stagingRunId:String(bad),manifestRaw:JSON.stringify({...manifest(),run_id:bad}),
    })),/source\/run mismatch/,String(bad))
  }
})


test('bounds cryptographic verification fanout before invoking any external verifier',()=>{
  let calls=0
  const oversized=Array.from({length:33},(_,i)=>({
    name:'nzila-os-web'+i,
    image:'nzilacanadaacr.azurecr.io/nzila/web'+i+'@sha256:'+i.toString(16).padStart(64,'0'),
  }))
  assert.throws(()=>verifyOciProvenance(opts({
    manifestRaw:JSON.stringify({...manifest(),deployTargets:oversized}),
    verifier:()=>{calls++;throw Error('verifier must not be invoked')},
  })),/exceeds 32 deployment targets/)
  assert.equal(calls,0)
  const atLimit=oversized.slice(0,32)
  const valid=verifyOciProvenance(opts({
    manifestRaw:JSON.stringify({...manifest(),deployTargets:atLimit}),
    verifier:(_cmd,args)=>{
      calls++
      const subject=args[2].slice('oci://'.length)
      const [name,digest]=subject.split('@sha256:')
      return JSON.stringify([{verificationResult:{
        signature:{certificate:{subject:'GitHub OIDC'}},
        verifiedTimestamps:[{timestamp:'2026-11-01T00:00:00Z'}],
        statement:{predicateType:'https://slsa.dev/provenance/v1',
          subject:[{name,digest:{sha256:digest}}]},
      }}])
    },
  }))
  assert.equal(valid.targets.length,32)
  assert.equal(calls,32)
})
