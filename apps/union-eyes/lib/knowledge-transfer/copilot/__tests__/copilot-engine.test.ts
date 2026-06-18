import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  generate: vi.fn(),
  buildDependencyPropagationMap: vi.fn(),
  calculateResilienceIndex: vi.fn(),
}));

vi.mock('@/db/db', () => ({ db: { execute: h.execute } }));
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

import { processCopilotQuery, loadConversationHistory, listConversations } from '../copilot-engine';

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
    h.generate.mockReset();
    h.execute.mockResolvedValue([]);
    ctx();
  });

  it('processes a fragility query, creates conversation, returns explainable result', async () => {
    const result = await processCopilotQuery('org-1', { query: 'What is most fragile and at risk?' });
    expect(result.conversationId).toBeTruthy();
    expect(result.answer.length).toBe(250);
    expect(result.summary.endsWith('…')).toBe(true);
    expect(result.followUpSuggestions[0]).toContain('fragile');
    expect(result.evidenceReferences).toBeTruthy();
    expect(result.overallConfidence).toBe('medium');
  });

  it('returns governance follow-ups and reuses an existing conversation', async () => {
    h.execute.mockResolvedValue([{ id: 'conv-existing' }]);
    const result = await processCopilotQuery('org-1', {
      query: 'How do we improve governance compliance?',
      conversationId: 'conv-existing',
      priorMessages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.conversationId).toBe('conv-existing');
    expect(result.followUpSuggestions.some((s) => s.toLowerCase().includes('governance'))).toBe(true);
  });

  it('returns mitigation and dependency follow-ups', async () => {
    const mit = await processCopilotQuery('org-1', { query: 'How do we fix and improve this?' });
    expect(mit.followUpSuggestions.some((s) => s.toLowerCase().includes('mitigation'))).toBe(true);
    const dep = await processCopilotQuery('org-1', { query: 'What is the dependency chain propagation?' });
    expect(dep.followUpSuggestions.some((s) => s.toLowerCase().includes('dependency'))).toBe(true);
  });

  it('returns default follow-ups for generic query', async () => {
    const result = await processCopilotQuery('org-1', { query: 'Tell me about my organization' });
    expect(result.followUpSuggestions.some((s) => s.includes('urgent attention'))).toBe(true);
  });

  it('loads conversation history (found and empty)', async () => {
    h.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ messages: [{ id: 'm', role: 'user', content: 'x', createdAt: 'now' }] }]);
    const found = await loadConversationHistory('org-1', 'c1');
    expect(found.length).toBe(1);

    h.execute.mockResolvedValue([]);
    const empty = await loadConversationHistory('org-1', 'c2');
    expect(empty).toEqual([]);
  });

  it('lists conversations', async () => {
    h.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'c1', title: 'T', updated_at: new Date('2025-01-01'), message_count: 4 }]);
    const list = await listConversations('org-1', 5);
    expect(list[0].id).toBe('c1');
    expect(list[0].messageCount).toBe(4);
    expect(typeof list[0].updatedAt).toBe('string');
  });
});
