/**
 * @nzila/platform-rfp-generator — Generator Tests
 */
import { describe, it, expect } from 'vitest'
import { generateRfpResponse, renderRfpMarkdown } from '../generator'
import type { RfpGeneratorInput } from '../types'
import type { ProcurementPack } from '@nzila/platform-procurement-proof/types'
import type { AssuranceDashboard } from '@nzila/platform-assurance/types'

const mockPack: ProcurementPack = {
  packId: 'pack-001',
  orgId: 'org-1',
  generatedAt: '2026-03-04T00:00:00.000Z',
  generatedBy: 'user-1',
  status: 'signed',
  sections: {
    security: {
      dependencyAudit: {
        totalDependencies: 120,
        directDependencies: 45,
        criticalVulnerabilities: 0,
        highVulnerabilities: 1,
        mediumVulnerabilities: 3,
        lowVulnerabilities: 5,
        blockedLicenses: [],
        lockfileIntegrity: true,
        auditedAt: '2026-03-04T00:00:00.000Z',
      },
      signedAttestation: {
        attestationId: 'att-001',
        algorithm: 'sha256',
        digest: 'abc123',
        signedBy: 'ci-pipeline',
        signedAt: '2026-03-04T00:00:00.000Z',
        scope: 'full-platform',
      },
      vulnerabilitySummary: { score: 92, grade: 'A', lastScanAt: '2026-03-04T00:00:00.000Z' },
    },
    dataLifecycle: {
      manifests: [
        {
          dataCategory: 'user_pii',
          classification: 'confidential',
          storageRegion: 'southafricanorth',
          encryptionAtRest: true,
          encryptionInTransit: true,
          retentionDays: 365,
          deletionPolicy: 'auto',
        },
      ],
      retentionControls: {
        policiesEnforced: 5,
        policiesTotal: 5,
        autoDeleteEnabled: true,
        lastPurgeAt: '2026-03-01T00:00:00.000Z',
      },
    },
    operational: {
      sloCompliance: {
        overall: 99.2,
        targets: [
          { name: 'p95 latency', target: 500, actual: 320, compliant: true },
          { name: 'error rate', target: 1, actual: 0.3, compliant: true },
        ],
      },
      performanceMetrics: { p50Ms: 120, p95Ms: 320, p99Ms: 480, errorRate: 0.3, uptimePercent: 99.95 },
      incidentSummary: {
        totalIncidents: 2,
        resolvedIncidents: 2,
        meanTimeToResolutionMinutes: 18,
        lastIncidentAt: '2026-02-15T00:00:00.000Z',
      },
      trendWarnings: [],
    },
    governance: {
      evidencePackCount: 12,
      snapshotChainLength: 48,
      snapshotChainValid: true,
      policyComplianceRate: 100,
      lastEvidencePackAt: '2026-03-03T00:00:00.000Z',
      controlFamiliesCovered: ['access', 'financial', 'data', 'operational'],
    },
    sovereignty: {
      deploymentRegion: 'southafricanorth',
      dataResidency: 'ZA',
      regulatoryFrameworks: ['POPIA', 'GDPR'],
      crossBorderTransfer: false,
      validated: true,
      validatedAt: '2026-03-01T00:00:00.000Z',
    },
  },
  manifest: {
    version: '1.0',
    sectionCount: 5,
    artifactCount: 12,
    generatedAt: '2026-03-04T00:00:00.000Z',
    checksums: {},
  },
  signature: {
    algorithm: 'hmac-sha256',
    digest: 'xyz789',
    signedAt: '2026-03-04T00:00:00.000Z',
    signedBy: 'platform-signer',
    keyId: 'key-001',
  },
}

const mockDashboard: AssuranceDashboard = {
  orgId: 'org-1',
  generatedAt: '2026-03-04T00:00:00.000Z',
  compliance: {
    score: 95, grade: 'A', snapshotChainVerified: true,
    policyComplianceRate: 100, controlFamiliesCovered: 4, controlFamiliesTotal: 4,
    lastSnapshotAt: '2026-03-04T00:00:00.000Z',
  },
  security: {
    score: 88, grade: 'B', criticalVulnerabilities: 0, highVulnerabilities: 1,
    dependencyPosture: 92, attestationValid: true, lockfileIntegrity: true,
    lastScanAt: '2026-03-04T00:00:00.000Z',
  },
  ops: {
    score: 91, grade: 'A', confidenceScore: 93, sloComplianceRate: 99.2,
    p95Ms: 320, errorRate: 0.3, uptimePercent: 99.95, trendDirection: 'stable',
    incidentCount: 2,
  },
  cost: {
    score: 82, grade: 'B', budgetUtilization: 0.72, dailySpendUsd: 360,
    monthlySpendUsd: 10800, monthlyBudgetUsd: 15000, overBudget: false,
    categoriesOverCap: [],
  },
  integrationReliability: {
    score: 96, grade: 'A', slaComplianceRate: 99.8, dlqBacklog: 0,
    circuitBreakersOpen: 0, providersHealthy: 3, providersTotal: 3,
    lastHealthCheckAt: '2026-03-04T00:00:00.000Z',
  },
  overallScore: 91,
  overallGrade: 'A',
}

describe('generateRfpResponse', () => {
  it('generates responses for all 8 RFP sections', () => {
    const input: RfpGeneratorInput = {
      orgId: 'org-1',
      generatedBy: 'user-1',
      procurementPack: mockPack,
      assuranceDashboard: mockDashboard,
    }

    const response = generateRfpResponse(input)
    expect(response.sections).toHaveLength(9)
    expect(response.totalQuestions).toBeGreaterThanOrEqual(9)
    expect(response.totalAnswered).toBe(response.totalQuestions)

    // Check all 9 sections present in order
    const sectionNames = response.sections.map((s) => s.section)
    expect(sectionNames).toEqual([
      'security',
      'privacy',
      'evidence_auditability',
      'operations',
      'integration',
      'hosting_sovereignty',
      'disaster_recovery',
      'decision_layer',
      'verification',
    ])
  })

  it('includes evidence references in answers', () => {
    const input: RfpGeneratorInput = {
      orgId: 'org-1',
      generatedBy: 'user-1',
      procurementPack: mockPack,
      assuranceDashboard: mockDashboard,
    }

    const response = generateRfpResponse(input)
    for (const section of response.sections) {
      for (const answer of section.answers) {
        expect(answer.evidenceRefs.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('generateRfpResponse — alternate branches', () => {
  it('renders non-empty blockedLicenses, unverified lockfile, invalid attestation', () => {
    const altPack: ProcurementPack = {
      ...mockPack,
      sections: {
        ...mockPack.sections,
        security: {
          ...mockPack.sections.security,
          dependencyAudit: {
            ...mockPack.sections.security.dependencyAudit,
            blockedLicenses: ['MIT', 'Apache-2.0'],
            lockfileIntegrity: false,
          },
          signedAttestation: mockPack.sections.security.signedAttestation,
          vulnerabilitySummary: mockPack.sections.security.vulnerabilitySummary,
        },
      },
    }
    const altDashboard: AssuranceDashboard = {
      ...mockDashboard,
      security: { ...mockDashboard.security, attestationValid: false },
    }
    const input: RfpGeneratorInput = {
      orgId: 'org-1',
      generatedBy: 'user-1',
      procurementPack: altPack,
      assuranceDashboard: altDashboard,
    }

    const response = generateRfpResponse(input)
    const securityAnswers = response.sections.find((s) => s.section === 'security')!.answers

    // blockedLicenses non-empty → joined list
    expect(securityAnswers[0]!.answer).toContain('MIT, Apache-2.0')
    // lockfileIntegrity false → 'unverified'
    expect(securityAnswers[2]!.answer).toContain('unverified')
    // attestationValid false → 'invalid'
    expect(securityAnswers[2]!.answer).toContain('invalid')
  })

  it('renders crossBorderTransfer enabled and sovereignty pending validation', () => {
    const altPack: ProcurementPack = {
      ...mockPack,
      sections: {
        ...mockPack.sections,
        sovereignty: {
          ...mockPack.sections.sovereignty,
          crossBorderTransfer: true,
          validated: false,
        },
      },
    }
    const input: RfpGeneratorInput = {
      orgId: 'org-1',
      generatedBy: 'user-1',
      procurementPack: altPack,
      assuranceDashboard: mockDashboard,
    }

    const response = generateRfpResponse(input)
    const privacyAnswers = response.sections.find((s) => s.section === 'privacy')!.answers
    const hostingAnswers = response.sections.find((s) => s.section === 'hosting_sovereignty')!.answers

    // crossBorderTransfer true → 'enabled with safeguards'
    expect(privacyAnswers[1]!.answer).toContain('enabled with safeguards')
    // validated false → 'pending validation'
    expect(privacyAnswers[1]!.answer).toContain('pending validation')
    // hosting section → 'enabled with documented safeguards and consent'
    expect(hostingAnswers[0]!.answer).toContain('enabled with documented safeguards and consent')
  })

  it('renders autoDelete disabled and lastPurgeAt null', () => {
    const altPack: ProcurementPack = {
      ...mockPack,
      sections: {
        ...mockPack.sections,
        dataLifecycle: {
          ...mockPack.sections.dataLifecycle,
          retentionControls: {
            ...mockPack.sections.dataLifecycle.retentionControls,
            autoDeleteEnabled: false,
            lastPurgeAt: null,
          },
        },
      },
    }
    const input: RfpGeneratorInput = {
      orgId: 'org-1',
      generatedBy: 'user-1',
      procurementPack: altPack,
      assuranceDashboard: mockDashboard,
    }

    const response = generateRfpResponse(input)
    const privacyAnswers = response.sections.find((s) => s.section === 'privacy')!.answers
    const evidenceAnswers = response.sections.find((s) => s.section === 'evidence_auditability')!.answers

    // autoDeleteEnabled false → 'disabled'
    expect(privacyAnswers[2]!.answer).toContain('auto-delete disabled')
    // lastPurgeAt null → 'N/A'
    expect(evidenceAnswers[1]!.answer).toContain('N/A')
  })

  it('renders snapshotChainValid false as unverified', () => {
    const altPack: ProcurementPack = {
      ...mockPack,
      sections: {
        ...mockPack.sections,
        governance: {
          ...mockPack.sections.governance,
          snapshotChainValid: false,
        },
      },
    }
    const input: RfpGeneratorInput = {
      orgId: 'org-1',
      generatedBy: 'user-1',
      procurementPack: altPack,
      assuranceDashboard: mockDashboard,
    }

    const response = generateRfpResponse(input)
    const evidenceAnswers = response.sections.find((s) => s.section === 'evidence_auditability')!.answers

    expect(evidenceAnswers[0]!.answer).toContain('unverified')
  })

  it('renders verification appendix with missing signature', () => {
    const altPack: ProcurementPack = {
      ...mockPack,
      signature: undefined as any,
    }
    const input: RfpGeneratorInput = {
      orgId: 'org-1',
      generatedBy: 'user-1',
      procurementPack: altPack,
      assuranceDashboard: mockDashboard,
    }

    const response = generateRfpResponse(input)
    const verificationAnswers = response.sections.find((s) => s.section === 'verification')!.answers

    // sig?.keyId ?? 'N/A' and sig?.algorithm ?? 'Ed25519'
    expect(verificationAnswers[0]!.answer).toContain('N/A')
    expect(verificationAnswers[0]!.answer).toContain('Ed25519')
  })
})

describe('renderRfpMarkdown', () => {
  it('renders a complete markdown document', () => {
    const input: RfpGeneratorInput = {
      orgId: 'org-1',
      generatedBy: 'user-1',
      procurementPack: mockPack,
      assuranceDashboard: mockDashboard,
    }

    const response = generateRfpResponse(input)
    const md = renderRfpMarkdown(response)

    expect(md).toContain('# RFP Response')
    expect(md).toContain('## 1. Security Controls')
    expect(md).toContain('## 2. Privacy & Data Protection')
    expect(md).toContain('## 4. Operational Resilience')
    expect(md).toContain('## 7. Disaster Recovery')
    expect(md).toContain('## 3. Evidence & Auditability')
    expect(md).toContain('## 5. Integrations & Data Flow')
    expect(md).toContain('## 6. Hosting & Sovereignty')
    expect(md).toContain('## 8. Decision Layer')
    expect(md).toContain('## 9. Verification Appendix')
    expect(md).toContain('**Evidence:**')
  })
})
