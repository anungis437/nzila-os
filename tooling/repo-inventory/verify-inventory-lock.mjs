#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const prefixes = ['tooling/repo-inventory/output/inventory','tooling/repo-inventory/output/repo-inventory']
export const INVENTORY_PAIRS = [
  prefixes.map(p => p + '.json'),
  prefixes.map(p => p + '.md'),
]
const deny = m => { throw new Error('INVENTORY_LOCK_DENIED: ' + m) }
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))
  return v
}
function normalize(path, content) {
  if (path.endsWith('.json')) {
    let j
    try { j = JSON.parse(content) } catch { deny('Invalid JSON: ' + path) }
    for (const k of ['appCount','packageCount','workspacePackageCount','workflowCount','contractTestCount','tsTestFileCount','pythonTestFileCount']) {
      if (!Number.isInteger(j?.[k]) || j[k] < 0) deny('Invalid inventory metric '+k)
    }
    if (!Array.isArray(j.apps) || !Array.isArray(j.workflows)) deny('Missing complete inventory')
    const { generatedAt, ...rest } = j
    if (!/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(generatedAt ?? '')) deny('Invalid inventory generator timestamp')
    return JSON.stringify(canonical(rest))
  }
  if (!content.startsWith('# Nzila OS — Canonical Repo Inventory\n')) deny('Bad inventory heading')
  const marker = /^> Auto-generated on \d{4}-\d{2}-\d{2} by .*tooling\/repo-inventory.*Do not edit manually\.$/m
  if (!marker.test(content)) deny('Invalid inventory markdown provenance')
  return content.replace(marker, '> Auto-generated on DATE by GENERATOR. Do not edit manually.').replace(/\r\n/g,'\n')
}
export function verifyInventoryLock({readCommitted,readGenerated}) {
  for (const pair of INVENTORY_PAIRS) {
    const committed = pair.map(p=>normalize(p,readCommitted(p)))
    const generated = pair.map(p=>normalize(p,readGenerated(p)))
    if (committed[0] !== committed[1]) deny('Committed alias divergence: ' + pair[0])
    if (generated[0] !== generated[1]) deny('Generated alias divergence: ' + pair[0])
    if (committed[0] !== generated[0]) deny('Structural inventory drift: ' + pair[0])
  }
  return { verdict: 'PASS', files: 4, ignored: 'only generated calendar date' }
}
export function checkRepository(root=resolve(fileURLToPath(new URL('../..', import.meta.url)))) {
  return verifyInventoryLock({
    readCommitted: p=>execFileSync('git',['show','HEAD:'+p],{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024}),
    readGenerated: p=>readFileSync(join(root,p),'utf8'),
  })
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { console.log('Inventory lock:',checkRepository()) }
  catch(e){ console.error(e.message); process.exitCode=1 }
}
