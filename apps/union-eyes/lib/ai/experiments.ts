/**
 * AI Template A/B Testing Framework
 * 
 * Enables controlled experiments to compare template performance
 * and automatically optimize based on feedback.
 */

import { logger } from '@/lib/logger';

// Experiment configuration
export interface ExperimentConfig {
  id: string;
  name: string;
  description: string;
  templateAId: string;
  templateBId: string;
  trafficSplit: number; // 0-1, percentage of traffic to variant A
  startDate: Date;
  endDate?: Date;
  status: 'draft' | 'running' | 'paused' | 'completed';
  metrics: ExperimentMetric[];
}

export interface ExperimentMetric {
  name: string;
  type: 'counter' | 'ratio' | 'duration';
  target: 'higher' | 'lower';
}

export interface ExperimentResult {
  experimentId: string;
  variant: 'A' | 'B';
  sampleSize: number;
  metrics: Record<string, {
    value: number;
    confidence: number;
    significant: boolean;
  }>;
  winner?: 'A' | 'B' | 'tie';
  recommendation: string;
}

// Metric tracking
interface MetricSample {
  timestamp: Date;
  variant: 'A' | 'B';
  value: number;
}

/**
 * Template A/B Experiment Manager
 */
class ExperimentManager {
  private experiments: Map<string, ExperimentConfig> = new Map();
  private metrics: Map<string, MetricSample[]> = new Map();

  /**
   * Create a new experiment
   */
  createExperiment(config: ExperimentConfig): void {
    this.experiments.set(config.id, config);
    this.metrics.set(config.id, []);
    
    logger.info('Experiment created', { 
      experimentId: config.id,
      name: config.name,
      trafficSplit: config.trafficSplit,
    });
  }

  /**
   * Get variant for a user session (deterministic)
   */
  getVariant(experimentId: string, sessionId: string): 'A' | 'B' {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return 'A'; // Default to control
    }

    // Deterministic assignment based on session hash
    const hash = this.hashString(sessionId + experimentId);
    const normalized = hash / 0xffffffff;
    
    return normalized < experiment.trafficSplit ? 'A' : 'B';
  }

  /**
   * Record a metric for an experiment
   */
  recordMetric(
    experimentId: string, 
    variant: 'A' | 'B', 
    metricName: string, 
    value: number
  ): void {
    const key = `${experimentId}:${metricName}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    this.metrics.get(key)!.push({
      timestamp: new Date(),
      variant,
      value,
    });
  }

  /**
   * Analyze experiment results
   */
  analyzeResults(experimentId: string): ExperimentResult {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const results: ExperimentResult = {
      experimentId,
      variant: 'A', // Placeholder
      sampleSize: 0,
      metrics: {},
      recommendation: '',
    };

    // Analyze each metric
    for (const metric of experiment.metrics) {
      const key = `${experimentId}:${metric.name}`;
      const samples = this.metrics.get(key) || [];
      
      const variantASamples = samples.filter(s => s.variant === 'A');
      const variantBSamples = samples.filter(s => s.variant === 'B');
      
      const meanA = this.calculateMean(variantASamples.map(s => s.value));
      const meanB = this.calculateMean(variantBSamples.map(s => s.value));
      
      // Calculate confidence (simplified t-test approximation)
      const stdA = this.calculateStdDev(variantASamples.map(s => s.value), meanA);
      const stdB = this.calculateStdDev(variantBSamples.map(s => s.value), meanB);
      
      const nA = variantASamples.length;
      const nB = variantBSamples.length;
      
      // Standard error of difference
      const se = Math.sqrt((stdA * stdA / nA) + (stdB * stdB / nB));
      const zScore = se > 0 ? (meanB - meanA) / se : 0;
      const confidence = this.zScoreToConfidence(Math.abs(zScore));
      
      // Determine winner
      const significant = confidence >= 0.95;
      let _winner: 'A' | 'B' | 'tie' = 'tie';
      
      if (significant) {
        if (metric.target === 'higher') {
          _winner = meanB > meanA ? 'B' : 'A';
        } else {
          _winner = meanB < meanA ? 'B' : 'A';
        }
      }

      results.metrics[metric.name] = {
        value: meanB - meanA,
        confidence,
        significant,
      };
    }

    results.sampleSize = (this.metrics.get(`${experimentId}:${experiment.metrics[0]?.name}`) || []).length;
    
    // Determine overall winner
    const significantMetrics = Object.values(results.metrics).filter(m => m.significant);
    const bWins = significantMetrics.filter(m => m.value > 0).length;
    const aWins = significantMetrics.filter(m => m.value < 0).length;
    
    if (bWins > aWins) {
      results.winner = 'B';
      results.recommendation = `Variant B performs better. Consider promoting to production.`;
    } else if (aWins > bWins) {
      results.winner = 'A';
      results.recommendation = `Control (A) performs better. Keep current template.`;
    } else {
      results.winner = 'tie';
      results.recommendation = `No significant difference. Continue testing or pick based on other factors.`;
    }

    // Update experiment status
    experiment.status = 'completed';
    
    logger.info('Experiment analyzed', {
      experimentId,
      winner: results.winner,
      recommendation: results.recommendation,
    });

    return results;
  }

  /**
   * Get all experiments
   */
  getExperiments(): ExperimentConfig[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Get experiment by ID
   */
  getExperiment(id: string): ExperimentConfig | undefined {
    return this.experiments.get(id);
  }

  /**
   * Pause an experiment
   */
  pauseExperiment(id: string): void {
    const exp = this.experiments.get(id);
    if (exp) {
      exp.status = 'paused';
      logger.info('Experiment paused', { experimentId: id });
    }
  }

  /**
   * Resume an experiment
   */
  resumeExperiment(id: string): void {
    const exp = this.experiments.get(id);
    if (exp) {
      exp.status = 'running';
      logger.info('Experiment resumed', { experimentId: id });
    }
  }

  // Helper: Simple string hash
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  // Helper: Calculate mean
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  // Helper: Calculate standard deviation
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  // Helper: Convert z-score to confidence
  private zScoreToConfidence(z: number): number {
    // Approximation of normal CDF
    if (z > 6) return 0.999999;
    if (z < 0) return 1 - this.zScoreToConfidence(-z);
    
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = z < 0 ? -1 : 1;
    const t = 1 / (1 + p * Math.abs(z));
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    
    return 0.5 * (1 + sign * y);
  }
}

// Export singleton
export const experimentManager = new ExperimentManager();
export { ExperimentManager };

// Predefined experiment templates
export const experimentTemplates = {
  /**
   * Test different attention weight configurations
   */
  attentionWeights: (templateAId: string, templateBId: string): ExperimentConfig => ({
    id: `exp-attention-${Date.now()}`,
    name: 'Attention Weight Optimization',
    description: 'Compare different attention weight configurations',
    templateAId,
    templateBId,
    trafficSplit: 0.5,
    startDate: new Date(),
    status: 'draft',
    metrics: [
      { name: 'user_satisfaction', type: 'ratio', target: 'higher' },
      { name: 'response_accuracy', type: 'ratio', target: 'higher' },
      { name: 'response_time', type: 'duration', target: 'lower' },
    ],
  }),

  /**
   * Test different system prompts
   */
  systemPrompt: (templateAId: string, templateBId: string): ExperimentConfig => ({
    id: `exp-prompt-${Date.now()}`,
    name: 'System Prompt Optimization',
    description: 'Compare different system prompt configurations',
    templateAId,
    templateBId,
    trafficSplit: 0.5,
    startDate: new Date(),
    status: 'draft',
    metrics: [
      { name: 'user_satisfaction', type: 'ratio', target: 'higher' },
      { name: 'task_completion', type: 'ratio', target: 'higher' },
    ],
  }),
};
