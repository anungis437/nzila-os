#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const OUTPUT = resolve(ROOT, 'ops/outputs/data-residency-runtime.json')

const ENFORCE = process.argv.includes('--enforce')
const ALLOWED = (process.env.RESIDENCY_ALLOWED_REGIONS ?? 'canadacentral,canadaeast')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)
const RESOURCE_GROUP = process.env.AZURE_RESIDENCY_RESOURCE_GROUP ?? ''

function runAz(command) {
  return execSync(command, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function collectResources() {
  const base = RESOURCE_GROUP
    ? `az resource list --resource-group \"${RESOURCE_GROUP}\" --output json`
    : 'az resource list --output json'
  const output = runAz(base)
  const resources = JSON.parse(output)
  return Array.isArray(resources) ? resources : []
}

let status = 'ok'
let error = null
let resources = []
let violations = []

try {
  resources = collectResources()
  violations = resources
    .filter((r) => typeof r.location === 'string')
    .filter((r) => !ALLOWED.includes(String(r.location).toLowerCase()))
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      location: r.location,
      resourceGroup: r.resourceGroup,
    }))
  if (violations.length > 0) {
    status = 'violation'
  }
} catch (e) {
  status = 'unverified'
  error = e instanceof Error ? e.message : String(e)
}

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(
  OUTPUT,
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      status,
      allowed_regions: ALLOWED,
      resource_group_scope: RESOURCE_GROUP || null,
      total_resources_seen: resources.length,
      violations_count: violations.length,
      violations,
      error,
    },
    null,
    2,
  ) + '\n',
)

console.log(`Data residency runtime status: ${status}`)
console.log(`Report written: ${OUTPUT}`)

if (ENFORCE && (status === 'violation' || status === 'unverified')) {
  console.error('Runtime data residency enforcement failed')
  process.exit(1)
}
