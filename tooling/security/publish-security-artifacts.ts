/**
 * Security Evidence Publisher
 *
 * Collects all security-related CI artifacts and uploads them
 * as an evidence pack to Azure Blob for audit trails.
 *
 * Run via: pnpm tsx tooling/security/publish-security-artifacts.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '../..')

interface SecurityArtifactBundle {
  ref: string
  runId: string
  timestamp: string
  artifacts: Record<string, unknown>
}

async function publishSecurityArtifacts(): Promise<void> {
  const ref = process.env.GITHUB_SHA ?? 'local'
  const runId = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`

  const bundle: SecurityArtifactBundle = {
    ref,
    runId,
    timestamp: new Date().toISOString(),
    artifacts: {},
  }

  // Collect CodeQL results
  const codeqlPath = join(REPO_ROOT, 'codeql-results')
  if (existsSync(codeqlPath)) {
    bundle.artifacts['codeql'] = { path: codeqlPath, status: 'present' }
  }

  // Collect audit report
  const auditPath = join(REPO_ROOT, 'audit-report.json')
  if (existsSync(auditPath)) {
    bundle.artifacts['dependency-audit'] = JSON.parse(readFileSync(auditPath, 'utf-8'))
  }

  // Collect SBOM
  const sbomPath = join(REPO_ROOT, 'sbom.json')
  if (existsSync(sbomPath)) {
    bundle.artifacts['sbom'] = JSON.parse(readFileSync(sbomPath, 'utf-8'))
  }

  const periodLabel = new Date().toISOString().slice(0, 7) // YYYY-MM

  // Import the security evidence collector
  const { collectSecurityEvidence } = await import(
    '@nzila/os-core/evidence/collectors/security'
  )
  const evidenceArtifacts = await collectSecurityEvidence({
    periodLabel,
    auditReportPath: auditPath,
    sbomPath: sbomPath,
  })

  // Log summary; actual upload goes through processEvidencePack
  console.log(`Security Evidence Bundle: ${runId}`)
  console.log(`  Artifacts collected: ${evidenceArtifacts.length}`)
  for (const a of evidenceArtifacts) {
    console.log(`    - ${a.type}`)
  }

  if (process.env.UPLOAD_EVIDENCE === 'true') {
    const { processEvidencePack } = await import('@nzila/os-core/evidence/generate-evidence-index')
    await processEvidencePack({
      evidenceDir: '',
      entityId: process.env.NZILA_ENTITY_ID ?? '',
      periodLabel,
      tag: 'security',
      additionalArtifacts: evidenceArtifacts,
    } as any)
    console.log('✅ Security evidence pack uploaded')
  } else {
    console.log('ℹ️  Set UPLOAD_EVIDENCE=true to upload to Azure Blob')
  }
}

publishSecurityArtifacts().catch((err) => {
  console.error('Failed to publish security artifacts:', err)
  process.exit(1)
})
