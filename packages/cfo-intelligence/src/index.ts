/**
 * @nzila/cfo-intelligence — barrel export
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CFO INTELLIGENCE LAYER                                      ║
 * ║                                                              ║
 * ║  AI-powered anomaly detection, trend analysis, and           ║
 * ║  actionable insights for CFO dashboards.                     ║
 * ║                                                              ║
 * ║  Usage:                                                      ║
 * ║    import { runInsightEngine } from '@nzila/cfo-intelligence'║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export {
  runInsightEngine,
  detectAnomalies,
  detectTrends,
  checkThresholds,
  type InsightSeverity,
  type InsightCategory,
  type DataSeries,
  type FinancialInsight,
  type AnomalyDetectionConfig,
  type ThresholdRule,
  type InsightEngineInput,
  type InsightEngineResult,
} from './insight-engine'
