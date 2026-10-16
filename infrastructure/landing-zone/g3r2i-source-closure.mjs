import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { evidence, files, frozen, hash, read, root, source, verify } from './g3r2i-preservation.mjs'
import { builderDigest, sourceDigests } from './g3r2i-local-qualification.mjs'
import { scan } from './g3r2i-secret-scan.mjs'

const lineage = 'PROSPECTIVE_G3R2_IMAGE_QUALIFICATION'
const authority = 'G3_SYNTHETIC_PROOF_V1'
const config = await resolveConfig(path.join(root, '..', '..', 'package.json'))
async function json(directory, name, value) {
  writeFileSync(
    path.join(directory, name),
    await format(JSON.stringify(value), { ...config, parser: 'json' }),
  )
}
function sourceFiles() {
  return files(source).filter(
    (entry) =>
      !entry.path.startsWith('build/') && !entry.path.startsWith('G3_SOURCE_AUTHORITY_MANIFEST.'),
  )
}
function executionRecord() {
  const execution = read(path.join(evidence, 'G3R2I_LOCAL_EXECUTION.json'))
  assert.deepEqual(execution.SOURCE_DIGESTS, sourceDigests(), 'QUALIFIED_SOURCE_BYTES_CHANGED')
  for (const key of [
    'LOCAL_BUILD_RESULT',
    'LOCAL_RUNTIME_RESULT',
    'LOCAL_HEALTH_RESULT',
    'LOCAL_SECRET_OBSERVER_PROOF',
  ])
    assert.equal(execution[key], 'PASS', `LOCAL_QUALIFICATION_REQUIRED:${key}`)
  assert.equal(execution.FAKE_SECRET_DISCLOSED, 'NO')
  assert.equal(execution.BINARY_REPRODUCIBILITY.REPEAT_BINARY_SHA256_MATCH, 'YES')
  assert.equal(execution.BASE_IMAGE_DIGESTS.BUILDER_BASE_DIGEST, builderDigest)
  assert.equal(execution.IMAGE_PUSHED, 'NO')
  assert.equal(execution.AZURE_MUTATIONS, 0)
  return execution
}
async function proofContracts() {
  const previous = read(path.join(frozen, 'proof', 'G3_PROOF_MANIFEST.json'))
  const proof = {
    ...previous,
    amendmentLineage: lineage,
    imageSourceAuthority: authority,
    specificationReadiness: 'COMPLETE_LOCAL_PROTOCOL;LIVE_AZURE_PROOFS_NOT_EXECUTED',
    secretChallenge: {
      protocol: 'g3-secret-proof-v1',
      endpoint: 'POST /proof/secret',
      nonceGeneration:
        '32 CSPRNG bytes encoded canonical unpadded base64url;exactly 43 ASCII characters',
      request: {
        contentType: 'application/json;optional charset=utf-8',
        shape: { nonce: '<43-character canonical base64url>' },
        maximumBodyBytes: 256,
        rejectUnknownOrDuplicateProperties: true,
      },
      algorithm: 'HMAC-SHA256',
      key: 'UTF-8 platform-injected high-entropy synthetic secret;never retained',
      message: 'UTF-8 encoded nonce string;not decoded nonce bytes',
      responseShape: {
        protocol: 'g3-secret-proof-v1',
        algorithm: 'HMAC-SHA256',
        proof: '<64 lowercase hexadecimal characters>',
      },
      verificationAlgorithm:
        'Compute expected HMAC independently;decode expected/observed hex and compare constant-time;wrong secret must mismatch',
      nonDisclosureAssertions: [
        'No raw secret or length/prefix/suffix',
        'No environment/token/path/URI details',
        'No nonce in runtime logs',
        'No sensitive metrics',
        'No raw secret in retained evidence',
      ],
      failureBehavior: {
        missingSecret: '503 generic unavailable',
        invalidNonceOrBodyOrContentType: '400 generic invalid_request',
        unexpectedMethod: '405 generic method_not_allowed',
        unexpectedRoute: '404 generic not_found',
      },
      implementedObserver: true,
      localResult: 'PASS_FAKE_MATERIAL_ONLY',
      liveExecution: 'NOT_EXECUTED',
      evidenceToRetain: [
        'nonce',
        'expected proof digest',
        'observed proof digest',
        'HTTP status',
        'timestamp',
        'authorized registry image digest',
        'runtime revision',
        'secret logical ID',
        'secret version identifier if safely obtainable',
      ],
      neverRetain: ['raw secret', 'identity token', 'full environment/container inspect'],
      authorizationLimit:
        'HMAC proves injected-value possession only;Key Vault injection,managed identity,RBAC and private paths require separate future live proofs',
      secretEntropyRequirement:
        'Human-authorized CSPRNG-generated high-entropy synthetic secret;HMAC permits offline guesses against weak keys',
    },
    secretBinding: {
      SECRET_LOGICAL_ID: 'g3-proof-secret',
      CONTAINER_SECRET_REFERENCE: 'g3-proof-secret',
      ENVIRONMENT_BINDING_NAME: 'G3_PROOF_SECRET',
      CONSUMER: 'G3_RUNTIME_IDENTITY / G3_SYNTHETIC_PROOF_V1',
      VALUE_SOURCE: 'KEY_VAULT_OR_AUTHORIZED_SECRET_INJECTION',
      SECRET_VALUE_IN_REPOSITORY: 'NO',
      identityLifecycle: 'Main;build-slot platform-pull identity None',
    },
    imageBinding:
      'Future nzilag2tzo75uuozprbo.azurecr.io/g3-synthetic-runtime@sha256:<authorized registry manifest digest>;local config digest prohibited as authority',
    healthEndpoint: 'GET /healthz',
    negativeProbeCount: 10,
  }
  const priorNegatives = read(path.join(frozen, 'proof', 'G3_NEGATIVE_PROBES.json'))
  const additional = [
    [
      'RUNTIME_WITHOUT_SECRET_PROOF_DENIED',
      'Valid nonce;runtime absent injected secret;HTTP503 generic unavailable;no source/value disclosure',
      'PASS_LOCAL_APP_ONLY',
    ],
    [
      'WRONG_SECRET_PROOF_MISMATCH',
      'Valid nonce;different fake key produces HMAC mismatch against expected key;no false health200 inference',
      'PASS_LOCAL_APP_ONLY',
    ],
    [
      'UNAUTHORIZED_PRINCIPAL_CANNOT_RETRIEVE_RUNTIME_SECRET',
      'Known existing secret,private TLS connectivity control,unauthorized principal;explicit authorization403 not timeout/404',
      'NOT_EXECUTED',
    ],
    [
      'PUBLIC_PATH_CANNOT_REACH_PRIVATE_WORKLOAD',
      'Independent public-origin DNS/network denial for INTERNAL environment/workload;not RBAC403 inference',
      'NOT_EXECUTED',
    ],
  ].map(([id, acceptance, localResult]) => ({
    id,
    acceptance,
    localResult,
    execution: 'NOT_EXECUTED_IN_AZURE',
    expectedUnexpectedSuccessHandling:
      'STOP;preserve sanitized evidence;contain/revoke only within explicit separate authority;never continue proof',
  }))
  await json(path.join(source, 'proof'), 'G3_PROOF_MANIFEST.json', proof)
  await json(path.join(source, 'proof'), 'G3_NEGATIVE_PROBES.json', {
    ...priorNegatives,
    amendmentLineage: lineage,
    probes: [...priorNegatives.probes, ...additional],
  })
  return proof
}
function compile() {
  const bicep = path.join(process.env.USERPROFILE, '.azure', 'bin', 'bicep.exe')
  const previous = read(path.join(evidence, 'G3R2_LOCAL_BUILD_EVIDENCE.json'))
  const entries = previous.entries.map((entry) => {
    const args = [
      'build',
      path.join(source, entry.source),
      '--outfile',
      path.join(source, entry.templatePath),
    ]
    const result = spawnSync(bicep, args, { encoding: 'utf8' })
    assert.equal(result.status, 0, `BICEP_LOCAL_BUILD_FAILED:${entry.source}:${result.stderr}`)
    assert.equal(result.stderr, '', `BICEP_WARNING:${entry.source}`)
    return {
      source: entry.source,
      sourceSha256: hash(readFileSync(path.join(source, entry.source))),
      templatePath: entry.templatePath,
      templateSha256: hash(readFileSync(path.join(source, entry.templatePath))),
      command: [bicep, ...args],
      result: 'PASS',
      stderr: '',
    }
  })
  return {
    status: 'PASS_LOCAL_ONLY_NOT_DEPLOYED',
    entrypointCount: entries.length,
    warnings: 0,
    errors: 0,
    entries,
  }
}
export async function generate() {
  verify()
  const execution = executionRecord()
  await proofContracts()
  const build = compile()
  const priorManifest = read(path.join(frozen, 'G3_SOURCE_AUTHORITY_MANIFEST.json'))
  const manifest = {
    ...priorManifest,
    AMENDMENT_LINEAGE: lineage,
    QUALIFIED_IMAGE_SOURCE: authority,
    IMAGE_SOURCE_STATUS: 'QUALIFIED_LOCAL_SOURCE_NOT_PUSHED',
    FUTURE_IMMUTABLE_REGISTRY_DIGEST: 'REQUIRED',
    ROOT_1_SOURCE_AUTHORITY: 'CLOSED_BY_PROSPECTIVE_SUPERSESSION',
    priorRejectedCandidate: {
      frozenManifestPath:
        '../g3-readiness-evidence/g3r2-frozen-source/G3_SOURCE_AUTHORITY_MANIFEST.json',
      frozenManifestSha256: hash(
        readFileSync(path.join(frozen, 'G3_SOURCE_AUTHORITY_MANIFEST.json')),
      ),
      decision: 'BLOCKED_PRESERVED_NOT_REWRITTEN',
    },
    IMAGE_SOURCE: {
      decision: 'QUALIFIED_LOCAL_SOURCE_NOT_PUSHED',
      authorityId: authority,
      lineage,
      path: 'workload/synthetic-proof',
      sourceDigests: execution.SOURCE_DIGESTS,
      builderDigest,
      runtimeBase: 'scratch',
      binarySha256: execution.BINARY_REPRODUCIBILITY.firstSha256,
      localConfigDigest: execution.LOCAL_IMAGE_CONFIG_DIGEST,
      localImageIsNotRegistryAuthority: true,
      futureRegistryDigestStatus: 'REQUIRED_AFTER_AUTHORIZED_BUILD_AND_PUSH',
      proofEndpoint: 'POST /proof/secret',
      healthEndpoint: 'GET /healthz',
    },
    BUILD_COMMANDS: build.entries.map((entry) => entry.command),
    VALIDATION_COMMANDS: [
      'node --test infrastructure\\landing-zone\\g3r2-source-closure.test.mjs infrastructure\\landing-zone\\g3r2i-source-closure.test.mjs',
      'node infrastructure\\landing-zone\\g3r2i-source-closure.mjs --check',
      'pnpm validate:docs',
    ],
    localTooling: {
      currentGenerator: {
        path: 'g3r2i-source-closure.mjs',
        sha256: hash(readFileSync(fileURLToPath(import.meta.url))),
      },
      previousGenerator: {
        ...priorManifest.localTooling.generator,
        status: 'FROZEN_G3R2_ONLY;DO_NOT_REGENERATE_ACCEPTED_HISTORY',
      },
      parameterValidation: priorManifest.localTooling.parameterValidation,
    },
    sourceCompleteness: 'COMPLETE_LOCAL_SOURCE_AND_PROOF_PACKAGE;NOT_DEPLOYED;NO_LIVE_AZURE_PROOF',
    sourceFiles: sourceFiles(),
  }
  await json(source, 'G3_SOURCE_AUTHORITY_MANIFEST.json', manifest)
  writeFileSync(
    path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.md'),
    await format(
      `# Prospective G3 source authority V1 - G3R2I amendment

Original lineage **PROSPECTIVE_G3R2**; image amendment **${lineage}**, authority **${authority}**.
Eight modules remain; all nine Bicep entrypoints compile. Historical recovery remains **0/7**.
[Manifest](./G3_SOURCE_AUTHORITY_MANIFEST.json) binds the [new workload](./workload/synthetic-proof/README.md),
verified builder digest, matching binary hashes, proof contracts and local config digest.
The local config digest is not a registry manifest: a future authorized immutable ACR digest is still required.

The [frozen G3R2 source snapshot](../g3-readiness-evidence/g3r2-frozen-source/G3_SOURCE_AUTHORITY_MANIFEST.json)
and every original G3/G3R1/G3R2 evidence file preserve the rejected candidate's BLOCKED decision.
Do not run the G3R2 writer on the amended source: it belongs to the frozen historical lane.
Use the G3R2I writer/checker for this prospective amendment.

ROOT-1 is CLOSED_BY_PROSPECTIVE_SUPERSESSION, not recovered. Local fake-secret HMAC proves application behavior,
not live Key Vault injection, identity/RBAC, private network reachability or deployment readiness.
Exactly two identities, locked-false provisioning/activation/RBAC flags, G2 external dependencies,
capacity gates, rollback and reconciliation remain unchanged. Controllers were not executed.

Remaining roots: accountable operator and separate human approver; explicit G2-side authority;
complete future costs and human ceiling. G3 execution BLOCKED; G3A/G3B NOT_AUTHORIZED.
`,
      { ...config, parser: 'markdown' },
    ),
  )
  const scanner = scan()
  await json(evidence, 'G3R2I_SECRET_SCAN.json', scanner)
  await json(evidence, 'G3R2I_LOCAL_BUILD_EVIDENCE.json', build)
  const oldCosts = read(path.join(evidence, 'G3R2_COST_CLOSURE.json'))
  const costImpact = {
    status: 'NO_MATERIAL_RESOURCE_OR_RUNTIME_COST_CHANGE',
    bomSha256: hash(readFileSync(path.join(source, 'G3_BILL_OF_MATERIALS.json'))),
    priorBomSha256: priorManifest.COST_BOM.sha256,
    resources: 23,
    inlineSubnets: 3,
    runtime: { cpu: 0.25, memoryGiB: 0.5, minReplicas: 0, maxReplicas: 1 },
    localQualificationIsNotFuturePrivateBuilderQualification: true,
    futureUnresolvedCosts: [
      'authorized private builder',
      'ordinary vault operations',
      'registry storage/headroom',
      'applicable external/platform egress',
    ],
    scenarios: oldCosts.scenarios.map(({ name, knownSubtotalCAD, completeTotalCAD }) => ({
      name,
      knownSubtotalCAD,
      completeTotalCAD,
    })),
    fullProofCeiling: 'UNRESOLVED',
    humanCeiling: 'UNBOUND',
  }
  assert.equal(costImpact.bomSha256, costImpact.priorBomSha256)
  const result = {
    ...execution,
    CURRENT_CANDIDATE_BYTES_CHANGED: 'NO',
    priorG3R2EvidenceChanged: false,
    localValidationRecord: {
      path: 'G3R2I_LOCAL_VALIDATION.json',
      sha256: hash(readFileSync(path.join(evidence, 'G3R2I_LOCAL_VALIDATION.json'))),
    },
    SCANNER_RESULT: {
      status: scanner.status,
      rawSourceScannerExit: scanner.rawSourceScannerExit,
      rawSourceFindings: scanner.rawSourceFindings,
      unresolvedFindings: scanner.UNRESOLVED_SECRET_FINDINGS,
      reportPath: 'G3R2I_SECRET_SCAN.json',
    },
    LOCAL_BICEP_BUILD: {
      status: build.status,
      entrypoints: build.entrypointCount,
      errors: 0,
      warnings: 0,
    },
    LOCAL_PROOF_PACKAGE: 'COMPLETE_LOCAL_SPECIFICATION;AZURE_PROOFS_NOT_EXECUTED',
    ROOT_1_SOURCE_AUTHORITY: 'CLOSED_BY_PROSPECTIVE_SUPERSESSION',
    G3R2: 'PASS',
    G3R2DispositionBasis: 'PROSPECTIVE_G3R2I_SUPERSESSION;FROZEN_G3R2_BLOCKED_RECORD_UNCHANGED',
    G3R2I_GATE: 'PASS',
    G3_EXECUTION_READINESS: 'BLOCKED',
    G3A: 'NOT_AUTHORIZED',
    G3B: 'NOT_AUTHORIZED',
    remainingRoots: [
      'ROOT-2_ACCOUNTABLE_OPERATOR_AND_SEPARATE_HUMAN_APPROVER',
      'ROOT-3_EXPLICIT_G2_NETWORK_MUTATION_AUTHORITY',
      'ROOT-4_COMPLETE_COST_MODEL_AND_HUMAN_COST_CEILING',
    ],
    costModelImpact: costImpact,
    sourceManifestSha256: hash(
      readFileSync(path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.json')),
    ),
    historicalPreservation: {
      path: 'G3R2I_HISTORICAL_PRESERVATION.json',
      sha256: hash(readFileSync(path.join(evidence, 'G3R2I_HISTORICAL_PRESERVATION.json'))),
    },
    proofBoundaries: {
      AZURE_RESOURCE_MUTATIONS: 0,
      AZURE_RBAC_MUTATIONS: 0,
      AZURE_REGISTRY_MUTATIONS: 0,
      G2_MUTATIONS: 0,
      G3_RESOURCE_GROUP_CREATED: 'NO',
      G3_ENVIRONMENT_CREATED: 'NO',
      UAMI_CREATED: 'NO',
      PEERING_CREATED: 'NO',
      FIREWALL_RULES_CHANGED: 'NO',
      PRIVATE_DNS_CHANGED: 'NO',
      AZURE_IMAGE_BUILD: 'NO',
      IMAGE_PUSHED: 'NO',
      LIVE_SECRET_CHALLENGE_EXECUTED: 'NO',
      G3_CONTROLLER_EXECUTED: 'NO',
      G3A_EXECUTED: 'NO',
      G3B_EXECUTED: 'NO',
      LOCAL_IMAGE_BUILT: 'YES',
      LOCAL_CONTAINER_TESTED: 'YES',
    },
  }
  await json(evidence, 'G3R2I_IMAGE_QUALIFICATION.json', result)
  writeFileSync(
    path.join(evidence, 'G3R2I_IMAGE_QUALIFICATION.md'),
    await format(
      `# G3R2I image qualification - PASS

## Preservation and lineage

Rejected synthetic-health candidate unchanged. All G3/G3R1/G3R2 evidence preserved, including G3R2's BLOCKED
image decision. [Preservation manifest](./G3R2I_HISTORICAL_PRESERVATION.json) and the frozen source snapshot
retain exact bytes. New authority **${authority}**, lineage **${lineage}**, is prospective, not historical recovery.

## Source, compiler and binary

[Qualification record](./G3R2I_IMAGE_QUALIFICATION.json) binds source/context/file digests, compiler and public
manifest verification. Builder **Go 1.26.9 linux/amd64**, \`${builderDigest}\`; runtime **scratch**.
No dependency downloads, prebuilt host binary or floating execution authority.
Binary compiled twice under identical flags: **${execution.BINARY_REPRODUCIBILITY.firstSha256}**, byte-identical.
Public Go version advisory checks found zero matches; this is bounded version evidence, not a full builder OS scan.

## Local build and runtime

Local image build **PASS**. Local image/config digest **${execution.LOCAL_IMAGE_CONFIG_DIGEST}** is
**not** future ACR manifest authority. Health, independent HMAC challenge, different nonce/key, missing-secret
generic503 and malformed/oversize/content-type denial **PASS**. Fake secret disclosed **NO** across response,
stdout/stderr/log/error tests. UID/GID **65532:65532**, read-only root, no capabilities, no-new-privileges,
network none, no host published port, port3000 only, graceful SIGTERM.

## Integration and validation

[Local Bicep evidence](./G3R2I_LOCAL_BUILD_EVIDENCE.json): all nine entrypoints **PASS**, zero warnings/errors.
[Amended manifest](../g3-source/G3_SOURCE_AUTHORITY_MANIFEST.json) binds new source authority.
Proof manifest specifies exact HMAC protocol, non-disclosure, failure behavior and safe artifacts.
Ten future negative probes cover app-level denial and independent identity/network/capacity boundaries;
only fake local app probes ran. [Scanner](./G3R2I_SECRET_SCAN.json) has zero unresolved findings.
Raw source scanner findings remain explicit exact public-name/role-ID adjudications; config unchanged.
Existing G3R2 regressions validate the frozen source/evidence, not a rewrite of the accepted BLOCKED record.
[Validation record](./G3R2I_LOCAL_VALIDATION.json): 296 Node tests, 26 Go tests/subtests, 27 PowerShell
rejection cases, formatting, syntax, repeat-generation/hash checks and documentation audit with zero errors
(existing warnings retained). Local compiler tests use bounded executable temporary storage only;
the runtime requires no writes.

## Disposition and costs

ROOT-1 **CLOSED_BY_PROSPECTIVE_SUPERSESSION**. G3R2 **PASS by prospective supersession**.
Remaining roots: accountable operator/separate approver, explicit G2-side mutation authority,
complete future costs/human ceiling. BOM remains23 resources/3 inline subnets; runtime sizing unchanged.
Local qualification does not qualify a future private builder or close vault/registry/egress costs.
Known CAD scenario subtotals remain2.05/43.18/45.15/52.93/170.74; all-in ceiling unresolved, human ceiling unbound.

## Execution boundary

G3 execution **BLOCKED**, G3A/G3B **NOT_AUTHORIZED**.
Azure resource/RBAC/registry and G2 mutations **0**; no resource/identity/network creation or changes;
no Azure image build, push, live secret challenge, controller execution, G3A or G3B.
Local image build/container tests **YES**, explicitly authorized. Future immutable ACR digest **REQUIRED**.
`,
      { ...config, parser: 'markdown' },
    ),
  )
  await json(evidence, 'G3R2I_OUTPUT_BINDING.json', {
    generatorSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
    manifestSha256: result.sourceManifestSha256,
    manifestMarkdownSha256: hash(
      readFileSync(path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.md')),
    ),
    files: [
      'G3R2I_IMAGE_QUALIFICATION.json',
      'G3R2I_IMAGE_QUALIFICATION.md',
      'G3R2I_LOCAL_EXECUTION.json',
      'G3R2I_LOCAL_BUILD_EVIDENCE.json',
      'G3R2I_SECRET_SCAN.json',
      'G3R2I_LOCAL_VALIDATION.json',
    ].map((name) => ({ name, sha256: hash(readFileSync(path.join(evidence, name))) })),
  })
  verify()
  return result
}
export function check() {
  verify()
  executionRecord()
  const binding = read(path.join(evidence, 'G3R2I_OUTPUT_BINDING.json'))
  assert.equal(binding.generatorSha256, hash(readFileSync(fileURLToPath(import.meta.url))))
  for (const entry of binding.files)
    assert.equal(
      hash(readFileSync(path.join(evidence, entry.name))),
      entry.sha256,
      `OUTPUT_CHANGED:${entry.name}`,
    )
  assert.equal(
    hash(readFileSync(path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.json'))),
    binding.manifestSha256,
  )
  assert.equal(
    hash(readFileSync(path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.md'))),
    binding.manifestMarkdownSha256,
  )
  const manifest = read(path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.json'))
  assert.deepEqual(sourceFiles(), manifest.sourceFiles)
  for (const entry of read(path.join(evidence, 'G3R2I_LOCAL_BUILD_EVIDENCE.json')).entries) {
    assert.equal(hash(readFileSync(path.join(source, entry.source))), entry.sourceSha256)
    assert.equal(hash(readFileSync(path.join(source, entry.templatePath))), entry.templateSha256)
  }
  const scanner = read(path.join(evidence, 'G3R2I_SECRET_SCAN.json'))
  assert.deepEqual(
    scanner.sourceScanFiles,
    files(source).filter((entry) => !entry.path.startsWith('build/')),
    'SCANNED_SOURCE_FILE_SET_OR_BYTES_CHANGED',
  )
  for (const entry of scanner.toolingScanFiles)
    assert.equal(hash(readFileSync(path.join(root, entry.path))), entry.sha256)
  assert.equal(
    scanner.scannerConfigSha256,
    hash(readFileSync(path.join(root, '..', '..', '.gitleaks.toml'))),
  )
  return { status: 'PASS_LOCAL_SOURCE_BUILD_PROOF_SCANNER_PRESERVATION_AND_OUTPUT_BINDING' }
}
export async function main(args) {
  assert(
    args.length === 1 && ['--write', '--check'].includes(args[0]),
    'G3R2I_LOCAL_CLOSURE_FLAGS_ONLY',
  )
  if (args[0] === '--write') await generate()
  else check()
  console.log(
    'PASS G3R2I local source/image qualification;ROOT-1 prospectively closed;no push/Azure/controller execution.',
  )
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2))
