/**
 * Test support: the registers of an accepted route-classification tranche, read from the commit that accepted it.
 * A historical tranche test builds its validator input from these, so it keeps proving the counts, identities and
 * classifications the tranche was accepted with, and a later tranche cannot change what the test proves. Only the
 * cumulative test reads the current registers.
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES_0B1 } from './ue-gate0b1-classification.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

export const ACCEPTED = {
  '0B.1': '8480b8899c49d313e8f1254637255674a1c1e4be',
  '0B.2': 'e38eee48d8dbc7b4dddddeb4974ca4067213117a',
  '0B.3': '6dcc66d292d9a10f3713691a93009e7dc82bd610',
  '0B.4': '64d45940c34890eef41cc86c017d99b484dbf71c',
  '0B.5': '00de050b86e1014854e38fc34f51b4c7c85ed747',
  '0B.6': 'cab380c61301152b604f4161d00d14ce81584045',
  '0B.7': '32ae5951ef08eefecae73c0e08c88a70f184026d',
}

const OWNERSHIP = 'docs/union-eyes/convergence/register/ue-route-capability-ownership.json'
const MATRIX = 'docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json'

export const fileAt = (commit, file) => execFileSync('git', ['show', `${commit}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
export const jsonAt = (commit, file) => JSON.parse(fileAt(commit, file))
export const ownershipEntriesAt = (commit) => jsonAt(commit, OWNERSHIP).entries
export const ledgerAt = (commit) => jsonAt(commit, FILES_0B1.ledger)
export const matrixAt = (commit) => jsonAt(commit, MATRIX)

export function countsAt(commit) {
  const entries = ownershipEntriesAt(commit)
  return {
    operations: entries.length,
    owned: entries.filter((entry) => entry[4] === 'OWNED').length,
    undecided: entries.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').length,
    classified: Object.keys(ledgerAt(commit).classified).length,
  }
}
