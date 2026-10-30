import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hashDirectory } from './artifact-tree.mjs'

function temp() { return mkdtempSync(join(tmpdir(), 'nzila-tree-proof-')) }
test('directory creation order does not affect artifact identity', () => {
  const a=temp(), b=temp()
  try {
    writeFileSync(join(a,'z.txt'),'z');writeFileSync(join(a,'a.txt'),'a')
    writeFileSync(join(b,'a.txt'),'a');writeFileSync(join(b,'z.txt'),'z')
    assert.deepEqual(hashDirectory(a),hashDirectory(b))
    assert.equal(hashDirectory(a).fileCount,2)
  } finally { rmSync(a,{recursive:true,force:true});rmSync(b,{recursive:true,force:true}) }
})
test('path identity makes raw byte concatenation collision impossible',()=>{
  const a=temp(),b=temp()
  try {
    writeFileSync(join(a,'one'),'AB');writeFileSync(join(a,'two'),'CD')
    writeFileSync(join(b,'one'),'A');writeFileSync(join(b,'two'),'BCD')
    assert.notEqual(hashDirectory(a).digest,hashDirectory(b).digest)
  } finally {rmSync(a,{recursive:true,force:true});rmSync(b,{recursive:true,force:true})}
})
test('moving one file or modifying its bytes changes the digest',()=>{
  const dir=temp()
  try {
    writeFileSync(join(dir,'a'),'x')
    const before=hashDirectory(dir).digest
    writeFileSync(join(dir,'a'),'xx')
    assert.notEqual(hashDirectory(dir).digest,before)
    mkdirSync(join(dir,'sub'))
    writeFileSync(join(dir,'sub','a'),'xx')
    assert.notEqual(hashDirectory(dir).digest,hashDirectory(join(dir,'sub')).digest)
  } finally {rmSync(dir,{recursive:true,force:true})}
})
test('symlinked build input fails closed instead of disappearing from evidence',()=>{
  const dir=temp(),outside=temp()
  try {
    writeFileSync(join(outside,'x'),'outside')
    symlinkSync(join(outside,'x'),join(dir,'injected'))
    assert.throws(()=>hashDirectory(dir),/ARTIFACT_SYMLINK_UNVERIFIED/)
  } finally {rmSync(dir,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true})}
})
test('empty and excluded cache input cannot masquerade as populated bundle',()=>{
  const dir=temp()
  try {
    const empty=hashDirectory(dir)
    mkdirSync(join(dir,'cache'))
    writeFileSync(join(dir,'cache','stale'),'x')
    assert.deepEqual(hashDirectory(dir),empty)
    assert.equal(empty.fileCount,0)
  } finally {rmSync(dir,{recursive:true,force:true})}
})
