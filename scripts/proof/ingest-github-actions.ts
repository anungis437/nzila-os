#!/usr/bin/env tsx
/**
 * ingest-github-actions.ts
 *
 * Collects GitHub Actions run context from environment variables (CI mode)
 * or produces a bootstrap-labelled unknown record (local mode).
 *
 * Appends a single CIRunRecord line to reports/runtime/ci-runs.jsonl.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..', '..').replace(/\\/g, '/')

const OUTPUT_DIR = join(ROOT, 'reports', 'runtime')
const OUTPUT_FILE = join(OUTPUT_DIR, 'ci-runs.jsonl')

interface CIRunRecord {
  ingestedAt: string
  timestamp: string
  completedAt: string
  runId: string | null
  workflow: string | null
  sha: string | null
  actor: string | null
  refName: string | null
  runAttempt: number | null
  serverUrl: string | null
  repository: string | null
  runUrl: string | null
  conclusion: 'success' | 'failure' | 'cancelled' | 'unknown'
  status: 'success' | 'unknown'
  bootstrapEvidence: boolean
}

function getEnv(key: string): string | null {
  return process.env[key] ?? null
}

async function main(): Promise<void> {
  const isCI = process.env.CI === 'true'
  const runCompletedRaw = process.env.GITHUB_RUN_COMPLETED_AT
  const runCompleted =
    runCompletedRaw && !Number.isNaN(new Date(runCompletedRaw).getTime())
      ? new Date(runCompletedRaw).toISOString()
      : null
  const now = new Date().toISOString()
  const evidenceTimestamp = runCompleted ?? now

  let record: CIRunRecord

  if (isCI) {
    const runId = getEnv('GITHUB_RUN_ID')
    const workflow = getEnv('GITHUB_WORKFLOW')
    const sha = getEnv('GITHUB_SHA')
    const actor = getEnv('GITHUB_ACTOR')
    const refName = getEnv('GITHUB_REF_NAME')
    const runAttemptRaw = getEnv('GITHUB_RUN_ATTEMPT')
    const serverUrl = getEnv('GITHUB_SERVER_URL')
    const repository = getEnv('GITHUB_REPOSITORY')
    const runUrl =
      serverUrl && repository && runId
        ? `${serverUrl}/${repository}/actions/runs/${runId}`
        : null

    const conclusionRaw = (getEnv('CI_CONCLUSION') ?? 'success').toLowerCase()
    const conclusion: CIRunRecord['conclusion'] =
      conclusionRaw === 'success' ||
      conclusionRaw === 'failure' ||
      conclusionRaw === 'cancelled' ||
      conclusionRaw === 'unknown'
        ? conclusionRaw
        : 'unknown'

    record = {
      ingestedAt: now,
      timestamp: evidenceTimestamp,
      completedAt: evidenceTimestamp,
      runId,
      workflow,
      sha,
      actor,
      refName,
      runAttempt: runAttemptRaw ? parseInt(runAttemptRaw, 10) : null,
      serverUrl,
      repository,
      runUrl,
      conclusion,
      status: conclusion === 'success' ? 'success' : 'unknown',
      bootstrapEvidence: false,
    }

    console.log(`[ingest-github-actions] CI run detected: ${runUrl ?? runId}`)
  } else {
    record = {
      ingestedAt: now,
      timestamp: now,
      completedAt: now,
      runId: null,
      workflow: null,
      sha: null,
      actor: null,
      refName: null,
      runAttempt: null,
      serverUrl: null,
      repository: null,
      runUrl: null,
      conclusion: 'unknown',
      status: 'unknown',
      bootstrapEvidence: true,
    }

    console.log(
      '[ingest-github-actions] Local mode — writing bootstrap/unknown record',
    )
  }

  await mkdir(OUTPUT_DIR, { recursive: true })

  // Append to JSONL
  const line = JSON.stringify(record) + '\n'
  const existing = existsSync(OUTPUT_FILE)
    ? await readFile(OUTPUT_FILE, 'utf-8')
    : ''
  await writeFile(OUTPUT_FILE, existing + line, 'utf-8')

  console.log(`[ingest-github-actions] Appended to ${OUTPUT_FILE}`)
  process.exit(0)
}

main().catch((err: unknown) => {
  console.error('[ingest-github-actions] Fatal error:', err)
  process.exit(1)
})
