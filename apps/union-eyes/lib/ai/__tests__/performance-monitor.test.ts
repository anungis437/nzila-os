import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { PerformanceMonitor, performanceMonitor } from '../performance-monitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('recordRequest', () => {
    it('records a successful request', () => {
      monitor.recordRequest({
        success: true,
        latencyMs: 150,
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.01,
        model: 'gpt-4',
      });
      const metrics = monitor.getCurrentMetrics();
      expect(metrics).not.toBeNull();
      expect(metrics!.requests.total).toBe(1);
      expect(metrics!.requests.success).toBe(1);
      expect(metrics!.requests.failure).toBe(0);
    });

    it('records a failed request', () => {
      monitor.recordRequest({
        success: false,
        latencyMs: 5000,
        inputTokens: 100,
        outputTokens: 0,
        cost: 0,
      });
      const metrics = monitor.getCurrentMetrics();
      expect(metrics!.requests.failure).toBe(1);
    });

    it('accumulates tokens', () => {
      monitor.recordRequest({ success: true, latencyMs: 100, inputTokens: 50, outputTokens: 30, cost: 0.01 });
      monitor.recordRequest({ success: true, latencyMs: 200, inputTokens: 60, outputTokens: 40, cost: 0.02 });
      const metrics = monitor.getCurrentMetrics();
      expect(metrics!.tokens.input).toBe(110);
      expect(metrics!.tokens.output).toBe(70);
      expect(metrics!.tokens.total).toBe(180);
    });

    it('accumulates costs by model', () => {
      monitor.recordRequest({ success: true, latencyMs: 100, inputTokens: 50, outputTokens: 30, cost: 0.01, model: 'gpt-4' });
      monitor.recordRequest({ success: true, latencyMs: 200, inputTokens: 60, outputTokens: 40, cost: 0.005, model: 'gpt-3.5' });
      const metrics = monitor.getCurrentMetrics();
      expect(metrics!.costs.byModel['gpt-4']).toBeCloseTo(0.01);
      expect(metrics!.costs.byModel['gpt-3.5']).toBeCloseTo(0.005);
      expect(metrics!.costs.total).toBeCloseTo(0.015);
    });
  });

  describe('recordFeedback', () => {
    it('updates quality metrics', () => {
      monitor.recordRequest({ success: true, latencyMs: 100, inputTokens: 10, outputTokens: 10, cost: 0 });
      monitor.recordFeedback(4.5);
      const metrics = monitor.getCurrentMetrics();
      expect(metrics!.quality.avgSatisfactionScore).toBe(4.5);
      expect(metrics!.quality.feedbackCount).toBe(1);
    });

    it('computes running average', () => {
      monitor.recordRequest({ success: true, latencyMs: 100, inputTokens: 10, outputTokens: 10, cost: 0 });
      monitor.recordFeedback(4.0);
      monitor.recordFeedback(5.0);
      const metrics = monitor.getCurrentMetrics();
      expect(metrics!.quality.avgSatisfactionScore).toBe(4.5);
    });
  });

  describe('getCurrentMetrics', () => {
    it('returns null when no data', () => {
      expect(monitor.getCurrentMetrics()).toBeNull();
    });
  });

  describe('getAggregatedMetrics', () => {
    it('returns zeros when no data', () => {
      const agg = monitor.getAggregatedMetrics(7);
      expect(agg.totalRequests).toBe(0);
      expect(agg.totalCost).toBe(0);
    });

    it('aggregates recorded data', () => {
      monitor.recordRequest({ success: true, latencyMs: 100, inputTokens: 50, outputTokens: 20, cost: 0.01 });
      monitor.recordRequest({ success: false, latencyMs: 300, inputTokens: 30, outputTokens: 0, cost: 0 });
      const agg = monitor.getAggregatedMetrics(7);
      expect(agg.totalRequests).toBe(2);
      expect(agg.errorRate).toBe(50);
    });
  });

  describe('alerts', () => {
    it('triggers error rate alert when threshold exceeded', () => {
      // Record many failures to trigger error rate > 5%
      for (let i = 0; i < 10; i++) {
        monitor.recordRequest({ success: false, latencyMs: 100, inputTokens: 10, outputTokens: 0, cost: 0 });
      }
      const alerts = monitor.getActiveAlerts();
      expect(alerts.some(a => a.config.metric === 'errorRate')).toBe(true);
    });

    it('acknowledges alert', () => {
      for (let i = 0; i < 5; i++) {
        monitor.recordRequest({ success: false, latencyMs: 100, inputTokens: 10, outputTokens: 0, cost: 0 });
      }
      const alerts = monitor.getActiveAlerts();
      if (alerts.length > 0) {
        monitor.acknowledgeAlert(alerts[0].id);
        expect(monitor.getActiveAlerts().length).toBeLessThan(alerts.length);
      }
    });

    it('adds custom alert config', () => {
      monitor.addAlertConfig({
        metric: 'custom.metric',
        threshold: 10,
        operator: 'gt',
        severity: 'info',
        message: 'Custom alert',
      });
      // Should not throw
      expect(true).toBe(true);
    });
  });
});

describe('performanceMonitor singleton', () => {
  it('is an instance of PerformanceMonitor', () => {
    expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
  });
});
