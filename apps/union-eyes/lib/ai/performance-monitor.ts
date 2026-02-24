/**
 * AI Performance Monitoring Service
 * 
 * Real-time monitoring and metrics collection for AI system performance.
 */

import { logger } from '@/lib/logger';

// Metrics types
export interface AIMetrics {
  timestamp: Date;
  requests: {
    total: number;
    success: number;
    failure: number;
    latency: {
      p50: number;
      p95: number;
      p99: number;
      avg: number;
    };
  };
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  costs: {
    total: number;
    byModel: Record<string, number>;
  };
  quality: {
    avgSatisfactionScore: number;
    feedbackCount: number;
    errorRate: number;
  };
}

export interface AlertConfig {
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface Alert {
  id: string;
  config: AlertConfig;
  value: number;
  triggeredAt: Date;
  acknowledged: boolean;
}

/**
 * Performance Monitor
 */
class PerformanceMonitor {
  private metrics: AIMetrics[] = [];
  private alerts: Alert[] = [];
  private alertConfigs: AlertConfig[] = [];
  private maxMetricsHistory = 1000;

  constructor() {
    // Default alert configurations
    this.initializeDefaultAlerts();
  }

  /**
   * Initialize default alerts
   */
  private initializeDefaultAlerts(): void {
    this.alertConfigs = [
      {
        metric: 'errorRate',
        threshold: 5,
        operator: 'gt',
        severity: 'critical',
        message: 'AI error rate exceeds 5%',
      },
      {
        metric: 'latency.p99',
        threshold: 10000,
        operator: 'gt',
        severity: 'warning',
        message: 'P99 latency exceeds 10 seconds',
      },
      {
        metric: 'cost.total',
        threshold: 100,
        operator: 'gt',
        severity: 'warning',
        message: 'Daily AI costs exceed $100',
      },
      {
        metric: 'quality.avgScore',
        threshold: 3.5,
        operator: 'lt',
        severity: 'warning',
        message: 'Average satisfaction score below 3.5',
      },
    ];
  }

  /**
   * Record a request
   */
  recordRequest(params: {
    success: boolean;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    model?: string;
  }): void {
    const now = new Date();
    const today = this.getOrCreateTodayMetrics(now);

    // Update request counts
    today.requests.total++;
    if (params.success) {
      today.requests.success++;
    } else {
      today.requests.failure++;
    }

    // Update latency (simplified - real impl would use histogram)
    const latencies = this.getRecentLatencies(today.requests.total);
    latencies.push(params.latencyMs);
    if (latencies.length > 100) latencies.shift();
    
    today.requests.latency = this.calculatePercentiles(latencies);

    // Update tokens
    today.tokens.input += params.inputTokens;
    today.tokens.output += params.outputTokens;
    today.tokens.total += params.inputTokens + params.outputTokens;

    // Update costs
    today.costs.total += params.cost;
    if (params.model) {
      today.costs.byModel[params.model] = 
        (today.costs.byModel[params.model] || 0) + params.cost;
    }

    // Check alerts
    this.checkAlerts(today);

    logger.debug('AI metrics recorded', { 
      success: params.success, 
      latency: params.latencyMs,
      cost: params.cost,
    });
  }

  /**
   * Record feedback (for quality metrics)
   */
  recordFeedback(score: number): void {
    const now = new Date();
    const today = this.getOrCreateTodayMetrics(now);

    // Update quality metrics (running average)
    const currentCount = today.quality.feedbackCount;
    const currentAvg = today.quality.avgSatisfactionScore;
    
    today.quality.feedbackCount++;
    today.quality.avgSatisfactionScore = 
      (currentAvg * currentCount + score) / (currentCount + 1);

    // Calculate error rate
    today.quality.errorRate = 
      (today.requests.failure / today.requests.total) * 100;
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): AIMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  /**
   * Get metrics for a time range
   */
  getMetricsRange(startDate: Date, endDate: Date): AIMetrics[] {
    return this.metrics.filter(m => 
      m.timestamp >= startDate && m.timestamp <= endDate
    );
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(days: number = 7): {
    totalRequests: number;
    avgLatency: number;
    totalTokens: number;
    totalCost: number;
    avgSatisfaction: number;
    errorRate: number;
  } {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const recentMetrics = this.getMetricsRange(startDate, new Date());
    
    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        avgLatency: 0,
        totalTokens: 0,
        totalCost: 0,
        avgSatisfaction: 0,
        errorRate: 0,
      };
    }

    const totals = recentMetrics.reduce((acc, m) => ({
      requests: acc.requests + m.requests.total,
      latency: acc.latency + m.requests.latency.avg,
      tokens: acc.tokens + m.tokens.total,
      cost: acc.cost + m.costs.total,
      satisfaction: acc.satisfaction + m.quality.avgSatisfactionScore * m.quality.feedbackCount,
      feedbackCount: acc.feedbackCount + m.quality.feedbackCount,
      failures: acc.failures + m.requests.failure,
    }), {
      requests: 0,
      latency: 0,
      tokens: 0,
      cost: 0,
      satisfaction: 0,
      feedbackCount: 0,
      failures: 0,
    });

    const totalRequests = totals.requests;
    
    return {
      totalRequests,
      avgLatency: totalRequests > 0 ? totals.latency / recentMetrics.length : 0,
      totalTokens: totals.tokens,
      totalCost: totals.cost,
      avgSatisfaction: totals.feedbackCount > 0 
        ? totals.satisfaction / totals.feedbackCount 
        : 0,
      errorRate: totalRequests > 0 
        ? (totals.failures / totalRequests) * 100 
        : 0,
    };
  }

  /**
   * Get unacknowledged alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Add custom alert configuration
   */
  addAlertConfig(config: AlertConfig): void {
    this.alertConfigs.push(config);
  }

  // Helper: Get or create today's metrics entry
  private getOrCreateTodayMetrics(date: Date): AIMetrics {
    const todayStr = date.toISOString().split('T')[0];
    
    let today = this.metrics.find(m => 
      m.timestamp.toISOString().split('T')[0] === todayStr
    );

    if (!today) {
      today = {
        timestamp: date,
        requests: { total: 0, success: 0, failure: 0, latency: { p50: 0, p95: 0, p99: 0, avg: 0 } },
        tokens: { input: 0, output: 0, total: 0 },
        costs: { total: 0, byModel: {} },
        quality: { avgSatisfactionScore: 0, feedbackCount: 0, errorRate: 0 },
      };
      this.metrics.push(today);
      
      // Trim history if needed
      if (this.metrics.length > this.maxMetricsHistory) {
        this.metrics.shift();
      }
    }

    return today;
  }

  // Helper: Get recent latencies
  private getRecentLatencies(_limit: number): number[] {
    // In a real implementation, this would query a proper histogram
    return [];
  }

  // Helper: Calculate percentiles
  private calculatePercentiles(values: number[]): AIMetrics['requests']['latency'] {
    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;

    return {
      p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
      avg,
    };
  }

  // Helper: Check alerts
  private checkAlerts(metrics: AIMetrics): void {
    const errorRate = (metrics.requests.failure / Math.max(1, metrics.requests.total)) * 100;
    const latencyP99 = metrics.requests.latency.p99;
    const costTotal = metrics.costs.total;
    const satisfaction = metrics.quality.avgSatisfactionScore;

    const values: Record<string, number> = {
      errorRate,
      'latency.p99': latencyP99,
      'cost.total': costTotal,
      'quality.avgScore': satisfaction,
    };

    for (const config of this.alertConfigs) {
      const value = values[config.metric];
      if (value === undefined) continue;

      let triggered = false;
      switch (config.operator) {
        case 'gt': triggered = value > config.threshold; break;
        case 'lt': triggered = value < config.threshold; break;
        case 'gte': triggered = value >= config.threshold; break;
        case 'lte': triggered = value <= config.threshold; break;
      }

      if (triggered) {
        // Check if alert already exists (don&apos;t spam)
        const existingAlert = this.alerts.find(a => 
          a.config.metric === config.metric && 
          !a.acknowledged &&
          (Date.now() - a.triggeredAt.getTime()) < 3600000 // Within last hour
        );

        if (!existingAlert) {
          const alert: Alert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            config,
            value,
            triggeredAt: new Date(),
            acknowledged: false,
          };
          this.alerts.push(alert);
          
          logger.warn('AI Performance Alert triggered', {
            metric: config.metric,
            value,
            threshold: config.threshold,
            severity: config.severity,
          });

          // Keep only recent alerts
          if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-100);
          }
        }
      }
    }
  }
}

// Export singleton
export const performanceMonitor = new PerformanceMonitor();
export { PerformanceMonitor };
