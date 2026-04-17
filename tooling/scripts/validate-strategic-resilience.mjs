#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const OUTPUT = resolve(ROOT, 'ops/outputs/strategic-resilience-report.json')

const MAX_REVIEW_AGE_DAYS = Number(process.env.RESILIENCE_MAX_REVIEW_AGE_DAYS ?? 120)
const ENFORCE = process.argv.includes('--enforce')

function readJson(relPath) {
  const path = resolve(ROOT, relPath)
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${relPath}`)
  }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function daysSinceIsoDate(isoDate) {
  const then = new Date(isoDate)
  if (Number.isNaN(then.getTime())) return Number.POSITIVE_INFINITY
  const diffMs = Date.now() - then.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

const checks = []
function check(name, fn) {
  try {
    const detail = fn()
    checks.push({ name, status: 'pass', detail })
  } catch (error) {
    checks.push({
      name,
      status: 'fail',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

check('vendor strategy docs exist', () => {
  const required = [
    'docs/platform/VENDOR_DIVERSIFICATION_STRATEGY.md',
    'governance/resilience/vendor-diversification-registry.json',
  ]
  for (const rel of required) {
    if (!existsSync(resolve(ROOT, rel))) throw new Error(`Missing ${rel}`)
  }
  return 'vendor diversification artifacts present'
})

check('vendor registry has fallback providers', () => {
  const data = readJson('governance/resilience/vendor-diversification-registry.json')
  const capabilities = Array.isArray(data.capabilities) ? data.capabilities : []
  if (capabilities.length < 3) throw new Error('Expected at least 3 critical capabilities')
  const missing = capabilities
    .filter((c) => !c.secondary_provider || String(c.secondary_provider).trim().length === 0)
    .map((c) => c.name)
  if (missing.length > 0) throw new Error(`Missing secondary_provider for: ${missing.join(', ')}`)
  return `${capabilities.length} capabilities declare primary + secondary providers`
})

check('emerging threat register covers required risks', () => {
  const data = readJson('governance/resilience/emerging-threat-register.json')
  const ids = new Set((data.threats ?? []).map((t) => t.id))
  const required = [
    'THREAT-AI-HALLUCINATION',
    'THREAT-QUANTUM-CRYPTO',
    'THREAT-DEPENDENCY-CONFUSION',
  ]
  const missing = required.filter((id) => !ids.has(id))
  if (missing.length > 0) throw new Error(`Missing threat IDs: ${missing.join(', ')}`)
  return 'required emerging threat families are tracked'
})

check('regulatory watchlist is current', () => {
  const data = readJson('governance/resilience/regulatory-watchlist.json')
  const entries = Array.isArray(data.watchlist) ? data.watchlist : []
  if (entries.length < 5) throw new Error('Expected at least 5 watchlist entries')
  const age = daysSinceIsoDate(data.last_reviewed)
  if (age > MAX_REVIEW_AGE_DAYS) {
    throw new Error(`regulatory watchlist stale (${age}d > ${MAX_REVIEW_AGE_DAYS}d)`)    
  }
  return `watchlist has ${entries.length} entries; reviewed ${age} days ago`
})

check('succession and cross-training policy is measurable', () => {
  const data = readJson('governance/resilience/succession-and-cross-training.json')
  const domains = Array.isArray(data.domains) ? data.domains : []
  if (domains.length < 5) throw new Error('Expected at least 5 domains in succession policy')
  const missingTargets = domains
    .filter((d) =>
      d.mandatory_cross_training_hours_per_quarter == null ||
      d.succession_backup_count == null,
    )
    .map((d) => d.domain)
  if (missingTargets.length > 0) {
    throw new Error(`Missing measurable targets for domains: ${missingTargets.join(', ')}`)
  }
  return `${domains.length} domains include cross-training and succession targets`
})

const passed = checks.filter((c) => c.status === 'pass').length
const failed = checks.length - passed

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(
  OUTPUT,
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      total: checks.length,
      passed,
      failed,
      checks,
    },
    null,
    2,
  ) + '\n',
)

console.log(`Strategic resilience checks: ${passed}/${checks.length} passed`)
console.log(`Report written: ${OUTPUT}`)

if (ENFORCE && failed > 0) {
  console.error('Strategic resilience enforcement failed')
  process.exit(1)
}
