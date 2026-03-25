import { pgTable, uuid, text, timestamp, jsonb, integer, numeric, boolean, index, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../../db/schema-organizations';
import { users } from '../../db/schema/user-management-schema';

/**
 * Analytics Metrics Table
 * Stores computed metrics for dashboard and reporting
 * Supports custom metrics, KPIs, and comparative analysis
 */
export const analyticsMetrics = pgTable('analytics_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  metricType: text('metric_type').notNull(), // 'claims_volume', 'resolution_time', 'member_growth', 'custom'
  metricName: text('metric_name').notNull(),
  metricValue: numeric('metric_value').notNull(),
  metricUnit: text('metric_unit'), // 'count', 'percentage', 'days', 'dollars'
  periodType: text('period_type').notNull(), // 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  metadata: jsonb('metadata'), // Additional context, filters applied, calculation method
  comparisonValue: numeric('comparison_value'), // Previous period value for comparison
  trend: text('trend'), // 'up', 'down', 'stable'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('analytics_metrics_org_idx').on(table.organizationId),
  typeIdx: index('analytics_metrics_type_idx').on(table.metricType),
  periodIdx: index('analytics_metrics_period_idx').on(table.periodStart, table.periodEnd),
}));

/**
 * KPI Configurations Table
 * User-defined KPIs with thresholds, alerts, and visualization settings
 */
export const kpiConfigurations = pgTable('kpi_configurations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdBy: varchar('created_by', { length: 255 }).notNull().references(() => users.userId),
  name: text('name').notNull(),
  description: text('description'),
  metricType: text('metric_type').notNull(), // Links to analyticsMetrics.metricType
  dataSource: text('data_source').notNull(), // 'claims', 'members', 'financial', 'custom_query'
  calculation: jsonb('calculation').notNull(), // Formula, aggregation method, filters
  visualizationType: text('visualization_type').notNull(), // 'line', 'bar', 'pie', 'gauge', 'number'
  targetValue: numeric('target_value'), // Goal/target for this KPI
  warningThreshold: numeric('warning_threshold'),
  criticalThreshold: numeric('critical_threshold'),
  alertEnabled: boolean('alert_enabled').default(false),
  alertRecipients: jsonb('alert_recipients'), // Array of user IDs or emails
  refreshInterval: integer('refresh_interval').default(3600), // Seconds
  isActive: boolean('is_active').default(true),
  displayOrder: integer('display_order'),
  dashboardLayout: jsonb('dashboard_layout'), // Position, size in grid
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('kpi_configurations_org_idx').on(table.organizationId),
  activeIdx: index('kpi_configurations_active_idx').on(table.isActive),
}));

/**
 * ML Predictions Table
 * Stores machine learning predictions for forecasting
 */
export const mlPredictions = pgTable('ml_predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  predictionType: text('prediction_type').notNull(), // 'claims_volume', 'resource_needs', 'budget_forecast'
  modelName: text('model_name').notNull(), // 'arima', 'prophet', 'linear_regression', 'random_forest'
  modelVersion: text('model_version').notNull(),
  targetDate: timestamp('target_date').notNull(), // Date being predicted
  predictedValue: numeric('predicted_value').notNull(),
  confidenceInterval: jsonb('confidence_interval'), // { lower: number, upper: number }
  confidenceScore: numeric('confidence_score'), // 0-1
  features: jsonb('features'), // Input features used for prediction
  actualValue: numeric('actual_value'), // Filled in when actual data becomes available
  accuracy: numeric('accuracy'), // Calculated after actual value is known
  metadata: jsonb('metadata'), // Training data range, hyperparameters, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  validatedAt: timestamp('validated_at'), // When actual value was recorded
}, (table) => ({
  orgIdx: index('ml_predictions_org_idx').on(table.organizationId),
  typeIdx: index('ml_predictions_type_idx').on(table.predictionType),
  dateIdx: index('ml_predictions_date_idx').on(table.targetDate),
}));

/**
 * Trend Analyses Table
 * Stores trend detection results and anomaly detection
 */
export const trendAnalyses = pgTable('trend_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  analysisType: text('analysis_type').notNull(), // 'trend', 'anomaly', 'pattern', 'correlation'
  dataSource: text('data_source').notNull(), // 'claims', 'members', 'financial', etc.
  timeRange: jsonb('time_range').notNull(), // { start: date, end: date }
  detectedTrend: text('detected_trend'), // 'increasing', 'decreasing', 'seasonal', 'cyclical', 'stable'
  trendStrength: numeric('trend_strength'), // 0-1, how strong the trend is
  anomaliesDetected: jsonb('anomalies_detected'), // Array of anomaly points with dates and values
  anomalyCount: integer('anomaly_count').default(0),
  seasonalPattern: jsonb('seasonal_pattern'), // Detected seasonal patterns
  correlations: jsonb('correlations'), // Correlations with other metrics
  insights: text('insights'), // AI-generated human-readable insights
  recommendations: jsonb('recommendations'), // Actionable recommendations
  statisticalTests: jsonb('statistical_tests'), // Results of statistical significance tests
  visualizationData: jsonb('visualization_data'), // Pre-computed data for charts
  confidence: numeric('confidence'), // 0-1
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('trend_analyses_org_idx').on(table.organizationId),
  typeIdx: index('trend_analyses_type_idx').on(table.analysisType),
  createdIdx: index('trend_analyses_created_idx').on(table.createdAt),
}));

/**
 * Insight Recommendations Table
 * AI-generated insights and recommendations based on analytics
 */
export const insightRecommendations = pgTable('insight_recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  insightType: text('insight_type').notNull(), // 'opportunity', 'risk', 'optimization', 'alert', 'information'
  category: text('category').notNull(), // 'claims', 'members', 'financial', 'operations', 'compliance'
  priority: text('priority').notNull(), // 'critical', 'high', 'medium', 'low'
  title: text('title').notNull(),
  description: text('description').notNull(),
  dataSource: jsonb('data_source'), // What data this insight is based on
  metrics: jsonb('metrics'), // Related metrics and values
  trend: text('trend'), // Associated trend
  impact: text('impact'), // Expected impact (high, medium, low)
  recommendations: jsonb('recommendations'), // Array of actionable recommendations
  actionRequired: boolean('action_required').default(false),
  actionDeadline: timestamp('action_deadline'),
  estimatedBenefit: text('estimated_benefit'),
  confidenceScore: numeric('confidence_score'), // 0-1, AI confidence in this insight
  relatedEntities: jsonb('related_entities'), // Links to specific claims, members, etc.
  status: text('status').default('new'), // 'new', 'acknowledged', 'in_progress', 'completed', 'dismissed'
  acknowledgedBy: varchar('acknowledged_by', { length: 255 }).references(() => users.userId),
  acknowledgedAt: timestamp('acknowledged_at'),
  dismissedBy: varchar('dismissed_by', { length: 255 }).references(() => users.userId),
  dismissedAt: timestamp('dismissed_at'),
  dismissalReason: text('dismissal_reason'),
  completedAt: timestamp('completed_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('insight_recommendations_org_idx').on(table.organizationId),
  statusIdx: index('insight_recommendations_status_idx').on(table.status),
  priorityIdx: index('insight_recommendations_priority_idx').on(table.priority),
  createdIdx: index('insight_recommendations_created_idx').on(table.createdAt),
}));

/**
 * Comparative Analysis Table
 * Cross-organization comparisons and benchmarking
 */
export const comparativeAnalyses = pgTable('comparative_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  analysisName: text('analysis_name').notNull(),
  comparisonType: text('comparison_type').notNull(), // 'peer_comparison', 'industry_benchmark', 'historical_comparison'
  organizationIds: jsonb('organization_ids'), // Array of org IDs being compared (for peer comparison)
  metrics: jsonb('metrics').notNull(), // Array of metrics being compared
  timeRange: jsonb('time_range').notNull(),
  results: jsonb('results').notNull(), // Comparison results with percentiles, rankings
  benchmarks: jsonb('benchmarks'), // Industry or peer benchmarks
  organizationRanking: jsonb('organization_ranking'), // How this org ranks
  gaps: jsonb('gaps'), // Areas where org is underperforming
  strengths: jsonb('strengths'), // Areas where org is outperforming
  recommendations: jsonb('recommendations'),
  visualizationData: jsonb('visualization_data'),
  isPublic: boolean('is_public').default(false), // Allow sharing with other orgs
  createdBy: varchar('created_by', { length: 255 }).notNull().references(() => users.userId),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('comparative_analyses_org_idx').on(table.organizationId),
  createdIdx: index('comparative_analyses_created_idx').on(table.createdAt),
}));

// Relations
export const analyticsMetricsRelations = relations(analyticsMetrics, ({ one }) => ({
  organization: one(organizations, {
    fields: [analyticsMetrics.organizationId],
    references: [organizations.id],
  }),
}));

export const kpiConfigurationsRelations = relations(kpiConfigurations, ({ one }) => ({
  organization: one(organizations, {
    fields: [kpiConfigurations.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [kpiConfigurations.createdBy],
    references: [users.userId],
  }),
}));

export const mlPredictionsRelations = relations(mlPredictions, ({ one }) => ({
  organization: one(organizations, {
    fields: [mlPredictions.organizationId],
    references: [organizations.id],
  }),
}));

export const trendAnalysesRelations = relations(trendAnalyses, ({ one }) => ({
  organization: one(organizations, {
    fields: [trendAnalyses.organizationId],
    references: [organizations.id],
  }),
}));

export const insightRecommendationsRelations = relations(insightRecommendations, ({ one }) => ({
  organization: one(organizations, {
    fields: [insightRecommendations.organizationId],
    references: [organizations.id],
  }),
  acknowledgedByUser: one(users, {
    fields: [insightRecommendations.acknowledgedBy],
    references: [users.userId],
  }),
  dismissedByUser: one(users, {
    fields: [insightRecommendations.dismissedBy],
    references: [users.userId],
  }),
}));

export const comparativeAnalysesRelations = relations(comparativeAnalyses, ({ one }) => ({
  organization: one(organizations, {
    fields: [comparativeAnalyses.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [comparativeAnalyses.createdBy],
    references: [users.userId],
  }),
}));

// ============================================================================
// CUSTOMER SUCCESS TABLES
// ============================================================================

export const customerNpsSurveys = pgTable('customer_nps_surveys', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  respondentName: varchar('respondent_name', { length: 255 }).notNull(),
  score: integer('score').notNull(),
  feedback: text('feedback'),
  category: varchar('category', { length: 100 }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
});

export const customerOnboardingMilestones = pgTable('customer_onboarding_milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  milestone: varchar('milestone', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CustomerNpsSurvey = typeof customerNpsSurveys.$inferSelect;
export type CustomerOnboardingMilestone = typeof customerOnboardingMilestones.$inferSelect;

