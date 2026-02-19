/**
 * Integration tests for Phase C action engine.
 *
 * These mock external dependencies (DB, Stripe, Azure OpenAI, Blob)
 * and test the propose → policy-check → execute → attest flow end-to-end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock @nzila/db ──────────────────────────────────────────────────────────

const mockDbInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([
      {
        id: '00000000-0000-0000-0000-aaaaaaaaaaaa',
        entityId: '00000000-0000-0000-0000-111111111111',
        appKey: 'console',
        profileKey: 'finance-default',
        actionType: 'finance.generate_stripe_monthly_reports',
        riskTier: 'low',
        status: 'approved',
        requestedBy: 'user_abc',
        approvedBy: 'user_abc',
        approvedAt: new Date(),
        proposalJson: {},
        relatedDomainType: null,
        relatedDomainId: null,
        aiRequestId: null,
        evidencePackEligible: true,
        policyDecisionJson: { allowed: true, riskTier: 'low', autoApproved: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
  }),
})

const mockDbSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  }),
})

const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
})

vi.mock('@nzila/db', () => ({
  db: {
    insert: mockDbInsert,
    select: mockDbSelect,
    update: mockDbUpdate,
  },
}))

vi.mock('@nzila/db/schema', () => ({
  aiActions: { id: 'id', entityId: 'entityId', actionType: 'actionType' },
  aiActionRuns: { id: 'id', actionId: 'actionId' },
  aiCapabilityProfiles: { entityId: 'entityId', appKey: 'appKey', environment: 'environment', profileKey: 'profileKey' },
  aiUsageBudgets: { entityId: 'entityId', appKey: 'appKey', profileKey: 'profileKey', month: 'month' },
  aiKnowledgeSources: { entityId: 'entityId', title: 'title', appKey: 'appKey', id: 'id' },
  aiKnowledgeIngestionRuns: { id: 'id' },
  aiEmbeddings: {},
  documents: { id: 'id', entityId: 'entityId', linkedType: 'linkedType', linkedId: 'linkedId' },
  auditEvents: { entityId: 'entityId', createdAt: 'createdAt', hash: 'hash' },
  evidencePacks: {},
  evidencePackArtifacts: {},
  stripeReports: { entityId: 'entityId', startDate: 'startDate', endDate: 'endDate' },
}))

// ── Mock @nzila/blob ────────────────────────────────────────────────────────

vi.mock('@nzila/blob', () => ({
  uploadBuffer: vi.fn().mockResolvedValue({
    blobPath: 'exports/test/blob.json',
    sha256: 'abc123',
    sizeBytes: 100,
  }),
  downloadBuffer: vi.fn().mockResolvedValue({
    buffer: Buffer.from('test content'),
    blobPath: 'test/blob.txt',
  }),
  generateSasUrl: vi.fn().mockResolvedValue('https://test.blob.core.windows.net/test?sas=token'),
  computeSha256: vi.fn().mockReturnValue('deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678'),
}))

// ── Mock @nzila/os-core/hash ────────────────────────────────────────────────

vi.mock('@nzila/os-core/hash', () => ({
  computeEntryHash: vi.fn().mockReturnValue('hash-chain-entry-001'),
  verifyChain: vi.fn().mockReturnValue(true),
}))

// ── Mock @nzila/payments-stripe ─────────────────────────────────────────────

vi.mock('@nzila/payments-stripe', () => ({
  generateStripeReports: vi.fn().mockResolvedValue([
    {
      reportType: 'revenue_summary',
      blobPath: 'exports/entity/stripe/2026/01/revenue_summary.json',
      sha256: 'aaa111',
      sizeBytes: 500,
      documentId: 'doc-rev-001',
      reportId: 'stripe-rev-001',
    },
    {
      reportType: 'payout_recon',
      blobPath: 'exports/entity/stripe/2026/01/payout_recon.json',
      sha256: 'bbb222',
      sizeBytes: 600,
      documentId: 'doc-pay-001',
      reportId: 'stripe-pay-001',
    },
  ]),
}))

// ── Mock @nzila/ai-core embedding ───────────────────────────────────────────

vi.mock('@nzila/ai-core', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    embed: vi.fn().mockResolvedValue({
      embeddings: [new Array(1536).fill(0.1)],
      tokenCount: 100,
    }),
    appendAiAuditEvent: vi.fn().mockResolvedValue(undefined),
  }
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Stripe tool idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('idempotency key is deterministic for same proposal', async () => {
    // Import after mocks
    const { generateMonthlyReports } = await import('./stripeTool')

    const proposal = {
      entityId: '00000000-0000-0000-0000-111111111111',
      appKey: 'console',
      profileKey: 'finance-default',
      period: {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        periodLabel: '2026-01',
      },
      outputs: ['revenue_summary', 'payout_recon'] as const,
      evidence: { storeUnderEvidencePack: true },
    }

    // First call generates new reports
    const result1 = await generateMonthlyReports(proposal as any, 'user_abc')
    expect(result1.idempotencyKey).toBe(
      '00000000-0000-0000-0000-111111111111::2026-01::payout_recon,revenue_summary::all',
    )

    // Verify toolCalls are logged
    expect(result1.toolCalls.length).toBeGreaterThan(0)
  })
})

describe('Chunker + embeddings flow', () => {
  it('chunk → embed produces correct counts', async () => {
    const { chunkText } = await import('./knowledgeTool')

    const text = 'A'.repeat(2000)
    const chunks = chunkText(text, 500, 100, 100)

    // step = 500 - 100 = 400
    // chunks: 0..500, 400..900, 800..1300, 1200..1700, 1600..2000
    expect(chunks).toHaveLength(5)
    expect(chunks[0].text.length).toBe(500)
    expect(chunks[chunks.length - 1].text.length).toBe(400) // 1600..2000
  })
})

describe('Sanitize pipeline idempotency', () => {
  it('same proposal JSON produces same hash every time', async () => {
    const { hashSanitized } = await import('./sanitize')

    const proposal = {
      entityId: '00000000-0000-0000-0000-111111111111',
      period: { periodLabel: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31' },
      outputs: ['revenue_summary', 'payout_recon'],
    }

    const hash1 = hashSanitized(proposal)
    const hash2 = hashSanitized(proposal)
    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^[a-f0-9]{64}$/)
  })

  it('different proposals produce different hashes', async () => {
    const { hashSanitized } = await import('./sanitize')

    const p1 = { period: { periodLabel: '2026-01' } }
    const p2 = { period: { periodLabel: '2026-02' } }
    expect(hashSanitized(p1)).not.toBe(hashSanitized(p2))
  })
})
