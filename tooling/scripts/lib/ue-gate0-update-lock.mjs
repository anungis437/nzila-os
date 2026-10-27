/**
 * Deterministic, validated update of the independent capability lock.
 *
 *   node tooling/scripts/lib/ue-gate0-update-lock.mjs [--checkpoint <commit>]
 *
 * --checkpoint records a commit a reviewer accepted: the lock as it stood at that commit is read from git history and
 * every id in it must stay in the lock. Every other new matrix capability is added with a provenance record proved by
 * a frozen tranche. The script refuses to write a lock the validator would reject, so the lock is never edited by hand.
 * Build order: ue-gate0-build-matrix.mjs, the tranche builder, this script, then ue-gate0-build-matrix.mjs again.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES_0B1 } from './ue-gate0b1-classification.mjs'
import { FILES_0B2 } from './ue-gate0b2-classification.mjs'
import { FILES_0B3 } from './ue-gate0b3-classification.mjs'
import { FILES_0B4 } from './ue-gate0b4-classification.mjs'
import { FILES_0B5 } from './ue-gate0b5-classification.mjs'
import { FILES_0B6 } from './ue-gate0b6-classification.mjs'
import { FILES_0B7 } from './ue-gate0b7-classification.mjs'
import { FILES_0B8 } from './ue-gate0b8-classification.mjs'
import { FILES } from './ue-gate0-scope-lock.mjs'
import { lockProvenanceProblems, updatedLock, lockVersionFor } from './ue-gate0-lock-provenance.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const readJson = (file) => JSON.parse(readFileSync(join(ROOT, file), 'utf8'))
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

export function updateLock({ checkpoint } = {}) {
  let lock = readJson(FILES.lock)
  const matrix = readJson(FILES.matrix)
  const matrixById = new Map(matrix.capabilities.map((capability) => [capability.id, capability]))
  const tranches = [FILES_0B1, FILES_0B2, FILES_0B3, FILES_0B4, FILES_0B5, FILES_0B6, FILES_0B7, FILES_0B8].map((files) => {
    const manifest = readJson(files.manifest)
    return { tranche: manifest.tranche, manifest, classification: readJson(files.classification) }
  })
  if (checkpoint) {
    if (!/^[0-9a-f]{40}$/.test(checkpoint)) throw new Error('a checkpoint must be a full 40-character commit id')
    git(['cat-file', '-e', `${checkpoint}^{commit}`])
    if (!(lock.checkpoints ?? []).some((item) => item.commit === checkpoint)) {
      lock = { ...lock, checkpoints: [...(lock.checkpoints ?? []), { commit: checkpoint, note: 'The lock at this commit was accepted by review. Every capability id it holds stays in the lock unless a versioned retirement removes it.' }] }
    }
  }
  const checkpointIds = Object.fromEntries((lock.checkpoints ?? []).map((item) => [item.commit, JSON.parse(git(['show', `${item.commit}:${FILES.lock}`])).capabilityIds]))
  const anchorIds = JSON.parse(git(['show', `${lock.anchorCommit}:${lock.anchorMatrixPath ?? FILES.matrix}`])).capabilities.map((capability) => capability.id)
  const next = updatedLock({ lock, matrixIds: matrixById.keys(), anchorIds, checkpointIds, tranches, matrixById })
  const problems = lockProvenanceProblems({
    lock: next,
    byId: matrixById,
    anchorIds,
    checkpointIds,
    tranches,
    deps: { commitExists: (sha) => { try { git(['cat-file', '-e', `${sha}^{commit}`]); return true } catch { return false } }, exists: (file) => { try { readFileSync(join(ROOT, file)); return true } catch { return false } } },
  })
  if (problems.length > 0) throw new Error(`the updated lock would not validate:\n${problems.join('\n')}`)
  const text = `${JSON.stringify(next, null, 2)}\n`
  const path = join(ROOT, FILES.lock)
  if (readFileSync(path, 'utf8') !== text) writeFileSync(path, text)
  return { lockVersion: next.lockVersion, capabilities: next.capabilityIds.length, additions: (next.additions ?? []).length, checkpoints: (next.checkpoints ?? []).length, expectedVersion: lockVersionFor(next) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--checkpoint')
  console.log(JSON.stringify(updateLock({ checkpoint: index >= 0 ? process.argv[index + 1] : undefined }), null, 2))
}
