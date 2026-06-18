/**
 * Comprehensive tests for @nzila/platform-reasoning-engine operations.
 *
 * Covers: executeReasoningChain, getReasoningChain, getReasoningHistory,
 * generateId (internal), deduplicateCitations (internal), confidence calc.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  executeReasoningChain,
  getReasoningChain,
  getReasoningHistory,
} from '../operations';
import { createInMemoryReasoningStore } from '../memory-store';
import { ReasoningTypes, ReasoningStatuses } from '../types';
import type {
  ReasoningStore,
  ReasoningStrategy,
  Citation,
  ReasoningStep,
  ReasoningConclusion,
} from '../types';
import { OntologyEntityTypes, EntityStatuses } from '@nzila/platform-ontology';
import type { ContextEnvelope } from '@nzila/platform-context-orchestrator';

// ── Test Fixtures ───────────────────────────────────────────────────────────

const ORG = '00000000-0000-0000-0000-000000000001';
const ENTITY_ID = '00000000-0000-0000-0000-000000000099';

function makeContext(): ContextEnvelope {
  return {
    id: '00000000-0000-0000-0000-000000000050',
    tenantId: ORG,
    purpose: 'decision',
    primaryEntityType: OntologyEntityTypes.CASE,
    primaryEntityId: ENTITY_ID,
    assembledAt: '2025-06-01T00:00:00.000Z',
    entity: {
      id: ENTITY_ID,
      tenantId: ORG,
      entityType: OntologyEntityTypes.CASE,
      canonicalName: 'Case #42',
      aliases: [],
      status: EntityStatuses.ACTIVE,
      tags: [],
      sourceSystems: [],
      metadata: {},
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
    relatedEntities: [],
    relationships: [],
    recentEvents: [],
    applicableKnowledge: [],
    decisionHistory: [],
    tenantPolicies: {},
    caller: { userId: 'user-1', role: 'case_officer' },
  };
}

function makeCitation(id: string, sourceType: Citation['sourceType'] = 'policy', sourceId?: string): Citation {
  return {
    id,
    sourceType,
    sourceId: sourceId ?? `src-${id}`,
    label: `Citation ${id}`,
    excerpt: 'excerpt',
    relevance: 0.9,
  };
}

function makeStep(num: number, citations: Citation[] = [], confidence = 0.9): ReasoningStep {
  return {
    stepNumber: num,
    description: `Step ${num}`,
    input: { data: num },
    output: { result: num },
    citations,
    confidence,
    durationMs: 100,
  };
}

function makeConclusion(confidence = 0.85): ReasoningConclusion {
  return {
    summary: 'Conclusion',
    recommendation: 'Proceed',
    riskLevel: 'low',
    confidence,
    alternativeConclusions: [],
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('operations', () => {
  let store: ReasoningStore;

  beforeEach(() => {
    store = createInMemoryReasoningStore();
  });

  // ── executeReasoningChain ─────────────────────────────────────────────

  describe('executeReasoningChain', () => {
    it('returns COMPLETED chain with steps and conclusion', async () => {
      const cit1 = makeCitation('c1');
      const strategy: ReasoningStrategy = {
        type: ReasoningTypes.RISK_BASED,
        async reason() {
          return {
            steps: [makeStep(1, [cit1], 0.9), makeStep(2, [], 0.8)],
            conclusion: makeConclusion(0.85),
            citations: [cit1],
          };
        },
      };

      const chain = await executeReasoningChain({
        store,
        strategy,
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.RISK_BASED,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'Risk?',
          requestedBy: 'user-1',
        },
      });

      expect(chain.status).toBe(ReasoningStatuses.COMPLETED);
      expect(chain.steps).toHaveLength(2);
      expect(chain.conclusion).not.toBeNull();
      expect(chain.orgId).toBe(ORG);
      expect(chain.entityId).toBe(ENTITY_ID);
      expect(chain.question).toBe('Risk?');
      expect(chain.requestedBy).toBe('user-1');
      expect(chain.createdAt).toBeDefined();
      expect(chain.completedAt).toBeDefined();
    });

    it('calculates totalConfidence as average of step confidences', async () => {
      const strategy: ReasoningStrategy = {
        type: ReasoningTypes.DEDUCTIVE,
        async reason() {
          return {
            steps: [makeStep(1, [], 0.8), makeStep(2, [], 0.6)],
            conclusion: makeConclusion(0.7),
            citations: [],
          };
        },
      };

      const chain = await executeReasoningChain({
        store,
        strategy,
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.DEDUCTIVE,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'Q',
          requestedBy: 'u',
        },
      });

      expect(chain.totalConfidence).toBeCloseTo(0.7, 5); // (0.8 + 0.6) / 2
    });

    it('uses conclusion confidence when no steps', async () => {
      const strategy: ReasoningStrategy = {
        type: ReasoningTypes.INDUCTIVE,
        async reason() {
          return {
            steps: [],
            conclusion: makeConclusion(0.42),
            citations: [],
          };
        },
      };

      const chain = await executeReasoningChain({
        store,
        strategy,
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.INDUCTIVE,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'Q',
          requestedBy: 'u',
        },
      });

      expect(chain.totalConfidence).toBe(0.42);
    });

    it('deduplicates citations across steps and top-level', async () => {
      const cit1 = makeCitation('c1', 'policy', 'pol-1');
      const cit2 = makeCitation('c2', 'knowledge', 'kn-1');
      const citDup = makeCitation('c1-dup', 'policy', 'pol-1'); // same key: policy:pol-1

      const strategy: ReasoningStrategy = {
        type: ReasoningTypes.RISK_BASED,
        async reason() {
          return {
            steps: [makeStep(1, [cit1, cit2])],
            conclusion: makeConclusion(),
            citations: [citDup], // duplicate of cit1
          };
        },
      };

      const chain = await executeReasoningChain({
        store,
        strategy,
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.RISK_BASED,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'Q',
          requestedBy: 'u',
        },
      });

      // cit1 and citDup share key "policy:pol-1" → deduplicated to 1
      // cit2 is unique → 1
      // Total: 2
      expect(chain.allCitations).toHaveLength(2);
    });

    it('handles all unique citations (no duplicates)', async () => {
      const cit1 = makeCitation('c1', 'policy', 'pol-1');
      const cit2 = makeCitation('c2', 'knowledge', 'kn-1');
      const cit3 = makeCitation('c3', 'event', 'evt-1');

      const strategy: ReasoningStrategy = {
        type: ReasoningTypes.CAUSAL,
        async reason() {
          return {
            steps: [makeStep(1, [cit1, cit2])],
            conclusion: makeConclusion(),
            citations: [cit3],
          };
        },
      };

      const chain = await executeReasoningChain({
        store,
        strategy,
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.CAUSAL,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'Q',
          requestedBy: 'u',
        },
      });

      expect(chain.allCitations).toHaveLength(3);
    });

    it('persists the chain in the store', async () => {
      const strategy: ReasoningStrategy = {
        type: ReasoningTypes.RISK_BASED,
        async reason() {
          return { steps: [], conclusion: makeConclusion(), citations: [] };
        },
      };

      const chain = await executeReasoningChain({
        store,
        strategy,
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.RISK_BASED,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'Q',
          requestedBy: 'u',
        },
      });

      const stored = await store.getChain(chain.id);
      expect(stored).toBeDefined();
      expect(stored!.id).toBe(chain.id);
    });

    it('records FAILED status and empty data when strategy throws', async () => {
      const failStrategy: ReasoningStrategy = {
        type: ReasoningTypes.DEDUCTIVE,
        async reason() {
          throw new Error('Kaboom');
        },
      };

      const chain = await executeReasoningChain({
        store,
        strategy: failStrategy,
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.DEDUCTIVE,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'Q',
          requestedBy: 'u',
        },
      });

      expect(chain.status).toBe(ReasoningStatuses.FAILED);
      expect(chain.conclusion).toBeNull();
      expect(chain.steps).toHaveLength(0);
      expect(chain.allCitations).toHaveLength(0);
      expect(chain.totalConfidence).toBe(0);
      expect(chain.crossVerticalInsights).toHaveLength(0);
    });

    it('persists failed chain in the store', async () => {
      const failStrategy: ReasoningStrategy = {
        type: ReasoningTypes.DEDUCTIVE,
        async reason() {
          throw new Error('fail');
        },
      };

      const chain = await executeReasoningChain({
        store,
        strategy: failStrategy,
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.DEDUCTIVE,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'Q',
          requestedBy: 'u',
        },
      });

      const stored = await store.getChain(chain.id);
      expect(stored).toBeDefined();
      expect(stored!.status).toBe(ReasoningStatuses.FAILED);
    });

    it('generates unique chain IDs', async () => {
      const strategy: ReasoningStrategy = {
        type: ReasoningTypes.RISK_BASED,
        async reason() {
          return { steps: [], conclusion: makeConclusion(), citations: [] };
        },
      };
      const request = {
        orgId: ORG,
        reasoningType: ReasoningTypes.RISK_BASED,
        entityType: OntologyEntityTypes.CASE,
        entityId: ENTITY_ID,
        question: 'Q',
        requestedBy: 'u',
      };

      const chain1 = await executeReasoningChain({ store, strategy, context: makeContext(), request });
      const chain2 = await executeReasoningChain({ store, strategy, context: makeContext(), request });

      expect(chain1.id).not.toBe(chain2.id);
    });
  });

  // ── generateId fallback ───────────────────────────────────────────────

  describe('generateId fallback (no crypto.randomUUID)', () => {
    const origRandomUUID = globalThis.crypto?.randomUUID;

    afterEach(() => {
      if (origRandomUUID) {
        Object.defineProperty(globalThis.crypto, 'randomUUID', {
          value: origRandomUUID,
          writable: true,
          configurable: true,
        });
      }
    });

    it('falls back to counter-based ID when randomUUID is unavailable', async () => {
      // Remove randomUUID
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const strategy: ReasoningStrategy = {
        type: ReasoningTypes.RISK_BASED,
        async reason() {
          return { steps: [], conclusion: makeConclusion(), citations: [] };
        },
      };

      const chain = await executeReasoningChain({
        store,
        strategy,
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.RISK_BASED,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'Q',
          requestedBy: 'u',
        },
      });

      // Fallback format: 00000000-0000-0000-0000-XXXXXXXXXXXX
      expect(chain.id).toMatch(/^00000000-0000-0000-0000-\d{12}$/);
    });
  });

  // ── getReasoningChain ─────────────────────────────────────────────────

  describe('getReasoningChain', () => {
    it('returns chain by id', async () => {
      const strategy: ReasoningStrategy = {
        type: ReasoningTypes.RISK_BASED,
        async reason() {
          return { steps: [], conclusion: makeConclusion(), citations: [] };
        },
      };

      const chain = await executeReasoningChain({
        store,
        strategy,
        context: makeContext(),
        request: {
          orgId: ORG,
          reasoningType: ReasoningTypes.RISK_BASED,
          entityType: OntologyEntityTypes.CASE,
          entityId: ENTITY_ID,
          question: 'Q',
          requestedBy: 'u',
        },
      });

      const found = await getReasoningChain(store, chain.id);
      expect(found).toBeDefined();
      expect(found!.question).toBe('Q');
    });

    it('returns undefined for non-existent id', async () => {
      const found = await getReasoningChain(store, 'not-exists');
      expect(found).toBeUndefined();
    });
  });

  // ── getReasoningHistory ───────────────────────────────────────────────

  describe('getReasoningHistory', () => {
    it('returns all chains for an entity', async () => {
      const strategy: ReasoningStrategy = {
        type: ReasoningTypes.RISK_BASED,
        async reason() {
          return { steps: [], conclusion: makeConclusion(), citations: [] };
        },
      };
      const baseRequest = {
        orgId: ORG,
        reasoningType: ReasoningTypes.RISK_BASED,
        entityType: OntologyEntityTypes.CASE,
        entityId: ENTITY_ID,
        requestedBy: 'u',
      };

      await executeReasoningChain({
        store,
        strategy,
        context: makeContext(),
        request: { ...baseRequest, question: 'Q1' },
      });
      await executeReasoningChain({
        store,
        strategy,
        context: makeContext(),
        request: { ...baseRequest, question: 'Q2' },
      });

      const history = await getReasoningHistory(store, OntologyEntityTypes.CASE, ENTITY_ID);
      expect(history).toHaveLength(2);
    });

    it('returns empty for non-existent entity', async () => {
      const history = await getReasoningHistory(store, OntologyEntityTypes.CASE, 'no-such-entity');
      expect(history).toHaveLength(0);
    });
  });
});
