#!/usr/bin/env node
/**
 * Prints a deployment-safety decision as JSON and exits non-zero when the
 * requested phase is not allowed. It does not call Azure.
 *
 *   node tooling/scripts/union-eyes-deployment-safety-cli.mjs --phase migrate --inventory inventory.json ...
 */
import fs from 'node:fs'
import { evaluateDeploymentSafety, phaseAllowed } from './lib/union-eyes-deployment-safety.mjs'

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const phase = arg('--phase')
const inventoryPath = arg('--inventory')
if (!phase || !inventoryPath) {
  process.stderr.write('usage: union-eyes-deployment-safety-cli.mjs --phase <quiesce|migrate|deploy|probe|promote> --inventory <file>\n')
  process.exit(2)
}

const rehearsalPath = arg('--rehearsal')
const input = {
  phase,
  releaseSha: arg('--release-sha') ?? '',
  images: {
    frontend: {
      digest: arg('--frontend-digest') ?? '',
      tag: arg('--frontend-tag') ?? '',
      label: arg('--frontend-label') ?? '',
    },
    backend: {
      digest: arg('--backend-digest') ?? '',
      tag: arg('--backend-tag') ?? '',
      label: arg('--backend-label') ?? '',
    },
  },
  inventory: JSON.parse(fs.readFileSync(inventoryPath, 'utf8')),
  databaseAuthority: {
    role: arg('--authority-role') ?? '',
    bypassrls: arg('--bypassrls') === 'true',
    superuser: arg('--superuser') === 'true',
  },
  schemaPreflight: { ok: arg('--schema-preflight') === 'pass' },
  djangoPreflight: { ok: arg('--django-preflight') === 'pass' },
  rehearsal: rehearsalPath ? JSON.parse(fs.readFileSync(rehearsalPath, 'utf8')) : {},
  candidateRevision: arg('--candidate-revision'),
  migrationCommitted: arg('--migration-committed') === 'true',
  requestedRecovery: arg('--requested-recovery'),
  tenantIsolation: arg('--tenant-principal')
    ? {
        ok: arg('--tenant-ok') === 'true',
        principal: arg('--tenant-principal'),
        bypassrls: arg('--tenant-bypassrls') === 'true',
      }
    : undefined,
  healthProbe: arg('--health') ? { ok: arg('--health') === 'pass' } : undefined,
  probe: arg('--probe-target')
    ? {
        target: arg('--probe-target'),
        header: arg('--probe-header'),
        revisionName: arg('--probe-revision'),
      }
    : undefined,
}

const decision = evaluateDeploymentSafety(input)
const allowed = phaseAllowed(decision, phase)
process.stdout.write(`${JSON.stringify({ phase, allowed, ...decision })}\n`)
process.exit(allowed ? 0 : 1)
