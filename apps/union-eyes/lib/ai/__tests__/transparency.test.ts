import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock crypto.randomUUID with incrementing values for unique IDs
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `${String(uuidCounter++).padStart(8, '0')}-0000-0000-0000-000000000000`),
});

import {
  AITransparencyEngine,
  AIAppealManager,
  HumanOverrideManager,
  transparencyEngine,
  appealManager,
  overrideManager,
  unionEyesModelCard,
  addAIDisclosure,
} from '../transparency';

describe('AITransparencyEngine', () => {
  let engine: AITransparencyEngine;

  beforeEach(() => {
    engine = new AITransparencyEngine();
  });

  describe('generateDisclosure', () => {
    it('generates correct disclosure for high confidence', () => {
      const disclosure = engine.generateDisclosure({
        model: 'gpt-4',
        modelVersion: '1.0',
        confidenceScore: 0.9,
        humanReviewed: false,
      });
      expect(disclosure.isAIGenerated).toBe(true);
      expect(disclosure.confidence).toBe('high');
      expect(disclosure.confidenceScore).toBe(0.9);
      expect(disclosure.model).toBe('gpt-4');
      expect(disclosure.disclosureVersion).toBe('1.0.0');
    });

    it('maps medium confidence correctly', () => {
      const disclosure = engine.generateDisclosure({
        model: 'gpt-3.5',
        modelVersion: '1.0',
        confidenceScore: 0.6,
        humanReviewed: true,
      });
      expect(disclosure.confidence).toBe('medium');
      expect(disclosure.humanReviewed).toBe(true);
    });

    it('maps low confidence correctly', () => {
      const disclosure = engine.generateDisclosure({
        model: 'test',
        modelVersion: '1.0',
        confidenceScore: 0.3,
        humanReviewed: false,
      });
      expect(disclosure.confidence).toBe('low');
    });
  });

  describe('generateExplanation', () => {
    it('generates explanation with factors and reasoning', async () => {
      const explanation = await engine.generateExplanation({
        requestId: 'req-1',
        query: 'How to file a grievance?',
        attentionBreakdown: { userQuery: 0.4, contextDocs: 0.3, jurisdictionRules: 0.2, cbaClauses: 0.1 },
        sourcesUsed: [{ title: 'CBA Section 12', type: 'cba', relevance: 0.9, snippet: 'Grievance procedure...' }],
        contextUsed: ['context1'],
      });
      expect(explanation.requestId).toBe('req-1');
      expect(explanation.factorsConsidered.length).toBeGreaterThan(0);
      expect(explanation.reasoningChain.length).toBeGreaterThan(0);
      expect(explanation.limitations.length).toBeGreaterThan(0);
      expect(explanation.sourcesUsed.length).toBe(1);
    });

    it('filters out low-weight factors', async () => {
      const explanation = await engine.generateExplanation({
        requestId: 'req-2',
        query: 'test',
        attentionBreakdown: { important: 0.5, negligible: 0.02 },
        sourcesUsed: [],
        contextUsed: [],
      });
      expect(explanation.factorsConsidered.some(f => f.weight < 0.05)).toBe(false);
    });

    it('adds complexity limitation for long queries', async () => {
      const explanation = await engine.generateExplanation({
        requestId: 'req-3',
        query: 'x'.repeat(600),
        attentionBreakdown: { userQuery: 0.5 },
        sourcesUsed: [],
        contextUsed: [],
      });
      expect(explanation.limitations.some(l => l.includes('Complex query'))).toBe(true);
    });

    it('keeps short source snippets without ellipsis', async () => {
      const explanation = await engine.generateExplanation({
        requestId: 'req-short-snip',
        query: 'test short snippet',
        attentionBreakdown: { userQuery: 0.8 },
        sourcesUsed: [{ title: 'Doc1', type: 'document', relevance: 0.9, snippet: 'A brief excerpt' }],
        contextUsed: [],
      });
      expect(explanation.sourcesUsed[0].snippet).toBe('A brief excerpt');
      expect(explanation.sourcesUsed[0].snippet).not.toContain('...');
    });

    it('omits reasoning chain step when no factors', async () => {
      const explanation = await engine.generateExplanation({
        requestId: 'req-no-factors',
        query: 'test no factors',
        attentionBreakdown: {},
        sourcesUsed: [],
        contextUsed: [],
      });
      expect(explanation.reasoningChain.some(s => s.includes('Key information'))).toBe(false);
    });

    it('assumes employer perspective when query mentions employer', async () => {
      const explanation = await engine.generateExplanation({
        requestId: 'req-employer',
        query: 'What should the employer do about overtime?',
        attentionBreakdown: { userQuery: 0.5 },
        sourcesUsed: [],
        contextUsed: [],
      });
      expect(explanation.assumptions.some(a => a.includes('union member perspective'))).toBe(false);
    });
  });

  describe('calculateConfidence', () => {
    it('returns higher score with good sources and jurisdiction', () => {
      const score = engine.calculateConfidence({
        hasSources: true,
        sourceRelevance: 0.9,
        hasJurisdiction: true,
        queryClarity: 0.8,
        contextQuality: 0.7,
      });
      expect(score).toBeGreaterThan(0.7);
    });

    it('returns lower score without sources', () => {
      const score = engine.calculateConfidence({
        hasSources: false,
        sourceRelevance: 0,
        hasJurisdiction: false,
        queryClarity: 0.5,
        contextQuality: 0.5,
      });
      expect(score).toBeLessThan(0.5);
    });

    it('clamps between 0 and 1', () => {
      const score = engine.calculateConfidence({
        hasSources: true,
        sourceRelevance: 2,
        hasJurisdiction: true,
        queryClarity: 2,
        contextQuality: 2,
      });
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});

describe('AIAppealManager', () => {
  let mgr: AIAppealManager;

  beforeEach(() => {
    mgr = new AIAppealManager();
  });

  it('files an appeal', async () => {
    const appeal = await mgr.fileAppeal({
      requestId: 'req-1',
      filedBy: 'user-1',
      reason: 'Incorrect answer',
      context: 'More details',
    });
    expect(appeal.id).toBeTruthy();
    expect(appeal.status).toBe('pending');
  });

  it('retrieves filed appeal', async () => {
    const appeal = await mgr.fileAppeal({
      requestId: 'req-2',
      filedBy: 'user-1',
      reason: 'Wrong',
      context: '',
    });
    const found = await mgr.getAppeal(appeal.id);
    expect(found).not.toBeNull();
    expect(found!.filedBy).toBe('user-1');
  });

  it('returns null for unknown appeal', async () => {
    expect(await mgr.getAppeal('nonexistent')).toBeNull();
  });

  it('gets user appeals', async () => {
    const uniqueUser = `user-appeal-filter-${Date.now()}`;
    await mgr.fileAppeal({ requestId: 'r1-filter', filedBy: uniqueUser, reason: 'a', context: '' });
    await mgr.fileAppeal({ requestId: 'r2-filter', filedBy: 'other-user', reason: 'b', context: '' });
    const appeals = await mgr.getUserAppeals(uniqueUser);
    expect(appeals.length).toBeGreaterThanOrEqual(1);
    expect(appeals.every(a => a.filedBy === uniqueUser)).toBe(true);
  });

  it('updates appeal status', async () => {
    const appeal = await mgr.fileAppeal({ requestId: 'r3', filedBy: 'u1', reason: 'x', context: '' });
    const updated = await mgr.updateAppeal({
      appealId: appeal.id,
      status: 'approved',
      reviewer: 'admin-1',
      reviewNotes: 'Valid concern',
    });
    expect(updated!.status).toBe('approved');
    expect(updated!.reviewer).toBe('admin-1');
  });
});

describe('HumanOverrideManager', () => {
  let mgr: HumanOverrideManager;

  beforeEach(() => {
    mgr = new HumanOverrideManager();
  });

  it('requests override', async () => {
    const req = await mgr.requestOverride({
      requestId: 'req-1',
      requestedBy: 'user-1',
      reason: 'Needs human review',
      priority: 'high',
      category: 'accuracy',
    });
    expect(req.status).toBe('pending');
    expect(req.priority).toBe('high');
  });

  it('retrieves override', async () => {
    await mgr.requestOverride({
      requestId: 'req-2',
      requestedBy: 'user-1',
      reason: 'test',
      priority: 'low',
      category: 'other',
    });
    const found = await mgr.getOverride('req-2');
    expect(found).not.toBeNull();
  });

  it('returns null for unknown override', async () => {
    expect(await mgr.getOverride('nope')).toBeNull();
  });

  it('gets pending overrides sorted by priority', async () => {
    const countBefore = (await mgr.getPendingOverrides()).length;
    await mgr.requestOverride({ requestId: 'sort-low', requestedBy: 'u', reason: '', priority: 'low', category: 'other' });
    await mgr.requestOverride({ requestId: 'sort-urgent', requestedBy: 'u', reason: '', priority: 'urgent', category: 'safety' });
    const pending = await mgr.getPendingOverrides();
    expect(pending.length).toBe(countBefore + 2);
    // Urgent should come before low in the sorted results
    const urgentIdx = pending.findIndex(p => p.requestId === 'sort-urgent');
    const lowIdx = pending.findIndex(p => p.requestId === 'sort-low');
    expect(urgentIdx).toBeLessThan(lowIdx);
  });

  it('resolves override', async () => {
    await mgr.requestOverride({ requestId: 'r3', requestedBy: 'u', reason: '', priority: 'medium', category: 'bias' });
    const resolved = await mgr.resolveOverride({
      requestId: 'r3',
      assignedTo: 'reviewer-1',
      status: 'completed',
      resolution: 'Fixed bias',
    });
    expect(resolved!.status).toBe('completed');
    expect(resolved!.assignedTo).toBe('reviewer-1');
  });
});

describe('unionEyesModelCard', () => {
  it('has required fields', () => {
    expect(unionEyesModelCard.modelName).toBe('UnionEyes-LLM');
    expect(unionEyesModelCard.intendedUse.length).toBeGreaterThan(0);
    expect(unionEyesModelCard.limitations.length).toBeGreaterThan(0);
    expect(unionEyesModelCard.safetyMeasures.length).toBeGreaterThan(0);
    expect(unionEyesModelCard.governance.humanOversight).toBe(true);
  });
});

describe('addAIDisclosure', () => {
  it('appends disclosure badge to response', () => {
    const disclosure = transparencyEngine.generateDisclosure({
      model: 'test',
      modelVersion: '1.0',
      confidenceScore: 0.85,
      humanReviewed: false,
    });
    const result = addAIDisclosure('Hello', disclosure);
    expect(result).toContain('Hello');
    expect(result).toContain('AI Assistant');
    expect(result).toContain('85%');
  });
});

describe('singletons', () => {
  it('transparencyEngine is AITransparencyEngine', () => {
    expect(transparencyEngine).toBeInstanceOf(AITransparencyEngine);
  });

  it('appealManager is AIAppealManager', () => {
    expect(appealManager).toBeInstanceOf(AIAppealManager);
  });

  it('overrideManager is HumanOverrideManager', () => {
    expect(overrideManager).toBeInstanceOf(HumanOverrideManager);
  });
});

// ── Batch 37: uncovered branch, function, and statement coverage ─────────
describe('AITransparencyEngine — additional branches', () => {
  let engine: AITransparencyEngine;
  beforeEach(() => { engine = new AITransparencyEngine(); });

  it('truncates long snippets but leaves short ones intact', async () => {
    const shortSnippet = 'Short text';
    const explanation = await engine.generateExplanation({
      requestId: 'req-short',
      query: 'test',
      attentionBreakdown: { userQuery: 0.5, contextDocs: 0.3 },
      sourcesUsed: [{ title: 'Doc', type: 'policy', relevance: 0.8, snippet: shortSnippet }],
      contextUsed: [],
    });
    // snippet ≤ 200 chars → no ellipsis
    expect(explanation.sourcesUsed[0].snippet).toBe(shortSnippet);
    expect(explanation.sourcesUsed[0].snippet).not.toContain('...');
  });

  it('adds low-weight limitation when >2 factors have weight < 0.1', async () => {
    const explanation = await engine.generateExplanation({
      requestId: 'req-lw',
      query: 'test query',
      attentionBreakdown: {
        factorA: 0.5,
        factorB: 0.09,
        factorC: 0.08,
        factorD: 0.07,
      },
      sourcesUsed: [],
      contextUsed: [],
    });
    // 3 factors < 0.1 → limitation about limited weight
    expect(explanation.limitations.some(l => l.includes('limited weight'))).toBe(true);
  });
});

describe('AIAppealManager — getUserAppeals', () => {
  it('returns appeals filed by user sorted by date', async () => {
    await appealManager.fileAppeal({
      requestId: 'r-1', filedBy: 'user-a', reason: 'wrong', context: 'ctx',
    });
    await appealManager.fileAppeal({
      requestId: 'r-2', filedBy: 'user-a', reason: 'incorrect', context: 'ctx2',
    });
    await appealManager.fileAppeal({
      requestId: 'r-3', filedBy: 'user-b', reason: 'other', context: 'ctx3',
    });
    const appeals = await appealManager.getUserAppeals('user-a');
    expect(appeals).toHaveLength(2);
    expect(appeals.every(a => a.filedBy === 'user-a')).toBe(true);
  });

  it('updateAppeal returns null for nonexistent appeal', async () => {
    const result = await appealManager.updateAppeal({
      appealId: 'nonexistent',
      status: 'rejected',
      reviewer: 'admin',
    });
    expect(result).toBeNull();
  });
});

describe('HumanOverrideManager — resolveOverride', () => {
  it('returns null for nonexistent override', async () => {
    const result = await overrideManager.resolveOverride({
      requestId: 'nonexistent',
      assignedTo: 'admin',
      status: 'denied',
      resolution: 'Not valid',
    });
    expect(result).toBeNull();
  });
});
