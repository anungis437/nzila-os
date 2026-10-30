/**
 * Deterministic path-bound SHA-256 for built artifact directories.
 * Never concatenate raw file bytes (AB+CD and A+BCD collide).
 * Never depend on filesystem enumeration order or follow untracked symlinks.
 * This digest describes local build bundles; it does NOT attest OCI images.
 */
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const EXCLUDED = new Set(['node_modules', '.git', 'cache'])

export function hashDirectory(dir) {
  const tree = createHash('sha256')
  tree.update('nzila-artifact-tree-v2\n')
  let files = 0

  function walk(directory, prefix) {
    const names = readdirSync(directory).sort((a,b) => a < b ? -1 : a > b ? 1 : 0)
    for (const name of names) {
      if (EXCLUDED.has(name)) continue
      if (name.includes('\0') || name === '.' || name === '..') {
        throw new Error('INVALID_ARTIFACT_FILE_NAME')
      }
      const path = join(directory, name)
      const relative = prefix ? prefix + '/' + name : name
      const type = lstatSync(path)
      if (type.isSymbolicLink()) throw new Error('ARTIFACT_SYMLINK_UNVERIFIED: ' + relative)
      if (type.isDirectory()) {
        walk(path, relative)
        continue
      }
      if (!type.isFile()) throw new Error('ARTIFACT_SPECIAL_FILE_UNVERIFIED: ' + relative)
      const bytes = readFileSync(path)
      const digest = createHash('sha256').update(bytes).digest('hex')
      // Path, length and content hash are bound in an unambiguous
      // per-file record and hashed into one domain-separated tree digest.
      tree.update(JSON.stringify([relative, bytes.length, digest]) + '\n')
      files++
    }
  }

  walk(dir, '')
  return Object.freeze({ digest: tree.digest('hex'), fileCount: files })
}
