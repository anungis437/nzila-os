import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, truncateSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
test('descriptor-pinned streaming hash preserves deterministic digest across read blocks', () => {
  const dir = temp()
  try {
    const bytes = Buffer.alloc(131_079, 0x5a)
    writeFileSync(join(dir, 'large.bin'), bytes)
    const fileHash = createHash('sha256').update(bytes).digest('hex')
    const expected = createHash('sha256').update('nzila-artifact-tree-v2\\n')
      .update(JSON.stringify(['large.bin', bytes.length, fileHash]) + '\\n').digest('hex')
    assert.deepEqual(hashDirectory(dir), { digest: expected, fileCount: 1 })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
test('oversized sparse artifact is refused before reading or allocating its contents', () => {
  const dir = temp()
  try {
    const file = join(dir, 'oversized.bin')
    writeFileSync(file, '')
    truncateSync(file, 2_147_483_649)
    assert.throws(() => hashDirectory(dir), /ARTIFACT_FILE_TOO_LARGE/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
test('symlinked artifact directory is refused, not traversed', () => {
  const dir = temp(), outside = temp()
  try {
    writeFileSync(join(outside, 'secret'), 'not a build artifact')
    symlinkSync(outside, join(dir, 'linked-dir'), 'dir')
    assert.throws(() => hashDirectory(dir), /ARTIFACT_SYMLINK_UNVERIFIED/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  }
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
