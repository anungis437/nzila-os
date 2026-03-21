/**
 * @nzila/finops — FinOps Package
 *
 * Complements @nzila/platform-cost with:
 * - Org resource quotas (enforcement + tracking)
 * - FinOps recommendations (cost optimization)
 * - Usage metering (per-org resource consumption)
 * - Budget alert policies
 */

export {
  type QuotaPolicy,
  type QuotaUsage,
  type QuotaEnforcementResult,
  QuotaPolicySchema,
  enforceQuota,
  getQuotaUsage,
  DEFAULT_QUOTA_POLICIES,
} from './quotas.js';

export {
  type Recommendation,
  type RecommendationCategory,
  generateRecommendations,
  estimateSavings,
} from './recommendations.js';

export {
  type UsageMeter,
  type UsageRecord,
  UsageRecordSchema,
  createUsageMeter,
  aggregateUsage,
} from './metering.js';

export {
  type BudgetAlert,
  type AlertSeverity,
  BudgetAlertSchema,
  evaluateBudgetAlerts,
  DEFAULT_ALERT_THRESHOLDS,
} from './alerts.js';
