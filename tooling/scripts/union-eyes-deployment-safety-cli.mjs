#!/usr/bin/env node
/**
 * Prints a deployment-safety decision as JSON and exits non-zero when the
 * requested phase is not allowed. It reads evidence files only. Flags that
 * assert an image label, a schema result, or a role attribute are rejected.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateDeploymentSafety, inspectMigration0019, phaseAllowed, readSourceIdentity } from './lib/union-eyes-deployment-safety.mjs'

const WORKFLOW_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

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
  if (index < 0) return undefined
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) return undefined
  return value
}

function booleanFlag(name) {
  const index = process.argv.indexOf(name)
  if (index < 0) return false
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) return true
  return value === 'true'
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
  process.stderr.write('usage: union-eyes-deployment-safety-cli.mjs --phase <approval|authority|premigrate|icra|scoped-0019|migrate|candidate|label|label-confirm|probe|rls-preflight> --manifest <file>\n')
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
const observedIdentity = readSourceIdentity(sourceRoot, WORKFLOW_ROOT)
const firewallServer = arg('--firewall-server')
const firewallResourceGroup = arg('--firewall-resource-group')
const input = {
  phase,
  now: arg('--now'),
  environment: arg('--environment'),
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
  stagingRls: arg('--staging-rls') ? readJson(arg('--staging-rls')) : undefined,
  requireLedgerRecord: booleanFlag('--require-0019-recorded'),
  migrationCommitted: booleanFlag('--migration-committed'),
  requestedRecovery: arg('--requested-recovery'),
  consumerAccounting: arg('--consumer-accounting') ? readJson(arg('--consumer-accounting')) : undefined,
  firewallRequest: firewallServer || firewallResourceGroup ? { serverName: firewallServer, resourceGroup: firewallResourceGroup } : undefined,
  sourceIdentity: {
    ...observedIdentity,
    workflowSha: arg('--workflow-sha') ?? process.env.GITHUB_SHA,
    applicationSourceSha: arg('--application-source-sha') ?? process.env.UE_APPLICATION_SOURCE_SHA,
  },
}

const decision = evaluateDeploymentSafety(input)
const allowed = phaseAllowed(decision, phase)
process.stdout.write(`${JSON.stringify({ phase, allowed, ...decision })}\n`)
process.exit(allowed ? 0 : 1)
