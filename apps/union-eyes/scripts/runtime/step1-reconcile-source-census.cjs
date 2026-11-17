#!/usr/bin/env node
'use strict'
// Reconcile discoveries against the pinned historical manifest and independently
// reviewed supplementary rows. This does not decide runtime or institutional admission.
const fs = require('node:fs')
const path = require('node:path')
const cp = require('node:child_process')
const assert = require('node:assert/strict')
const read = p => JSON.parse(fs.readFileSync(p,'utf8'))
const set = xs => new Set(xs)
const minus = (a,b) => [...a].filter(x=>!b.has(x)).sort()
const uniq = xs => xs.length===set(xs).size
const app = 'apps/union-eyes/'
const root = cp.execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim()
const rev = cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()
const docs = path.join(root,'docs/union-eyes/staging')
const inventory = read(path.join(docs,'UE_V2_STEP1_INDEPENDENT_GIT_TREE_CENSUS.json'))
const triage = read(path.join(docs,'UE_V2_STEP1_SCOPE_TRIAGE_AND_ADVERSARIAL_FINDINGS.json'))
const actual = read(process.argv[2])
assert.equal(actual.anchorCommit,rev,'source census SHA does not match checkout')
assert.equal(actual.record,'UE_STEP1_SOURCE_SURFACE_CENSUS')
const expectedFileKeys = inventory.routeFiles.map(x=>x.path)
const observedFileKeys = actual.routes.map(x=>x.path)
const prior = triage.routeMethods.map(x=>{
  const i=x.key.indexOf(' ')
  return x.key.slice(0,i)+' '+app+'app/api/'+x.key.slice(i+1)
})
const supplement=inventory.supplementalMethods.map(x=>x.key)
const observed=actual.routes.flatMap(r=>r.methods.map(m=>m+' '+r.path))
const expected=[...prior,...supplement]
const duplicateChecks={expectedFiles:uniq(expectedFileKeys),observedFiles:uniq(observedFileKeys),expectedMethods:uniq(expected),observedMethods:uniq(observed)}
const fileDelta={unclassified:minus(set(observedFileKeys),set(expectedFileKeys)),stale:minus(set(expectedFileKeys),set(observedFileKeys))}
const methodDelta={unclassified:minus(set(observed),set(expected)),stale:minus(set(expected),set(observed))}
const changedRouteBlobs=inventory.routeFiles.flatMap(x=>{
  const sha=cp.execFileSync('git',['rev-parse',rev+':'+x.path],{cwd:root,encoding:'utf8'}).trim()
  return sha===x.blobSha?[]:[{path:x.path,expected:x.blobSha,observed:sha}]
})
const declarationCandidates=[
  ...actual.serverModules.flatMap(m=>m.exports.map(e=>({key:m.path+'#'+e,kind:'MODULE_EXPORT'}))),
  ...actual.inlineServerActions.map(x=>({key:x.path+'#inline:'+x.position,kind:'INLINE_DIRECTIVE',name:x.name}))
]
const sourceInventoryMatch=Object.values(duplicateChecks).every(Boolean)&&
  !Object.values(fileDelta).some(xs=>xs.length)&&!Object.values(methodDelta).some(xs=>xs.length)&&
  !changedRouteBlobs.length&&!actual.unresolved.length
const result={record:'UE_STEP1_SOURCE_RECONCILIATION',sourceSha:rev,inventoryAnchor:inventory.anchorCommit,decision:'STEP1_OPEN_STEP2_HELD',
 sourceInventoryMatch,duplicateChecks,fileDelta,methodDelta,changedRouteBlobs,unresolved:actual.unresolved,
 counts:actual.counts,serverActionCandidates:declarationCandidates,
 limitation:'An exact inventory match is not proof of action scope, callable reachability, institutional authority, or runtime acceptance.'}
fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({sourceSha:rev,sourceInventoryMatch,counts:actual.counts,fileDelta,methodDelta,changedRouteBlobs:changedRouteBlobs.length,unresolved:actual.unresolved.length,decision:result.decision},null,2))
if(!sourceInventoryMatch)process.exitCode=1
