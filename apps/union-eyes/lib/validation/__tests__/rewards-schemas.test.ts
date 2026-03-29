import { describe, it, expect } from 'vitest';
import {
  createProgramSchema,
  updateProgramSchema,
  createAwardTypeSchema,
  updateAwardTypeSchema,
  createAwardSchema,
  approveAwardSchema,
  issueAwardSchema,
  revokeAwardSchema,
  rejectAwardSchema,
  createBudgetEnvelopeSchema,
  updateBudgetEnvelopeSchema,
  initiateRedemptionSchema,
  cancelRedemptionSchema,
  paginationSchema,
  awardStatusQuerySchema,
  reportQuerySchema,
  updateShopifyConfigSchema,
} from '../rewards-schemas';

const uuid = '00000000-0000-4000-8000-000000000001';

describe('rewards-schemas', () => {
  // ── createProgramSchema ────────────────────────────────
  describe('createProgramSchema', () => {
    it('accepts minimal valid input with defaults', () => {
      const result = createProgramSchema.parse({ name: 'Kudos' });
      expect(result).toEqual({
        name: 'Kudos',
        status: 'draft',
        currency: 'CAD',
      });
    });

    it('accepts full input', () => {
      const result = createProgramSchema.parse({
        name: 'Rewards',
        description: 'A program',
        status: 'active',
        currency: 'USD',
      });
      expect(result.status).toBe('active');
      expect(result.currency).toBe('USD');
    });

    it('rejects empty name', () => {
      expect(() => createProgramSchema.parse({ name: '' })).toThrow();
    });

    it('rejects name > 255 chars', () => {
      expect(() => createProgramSchema.parse({ name: 'x'.repeat(256) })).toThrow();
    });

    it('rejects invalid status enum', () => {
      expect(() => createProgramSchema.parse({ name: 'P', status: 'closed' })).toThrow();
    });

    it('rejects currency != 3 chars', () => {
      expect(() => createProgramSchema.parse({ name: 'P', currency: 'US' })).toThrow();
      expect(() => createProgramSchema.parse({ name: 'P', currency: 'USDX' })).toThrow();
    });
  });

  // ── updateProgramSchema ────────────────────────────────
  describe('updateProgramSchema', () => {
    it('accepts empty object (all fields partial)', () => {
      expect(updateProgramSchema.parse({})).toEqual({});
    });

    it('accepts partial fields', () => {
      expect(updateProgramSchema.parse({ name: 'New' })).toEqual({ name: 'New' });
    });
  });

  // ── createAwardTypeSchema ──────────────────────────────
  describe('createAwardTypeSchema', () => {
    const valid = {
      programId: uuid,
      name: 'Star Award',
      kind: 'peer' as const,
      defaultCreditAmount: 50,
    };

    it('accepts valid input with defaults', () => {
      const result = createAwardTypeSchema.parse(valid);
      expect(result.requiresApproval).toBe(false);
    });

    it('rejects non-uuid programId', () => {
      expect(() => createAwardTypeSchema.parse({ ...valid, programId: 'bad' })).toThrow();
    });

    it('rejects invalid kind', () => {
      expect(() => createAwardTypeSchema.parse({ ...valid, kind: 'custom' })).toThrow();
    });

    it('rejects zero credit amount', () => {
      expect(() => createAwardTypeSchema.parse({ ...valid, defaultCreditAmount: 0 })).toThrow();
    });

    it('rejects negative credit amount', () => {
      expect(() => createAwardTypeSchema.parse({ ...valid, defaultCreditAmount: -1 })).toThrow();
    });

    it('accepts rulesJson record', () => {
      const result = createAwardTypeSchema.parse({ ...valid, rulesJson: { a: 1 } });
      expect(result.rulesJson).toEqual({ a: 1 });
    });
  });

  // ── updateAwardTypeSchema ──────────────────────────────
  describe('updateAwardTypeSchema', () => {
    it('omits programId', () => {
      const result = updateAwardTypeSchema.parse({ name: 'Updated' });
      expect(result).not.toHaveProperty('programId');
    });
  });

  // ── createAwardSchema ──────────────────────────────────
  describe('createAwardSchema', () => {
    const valid = {
      programId: uuid,
      awardTypeId: uuid,
      recipientUserId: 'user1',
      reason: 'Great work',
    };

    it('accepts valid input', () => {
      expect(() => createAwardSchema.parse(valid)).not.toThrow();
    });

    it('rejects empty reason', () => {
      expect(() => createAwardSchema.parse({ ...valid, reason: '' })).toThrow();
    });

    it('rejects empty recipientUserId', () => {
      expect(() => createAwardSchema.parse({ ...valid, recipientUserId: '' })).toThrow();
    });
  });

  // ── Single-uuid action schemas ─────────────────────────
  describe.each([
    ['approveAwardSchema', approveAwardSchema, 'awardId'],
    ['issueAwardSchema', issueAwardSchema, 'awardId'],
  ])('%s', (_name, schema, key) => {
    it('accepts valid uuid', () => {
      expect(() => schema.parse({ [key]: uuid })).not.toThrow();
    });
    it('rejects non-uuid', () => {
      expect(() => schema.parse({ [key]: 'bad' })).toThrow();
    });
  });

  describe.each([
    ['revokeAwardSchema', revokeAwardSchema],
    ['rejectAwardSchema', rejectAwardSchema],
  ])('%s', (_name, schema) => {
    it('accepts awardId + reason', () => {
      expect(() => schema.parse({ awardId: uuid, reason: 'no' })).not.toThrow();
    });
    it('rejects empty reason', () => {
      expect(() => schema.parse({ awardId: uuid, reason: '' })).toThrow();
    });
  });

  // ── createBudgetEnvelopeSchema (with refine) ───────────
  describe('createBudgetEnvelopeSchema', () => {
    const valid = {
      programId: uuid,
      name: 'Q1 Budget',
      period: 'quarterly' as const,
      amountLimit: 10000,
      startsAt: '2026-01-01T00:00:00Z',
      endsAt: '2026-03-31T23:59:59Z',
    };

    it('accepts valid input with defaults', () => {
      const result = createBudgetEnvelopeSchema.parse(valid);
      expect(result.scopeType).toBe('org');
    });

    it('rejects endsAt before startsAt', () => {
      expect(() =>
        createBudgetEnvelopeSchema.parse({
          ...valid,
          startsAt: '2026-06-01T00:00:00Z',
          endsAt: '2026-01-01T00:00:00Z',
        })
      ).toThrow('End date must be after start date');
    });

    it('rejects endsAt == startsAt', () => {
      expect(() =>
        createBudgetEnvelopeSchema.parse({
          ...valid,
          startsAt: '2026-01-01T00:00:00Z',
          endsAt: '2026-01-01T00:00:00Z',
        })
      ).toThrow();
    });

    it('rejects non-positive amountLimit', () => {
      expect(() => createBudgetEnvelopeSchema.parse({ ...valid, amountLimit: 0 })).toThrow();
    });

    it('rejects non-datetime strings', () => {
      expect(() =>
        createBudgetEnvelopeSchema.parse({ ...valid, startsAt: '2026-01-01' })
      ).toThrow();
    });

    it('accepts all scopeType values', () => {
      for (const scope of ['org', 'local', 'department', 'manager'] as const) {
        expect(() =>
          createBudgetEnvelopeSchema.parse({ ...valid, scopeType: scope })
        ).not.toThrow();
      }
    });
  });

  // ── updateBudgetEnvelopeSchema ─────────────────────────
  describe('updateBudgetEnvelopeSchema', () => {
    it('accepts partial (no refine on update)', () => {
      const result = updateBudgetEnvelopeSchema.parse({ name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  // ── initiateRedemptionSchema ───────────────────────────
  describe('initiateRedemptionSchema', () => {
    it('accepts valid input', () => {
      expect(() =>
        initiateRedemptionSchema.parse({ programId: uuid, creditsToSpend: 10 })
      ).not.toThrow();
    });

    it('rejects zero credits', () => {
      expect(() =>
        initiateRedemptionSchema.parse({ programId: uuid, creditsToSpend: 0 })
      ).toThrow();
    });
  });

  // ── cancelRedemptionSchema ─────────────────────────────
  describe('cancelRedemptionSchema', () => {
    it('requires reason', () => {
      expect(() =>
        cancelRedemptionSchema.parse({ redemptionId: uuid, reason: '' })
      ).toThrow();
    });
  });

  // ── paginationSchema ──────────────────────────────────
  describe('paginationSchema', () => {
    it('defaults limit=20, offset=0', () => {
      const result = paginationSchema.parse({});
      expect(result).toEqual({ limit: 20, offset: 0 });
    });

    it('coerces strings to numbers', () => {
      const result = paginationSchema.parse({ limit: '5', offset: '10' });
      expect(result).toEqual({ limit: 5, offset: 10 });
    });

    it('rejects limit > 100', () => {
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
    });

    it('rejects negative offset', () => {
      expect(() => paginationSchema.parse({ offset: -1 })).toThrow();
    });
  });

  // ── awardStatusQuerySchema ─────────────────────────────
  describe('awardStatusQuerySchema', () => {
    it('defaults statuses to [pending]', () => {
      const result = awardStatusQuerySchema.parse({});
      expect(result.statuses).toEqual(['pending']);
    });

    it('accepts multiple statuses', () => {
      const result = awardStatusQuerySchema.parse({ statuses: ['approved', 'issued'] });
      expect(result.statuses).toEqual(['approved', 'issued']);
    });

    it('rejects invalid status', () => {
      expect(() => awardStatusQuerySchema.parse({ statuses: ['unknown'] })).toThrow();
    });

    it('inherits pagination defaults', () => {
      const result = awardStatusQuerySchema.parse({});
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });

  // ── reportQuerySchema ──────────────────────────────────
  describe('reportQuerySchema', () => {
    it('accepts empty object (all optional)', () => {
      expect(reportQuerySchema.parse({})).toEqual({});
    });

    it('accepts datetime strings', () => {
      expect(() =>
        reportQuerySchema.parse({
          startDate: '2026-01-01T00:00:00Z',
          endDate: '2026-12-31T23:59:59Z',
          programId: uuid,
        })
      ).not.toThrow();
    });

    it('rejects non-datetime dates', () => {
      expect(() => reportQuerySchema.parse({ startDate: '2026-01-01' })).toThrow();
    });
  });

  // ── updateShopifyConfigSchema ──────────────────────────
  describe('updateShopifyConfigSchema', () => {
    const valid = {
      shopDomain: 'store.myshopify.com',
      storefrontTokenSecretRef: 'ref-1',
      webhookSecretRef: 'whsec-1',
    };

    it('accepts valid input with defaults', () => {
      const result = updateShopifyConfigSchema.parse(valid);
      expect(result.allowedCollections).toEqual([]);
    });

    it('rejects empty shopDomain', () => {
      expect(() =>
        updateShopifyConfigSchema.parse({ ...valid, shopDomain: '' })
      ).toThrow();
    });

    it('rejects empty storefrontTokenSecretRef', () => {
      expect(() =>
        updateShopifyConfigSchema.parse({ ...valid, storefrontTokenSecretRef: '' })
      ).toThrow();
    });

    it('rejects empty webhookSecretRef', () => {
      expect(() =>
        updateShopifyConfigSchema.parse({ ...valid, webhookSecretRef: '' })
      ).toThrow();
    });
  });
});
