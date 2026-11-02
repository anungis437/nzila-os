/**
 * Deterministic path-bound SHA-256 for built artifact directories.
 * Never concatenate raw file bytes (AB+CD and A+BCD collide).
 * Never depend on filesystem enumeration order or follow untracked symlinks.
 * This digest describes local build bundles; it does NOT attest OCI images.
 */
import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const EXCLUDED = new Set(['node_modules', '.git', 'cache'])

/**
 * Hash the bytes of the opened inode, not a path re-resolved after lstat.
 * O_NOFOLLOW prevents a symlink swap; O_NONBLOCK prevents a FIFO swap from
 * hanging the build. Bound each file and stream it instead of allocating its
 * entire size. An inode/size/metadata change is a failed artifact proof.
 */
function hashPinnedFile(path, relative, inspected) {
  let fd
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    const before = fstatSync(fd, { bigint: true })
    if (!before.isFile() || before.dev !== inspected.dev ||
        before.ino !== inspected.ino || before.size !== inspected.size ||
        before.mtimeNs !== inspected.mtimeNs || before.ctimeNs !== inspected.ctimeNs) {
      throw new Error('ARTIFACT_FILE_CHANGED: ' + relative)
    }
    if (before.size > 2_147_483_648n) throw new Error('ARTIFACT_FILE_TOO_LARGE: ' + relative)
    const digest = createHash('sha256')
    const buffer = Buffer.allocUnsafe(64 * 1024)
    let remaining = before.size
    while (remaining > 0n) {
      const size = Number(remaining > BigInt(buffer.length) ? BigInt(buffer.length) : remaining)
      const count = readSync(fd, buffer, 0, size, null)
      if (count === 0) throw new Error('ARTIFACT_FILE_CHANGED: ' + relative)
      digest.update(buffer.subarray(0, count))
      remaining -= BigInt(count)
    }
    if (readSync(fd, buffer, 0, 1, null) !== 0) {
      throw new Error('ARTIFACT_FILE_CHANGED: ' + relative)
    }
    const after = fstatSync(fd, { bigint: true })
    if (after.dev !== before.dev || after.ino !== before.ino ||
        after.size !== before.size || after.mtimeNs !== before.mtimeNs ||
        after.ctimeNs !== before.ctimeNs) {
      throw new Error('ARTIFACT_FILE_CHANGED: ' + relative)
    }
    return { digest: digest.digest('hex'), length: Number(before.size) }
  } catch (error) {
    if (error?.code === 'ELOOP') throw new Error('ARTIFACT_SYMLINK_UNVERIFIED: ' + relative)
    throw error
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

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
      const type = lstatSync(path, { bigint: true })
      if (type.isSymbolicLink()) throw new Error('ARTIFACT_SYMLINK_UNVERIFIED: ' + relative)
      if (type.isDirectory()) {
        walk(path, relative)
        const after = lstatSync(path, { bigint: true })
        if (!after.isDirectory() || after.dev !== type.dev ||
            after.ino !== type.ino || after.mtimeNs !== type.mtimeNs ||
            after.ctimeNs !== type.ctimeNs) {
          throw new Error('ARTIFACT_DIRECTORY_CHANGED: ' + relative)
        }
        continue
      }
      if (!type.isFile()) throw new Error('ARTIFACT_SPECIAL_FILE_UNVERIFIED: ' + relative)
      const { digest, length } = hashPinnedFile(path, relative, type)
      // Path, length and content hash are bound in an unambiguous
      // per-file record and hashed into one domain-separated tree digest.
      tree.update(JSON.stringify([relative, length, digest]) + '\n')
      files++
    }
  }

  walk(dir, '')
  return Object.freeze({ digest: tree.digest('hex'), fileCount: files })
}
