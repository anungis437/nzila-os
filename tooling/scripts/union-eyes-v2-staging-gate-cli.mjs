#!/usr/bin/env node
/**
 * Evaluates one Union Eyes V2 staging release gate from evidence files and
 * exits non-zero when the gate reports any defect. Reads files only.
 *
 *   --gate manifest       --manifest <file>
 *   --gate attest         --manifest <file> --acr-app <file> --acr-clamav <file> --acr-cron <file>
 *   --gate parameters     --manifest <file> --parameters <file>
 *   --gate account        --account <file>            (az account show -o json)
 *   --gate what-if        --what-if <file> --registry-resource-group <rg>
 *   --gate change-record  --change-id <CHG-YYYY-NNNN> --source-sha <sha> [--change-dir ops/change-records] [--now <iso>]
 *   --gate drift          --reviewed <file> --fresh <file>
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  changeRecordDefects,
  deploymentParameterDefects,
  registryAttestationDefects,
  releaseManifestDefects,
  subscriptionDefects,
  whatIfDefects,
  whatIfFingerprint,
} from './lib/union-eyes-v2-staging-release.mjs'

function arg(name) {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  const value = process.argv[index + 1]
  return value === undefined || value.startsWith('--') ? undefined : value
}

function readJson(name) {
  const file = arg(name)
  if (!file) {
    process.stderr.write(`missing ${name}\n`)
    process.exit(2)
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const gate = arg('--gate')
let defects
let detail = {}
switch (gate) {
  case 'manifest':
    defects = releaseManifestDefects(readJson('--manifest'))
    break
  case 'attest': {
    const manifest = readJson('--manifest')
    defects = [
      ...releaseManifestDefects(manifest),
      ...registryAttestationDefects(manifest, {
        app: readJson('--acr-app'),
        clamav: readJson('--acr-clamav'),
        cron: readJson('--acr-cron'),
      }),
    ]
    break
  }
  case 'parameters': {
    const manifest = readJson('--manifest')
    defects = [...releaseManifestDefects(manifest), ...deploymentParameterDefects(readJson('--parameters'), manifest)]
    break
  }
  case 'account':
    defects = subscriptionDefects(readJson('--account'))
    break
  case 'what-if': {
    const whatIf = readJson('--what-if')
    defects = whatIfDefects(whatIf, { registryResourceGroup: arg('--registry-resource-group') })
    detail = { fingerprint: whatIfFingerprint(whatIf) }
    break
  }
  case 'change-record': {
    const changeId = arg('--change-id') ?? ''
    const dir = arg('--change-dir') ?? 'ops/change-records'
    const file = path.join(dir, `${path.basename(changeId)}.json`)
    const record = /^CHG-\d{4}-\d{4}$/.test(changeId) && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
    const now = arg('--now') ?? new Date().toISOString()
    defects = changeRecordDefects(record, { changeId, sourceSha: arg('--source-sha'), nowMs: Date.parse(now) })
    detail = { file }
    break
  }
  case 'drift': {
    const reviewed = whatIfFingerprint(readJson('--reviewed'))
    const fresh = whatIfFingerprint(readJson('--fresh'))
    defects = reviewed === fresh ? [] : ['WHAT_IF_DRIFT_SINCE_REVIEW']
    detail = { reviewed, fresh }
    break
  }
  default:
    process.stderr.write('usage: union-eyes-v2-staging-gate-cli.mjs --gate <manifest|attest|parameters|account|what-if|change-record|drift> ...\n')
    process.exit(2)
}

const ok = defects.length === 0
process.stdout.write(`${JSON.stringify({ gate, ok, defects, ...detail })}\n`)
process.exit(ok ? 0 : 1)
