import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { ExperimentManager, experimentManager, experimentTemplates } from '../experiments';
import type { ExperimentConfig } from '../experiments';

describe('ExperimentManager', () => {
  let manager: ExperimentManager;

  beforeEach(() => {
    manager = new ExperimentManager();
  });

  describe('createExperiment', () => {
    it('creates a valid experiment', () => {
      const config: ExperimentConfig = {
        id: 'exp-1',
        name: 'Test A/B',
        description: 'Compare templates',
        templateAId: 'template-a',
        templateBId: 'template-b',
        trafficSplit: 0.5,
        startDate: new Date(),
        status: 'running',
        metrics: [{ name: 'quality', type: 'ratio', target: 'higher' }],
      };
      manager.createExperiment(config);
      expect(manager.getExperiment('exp-1')).toBeDefined();
    });
  });

  describe('getVariant', () => {
    it('returns A for non-running experiment', () => {
      manager.createExperiment({
        id: 'exp-draft',
        name: 'Draft',
        description: 'Test',
        templateAId: 'a',
        templateBId: 'b',
        trafficSplit: 0.5,
        startDate: new Date(),
        status: 'draft',
        metrics: [],
      });
      expect(manager.getVariant('exp-draft', 'session-1')).toBe('A');
    });

    it('returns A or B deterministically for same session', () => {
      manager.createExperiment({
        id: 'exp-2',
        name: 'Test',
        description: 'Test',
        templateAId: 'a',
        templateBId: 'b',
        trafficSplit: 0.5,
        startDate: new Date(),
        status: 'running',
        metrics: [],
      });
      const variant1 = manager.getVariant('exp-2', 'session-1');
      const variant2 = manager.getVariant('exp-2', 'session-1');
      expect(variant1).toBe(variant2);
      expect(['A', 'B']).toContain(variant1);
    });

    it('returns a valid variant for any session', () => {
      manager.createExperiment({
        id: 'exp-split',
        name: 'Split test',
        description: 'Test',
        templateAId: 'a',
        templateBId: 'b',
        trafficSplit: 0.5,
        startDate: new Date(),
        status: 'running',
        metrics: [],
      });
      const variants = new Set<string>();
      for (let i = 0; i < 100; i++) {
        variants.add(manager.getVariant('exp-split', `session-${i}`));
      }
      // All returned variants must be valid
      for (const v of variants) {
        expect(['A', 'B']).toContain(v);
      }
    });
  });

  describe('recordMetric', () => {
    it('records a metric without error', () => {
      manager.createExperiment({
        id: 'exp-metric',
        name: 'Test',
        description: 'Test',
        templateAId: 'a',
        templateBId: 'b',
        trafficSplit: 0.5,
        startDate: new Date(),
        status: 'running',
        metrics: [{ name: 'quality', type: 'ratio', target: 'higher' }],
      });
      expect(() => {
        manager.recordMetric('exp-metric', 'A', 'quality', 0.85);
      }).not.toThrow();
    });
  });

  describe('analyzeResults', () => {
    it('throws for unknown experiment', () => {
      expect(() => manager.analyzeResults('nonexistent')).toThrow('Experiment nonexistent not found');
    });

    it('analyzes an experiment with data', () => {
      manager.createExperiment({
        id: 'exp-analyze',
        name: 'Analysis Test',
        description: 'Test',
        templateAId: 'a',
        templateBId: 'b',
        trafficSplit: 0.5,
        startDate: new Date(),
        status: 'running',
        metrics: [{ name: 'score', type: 'ratio', target: 'higher' }],
      });
      for (let i = 0; i < 20; i++) {
        manager.recordMetric('exp-analyze', 'A', 'score', 0.8 + Math.random() * 0.1);
        manager.recordMetric('exp-analyze', 'B', 'score', 0.7 + Math.random() * 0.1);
      }
      const result = manager.analyzeResults('exp-analyze');
      expect(result).toBeDefined();
      expect(result.experimentId).toBe('exp-analyze');
      expect(result.sampleSize).toBeGreaterThan(0);
      expect(result.winner).toBeDefined();
      expect(result.recommendation).toBeTruthy();
    });

    it('sets status to completed after analysis', () => {
      manager.createExperiment({
        id: 'exp-complete',
        name: 'Complete',
        description: 'Test',
        templateAId: 'a',
        templateBId: 'b',
        trafficSplit: 0.5,
        startDate: new Date(),
        status: 'running',
        metrics: [],
      });
      manager.analyzeResults('exp-complete');
      expect(manager.getExperiment('exp-complete')?.status).toBe('completed');
    });
  });

  describe('experiment lifecycle', () => {
    it('pauses and resumes experiment', () => {
      manager.createExperiment({
        id: 'exp-lifecycle',
        name: 'Lifecycle',
        description: 'Test',
        templateAId: 'a',
        templateBId: 'b',
        trafficSplit: 0.5,
        startDate: new Date(),
        status: 'running',
        metrics: [],
      });
      manager.pauseExperiment('exp-lifecycle');
      expect(manager.getExperiment('exp-lifecycle')?.status).toBe('paused');
      manager.resumeExperiment('exp-lifecycle');
      expect(manager.getExperiment('exp-lifecycle')?.status).toBe('running');
    });

    it('lists all experiments', () => {
      manager.createExperiment({
        id: 'exp-a', name: 'A', description: '', templateAId: 'a', templateBId: 'b',
        trafficSplit: 0.5, startDate: new Date(), status: 'running', metrics: [],
      });
      manager.createExperiment({
        id: 'exp-b', name: 'B', description: '', templateAId: 'a', templateBId: 'b',
        trafficSplit: 0.5, startDate: new Date(), status: 'running', metrics: [],
      });
      expect(manager.getExperiments().length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('experimentTemplates', () => {
  it('provides attentionWeights template factory', () => {
    const config = experimentTemplates.attentionWeights('tmpl-a', 'tmpl-b');
    expect(config.templateAId).toBe('tmpl-a');
    expect(config.templateBId).toBe('tmpl-b');
    expect(config.metrics.length).toBeGreaterThan(0);
    expect(config.status).toBe('draft');
  });

  it('provides systemPrompt template factory', () => {
    const config = experimentTemplates.systemPrompt('tmpl-a', 'tmpl-b');
    expect(config.templateAId).toBe('tmpl-a');
    expect(config.metrics.some(m => m.name === 'task_completion')).toBe(true);
  });
});

describe('experimentManager singleton', () => {
  it('is an instance of ExperimentManager', () => {
    expect(experimentManager).toBeInstanceOf(ExperimentManager);
  });
});
