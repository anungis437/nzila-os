import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyInventoryLock,INVENTORY_PAIRS } from './verify-inventory-lock.mjs'

const j={generatedAt:'2026-10-20T00:00:00.000Z',appCount:1,packageCount:2,workspacePackageCount:3,workflowCount:4,contractTestCount:5,tsTestFileCount:6,pythonTestFileCount:7,apps:[{name:'a'}],workflows:['ci']}
const tick=String.fromCharCode(96)
const md='# Nzila OS — Canonical Repo Inventory\n\n> Auto-generated on 2026-10-20 by '+tick+'tooling/repo-inventory'+tick+'. Do not edit manually.\n\n| TS/JS Test Files | 6 |\n'
function fixture(g={},c={}) {
  const a={}
  for(const pair of INVENTORY_PAIRS) for(const path of pair) a[path]=path.endsWith('.json')?JSON.stringify(j):md
  return {readCommitted:p=>c[p]??a[p],readGenerated:p=>g[p]??a[p]}
}
test('calendar date rollover is non-substantive',()=>{
  const j2={...j,generatedAt:'2026-10-30T00:00:00.000Z'}
  const g={}
  for(const p of INVENTORY_PAIRS[0])g[p]=JSON.stringify(j2)
  for(const p of INVENTORY_PAIRS[1])g[p]=md.replace('2026-10-20','2026-10-30')
  assert.equal(verifyInventoryLock(fixture(g)).verdict,'PASS')
})
test('modified count cannot be hidden behind generatedAt diff',()=>{
  const g={}
  for(const p of INVENTORY_PAIRS[0])g[p]=JSON.stringify({...j,tsTestFileCount:100})
  assert.throws(()=>verifyInventoryLock(fixture(g)),/Structural inventory drift/)
})
test('aliases cannot disagree',()=>{
  const g={[INVENTORY_PAIRS[0][1]]:JSON.stringify({...j,appCount:99})}
  assert.throws(()=>verifyInventoryLock(fixture(g)),/Generated alias divergence/)
})
test('missing metric and corrupted markdown fail closed',()=>{
  assert.throws(()=>verifyInventoryLock(fixture({[INVENTORY_PAIRS[0][0]]:'{}'})),/Invalid inventory metric/)
  assert.throws(()=>verifyInventoryLock(fixture({[INVENTORY_PAIRS[1][0]]:md.replace('Auto-generated','Modified')})),/Invalid inventory markdown provenance/)
})
