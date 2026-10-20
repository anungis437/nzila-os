import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  withRLSContext: vi.fn(),
  generate: vi.fn(),
  buildDependencyPropagationMap: vi.fn(),
  calculateResilienceIndex: vi.fn(),
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: h.withRLSContext }));
vi.mock('drizzle-orm', () => ({ sql: Object.assign((..._a: unknown[]) => ({}), { raw: (s: string) => s }) }));
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ generate: h.generate }),
  buildOrgAiTrace: (o: string) => ({ orgId: o }),
  UE_APP_KEY: 'ue',
  UE_SYSTEM_ORG_ID: 'sys',
}));
vi.mock('../../propagation/dependency-propagator', () => ({ buildDependencyPropagationMap: h.buildDependencyPropagationMap }));
vi.mock('../../resilience-index/resilience-calculator', () => ({ calculateResilienceIndex: h.calculateResilienceIndex }));
vi.mock('../../copilot-explainability/response-builder', () => ({
  buildPropagationEvidence: () => [{ observation: 'p', dataPoint: '1', sourceType: 'propagation', confidence: 'high' }],
  buildGovernanceFlags: () => [],
  buildExplainabilityEnvelope: (evidence: unknown, reasoning: unknown, assumptions: unknown, govFlags: unknown, limitations: unknown) => ({
    evidenceReferences: evidence,
    reasoningChain: reasoning,
    governanceFlags: govFlags,
    assumptions,
    limitations,
    overallConfidence: 'medium',
  }),
}));

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { processCopilotQuery, loadConversationHistory, listConversations } from '../copilot-engine';

const ORG = '11111111-1111-4111-8111-111111111111';
const C1 = '55555555-5555-4555-8555-555555555555';
const C2 = '66666666-6666-4666-8666-666666666666';

function ctx() {
  h.buildDependencyPropagationMap.mockResolvedValue({
    nodes: [
      { isSingleSource: true, category: 'governance' },
      { isSingleSource: false, category: 'operational' },
      { isSingleSource: true, category: 'compliance' },
    ],
    bottlenecks: [{ id: 'b1' }],
  });
  h.calculateResilienceIndex.mockResolvedValue({
    overallScore: 55,
    status: 'developing',
    dimensions: [{ name: 'Documentation Maturity', score: 30 }, { name: 'Governance', score: 60 }],
  });
  h.generate.mockResolvedValue({ content: 'A'.repeat(250) });
}

describe('lib/knowledge-transfer/copilot/copilot-engine', () => {
  beforeEach(() => {
    h.execute.mockReset();
    h.withRLSContext.mockReset();
    h.withRLSContext.mockImplementation(async (_c: unknown, op: (tx: unknown) => unknown) => op({ execute: h.execute }));
    h.generate.mockReset();
    h.execute.mockResolvedValue([]);
    ctx();
  });

  it('processes a fragility query, creates conversation, returns explainable result', async () => {
    const result = await processCopilotQuery(ORG, { query: 'What is most fragile and at risk?' });
    expect(result.conversationId).toBeTruthy();
    expect(result.answer.length).toBe(250);
    expect(result.summary.endsWith('…')).toBe(true);
    expect(result.followUpSuggestions[0]).toContain('fragile');
    expect(result.evidenceReferences).toBeTruthy();
    expect(result.overallConfidence).toBe('medium');
  });

  it('returns governance follow-ups and reuses an existing conversation', async () => {
    h.execute.mockResolvedValue([{ id: C1 }]);
    const result = await processCopilotQuery(ORG, {
      query: 'How do we improve governance compliance?',
      conversationId: C1,
      priorMessages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.conversationId).toBe(C1);
    expect(result.followUpSuggestions.some((s) => s.toLowerCase().includes('governance'))).toBe(true);
  });

  it('returns mitigation and dependency follow-ups', async () => {
    const mit = await processCopilotQuery(ORG, { query: 'How do we fix and improve this?' });
    expect(mit.followUpSuggestions.some((s) => s.toLowerCase().includes('mitigation'))).toBe(true);
    const dep = await processCopilotQuery(ORG, { query: 'What is the dependency chain propagation?' });
    expect(dep.followUpSuggestions.some((s) => s.toLowerCase().includes('dependency'))).toBe(true);
  });

  it('returns default follow-ups for generic query', async () => {
    const result = await processCopilotQuery(ORG, { query: 'Tell me about my organization' });
    expect(result.followUpSuggestions.some((s) => s.includes('urgent attention'))).toBe(true);
  });

  it('loads conversation history (found and empty)', async () => {
    h.execute.mockResolvedValueOnce([{ messages: [{ id: 'm', role: 'user', content: 'x', createdAt: 'now' }] }]);
    const found = await loadConversationHistory(ORG, C1);
    expect(found.length).toBe(1);

    h.execute.mockResolvedValue([]);
    const empty = await loadConversationHistory(ORG, C2);
    expect(empty).toEqual([]);
  });

  it('lists conversations', async () => {
    h.execute
      .mockResolvedValueOnce([{ id: 'c1', title: 'T', updated_at: new Date('2025-01-01'), message_count: 4 }]);
    const list = await listConversations(ORG, 5);
    expect(list[0].id).toBe('c1');
    expect(list[0].messageCount).toBe(4);
    expect(typeof list[0].updatedAt).toBe('string');
  });

  it('scopes message appends by organization and runs in tenant context', async () => {
    await processCopilotQuery(ORG, { query: 'Tell me about my organization' });
    expect(h.withRLSContext).toHaveBeenCalled();
    for (const call of h.withRLSContext.mock.calls) {
      expect(call[0]).toEqual({ organizationId: ORG });
    }
  });

  it('treats a malformed conversation id as empty without querying', async () => {
    expect(await loadConversationHistory(ORG, 'not-a-uuid')).toEqual([]);
    expect(h.execute).not.toHaveBeenCalled();
  });

  it('refuses a non-UUID organization before touching the database', async () => {
    await expect(listConversations('org-1')).rejects.toThrow('organizationId must be a UUID');
    expect(h.execute).not.toHaveBeenCalled();
  });

  it('never issues schema DDL', () => {
    const source = readFileSync(fileURLToPath(new URL('../copilot-engine.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/CREATE\s+(TABLE|INDEX)|ALTER\s+TABLE|ensureTable/i);
  });
});