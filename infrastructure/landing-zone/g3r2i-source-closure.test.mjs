import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { activationGate, validateParameters } from './g3-source/controllers/local-plan.mjs'
import { builderDigest, sourceDigests } from './g3r2i-local-qualification.mjs'
import { evidence, files, frozen, hash, read, root, source, verify } from './g3r2i-preservation.mjs'
import { check, main } from './g3r2i-source-closure.mjs'

const qualification = read(path.join(evidence, 'G3R2I_IMAGE_QUALIFICATION.json'))
const manifest = read(path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.json'))
const proof = read(path.join(source, 'proof', 'G3_PROOF_MANIFEST.json'))
const negatives = read(path.join(source, 'proof', 'G3_NEGATIVE_PROBES.json'))
const build = read(path.join(evidence, 'G3R2I_LOCAL_BUILD_EVIDENCE.json'))
const text = (name) => readFileSync(path.join(source, name), 'utf8')

test('rejected candidate, frozen evidence, all original source and G2 bytes preserved', () => {
  const baseline = verify()
  assert.equal(baseline.CURRENT_CANDIDATE_BYTES_CHANGED, 'NO')
  assert.equal(baseline.candidate.length, 4)
  assert.equal(baseline.historicalEvidence.length, 255)
  assert.equal(read(path.join(evidence, 'G3R2_SOURCE_AUTHORITY_CLOSURE.json')).G3R2_GATE, 'BLOCKED')
  assert.equal(
    read(path.join(frozen, 'G3_SOURCE_AUTHORITY_MANIFEST.json')).IMAGE_SOURCE.decision,
    'BLOCKED',
  )
})
test('new source and context digests bind exact qualified inputs', () => {
  assert.deepEqual(qualification.SOURCE_DIGESTS, sourceDigests())
  assert.equal(qualification.IMAGE_AUTHORITY_ID, 'G3_SYNTHETIC_PROOF_V1')
  assert.equal(qualification.SOURCE_LINEAGE, 'PROSPECTIVE_G3R2_IMAGE_QUALIFICATION')
  assert.equal(qualification.SOURCE_DIGESTS.GO_SUM_STATUS, 'NOT_REQUIRED_STANDARD_LIBRARY_ONLY')
  assert.deepEqual(qualification.SOURCE_DIGESTS.buildContext.map((entry) => entry.path).sort(), [
    '.dockerignore',
    'Dockerfile',
    'go.mod',
    'main.go',
    'main_test.go',
  ])
})
test('compiler manifest verified by raw public bytes; runtime scratch and no prebuilt binary', () => {
  const dockerfile = text('workload/synthetic-proof/Dockerfile')
  const from = dockerfile.split(/\r?\n/).filter((line) => line.startsWith('FROM '))
  assert.deepEqual(from, [
    `FROM docker.io/library/golang@${builderDigest} AS compiler`,
    'FROM scratch AS runtime',
  ])
  assert(dockerfile.includes('COPY --from=compiler /out/proof-server-a /proof-server'))
  assert(!dockerfile.includes('COPY health-server'))
  assert(dockerfile.includes('USER 65532:65532'))
  assert.equal(qualification.BUILD_TOOLCHAIN.compilerVersion, 'go version go1.26.9 linux/amd64')
  assert.equal(
    qualification.PUBLIC_READ_PROVENANCE.builderManifestRead.verifiedBytesSha256,
    builderDigest.slice(7),
  )
  assert.deepEqual(
    qualification.PUBLIC_READ_PROVENANCE.boundedVersionVulnerabilityCheck.advisories,
    [],
  )
})
test('both full source compilations produce identical binary bytes/digests', () => {
  const binary = qualification.BINARY_REPRODUCIBILITY
  assert.equal(binary.REPEAT_BINARY_SHA256_MATCH, 'YES')
  assert.equal(binary.firstSha256, binary.secondSha256)
  assert(binary.binaryBytes > 0)
  assert.equal(binary.independentInvocations, 2)
  const dockerfile = text('workload/synthetic-proof/Dockerfile')
  assert.equal(
    (dockerfile.match(/go build -a -trimpath -buildvcs=false -ldflags="-s -w -buildid="/g) ?? [])
      .length,
    2,
  )
  assert(dockerfile.includes('cmp /out/proof-server-a /out/proof-server-b'))
})
for (const key of [
  'LOCAL_BUILD_RESULT',
  'LOCAL_RUNTIME_RESULT',
  'LOCAL_HEALTH_RESULT',
  'LOCAL_SECRET_OBSERVER_PROOF',
])
  test(`verified local-only qualification:${key}`, () => assert.equal(qualification[key], 'PASS'))
test('local image/config is not future registry authority', () => {
  assert.equal(qualification.LOCAL_IMAGE_ID, qualification.LOCAL_IMAGE_CONFIG_DIGEST)
  assert(/^sha256:[a-f0-9]{64}$/.test(qualification.LOCAL_IMAGE_ID))
  assert.equal(qualification.FUTURE_ACR_IMAGE_DIGEST, 'REQUIRED_AFTER_AUTHORIZED_BUILD_AND_PUSH')
  assert.equal(manifest.FUTURE_IMMUTABLE_REGISTRY_DIGEST, 'REQUIRED')
})
test('runtime is actually nonroot read-only with no network/host port and graceful shutdown', () => {
  assert.equal(qualification.runtimeUid, 65532)
  assert.equal(qualification.runtimeGid, 65532)
  assert.equal(qualification.readOnlyRootFilesystem, true)
  assert(qualification.networkMode.startsWith('none;'))
  assert.equal(qualification.hostBinding, 'NONE_NO_PUBLISHED_PORT')
  assert.deepEqual(qualification.listeningPorts, [3000])
  assert.equal(qualification.gracefulSigterm, 'PASS')
})
test('local challenge records only allowed fake proof metadata, not raw keys', () => {
  assert.equal(qualification.FAKE_SECRET_DISCLOSED, 'NO')
  assert.equal(qualification.MISSING_SECRET_BEHAVIOR, 'PASS_GENERIC_503')
  assert.equal(qualification.WRONG_SECRET_BEHAVIOR, 'PASS_EXPECTED_PROOF_MISMATCH')
  for (const artifact of qualification.localChallengeArtifacts) {
    assert.equal(artifact.expectedProofDigest, artifact.observedProofDigest)
    assert.equal(artifact.nonce.length, 43)
    assert.equal(artifact.httpStatus, 200)
    assert.equal(artifact.rawSecretRetained, false)
    assert.equal(artifact.secretLogicalId, 'FAKE_LOCAL_ONLY')
    assert.equal(artifact.imageRegistryDigest, 'REQUIRED_AFTER_AUTHORIZED_BUILD_AND_PUSH')
    assert(!('secret' in artifact))
  }
})
test('proof manifest binds implemented exact HMAC protocol and future safe artifact contract', () => {
  assert.equal(proof.secretChallenge.implementedObserver, true)
  assert.equal(proof.secretChallenge.algorithm, 'HMAC-SHA256')
  assert.equal(proof.secretChallenge.request.maximumBodyBytes, 256)
  assert.equal(proof.secretChallenge.request.rejectUnknownOrDuplicateProperties, true)
  assert.equal(proof.secretChallenge.responseShape.protocol, 'g3-secret-proof-v1')
  assert(proof.secretChallenge.message.includes('not decoded'))
  assert(proof.secretChallenge.verificationAlgorithm.includes('constant-time'))
  assert.equal(proof.secretChallenge.liveExecution, 'NOT_EXECUTED')
  assert.equal(proof.secretChallenge.evidenceToRetain.length, 9)
  assert(proof.secretChallenge.neverRetain.includes('raw secret'))
  assert.equal(proof.secretBinding.ENVIRONMENT_BINDING_NAME, 'G3_PROOF_SECRET')
  assert.equal(proof.secretBinding.SECRET_VALUE_IN_REPOSITORY, 'NO')
})
for (const id of [
  'RUNTIME_WITHOUT_SECRET_PROOF_DENIED',
  'WRONG_SECRET_PROOF_MISMATCH',
  'UNAUTHORIZED_PRINCIPAL_CANNOT_RETRIEVE_RUNTIME_SECRET',
  'BUILD_CANNOT_READ_RUNTIME_SECRET',
  'RUNTIME_CANNOT_PUSH_IMAGE',
  'PUBLIC_PATH_CANNOT_REACH_PRIVATE_WORKLOAD',
  'WORKLOAD_DENIED_BEFORE_CAPACITY_GATE',
])
  test(`negative proof contract:${id}`, () => {
    const probe = negatives.probes.find((item) => item.id === id)
    assert(probe?.acceptance)
    assert(probe.expectedUnexpectedSuccessHandling.startsWith('STOP'))
    assert(probe.execution.startsWith('NOT_EXECUTED'))
  })
test('all ten negative probes retain independent cloud controls without executed Azure claims', () => {
  assert.equal(negatives.probes.length, 10)
  assert.equal(proof.negativeProbeCount, 10)
  assert.equal(new Set(negatives.probes.map((probe) => probe.id)).size, 10)
})
for (const entry of build.entries)
  test(`source-to-local-Bicep-template binding:${entry.source}`, () => {
    assert.equal(hash(readFileSync(path.join(source, entry.source))), entry.sourceSha256)
    assert.equal(hash(readFileSync(path.join(source, entry.templatePath))), entry.templateSha256)
    assert.equal(entry.result, 'PASS')
    assert.equal(entry.stderr, '')
    const arm = read(path.join(source, entry.templatePath))
    for (const [name, parameter] of Object.entries(arm.parameters ?? {})) {
      if (/Authorized|provisionResources/.test(name)) {
        assert.deepEqual(parameter.allowedValues, [false])
        assert.equal(parameter.defaultValue, false)
      }
    }
  })
test('workload immutable image denial, secret binding and health route are integrated', () => {
  const module = text('modules/workload.bicep')
  assert(module.includes('workloadActivationAuthorized && immutableImageValid'))
  assert(module.includes('length(digest) == 64'))
  assert(module.includes('length(immutableImage) == length(imagePrefix) + 64'))
  assert(module.includes("'0123456789abcdef'"))
  assert(module.includes('image: immutableImage'))
  assert(module.includes("name: 'g3-synthetic-proof-v1'"))
  assert.equal((module.match(/path: '\/healthz'/g) ?? []).length, 2)
  assert(module.includes("name: 'G3_PROOF_SECRET', secretRef: 'g3-proof-secret'"))
  assert(module.includes('keyVaultUrl:'))
  assert(!module.includes('value:'))
  assert(text('main.bicep').includes('availableConsumptionMilliCores >= 250'))
  const example = read(path.join(source, 'parameters.example.json')).parameters
  assert.equal(validateParameters(example).executionAllowed, false)
  const evidence = {
    explicitHumanWorkloadAuthority: true,
    environmentId: 'same',
    quotaEnvironmentId: 'same',
    quotaEvidenceId: 'local-only',
    availableConsumptionMilliCores: 250,
    imageSourceQualified: true,
  }
  for (const immutableImage of [
    '',
    'nzilag2tzo75uuozprbo.azurecr.io/g3-synthetic-runtime:latest',
    `nzilag2tzo75uuozprbo.azurecr.io/g3-synthetic-runtime@sha256:${'g'.repeat(64)}`,
  ])
    assert.equal(activationGate({ ...evidence, immutableImage }), 'DENY')
  assert.equal(
    activationGate({
      ...evidence,
      availableConsumptionMilliCores: 249,
      immutableImage: `nzilag2tzo75uuozprbo.azurecr.io/g3-synthetic-runtime@sha256:${'a'.repeat(64)}`,
    }),
    'DENY',
  )
})
test('BOM and runtime quantity/cost assumptions preserved; future costs not closed', () => {
  const impact = qualification.costModelImpact
  assert.equal(impact.bomSha256, impact.priorBomSha256)
  assert.equal(impact.resources, 23)
  assert.equal(impact.inlineSubnets, 3)
  assert.equal(impact.scenarios.length, 5)
  assert(impact.scenarios.every((scenario) => scenario.completeTotalCAD === null))
  assert.equal(impact.fullProofCeiling, 'UNRESOLVED')
  assert.equal(impact.humanCeiling, 'UNBOUND')
  assert.equal(impact.futureUnresolvedCosts.length, 4)
  const actualTypes = build.entries
    .flatMap((entry) => read(path.join(source, entry.templatePath)).resources ?? [])
    .filter((resource) => resource.type !== 'Microsoft.Resources/deployments')
    .map((resource) => resource.type)
    .sort()
  const bom = read(path.join(source, 'G3_BILL_OF_MATERIALS.json'))
  assert.deepEqual(bom.resources.map((resource) => resource.resourceType).sort(), actualTypes)
})
test('scanner covers source and every new tooling file without suppression', () => {
  const scanner = read(path.join(evidence, 'G3R2I_SECRET_SCAN.json'))
  assert.equal(scanner.UNRESOLVED_SECRET_FINDINGS, 0)
  assert.equal(scanner.generatedSuppressionOrAllowlist, false)
  assert.equal(scanner.scannerConfigurationChanged, false)
  assert.equal(scanner.rawSourceFindings, scanner.exactFalsePositiveAdjudications.length)
  assert.equal(scanner.rawSourceScannerExit, scanner.rawSourceFindings ? 1 : 0)
  assert.deepEqual(
    scanner.sourceScanFiles,
    files(source).filter((entry) => !entry.path.startsWith('build/')),
  )
  const expectedTooling = files(root).filter(
    (entry) => !entry.path.includes('/') && /^g3r2i.*\.mjs$/.test(entry.path),
  )
  assert.deepEqual(scanner.toolingScanFiles, expectedTooling)
})
test('ROOT-1 prospectively closes but deployment, humans, G2 and ceiling remain unapproved', () => {
  assert.equal(qualification.ROOT_1_SOURCE_AUTHORITY, 'CLOSED_BY_PROSPECTIVE_SUPERSESSION')
  assert.equal(qualification.G3R2I_GATE, 'PASS')
  assert.equal(qualification.G3R2, 'PASS')
  assert.equal(qualification.remainingRoots.length, 3)
  assert.equal(qualification.G3_EXECUTION_READINESS, 'BLOCKED')
  assert.equal(qualification.G3A, 'NOT_AUTHORIZED')
  assert.equal(qualification.G3B, 'NOT_AUTHORIZED')
  assert.equal(manifest.HISTORICAL_RECOVERED_MODULE_COUNT, 0)
  assert.equal(manifest.QUALIFIED_IMAGE_SOURCE, 'G3_SYNTHETIC_PROOF_V1')
  assert.equal(manifest.IMAGE_SOURCE_STATUS, 'QUALIFIED_LOCAL_SOURCE_NOT_PUSHED')
  assert.equal(manifest.NEW_CANONICAL_MODULE_COUNT, 8)
})
for (const [boundary, value] of Object.entries(qualification.proofBoundaries))
  test(`exact authorized boundary:${boundary}`, () =>
    assert.equal(
      value,
      boundary.startsWith('LOCAL_') ? 'YES' : typeof value === 'number' ? 0 : 'NO',
    ))
test('full persisted package/hash check never invokes controller, build or Azure', () =>
  assert.equal(
    check().status,
    'PASS_LOCAL_SOURCE_BUILD_PROOF_SCANNER_PRESERVATION_AND_OUTPUT_BINDING',
  ))
for (const flag of [
  '--deploy',
  '--push',
  '--azure-build',
  '--controller',
  '--grant',
  '--execute',
  '--build-image',
])
  test(`closure rejects unauthorized flag:${flag}`, async () =>
    await assert.rejects(main([flag]), /G3R2I_LOCAL_CLOSURE_FLAGS_ONLY/))
