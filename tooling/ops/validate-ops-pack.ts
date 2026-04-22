/**
 * @nzila Ops Pack Validator
 *
 * Validates that the operational documentation pack is complete and up-to-date.
 * Run by the ops-pack CI workflow on every PR.
 *
 * An "ops pack" consists of the required runbooks, oncall docs, disaster recovery
 * plans, and business continuity procedures defined in ops/ directory.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

interface ValidationResult {
  passed: boolean
  errors: string[]
  warnings: string[]
  checkedFiles: string[]
}

interface RequiredDoc {
  path: string
  severity: 'error' | 'warning'
  description: string
  /** Minimum word count for doc to be considered non-stub */
  minWordCount?: number
}

const SNAPSHOT_MAX_AGE_DAYS = 7
const REQUIRED_OPS_METRIC_KEYS = [
  'deploy_frequency_30d',
  'build_success_rate_30d',
  'median_build_minutes',
  'change_failure_rate_30d',
  'mttr_minutes',
  'uptime_30d',
  'p50_latency_ms',
  'p95_latency_ms',
  'auth_success_rate',
  'error_rate',
  'monthly_infra_cost_estimate',
  'incidents_last_30d',
] as const

const REQUIRED_DOCS: RequiredDoc[] = [
  {
    path: 'ops/runbooks/README.md',
    severity: 'error',
    description: 'Runbook index',
    minWordCount: 50,
  },
  {
    path: 'ops/oncall/README.md',
    severity: 'error',
    description: 'On-call guide',
    minWordCount: 50,
  },
  {
    path: 'ops/incident-response/README.md',
    severity: 'error',
    description: 'Incident response playbook',
    minWordCount: 100,
  },
  {
    path: 'ops/disaster-recovery/README.md',
    severity: 'error',
    description: 'Disaster recovery plan',
    minWordCount: 100,
  },
  {
    path: 'ops/business-continuity/README.md',
    severity: 'error',
    description: 'Business continuity plan',
    minWordCount: 50,
  },
  {
    path: 'ops/compliance/README.md',
    severity: 'warning',
    description: 'Compliance procedures',
    minWordCount: 50,
  },
  {
    path: 'ops/change-management/README.md',
    severity: 'warning',
    description: 'Change management procedures',
    minWordCount: 50,
  },
  {
    path: 'ops/security-operations/README.md',
    severity: 'error',
    description: 'Security operations playbook',
    minWordCount: 100,
  },
  {
    path: 'ARCHITECTURE.md',
    severity: 'error',
    description: 'System architecture document',
    minWordCount: 200,
  },
  {
    path: 'SECURITY.md',
    severity: 'error',
    description: 'Security policy',
    minWordCount: 100,
  },
]

function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((w) => w.length > 1).length
}

export function validateOpsPack(repoRoot: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const checkedFiles: string[] = []

  for (const doc of REQUIRED_DOCS) {
    const fullPath = join(repoRoot, doc.path)
    checkedFiles.push(doc.path)

    if (!existsSync(fullPath)) {
      const msg = `Missing required ops document: ${doc.path} (${doc.description})`
      if (doc.severity === 'error') errors.push(msg)
      else warnings.push(msg)
      continue
    }

    if (doc.minWordCount) {
      const content = readFileSync(fullPath, 'utf-8')
      const wordCount = countWords(content)
      if (wordCount < doc.minWordCount) {
        const msg = `${doc.path} appears to be a stub (${wordCount} words, minimum ${doc.minWordCount})`
        if (doc.severity === 'error') errors.push(msg)
        else warnings.push(msg)
      }
    }
  }

  // Enforce operational evidence freshness and schema completeness
  const snapshotPath = join(repoRoot, 'reports/ops/snapshot.json')
  checkedFiles.push('reports/ops/snapshot.json')
  if (!existsSync(snapshotPath)) {
    errors.push('Missing required ops evidence snapshot: reports/ops/snapshot.json')
  } else {
    try {
      const snapshotRaw = readFileSync(snapshotPath, 'utf-8')
      const snapshot = JSON.parse(snapshotRaw) as {
        _meta?: { generated_at?: string }
        metrics?: Record<string, unknown>
      }

      const generatedAtRaw = snapshot._meta?.generated_at
      if (!generatedAtRaw) {
        errors.push('reports/ops/snapshot.json missing _meta.generated_at')
      } else {
        const generatedAt = new Date(generatedAtRaw)
        if (Number.isNaN(generatedAt.getTime())) {
          errors.push('reports/ops/snapshot.json has invalid _meta.generated_at timestamp')
        } else {
          const ageMs = Date.now() - generatedAt.getTime()
          const ageDays = ageMs / (1000 * 60 * 60 * 24)
          if (ageDays > SNAPSHOT_MAX_AGE_DAYS) {
            errors.push(
              `reports/ops/snapshot.json is stale (${ageDays.toFixed(1)} days old; max ${SNAPSHOT_MAX_AGE_DAYS}). Run pnpm ops:evidence.`,
            )
          }
        }
      }

      const metrics = snapshot.metrics ?? {}
      for (const metricKey of REQUIRED_OPS_METRIC_KEYS) {
        if (!(metricKey in metrics)) {
          errors.push(`reports/ops/snapshot.json missing required metric key: ${metricKey}`)
        }
      }
    } catch (error) {
      errors.push(`Failed parsing reports/ops/snapshot.json: ${(error as Error).message}`)
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    checkedFiles,
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = process.argv[2] ?? process.cwd()
  const result = validateOpsPack(repoRoot)

  console.log('\n=== Ops Pack Validation ===\n')
  console.log(`Checked ${result.checkedFiles.length} files in: ${repoRoot}`)

  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:')
    result.warnings.forEach((w) => console.log(`  - ${w}`))
  }

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:')
    result.errors.forEach((e) => console.log(`  - ${e}`))
    console.log('\nOps pack validation FAILED\n')
    process.exit(1)
  } else {
    console.log('\n✅ Ops pack validation passed\n')
  }
}
