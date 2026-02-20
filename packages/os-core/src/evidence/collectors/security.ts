/**
 * Evidence Collector: Security Scan Results
 *
 * Aggregates outputs from CodeQL, dependency-audit, secret-scan, and SBOM
 * workflows into a structured evidence artifact for the annual pack.
 */
import type { EvidenceArtifact } from '../types'

export interface SecurityEvidenceOptions {
  periodLabel: string
  codeqlResultsPath?: string
  auditReportPath?: string
  sbomPath?: string
  gitleaksOutputPath?: string
}

export async function collectSecurityEvidence(
  opts: SecurityEvidenceOptions,
): Promise<EvidenceArtifact[]> {
  const { readFile } = await import('node:fs/promises')
  const artifacts: EvidenceArtifact[] = []

  // CodeQL results
  if (opts.codeqlResultsPath) {
    try {
      const raw = await readFile(opts.codeqlResultsPath, 'utf-8')
      const data = JSON.parse(raw)
      artifacts.push({
        type: 'security-scan-findings',
        subtype: 'codeql',
        periodLabel: opts.periodLabel,
        findings: data,
        collectedAt: new Date().toISOString(),
      })
    } catch {
      artifacts.push({
        type: 'security-scan-findings',
        subtype: 'codeql',
        periodLabel: opts.periodLabel,
        findings: null,
        error: 'CodeQL results not available',
        collectedAt: new Date().toISOString(),
      })
    }
  }

  // Dependency audit
  if (opts.auditReportPath) {
    try {
      const raw = await readFile(opts.auditReportPath, 'utf-8')
      const data = JSON.parse(raw)
      const vulnCount = Object.keys(data.vulnerabilities ?? {}).length
      artifacts.push({
        type: 'dependency-audit',
        periodLabel: opts.periodLabel,
        summary: { vulnerabilityCount: vulnCount },
        fullReport: data,
        collectedAt: new Date().toISOString(),
      })
    } catch {
      artifacts.push({
        type: 'dependency-audit',
        periodLabel: opts.periodLabel,
        summary: null,
        error: 'Audit report not available',
        collectedAt: new Date().toISOString(),
      })
    }
  }

  // SBOM
  if (opts.sbomPath) {
    try {
      const raw = await readFile(opts.sbomPath, 'utf-8')
      const sbom = JSON.parse(raw)
      artifacts.push({
        type: 'sbom',
        periodLabel: opts.periodLabel,
        format: sbom.bomFormat ?? 'unknown',
        componentCount: (sbom.components ?? []).length,
        sbom,
        collectedAt: new Date().toISOString(),
      })
    } catch {
      artifacts.push({
        type: 'sbom',
        periodLabel: opts.periodLabel,
        error: 'SBOM not available',
        collectedAt: new Date().toISOString(),
      })
    }
  }

  return artifacts
}
