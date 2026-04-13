/**
 * Tests for @nzila/platform-reasoning-engine types and schema modules.
 *
 * Covers: ReasoningRequestSchema validation, constants, and Drizzle schema import.
 */

import { describe, it, expect } from 'vitest';
import {
  ReasoningTypes,
  ReasoningStatuses,
  ReasoningRequestSchema,
} from '../types';
import { reasoningChains } from '../schema';

// ── ReasoningTypes ──────────────────────────────────────────────────────────

describe('ReasoningTypes', () => {
  it('defines all reasoning type values', () => {
    expect(ReasoningTypes.DEDUCTIVE).toBe('deductive');
    expect(ReasoningTypes.INDUCTIVE).toBe('inductive');
    expect(ReasoningTypes.ABDUCTIVE).toBe('abductive');
    expect(ReasoningTypes.ANALOGICAL).toBe('analogical');
    expect(ReasoningTypes.CAUSAL).toBe('causal');
    expect(ReasoningTypes.RISK_BASED).toBe('risk_based');
    expect(ReasoningTypes.POLICY_BASED).toBe('policy_based');
    expect(ReasoningTypes.CROSS_VERTICAL).toBe('cross_vertical');
  });

  it('has 8 reasoning types', () => {
    expect(Object.keys(ReasoningTypes)).toHaveLength(8);
  });
});

// ── ReasoningStatuses ───────────────────────────────────────────────────────

describe('ReasoningStatuses', () => {
  it('defines all status values', () => {
    expect(ReasoningStatuses.PENDING).toBe('pending');
    expect(ReasoningStatuses.IN_PROGRESS).toBe('in_progress');
    expect(ReasoningStatuses.COMPLETED).toBe('completed');
    expect(ReasoningStatuses.FAILED).toBe('failed');
    expect(ReasoningStatuses.INCONCLUSIVE).toBe('inconclusive');
  });

  it('has 5 statuses', () => {
    expect(Object.keys(ReasoningStatuses)).toHaveLength(5);
  });
});

// ── ReasoningRequestSchema ──────────────────────────────────────────────────

describe('ReasoningRequestSchema', () => {
  const validRequest = {
    orgId: '11111111-1111-1111-1111-111111111111',
    reasoningType: 'risk_based',
    entityType: 'case',
    entityId: '22222222-2222-2222-2222-222222222222',
    question: 'What is the risk?',
    requestedBy: 'user-1',
  };

  it('validates a correct request', () => {
    const parsed = ReasoningRequestSchema.parse(validRequest);
    expect(parsed.orgId).toBe(validRequest.orgId);
    expect(parsed.reasoningType).toBe('risk_based');
  });

  it('accepts all reasoning types', () => {
    for (const type of Object.values(ReasoningTypes)) {
      expect(() =>
        ReasoningRequestSchema.parse({ ...validRequest, reasoningType: type }),
      ).not.toThrow();
    }
  });

  it('rejects invalid orgId (not UUID)', () => {
    expect(() =>
      ReasoningRequestSchema.parse({ ...validRequest, orgId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('rejects invalid entityId (not UUID)', () => {
    expect(() =>
      ReasoningRequestSchema.parse({ ...validRequest, entityId: 'bad' }),
    ).toThrow();
  });

  it('rejects unknown reasoning type', () => {
    expect(() =>
      ReasoningRequestSchema.parse({ ...validRequest, reasoningType: 'unknown' }),
    ).toThrow();
  });

  it('rejects empty question', () => {
    expect(() =>
      ReasoningRequestSchema.parse({ ...validRequest, question: '' }),
    ).toThrow();
  });

  it('rejects empty requestedBy', () => {
    expect(() =>
      ReasoningRequestSchema.parse({ ...validRequest, requestedBy: '' }),
    ).toThrow();
  });

  it('rejects empty entityType', () => {
    expect(() =>
      ReasoningRequestSchema.parse({ ...validRequest, entityType: '' }),
    ).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => ReasoningRequestSchema.parse({})).toThrow();
    expect(() => ReasoningRequestSchema.parse({ orgId: validRequest.orgId })).toThrow();
  });
});

// ── Drizzle Schema ──────────────────────────────────────────────────────────

describe('reasoningChains schema', () => {
  it('is defined as a pgTable', () => {
    expect(reasoningChains).toBeDefined();
  });
});
