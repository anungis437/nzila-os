#!/usr/bin/env node
/**
 * Write a release manifest from the serving revision's observed image
 * digests. It does not accept a caller-supplied digest.
 */
import fs from 'node:fs'
import { servingDigests } from './lib/union-eyes-deployment-safety.mjs'

function arg(name) {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) return undefined
  return value
}

const releaseSha = arg('--release-sha')
const ingressPath = arg('--ingress')
const revisionsPath = arg('--revisions')
const outPath = arg('--out')
if (!releaseSha || !ingressPath || !revisionsPath || !outPath) {
  process.stderr.write('release sha, ingress, revisions, and --out are required\n')
  process.exit(2)
}

const observed = servingDigests(JSON.parse(fs.readFileSync(ingressPath, 'utf8')), JSON.parse(fs.readFileSync(revisionsPath, 'utf8')))
if (!observed) {
  process.stderr.write('SERVING_IMAGE_DIGEST_MISMATCH\n')
  process.exit(1)
}

fs.writeFileSync(outPath, `${JSON.stringify({
  releaseSha,
  workflowSha: arg('--workflow-sha') ?? null,
  environment: arg('--environment') ?? null,
  frontendDigest: observed.frontendDigest,
  backendDigest: observed.backendDigest,
})}\n`)
