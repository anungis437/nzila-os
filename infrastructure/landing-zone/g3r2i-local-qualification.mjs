import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { evidence, files, hash, read, root, source, verify } from './g3r2i-preservation.mjs'

export const builderDigest =
  'sha256:bcef992b77b1e2031aaaa51da75cebc32da8e9c182e12e633ea79023c79d9eff'
export const builder = `docker.io/library/golang@${builderDigest}`
export const workload = path.join(source, 'workload', 'synthetic-proof')
export function sourceDigests() {
  const entries = files(workload)
  const contextNames = ['.dockerignore', 'Dockerfile', 'go.mod', 'main.go', 'main_test.go']
  const context = entries.filter((entry) => contextNames.includes(entry.path))
  assert.equal(context.length, contextNames.length)
  return {
    method:
      'SHA256(JSON UTF-8 sorted {path,sha256} arrays);source/context digests are not OCI digests',
    SOURCE_TREE_SHA256: hash(JSON.stringify(entries)),
    BUILD_CONTEXT_SHA256: hash(JSON.stringify(context)),
    GO_MOD_SHA256: entries.find((entry) => entry.path === 'go.mod').sha256,
    GO_SUM_SHA256_IF_PRESENT: null,
    GO_SUM_STATUS: 'NOT_REQUIRED_STANDARD_LIBRARY_ONLY',
    MAIN_SOURCE_SHA256: entries.find((entry) => entry.path === 'main.go').sha256,
    DOCKERFILE_SHA256: entries.find((entry) => entry.path === 'Dockerfile').sha256,
    DOCKERIGNORE_SHA256: entries.find((entry) => entry.path === '.dockerignore').sha256,
    files: entries,
    buildContext: context,
  }
}
function docker(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 600000,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  })
  assert.equal(
    result.status,
    0,
    `LOCAL_DOCKER_FAILED:${args[0]}:${result.error?.message ?? result.stderr}`,
  )
  return result
}
async function publicProvenance() {
  const auth = await fetch(
    'https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/golang:pull',
  )
  assert(auth.ok, `PUBLIC_REGISTRY_AUTH_HTTP:${auth.status}`)
  const { token } = await auth.json()
  const url = `https://registry-1.docker.io/v2/library/golang/manifests/${builderDigest}`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.oci.image.manifest.v1+json',
    },
  })
  assert(response.ok, `PUBLIC_MANIFEST_HTTP:${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.equal(`sha256:${hash(bytes)}`, builderDigest, 'PUBLIC_BUILDER_DIGEST_NOT_VERIFIED')
  assert.equal(response.headers.get('docker-content-digest'), builderDigest)
  const manifest = JSON.parse(bytes)
  const queries = [
    { package: { name: 'stdlib', ecosystem: 'Go' }, version: '1.26.9' },
    { package: { name: 'toolchain', ecosystem: 'Go' }, version: '1.26.9' },
  ]
  const vulnerabilityResponse = await fetch('https://api.osv.dev/v1/querybatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries }),
  })
  assert(
    vulnerabilityResponse.ok,
    `PUBLIC_GO_VULNERABILITY_QUERY_HTTP:${vulnerabilityResponse.status}`,
  )
  const vulnerability = await vulnerabilityResponse.json()
  assert.equal(vulnerability.results.length, queries.length)
  const advisories = vulnerability.results
    .flatMap((result) => result.vulns ?? [])
    .map((item) => item.id)
  assert.equal(
    advisories.length,
    0,
    `PINNED_GO_VERSION_HAS_PUBLIC_ADVISORIES:${advisories.join(',')}`,
  )
  return {
    builderManifestRead: {
      method: 'GET',
      url,
      digestHeader: builderDigest,
      verifiedBytesSha256: hash(bytes),
      configDigest: manifest.config.digest,
      layerDigests: manifest.layers.map((layer) => layer.digest),
    },
    boundedVersionVulnerabilityCheck: {
      method: 'POST_PUBLIC_READ_ONLY_QUERY',
      url: 'https://api.osv.dev/v1/querybatch',
      queries,
      advisories,
      status: 'PASS_ZERO_VERSION_MATCHES;not a full container OS vulnerability scan',
      sourceOrSecretUploaded: false,
    },
  }
}
const expectedProof = (secret, nonce) =>
  createHmac('sha256', secret).update(nonce, 'utf8').digest('hex')
async function runtimeTests(imageId) {
  const containers = []
  const responses = []
  const localSecrets = [
    randomBytes(32).toString('base64url'),
    randomBytes(32).toString('base64url'),
  ]
  const retained = []
  try {
    function localRequest(id, route, method = 'GET', body, contentType) {
      const args = [
        'run',
        '--rm',
        '--network',
        `container:${id}`,
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--user',
        '65532:65532',
        builder,
        'curl',
        '--silent',
        '--show-error',
        '--max-time',
        '5',
        '--request',
        method,
        '--write-out',
        '\\n%{http_code}',
      ]
      if (body !== undefined)
        args.push('--header', `Content-Type: ${contentType}`, '--data-binary', body)
      args.push(`http://127.0.0.1:3000${route}`)
      const output = docker(args).stdout
      const split = output.lastIndexOf('\n')
      return { status: Number(output.slice(split + 1)), text: output.slice(0, split) }
    }
    async function run(secret) {
      const args = [
        'run',
        '--detach',
        '--network',
        'none',
        '--read-only',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--memory',
        '128m',
        '--cpus',
        '0.5',
        '--pids-limit',
        '32',
      ]
      if (secret) args.push('--env', 'G3_PROOF_SECRET')
      const id = docker([...args, imageId], {
        env: { ...process.env, G3_PROOF_SECRET: secret ?? '' },
      }).stdout.trim()
      containers.push(id)
      const state = JSON.parse(
        docker([
          'inspect',
          id,
          '--format',
          '{"running":{{.State.Running}},"user":{{json .Config.User}},"readonly":{{.HostConfig.ReadonlyRootfs}},"ports":{{json .Config.ExposedPorts}},"network":{{json .HostConfig.NetworkMode}},"bindings":{{json .HostConfig.PortBindings}},"capDrop":{{json .HostConfig.CapDrop}},"securityOpt":{{json .HostConfig.SecurityOpt}}}',
        ]).stdout,
      )
      assert.equal(state.running, true)
      assert.equal(state.user, '65532:65532')
      assert.equal(state.readonly, true)
      assert.deepEqual(Object.keys(state.ports), ['3000/tcp'])
      assert.deepEqual(state.capDrop, ['ALL'])
      assert(state.securityOpt.includes('no-new-privileges'))
      assert.equal(state.network, 'none')
      assert.equal(Object.keys(state.bindings ?? {}).length, 0)
      const processes = docker(['top', id, '-eo', 'pid,uid,gid,comm'])
        .stdout.trim()
        .split(/\r?\n/)
        .slice(1)
        .map((line) => line.trim().split(/\s+/).slice(1))
      assert.deepEqual(
        processes,
        [['65532', '65532', 'proof-server']],
        'ACTUAL_RUNTIME_PROCESS_NOT_FIXED_NONROOT',
      )
      const sockets = docker([
        'run',
        '--rm',
        '--network',
        `container:${id}`,
        '--read-only',
        '--cap-drop',
        'ALL',
        '--user',
        '65532:65532',
        builder,
        'cat',
        '/proc/net/tcp',
        '/proc/net/tcp6',
      ]).stdout
      const listeners = sockets
        .split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/))
        .filter((fields) => fields[3] === '0A')
        .map((fields) => Number.parseInt(fields[1].split(':')[1], 16))
      assert.deepEqual(listeners, [3000], 'ACTUAL_RUNTIME_LISTENING_PORTS_DIFFER')
      const response = localRequest(id, '/healthz')
      responses.push(response.text)
      assert.equal(response.status, 200)
      assert.equal(response.text, '{"status":"ok"}\n')
      return { id, state }
    }
    async function challenge(
      runtime,
      nonce,
      status = 200,
      body = JSON.stringify({ nonce }),
      contentType = 'application/json',
    ) {
      const response = localRequest(runtime.id, '/proof/secret', 'POST', body, contentType)
      const text = response.text
      responses.push(text)
      assert.equal(response.status, status)
      const result = JSON.parse(text)
      if (status === 200) {
        assert.deepEqual(Object.keys(result).sort(), ['algorithm', 'proof', 'protocol'])
        assert.equal(result.algorithm, 'HMAC-SHA256')
        assert.equal(result.protocol, 'g3-secret-proof-v1')
        assert(/^[a-f0-9]{64}$/.test(result.proof))
      } else
        assert.deepEqual(result, { status: status === 503 ? 'unavailable' : 'invalid_request' })
      return { result, status: response.status }
    }
    const first = await run(localSecrets[0])
    const nonce = randomBytes(32).toString('base64url')
    const secondNonce = randomBytes(32).toString('base64url')
    const observed = await challenge(first, nonce)
    const expected = expectedProof(localSecrets[0], nonce)
    assert(
      timingSafeEqual(Buffer.from(observed.result.proof, 'hex'), Buffer.from(expected, 'hex')),
      'LOCAL_SECRET_OBSERVER_PROOF_MISMATCH',
    )
    assert.equal((await challenge(first, nonce)).result.proof, expected)
    assert.notEqual((await challenge(first, secondNonce)).result.proof, expected)
    assert.notEqual(expectedProof(localSecrets[1], nonce), expected)
    for (const [body, contentType] of [
      ['{}', 'application/json'],
      [JSON.stringify({ nonce: '' }), 'application/json'],
      ['{', 'application/json'],
      [JSON.stringify({ nonce: 'A'.repeat(1000) }), 'application/json'],
      [JSON.stringify({ nonce }), 'text/plain'],
    ])
      await challenge(first, nonce, 400, body, contentType)
    retained.push({
      nonce,
      expectedProofDigest: expected,
      observedProofDigest: observed.result.proof,
      httpStatus: observed.status,
      timestamp: new Date().toISOString(),
      imageRegistryDigest: 'REQUIRED_AFTER_AUTHORIZED_BUILD_AND_PUSH',
      runtimeRevision: 'LOCAL_CONTAINER_ONLY',
      secretLogicalId: 'FAKE_LOCAL_ONLY',
      secretVersionIdentifier: 'NOT_APPLICABLE',
      rawSecretRetained: false,
    })
    const second = await run(localSecrets[1])
    const alternate = (await challenge(second, nonce)).result.proof
    assert.equal(alternate, expectedProof(localSecrets[1], nonce))
    assert.notEqual(alternate, expected)
    const missing = await run()
    await challenge(missing, nonce, 503)
    for (const id of containers) {
      docker(['stop', '--time', '6', id])
      assert.equal(
        JSON.parse(docker(['inspect', id, '--format', '{{json .State.ExitCode}}']).stdout),
        0,
        'GRACEFUL_SHUTDOWN_FAILED',
      )
      const logs = docker(['logs', id])
      responses.push(logs.stdout, logs.stderr)
    }
    for (const secret of localSecrets)
      assert(
        responses.every((output) => !output.includes(secret)),
        'FAKE_SECRET_DISCLOSED',
      )
    return {
      LOCAL_RUNTIME_RESULT: 'PASS',
      LOCAL_HEALTH_RESULT: 'PASS',
      LOCAL_SECRET_OBSERVER_PROOF: 'PASS',
      MISSING_SECRET_BEHAVIOR: 'PASS_GENERIC_503',
      WRONG_SECRET_BEHAVIOR: 'PASS_EXPECTED_PROOF_MISMATCH',
      FAKE_SECRET_DISCLOSED: 'NO',
      nonDisclosureSurfaces: [
        'HTTP responses',
        'stdout',
        'stderr',
        'captured container logs',
        'unit-test simulated response/server error logs',
      ],
      runtimeUid: 65532,
      runtimeGid: 65532,
      readOnlyRootFilesystem: true,
      networkMode: 'none;read-only nonroot client shares runtime network namespace',
      hostBinding: 'NONE_NO_PUBLISHED_PORT',
      listeningPorts: [3000],
      gracefulSigterm: 'PASS',
      localChallengeArtifacts: retained,
      liveAzureSecretChallengeExecuted: false,
    }
  } finally {
    for (const id of containers) docker(['rm', '--force', id])
  }
}
export async function qualify() {
  verify()
  const digests = sourceDigests()
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'nzila-g3r2i-binary-'))
  let compilerContainer
  try {
    const publicReads = await publicProvenance()
    const version = docker(['version', '--format', '{{json .}}'])
    const compilerVersion = docker([
      'run',
      '--rm',
      '--network',
      'none',
      '--read-only',
      builder,
      'go',
      'version',
    ]).stdout.trim()
    assert.equal(compilerVersion, 'go version go1.26.9 linux/amd64')
    const compilerBuild = docker([
      'build',
      '--platform',
      'linux/amd64',
      '--network',
      'none',
      '--progress',
      'plain',
      '--load',
      '--target',
      'compiler',
      '--tag',
      'nzila-g3r2i-compiler:qualification',
      workload,
    ])
    const runtimeBuild = docker([
      'build',
      '--platform',
      'linux/amd64',
      '--network',
      'none',
      '--progress',
      'plain',
      '--load',
      '--tag',
      'nzila-g3r2i-local:qualification',
      workload,
    ])
    const compilerImageId = docker([
      'image',
      'inspect',
      'nzila-g3r2i-compiler:qualification',
      '--format',
      '{{.Id}}',
    ]).stdout.trim()
    const unitRun = docker([
      'run',
      '--rm',
      '--network',
      'none',
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--tmpfs',
      '/tmp:rw,exec,nosuid,size=128m',
      '--tmpfs',
      '/root/.cache/go-build:rw,nosuid,size=256m',
      compilerImageId,
      'go',
      'test',
      '-count=1',
      '-json',
      './...',
    ])
    const events = unitRun.stdout
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line))
    const passedTests = events
      .filter((event) => event.Action === 'pass' && event.Test)
      .map((event) => event.Test)
    assert.equal(events.filter((event) => event.Action === 'fail').length, 0, 'GO_UNIT_TEST_FAILED')
    assert.equal(passedTests.length, 26, 'GO_TEST_COVERAGE_COUNT_CHANGED')
    const formatting = docker([
      'run',
      '--rm',
      '--network',
      'none',
      '--read-only',
      compilerImageId,
      'gofmt',
      '-l',
      'main.go',
      'main_test.go',
    ])
    assert.equal(formatting.stdout, '', 'GO_FORMAT_DRIFT')
    compilerContainer = docker([
      'create',
      '--network',
      'none',
      'nzila-g3r2i-compiler:qualification',
    ]).stdout.trim()
    for (const name of ['proof-server-a', 'proof-server-b'])
      docker(['cp', `${compilerContainer}:/out/${name}`, path.join(scratch, name)])
    const a = readFileSync(path.join(scratch, 'proof-server-a'))
    const b = readFileSync(path.join(scratch, 'proof-server-b'))
    assert.equal(hash(a), hash(b), 'REPEAT_BINARY_SHA256_MISMATCH')
    assert(a.equals(b), 'REPEAT_BINARY_BYTES_MISMATCH')
    const image = JSON.parse(
      docker([
        'image',
        'inspect',
        'nzila-g3r2i-local:qualification',
        '--format',
        '{"id":{{json .Id}},"user":{{json .Config.User}},"os":{{json .Os}},"architecture":{{json .Architecture}},"ports":{{json .Config.ExposedPorts}},"entrypoint":{{json .Config.Entrypoint}}}',
      ]).stdout,
    )
    assert.equal(image.user, '65532:65532')
    assert.equal(image.os, 'linux')
    assert.equal(image.architecture, 'amd64')
    assert.deepEqual(image.entrypoint, ['/proof-server'])
    assert.deepEqual(Object.keys(image.ports), ['3000/tcp'])
    const runtime = await runtimeTests(image.id)
    assert.deepEqual(sourceDigests(), digests, 'SOURCE_CHANGED_DURING_QUALIFICATION')
    verify()
    const result = {
      IMAGE_AUTHORITY_ID: 'G3_SYNTHETIC_PROOF_V1',
      SOURCE_LINEAGE: 'PROSPECTIVE_G3R2_IMAGE_QUALIFICATION',
      SOURCE_DIGESTS: digests,
      PUBLIC_READ_PROVENANCE: publicReads,
      BUILD_TOOLCHAIN: {
        compilerVersion,
        dockerVersion: JSON.parse(version.stdout),
        builder,
        compilerImageId,
        buildFlags: [
          'CGO_ENABLED=0',
          'GOOS=linux',
          'GOARCH=amd64',
          'GOTOOLCHAIN=local',
          'GOPROXY=off',
          'GOSUMDB=off',
          '-a',
          '-trimpath',
          '-buildvcs=false',
          '-ldflags=-s -w -buildid=',
        ],
        dependencySurface: 'STANDARD_LIBRARY_ONLY',
      },
      BASE_IMAGE_DIGESTS: {
        BUILDER_BASE_DIGEST: builderDigest,
        RUNTIME_BASE_DIGEST: 'SCRATCH_NO_BASE_IMAGE_DIGEST',
      },
      BINARY_REPRODUCIBILITY: {
        REPEAT_BINARY_SHA256_MATCH: 'YES',
        firstSha256: hash(a),
        secondSha256: hash(b),
        binaryBytes: a.length,
        independentInvocations: 2,
        conditions:
          'Same source/compiler/OS/arch/flags;both builds -a force rebuild;no network;Dockerfile cmp and host byte comparison',
      },
      GO_UNIT_TESTS: {
        command:
          'docker run --rm --network none --read-only [bounded tmpfs] <qualified compiler image> go test -count=1 -json ./...',
        result: 'PASS',
        passedTests,
        testAndSubtestCount: passedTests.length,
        failedTests: 0,
        outputSha256: hash(unitRun.stdout),
        gofmtResult: 'PASS_NO_FORMAT_DRIFT',
        vetResult: 'PASS_DOCKERFILE_BUILD_STAGE',
      },
      LOCAL_BUILD_RESULT: 'PASS',
      LOCAL_IMAGE_ID: image.id,
      LOCAL_IMAGE_CONFIG_DIGEST: image.id,
      LOCAL_IMAGE_ID_SEMANTICS:
        'Docker image inspect .Id is local config digest;not registry manifest or future ACR authority',
      BUILD_LOG_DIGESTS: {
        compiler: hash(compilerBuild.stdout + compilerBuild.stderr),
        runtime: hash(runtimeBuild.stdout + runtimeBuild.stderr),
      },
      ...runtime,
      FUTURE_ACR_IMAGE_DIGEST: 'REQUIRED_AFTER_AUTHORIZED_BUILD_AND_PUSH',
      IMAGE_PUSHED: 'NO',
      AZURE_IMAGE_BUILD: 'NO',
      AZURE_MUTATIONS: 0,
      CONTROLLER_EXECUTED: 'NO',
    }
    const formattingConfig = await resolveConfig(path.join(root, '..', '..', 'package.json'))
    writeFileSync(
      path.join(evidence, 'G3R2I_LOCAL_EXECUTION.json'),
      await format(JSON.stringify(result), { ...formattingConfig, parser: 'json' }),
    )
    console.log(
      `PASS local image/runtime/HMAC/non-disclosure;repeat binary ${hash(a)};no push/Azure/controller execution.`,
    )
    return result
  } finally {
    if (compilerContainer) docker(['rm', compilerContainer])
    rmSync(scratch, { recursive: true })
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 2, 'LOCAL_QUALIFICATION_NO_FLAGS_ALLOWED')
  await qualify()
}
