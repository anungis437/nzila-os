/**
 * Unit tests for Phase C Zod proposal schemas.
 * Validates happy-path, default-filling, and rejection of invalid inputs.
 */
import { describe, it, expect } from 'vitest'
import {
  FinanceStripeMonthlyReportsProposalSchema,
  AiIngestKnowledgeSourceProposalSchema,
  validateActionProposal,
  ACTION_TYPES,
} from './schemas'

const ENTITY_ID = '00000000-0000-0000-0000-000000000001'

// ── FinanceStripeMonthlyReportsProposalSchema ───────────────────────────────

describe('FinanceStripeMonthlyReportsProposalSchema', () => {
  const validProposal = {
    entityId: ENTITY_ID,
    appKey: 'console',
    profileKey: 'finance-default',
    period: {
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      periodLabel: '2026-01',
    },
    outputs: ['revenue_summary', 'payout_recon'],
    evidence: { storeUnderEvidencePack: true },
  }

  it('accepts a valid proposal', () => {
    const result = FinanceStripeMonthlyReportsProposalSchema.safeParse(validProposal)
    expect(result.success).toBe(true)
  })

  it('fills defaults for outputs and evidence', () => {
    const minimal = {
      entityId: ENTITY_ID,
      appKey: 'console',
      profileKey: 'finance-default',
      period: {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        periodLabel: '2026-01',
      },
    }
    const result = FinanceStripeMonthlyReportsProposalSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.outputs).toEqual([
        'revenue_summary',
        'payout_recon',
        'refunds_summary',
        'disputes_summary',
      ])
      expect(result.data.evidence.storeUnderEvidencePack).toBe(true)
    }
  })

  it('rejects invalid date format', () => {
    const bad = { ...validProposal, period: { ...validProposal.period, startDate: '01/01/2026' } }
    const result = FinanceStripeMonthlyReportsProposalSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejects missing entityId', () => {
    const { entityId, ...rest } = validProposal
    const result = FinanceStripeMonthlyReportsProposalSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects invalid output type', () => {
    const bad = { ...validProposal, outputs: ['invalid_report_type'] }
    const result = FinanceStripeMonthlyReportsProposalSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID entityId', () => {
    const bad = { ...validProposal, entityId: 'not-a-uuid' }
    const result = FinanceStripeMonthlyReportsProposalSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })
})

// ── AiIngestKnowledgeSourceProposalSchema ───────────────────────────────────

describe('AiIngestKnowledgeSourceProposalSchema', () => {
  const validProposal = {
    entityId: ENTITY_ID,
    appKey: 'console',
    profileKey: 'knowledge-default',
    source: {
      sourceType: 'manual_text' as const,
      title: 'Test document',
      text: 'Lorem ipsum dolor sit amet. '.repeat(50),
    },
    ingestion: {
      chunkSize: 500,
      chunkOverlap: 100,
      embeddingBatchSize: 32,
      maxChunks: 100,
    },
    retention: {
      dataClass: 'internal' as const,
      retentionDays: 90,
    },
    citations: {
      requireCitations: true,
    },
  }

  it('accepts a valid manual_text proposal', () => {
    const result = AiIngestKnowledgeSourceProposalSchema.safeParse(validProposal)
    expect(result.success).toBe(true)
  })

  it('fills ingestion defaults', () => {
    const minimal = {
      entityId: ENTITY_ID,
      appKey: 'console',
      profileKey: 'knowledge-default',
      source: { sourceType: 'manual_text', title: 'Test', text: 'Content here' },
      retention: { dataClass: 'internal' },
    }
    const result = AiIngestKnowledgeSourceProposalSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ingestion.chunkSize).toBe(900)
      expect(result.data.ingestion.chunkOverlap).toBe(150)
      expect(result.data.ingestion.embeddingBatchSize).toBe(64)
      expect(result.data.ingestion.maxChunks).toBe(5000)
      expect(result.data.citations.requireCitations).toBe(true)
      expect(result.data.retention.retentionDays).toBe(90)
    }
  })

  it('rejects blob_document without documentId', () => {
    const bad = {
      ...validProposal,
      source: { sourceType: 'blob_document', title: 'Test' },
    }
    const result = AiIngestKnowledgeSourceProposalSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejects url source without url field', () => {
    const bad = {
      ...validProposal,
      source: { sourceType: 'url', title: 'Test' },
    }
    const result = AiIngestKnowledgeSourceProposalSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('accepts blob_document with documentId', () => {
    const doc = {
      ...validProposal,
      source: {
        sourceType: 'blob_document' as const,
        title: 'Test doc',
        documentId: ENTITY_ID,
      },
    }
    const result = AiIngestKnowledgeSourceProposalSchema.safeParse(doc)
    expect(result.success).toBe(true)
  })

  it('rejects chunkSize below minimum', () => {
    const bad = {
      ...validProposal,
      ingestion: { ...validProposal.ingestion, chunkSize: 50 },
    }
    const result = AiIngestKnowledgeSourceProposalSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejects invalid dataClass', () => {
    const bad = {
      ...validProposal,
      retention: { ...validProposal.retention, dataClass: 'top-secret' },
    }
    const result = AiIngestKnowledgeSourceProposalSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })
})

// ── validateActionProposal registry ─────────────────────────────────────────

describe('validateActionProposal', () => {
  it('validates a recognized action type against its schema', () => {
    const result = validateActionProposal(
      ACTION_TYPES.FINANCE_STRIPE_MONTHLY_REPORTS,
      {
        entityId: ENTITY_ID,
        appKey: 'console',
        profileKey: 'finance',
        period: { startDate: '2026-01-01', endDate: '2026-01-31', periodLabel: '2026-01' },
      },
    )
    expect(result.valid).toBe(true)
  })

  it('rejects invalid data for a recognized action type', () => {
    const result = validateActionProposal(
      ACTION_TYPES.FINANCE_STRIPE_MONTHLY_REPORTS,
      { entityId: 'bad' },
    )
    expect(result.valid).toBe(false)
  })

  it('allows freeform for unknown action types', () => {
    const result = validateActionProposal('future.action_type', { anything: 'goes' })
    expect(result.valid).toBe(true)
  })
})
