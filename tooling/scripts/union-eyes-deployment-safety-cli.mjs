#!/usr/bin/env node
/**
 * Prints a deployment-safety decision as JSON and exits non-zero when the
 * requested phase is not allowed. It reads evidence files only. Flags that
 * assert an image label, a schema result, or a role attribute are rejected.
 */
import fs from 'node:fs'
import { evaluateDeploymentSafety, inspectMigration0019, phaseAllowed } from './lib/union-eyes-deployment-safety.mjs'

const ASSERTED_FLAGS = [
  '--frontend-label',
  '--backend-label',
  '--frontend-tag',
  '--backend-tag',
  '--schema-preflight',
  '--django-preflight',
  '--bypassrls',
  '--superuser',
  '--authority-role',
  '--probe-header',
]

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

const asserted = ASSERTED_FLAGS.filter((flag) => process.argv.includes(flag))
if (asserted.length > 0) {
  process.stderr.write(`ASSERTED_GATE_REJECTED ${asserted.join(' ')}\n`)
  process.exit(2)
}

const phase = arg('--phase')
if (!phase) {
  process.stderr.write('usage: union-eyes-deployment-safety-cli.mjs --phase <premigrate|icra|scoped-0019|migrate|candidate|label|label-confirm|probe> --manifest <file>\n')
  process.exit(2)
}

const manifestPath = arg('--manifest')
const approvalPath = arg('--approval')
const trustPath = arg('--approval-trust')
const sourceRoot = arg('--source-root')
if (!manifestPath || !approvalPath || !trustPath || !sourceRoot) {
  process.stderr.write('release manifest, approval, trust anchor, and source root are required\n')
  process.exit(2)
}

const inspected = inspectMigration0019(sourceRoot)
const input = {
  phase,
  now: arg('--now'),
  manifest: readJson(manifestPath),
  acr: {
    frontend: arg('--acr-frontend') ? readJson(arg('--acr-frontend')) : undefined,
    backend: arg('--acr-backend') ? readJson(arg('--acr-backend')) : undefined,
  },
  ingress: arg('--ingress') ? readJson(arg('--ingress')) : undefined,
  revisions: arg('--revisions') ? readJson(arg('--revisions')) : undefined,
  freshIngress: arg('--fresh-ingress') ? readJson(arg('--fresh-ingress')) : undefined,
  freshRevisions: arg('--fresh-revisions') ? readJson(arg('--fresh-revisions')) : undefined,
  proposedIngress: arg('--proposed-ingress') ? readJson(arg('--proposed-ingress')) : undefined,
  roleCatalog: arg('--role-catalog') ? readJson(arg('--role-catalog')) : undefined,
  approval: readJson(approvalPath),
  approvalTrustPem: fs.readFileSync(trustPath, 'utf8'),
  ledger: arg('--ledger') ? readJson(arg('--ledger')) : undefined,
  migration0019: inspected,
  djangoPlan: arg('--django-plan') ? readJson(arg('--django-plan')) : undefined,
  rlsPreflight: arg('--rls-preflight') ? readJson(arg('--rls-preflight')) : undefined,
  candidateRevision: arg('--candidate-revision'),
  weightBaseline: arg('--weight-baseline') ? readJson(arg('--weight-baseline')) : undefined,
  probe: arg('--probe') ? readJson(arg('--probe')) : undefined,
  requireLedgerRecord: arg('--require-0019-recorded') === 'true',
  migrationCommitted: arg('--migration-committed') === 'true',
  requestedRecovery: arg('--requested-recovery'),
  consumerAccounting: arg('--consumer-accounting') ? readJson(arg('--consumer-accounting')) : undefined,
}

const decision = evaluateDeploymentSafety(input)
const allowed = phaseAllowed(decision, phase)
process.stdout.write(`${JSON.stringify({ phase, allowed, ...decision })}\n`)
process.exit(allowed ? 0 : 1)
