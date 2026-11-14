import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { infrastructureProvenance } from './lib/union-eyes-v2-staging-release.mjs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.GITHUB_REF, 'refs/heads/main')
assert.equal(git('rev-parse', 'HEAD'), process.env.GITHUB_SHA)
git('diff', '--exit-code', 'HEAD', '--', 'infrastructure/bicep/ue-v2')
git('merge-base', '--is-ancestor', process.env.SOURCE_SHA, process.env.GITHUB_SHA)
const observed = infrastructureProvenance({ applicationSourceSha: process.env.SOURCE_SHA, workflowSha: process.env.GITHUB_SHA, infrastructureTreeSha: git('rev-parse', 'HEAD:infrastructure/bicep/ue-v2'), templateSha256: createHash('sha256').update(readFileSync(process.env.TEMPLATE)).digest('hex') })
if (process.argv[2] === '--record') writeFileSync(process.argv[3], JSON.stringify(observed, null, 2) + '\n')
else {
  assert.equal(process.argv[2], '--verify')
  assert.deepEqual(JSON.parse(readFileSync(process.argv[3], 'utf8')), observed, 'Admitted infrastructure or image provenance changed after plan')
}
console.log(JSON.stringify({ status: 'PASS', ...observed }))
