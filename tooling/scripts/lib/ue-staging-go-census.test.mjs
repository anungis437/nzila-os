import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const generator = path.join(root, 'tooling/scripts/build-ue-staging-go-census.mjs')
const censusFile = path.join(root, 'docs/union-eyes/staging/UE_GATE0_QUALIFICATION_CENSUS.json')
const contractFile = path.join(root, 'docs/union-eyes/staging/UE_STAGING_GO_CONTRACT.json')

function generate() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-census-test-'))
  try {
    execFileSync(process.execPath, [generator, '--output-directory', directory, '--initialize-contract'], { cwd: root, stdio: 'pipe' })
    const censusPath = path.join(directory, path.basename(censusFile))
    const contractPath = path.join(directory, path.basename(contractFile))
    return {
      censusBytes: fs.readFileSync(censusPath), contractBytes: fs.readFileSync(contractPath),
      census: JSON.parse(fs.readFileSync(censusPath, 'utf8')), contract: JSON.parse(fs.readFileSync(contractPath, 'utf8')),
    }
  } finally { fs.rmSync(directory, {recursive: true, force: true}) }
}

test('census regeneration preserves live evidence and refuses to reinitialize an existing contract', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-evidence-preservation-test-'))
  const target = path.join(directory, path.basename(contractFile))
  const observed = '{"verdict":"STAGING_NO_GO","observedReceipt":"keep-actual-evidence"}\n'
  try {
    fs.writeFileSync(target, observed)
    execFileSync(process.execPath, [generator, '--output-directory', directory], {cwd: root, stdio: 'pipe'})
    assert.equal(fs.readFileSync(target, 'utf8'), observed)
    assert.throws(() => execFileSync(process.execPath, [generator, '--output-directory', directory, '--initialize-contract'], {cwd: root, stdio: 'pipe'}))
    assert.equal(fs.readFileSync(target, 'utf8'), observed)
  } finally { fs.rmSync(directory, {recursive: true, force: true}) }
})

test('staging census is deterministic and preserves frozen Gate 0 accounting', () => {
  const first = generate()
  const second = generate()
  assert.deepEqual(first.censusBytes, second.censusBytes)
  assert.deepEqual(first.contractBytes, second.contractBytes)
  assert.equal(first.census.frozenPopulation, 777)
  assert.equal(first.census.defects.length, 777)
  assert.equal(first.census.summary.sourceImplemented, 777)
  assert.equal(first.census.summary.partial, 0)
  assert.equal(first.census.summary.engineeringOutstanding, 0)
  assert.equal(first.census.summary.independentlyQualificationVerified, 0)
  assert.equal(first.census.summary.formallyClosed, 0)
  assert.equal(first.census.summary.directLedgerEvidence, 730)
  assert.equal(first.census.summary.creditedByEarlierRuns, 47)
  assert.equal(first.census.summary.earlierRunCreditsWithoutIndependentRegressionEvidence, 0)
  assert.equal(first.census.summary.earlierRunEvidenceGapsResolvedInB172, 24)
  assert.equal(first.census.summary.traceabilityOnlyBatchLabelDifferences, 56)
  assert.ok(first.census.defects.every(defect => defect.acceptance.formallyClosed === false))
})

test('staging contract fails closed without real deployment evidence', () => {
  const { contract } = generate()
  assert.equal(contract.verdict, 'STAGING_NO_GO')
  assert.equal(contract.boundaries.productionAuthorized, false)
  assert.equal(contract.boundaries.mergeAuthorizedByThisContract, false)
  assert.ok(contract.criteria.some(item => item.id === 'AUTHORIZED_STAGING_DEPLOYMENT' && item.status === 'NOT_PROVEN'))
  assert.ok(contract.criteria.some(item => item.id === 'API_AND_POSTGRES_TENANT_ISOLATION' && item.status === 'NOT_PROVEN'))
  assert.ok(contract.externalBlockers.every(item => item.engineeringBypassPermitted === false))
})

test('every defect retains the direct-scoped authority rule and a runtime qualification class', () => {
  const { census } = generate()
  for (const defect of census.defects) {
    assert.equal(defect.securityPrivacy.issue1116Rule, 'DIRECT_SPECIFIC_AUTHORITY_NO_PLATFORM_OR_HIERARCHY_TENANT_CONTENT_BYPASS')
    assert.match(defect.acceptance.runtimeEvidenceClass, /^[A-Z_]+$/)
    assert.equal(defect.acceptance.stagingBlockingClassification, 'STAGING_BLOCKING_UNTIL_DEPLOYED_QUALIFICATION')
  }
})
