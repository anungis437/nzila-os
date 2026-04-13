/**
 * Tests for evidence/collectors/security.ts — Security evidence collector
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReadFile = vi.fn()

vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}))

describe('collectSecurityEvidence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function loadCollector() {
    const mod = await import('../../collectors/security')
    return mod.collectSecurityEvidence
  }

  it('collects CodeQL results when path is provided and file exists', async () => {
    const codeqlData = { runs: [{ results: [] }] }
    mockReadFile.mockResolvedValueOnce(JSON.stringify(codeqlData))

    const collect = await loadCollector()
    const artifacts = await collect({
      periodLabel: 'FY2025',
      codeqlResultsPath: '/path/to/codeql.json',
    })

    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].type).toBe('security-scan-findings')
    expect(artifacts[0].subtype).toBe('codeql')
    expect(artifacts[0].periodLabel).toBe('FY2025')
    expect(artifacts[0].findings).toEqual(codeqlData)
    expect(artifacts[0].collectedAt).toBeTruthy()
  })

  it('produces error artifact when CodeQL file is unreadable', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'))

    const collect = await loadCollector()
    const artifacts = await collect({
      periodLabel: 'FY2025',
      codeqlResultsPath: '/bad/path.json',
    })

    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].type).toBe('security-scan-findings')
    expect(artifacts[0].subtype).toBe('codeql')
    expect(artifacts[0].findings).toBeNull()
    expect(artifacts[0].error).toContain('not available')
  })

  it('collects dependency audit report', async () => {
    const auditData = {
      vulnerabilities: { 'lodash': { id: 1 }, 'express': { id: 2 } },
    }
    mockReadFile.mockResolvedValueOnce(JSON.stringify(auditData))

    const collect = await loadCollector()
    const artifacts = await collect({
      periodLabel: 'FY2025',
      auditReportPath: '/path/to/audit.json',
    })

    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].type).toBe('dependency-audit')
    expect(artifacts[0].summary.vulnerabilityCount).toBe(2)
    expect(artifacts[0].fullReport).toEqual(auditData)
  })

  it('handles audit report read failure', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('Permission denied'))

    const collect = await loadCollector()
    const artifacts = await collect({
      periodLabel: 'FY2025',
      auditReportPath: '/denied.json',
    })

    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].type).toBe('dependency-audit')
    expect(artifacts[0].summary).toBeNull()
    expect(artifacts[0].error).toContain('not available')
  })

  it('collects SBOM data', async () => {
    const sbomData = {
      bomFormat: 'CycloneDX',
      components: [{ name: 'react' }, { name: 'next' }, { name: 'zod' }],
    }
    mockReadFile.mockResolvedValueOnce(JSON.stringify(sbomData))

    const collect = await loadCollector()
    const artifacts = await collect({
      periodLabel: 'FY2025',
      sbomPath: '/path/to/sbom.json',
    })

    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].type).toBe('sbom')
    expect(artifacts[0].format).toBe('CycloneDX')
    expect(artifacts[0].componentCount).toBe(3)
  })

  it('handles SBOM read failure', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'))

    const collect = await loadCollector()
    const artifacts = await collect({
      periodLabel: 'FY2025',
      sbomPath: '/bad/sbom.json',
    })

    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].type).toBe('sbom')
    expect(artifacts[0].error).toContain('not available')
  })

  it('handles SBOM without bomFormat', async () => {
    const sbomData = { components: [] }
    mockReadFile.mockResolvedValueOnce(JSON.stringify(sbomData))

    const collect = await loadCollector()
    const artifacts = await collect({
      periodLabel: 'FY2025',
      sbomPath: '/path/sbom.json',
    })

    expect(artifacts[0].format).toBe('unknown')
    expect(artifacts[0].componentCount).toBe(0)
  })

  it('returns empty array when no paths provided', async () => {
    const collect = await loadCollector()
    const artifacts = await collect({ periodLabel: 'FY2025' })
    expect(artifacts).toEqual([])
  })

  it('collects all artifact types when all paths provided', async () => {
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify({ runs: [] }))      // codeql
      .mockResolvedValueOnce(JSON.stringify({ vulnerabilities: {} })) // audit
      .mockResolvedValueOnce(JSON.stringify({ bomFormat: 'SPDX', components: [{ name: 'a' }] })) // sbom

    const collect = await loadCollector()
    const artifacts = await collect({
      periodLabel: 'FY2025',
      codeqlResultsPath: '/codeql.json',
      auditReportPath: '/audit.json',
      sbomPath: '/sbom.json',
    })

    expect(artifacts).toHaveLength(3)
    expect(artifacts.map(a => a.type)).toEqual([
      'security-scan-findings',
      'dependency-audit',
      'sbom',
    ])
  })
})
