#!/usr/bin/env node
/**
 * SAGE B-005 build provenance recorder (offline / CI artifact binding).
 *
 * Records the exact git SHA and optional expected image digest for a deploy
 * candidate. Never claims Azure revision parity. b005Closure stays NOT_PROVEN.
 *
 * Usage:
 *   node tooling/scripts/sage-b005-build-provenance.mjs \
 *     --git-sha <40-hex> \
 *     --out reports/proof-runs/sage-b005-build-provenance.json \
 *     [--expected-image-digest sha256:…] \
 *     [--image-ref …]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const SHA = /^[a-f0-9]{40}$/i
const DIGEST = /^sha256:[a-f0-9]{64}$/i

function errorCode(message) {
  return new Error('SAGE_B005_BUILD_PROVENANCE: ' + message)
}

function parseArgs(argv) {
  const opts = { gitSha: null, out: null, expectedImageDigest: null, imageRef: null }
  const args = argv.filter((a) => a !== '--')
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i]
    const value = args[i + 1]
    if (!value) throw errorCode('ARGUMENTS_INVALID')
    if (name === '--git-sha') opts.gitSha = value
    else if (name === '--out') opts.out = value
    else if (name === '--expected-image-digest') opts.expectedImageDigest = value
    else if (name === '--image-ref') opts.imageRef = value
    else throw errorCode(`UNKNOWN_ARGUMENT:${name}`)
  }
  if (!opts.gitSha || !SHA.test(opts.gitSha)) throw errorCode('GIT_SHA_REQUIRED')
  if (!opts.out) throw errorCode('OUT_REQUIRED')
  if (opts.expectedImageDigest && !DIGEST.test(opts.expectedImageDigest)) {
    throw errorCode('IMAGE_DIGEST_INVALID')
  }
  return opts
}

export function composeBuildProvenance({
  gitSha,
  expectedImageDigest = null,
  imageRef = null,
  observedAt = new Date().toISOString(),
}) {
  return {
    schemaVersion: 1,
    kind: 'SAGE_B005_BUILD_PROVENANCE',
    observedAt,
    gitSha,
    expectedImageDigest,
    imageRef,
    azureRevision: null,
    azureResourceGroup: null,
    result: expectedImageDigest ? 'EXPECTATION_RECORDED' : 'SHA_ONLY',
    b005Closure: 'NOT_PROVEN',
    unsupportedClaims: [
      'Azure Container App revision not verified',
      'Registry digest pull not verified',
      'Staging health commit match not verified here',
    ],
  }
}

export async function runBuildProvenance(argv) {
  const opts = parseArgs(argv)
  const receipt = composeBuildProvenance({
    gitSha: opts.gitSha,
    expectedImageDigest: opts.expectedImageDigest,
    imageRef: opts.imageRef,
  })
  await mkdir(dirname(opts.out), { recursive: true })
  await writeFile(opts.out, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  process.stdout.write(`${receipt.result}: b005Closure=${receipt.b005Closure} → ${opts.out}\n`)
  return receipt
}

export function resolveHeadSha(cwd = process.cwd()) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBuildProvenance(process.argv.slice(2)).catch((error) => {
    const code =
      error instanceof Error && error.message.startsWith('SAGE_B005_BUILD_PROVENANCE:')
        ? error.message
        : 'SAGE_B005_BUILD_PROVENANCE: UNEXPECTED_ERROR'
    process.stderr.write(code + '\n')
    process.exitCode = 1
  })
}
