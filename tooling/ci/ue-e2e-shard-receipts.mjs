/** Run-local E2E evidence. Missing, duplicate, failed or foreign receipts fail closed. */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const SHA = /^[a-f0-9]{40}$/
const REPOSITORY = 'anungis437/nzila-os'
const keys = ['version','kind','repository','headSha','headTree','runId','runAttempt','mode','shard','totalShards','status','outcomes','observedAt']
const exact = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...expected].sort().join('|')
const positive = value => Number.isSafeInteger(value) && value > 0

function identity(expected) {
  if (expected.repository !== REPOSITORY || !SHA.test(expected.headSha ?? '') || !SHA.test(expected.headTree ?? '') || !positive(expected.runId) || !positive(expected.runAttempt) || !['synthetic-pr','canonical-main'].includes(expected.mode)) throw new Error('Invalid frozen E2E identity')
}

export function createWorkerReceipt(input) {
  identity(input)
  if (!Number.isInteger(input.shard) || input.shard < 1 || input.shard > 4 || !exact(input.outcomes, ['job','build','playwright','performance'])) throw new Error('Invalid shard identity/outcomes')
  const performance = input.mode === 'synthetic-pr' && input.shard === 1 ? 'success' : 'not-required'
  const passed = input.outcomes.job === 'success' && input.outcomes.build === 'success' && input.outcomes.playwright === 'success' && input.outcomes.performance === performance
  const receipt = Object.fromEntries(['repository','headSha','headTree','runId','runAttempt','mode','shard'].map(key => [key,input[key]]))
  return { version: 1, kind: 'ue-e2e-worker', ...receipt, totalShards: 4, status: passed ? 'success' : 'failure', outcomes: { ...input.outcomes }, observedAt: new Date().toISOString() }
}

export function validateShardReceipts(receipts, expected) {
  identity(expected)
  if (!Array.isArray(receipts) || receipts.length !== 4) throw new Error('Exactly four Union Eyes shard receipts required')
  const shards = new Set()
  for (const receipt of receipts) {
    if (!exact(receipt, keys) || receipt.version !== 1 || receipt.kind !== 'ue-e2e-worker' || receipt.totalShards !== 4 || !Number.isInteger(receipt.shard) || receipt.shard < 1 || receipt.shard > 4 || shards.has(receipt.shard)) throw new Error('Missing, duplicate or unexpected Union Eyes shard')
    shards.add(receipt.shard)
    for (const name of ['repository','headSha','headTree','runId','runAttempt','mode']) if (receipt[name] !== expected[name]) throw new Error(`Foreign E2E receipt identity: ${name}`)
    if (!exact(receipt.outcomes, ['job','build','playwright','performance']) || receipt.status !== 'success' || createWorkerReceipt({ ...expected, shard: receipt.shard, outcomes: receipt.outcomes }).status !== 'success') throw new Error(`Union Eyes shard did not pass: ${receipt.shard}`)
    const observed = Date.parse(receipt.observedAt)
    if (!Number.isFinite(observed) || observed > Date.now() + 5 * 60 * 1000) throw new Error('Invalid shard observation time')
  }
  return { version: 1, kind: 'ue-e2e-aggregate', ...expected, status: 'success', workers: receipts.slice().sort((a,b) => a.shard-b.shard) }
}

export const artifactName = (expected, shard) => `ue-e2e-worker-${expected.runId}-${expected.runAttempt}-${shard}`

export function requireMatrixSuccess(result) {
  if (result !== 'success') throw new Error('Selected E2E matrix did not complete successfully, including job cleanup')
}

export function readShardReceipts(directory, expected) {
  identity(expected)
  const names = fs.readdirSync(directory)
  const wanted = [1,2,3,4].map(shard => artifactName(expected,shard))
  if (names.length !== 4 || wanted.some(name => !names.includes(name))) throw new Error('Missing or unexpected run-local shard artifacts')
  const receipts = wanted.map((name,index) => {
    const folder = path.join(directory,name)
    const stat = fs.lstatSync(folder)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Invalid shard artifact directory')
    const files = fs.readdirSync(folder)
    if (files.length !== 1 || files[0] !== 'receipt.json') throw new Error('Each shard artifact must contain exactly one receipt')
    const file = path.join(folder,'receipt.json'), fileStat = fs.lstatSync(file)
    if (!fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.size > 16384) throw new Error('Invalid shard receipt file')
    const receipt = JSON.parse(fs.readFileSync(file,'utf8'))
    if (receipt.shard !== index + 1) throw new Error('Artifact name and shard differ')
    return receipt
  })
  return validateShardReceipts(receipts,expected)
}

export function main(args = process.argv.slice(2), env = process.env) {
  const [mode,input,output] = args
  if (!['write','verify'].includes(mode) || !input || (mode === 'verify' ? args.length !== 3 : args.length !== 2)) throw new Error('Usage: ue-e2e-shard-receipts.mjs write <receipt.json> | verify <artifact-directory> <aggregate.json>')
  const git = (...flags) => execFileSync('git',flags,{encoding:'utf8'}).trim()
  const expected = { repository: env.GITHUB_REPOSITORY, headSha: env.UE_EXPECTED_HEAD, headTree: git('rev-parse','HEAD^{tree}'), runId: Number(env.GITHUB_RUN_ID), runAttempt: Number(env.GITHUB_RUN_ATTEMPT), mode: env.UE_E2E_MODE }
  identity(expected)
  if (git('rev-parse','HEAD') !== expected.headSha) throw new Error('E2E source checkout differs from frozen head')
  if (mode === 'verify') requireMatrixSuccess(env.UE_MATRIX_RESULT)
  const result = mode === 'write'
    ? createWorkerReceipt({ ...expected, shard: Number(env.UE_SHARD), outcomes: { job: env.UE_JOB_STATUS, build: env.UE_BUILD_OUTCOME, playwright: env.UE_PLAYWRIGHT_OUTCOME, performance: env.UE_PERFORMANCE_OUTCOME } })
    : readShardReceipts(input,expected)
  const file = mode === 'write' ? input : output
  fs.mkdirSync(path.dirname(file),{recursive:true})
  fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
  console.log(JSON.stringify(result))
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main()
