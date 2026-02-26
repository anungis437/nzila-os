/**
 * Alert Types and Schemas
 * 
 * Defines the structure for alerts, notifications, and monitoring rules
 * for Union Eyes comprehensive observability system.
 */

import { z } from 'zod';

/**
 * Alert Severity Levels
 * Maps to incident response escalation procedures
 */
export enum AlertSeverity {
  CRITICAL = 'critical',  // Immediate response required - system down/security breach
  HIGH = 'high',          // Urgent - major feature broken, data integrity risk
  MEDIUM = 'medium',      // Important - performance degradation, minor bugs
  LOW = 'low',            // Informational - warnings, optimization opportunities
  INFO = 'info',          // Informational only - no action required
}

/**
 * Alert Categories
 * Organizes alerts by functional domain for routing and filtering
 */
export enum AlertCategory {
  SECURITY = 'security',           // Authentication, authorization, RLS violations
  PERFORMANCE = 'performance',     // Slow queries, high latency, resource usage
  AVAILABILITY = 'availability',   // Uptime, health checks, service outages
  DATA_INTEGRITY = 'data_integrity', // Validation errors, constraint violations
  COMPLIANCE = 'compliance',       // Audit failures, policy violations
  OPERATIONS = 'operations',       // Deployment, backup, maintenance
  BUSINESS = 'business',           // KPI thresholds, transaction anomalies
}

/**
 * Alert Status
 * Lifecycle tracking for alert management
 */
export enum AlertStatus {
  ACTIVE = 'active',           // Currently firing
  ACKNOWLEDGED = 'acknowledged', // Team aware, investigating
  RESOLVED = 'resolved',       // Issue fixed, alert cleared
  SILENCED = 'silenced',       // Temporarily muted
  EXPIRED = 'expired',         // Auto-resolved after timeout
}

/**
 * Notification Channels
 * Delivery methods for alerts
 */
export enum NotificationChannel {
  EMAIL = 'email',         // Email notifications
  SMS = 'sms',             // SMS text messages
  SLACK = 'slack',         // Slack webhook
  WEBHOOK = 'webhook',     // Custom webhook
  IN_APP = 'in_app',       // In-app notifications
  PAGERDUTY = 'pagerduty', // PagerDuty integration
}

/**
 * Alert Rule Types
 * Different monitoring and alerting strategies
 */
export enum AlertRuleType {
  THRESHOLD = 'threshold',     // Value exceeds/falls below threshold
  ANOMALY = 'anomaly',         // Statistical deviation from baseline
  PATTERN = 'pattern',         // Pattern matching (e.g., consecutive failures)
  RATE = 'rate',               // Change rate (e.g., error rate spike)
  ABSENCE = 'absence',         // Expected event didn't occur
  CORRELATION = 'correlation', // Multiple conditions must be true
}

/**
 * Threshold Comparison Operators
 */
export enum ThresholdOperator {
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  EQUAL = 'eq',
  NOT_EQUAL = 'neq',
}

/**
 * Time Window Units
 */
export enum TimeWindowUnit {
  SECONDS = 'seconds',
  MINUTES = 'minutes',
  HOURS = 'hours',
  DAYS = 'days',
}

/**
 * Alert Rule Condition Schema
 */
export const AlertRuleConditionSchema = z.object({
  metric: z.string().describe('Metric name to monitor (e.g., error_rate, response_time)'),
  operator: z.nativeEnum(ThresholdOperator),
  threshold: z.number().describe('Threshold value to compare against'),
  windowSize: z.number().positive().describe('Time window size'),
  windowUnit: z.nativeEnum(TimeWindowUnit),
  aggregation: z.enum(['avg', 'sum', 'count', 'min', 'max', 'p50', 'p95', 'p99']).optional(),
});

export type AlertRuleCondition = z.infer<typeof AlertRuleConditionSchema>;

/**
 * Notification Recipient Schema
 */
export const NotificationRecipientSchema = z.object({
  channel: z.nativeEnum(NotificationChannel),
  target: z.string().describe('Email, phone number, webhook URL, etc.'),
  severity_filter: z.array(z.nativeEnum(AlertSeverity)).optional().describe('Only notify for these severities'),
});

export type NotificationRecipient = z.infer<typeof NotificationRecipientSchema>;

/**
 * Alert Rule Schema
 * Defines monitoring rules and alerting behavior
 */
export const AlertRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  
  // Rule classification
  category: z.nativeEnum(AlertCategory),
  severity: z.nativeEnum(AlertSeverity),
  rule_type: z.nativeEnum(AlertRuleType),
  
  // Conditions and triggers
  conditions: z.array(AlertRuleConditionSchema).min(1),
  condition_logic: z.enum(['AND', 'OR']).default('AND'),
  
  // Notification configuration
  recipients: z.array(NotificationRecipientSchema).min(1),
  cooldown_minutes: z.number().int().min(0).default(15).describe('Min time between repeat notifications'),
  
  // Rule behavior
  enabled: z.boolean().default(true),
  auto_resolve_minutes: z.number().int().min(0).optional().describe('Auto-resolve if condition clears'),
  silence_until: z.date().optional().describe('Temporarily silence until this timestamp'),
  
  // Metadata
  runbook_url: z.string().url().optional().describe('Link to incident response runbook'),
  tags: z.array(z.string()).default([]),
  org_id: z.string().uuid().optional().describe('Org-specific rule'),
  
  // Audit fields
  created_by: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type AlertRule = z.infer<typeof AlertRuleSchema>;

/**
 * Alert Instance Schema
 * Actual fired alert with instance data
 */
export const AlertInstanceSchema = z.object({
  id: z.string().uuid(),
  rule_id: z.string().uuid(),
  
  // Alert state
  status: z.nativeEnum(AlertStatus),
  severity: z.nativeEnum(AlertSeverity),
  category: z.nativeEnum(AlertCategory),
  
  // Alert details
  title: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional().describe('Additional context (metric values, stack traces, etc.)'),
  
  // Instance metadata
  org_id: z.string().uuid().optional(),
  resource_id: z.string().optional().describe('ID of affected resource (user, org, etc.)'),
  resource_type: z.string().optional().describe('Type of resource'),
  
  // Lifecycle timestamps
  fired_at: z.date(),
  acknowledged_at: z.date().optional(),
  acknowledged_by: z.string().optional(),
  resolved_at: z.date().optional(),
  resolved_by: z.string().optional(),
  
  // Notification tracking
  notifications_sent: z.number().int().default(0),
  last_notification_at: z.date().optional(),
  
  // Runbook reference
  runbook_url: z.string().url().optional(),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  created_at: z.date(),
  updated_at: z.date(),
});

export type AlertInstance = z.infer<typeof AlertInstanceSchema>;

/**
 * Notification Delivery Record Schema
 * Tracks notification delivery attempts
 */
export const NotificationDeliverySchema = z.object({
  id: z.string().uuid(),
  alert_id: z.string().uuid(),
  
  // Delivery details
  channel: z.nativeEnum(NotificationChannel),
  recipient: z.string(),
  
  // Delivery status
  status: z.enum(['pending', 'sent', 'failed', 'bounced']),
  error_message: z.string().optional(),
  retry_count: z.number().int().min(0).default(0),
  
  // Timestamps
  sent_at: z.date().optional(),
  delivered_at: z.date().optional(),
  failed_at: z.date().optional(),
  
  // Metadata
  created_at: z.date(),
  updated_at: z.date(),
});

export type NotificationDelivery = z.infer<typeof NotificationDeliverySchema>;

/**
 * Alert Metric Data Point
 * Time-series data for alert evaluation
 */
export interface AlertMetricDataPoint {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

/**
 * Alert Evaluation Result
 * Result of evaluating an alert rule against current metrics
 */
export interface AlertEvaluationResult {
  rule_id: string;
  should_fire: boolean;
  current_value: number;
  threshold: number;
  evaluation_time: Date;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Alert Dashboard Stats
 * Summary statistics for alert dashboard
 */
export interface AlertDashboardStats {
  active_count: number;
  critical_count: number;
  high_count: number;
  acknowledged_count: number;
  resolved_today: number;
  avg_resolution_time_minutes: number;
  top_categories: Array<{
    category: AlertCategory;
    count: number;
  }>;
  recent_alerts: AlertInstance[];
}

/**
 * Notification Preferences
 * User preferences for alert notifications
 */
export const NotificationPreferencesSchema = z.object({
  user_id: z.string(),
  org_id: z.string().uuid().optional(),
  
  // Channel preferences
  email_enabled: z.boolean().default(true),
  email_address: z.string().email().optional(),
  sms_enabled: z.boolean().default(false),
  sms_number: z.string().optional(),
  in_app_enabled: z.boolean().default(true),
  
  // Notification filtering
  min_severity: z.nativeEnum(AlertSeverity).default(AlertSeverity.MEDIUM),
  categories: z.array(z.nativeEnum(AlertCategory)).optional(),
  quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional(), // HH:MM format
  quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quiet_hours_timezone: z.string().default('America/Toronto'),
  
  // Digest settings
  digest_enabled: z.boolean().default(false),
  digest_frequency: z.enum(['hourly', 'daily', 'weekly']).default('daily'),
  
  created_at: z.date(),
  updated_at: z.date(),
});

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

/**
 * Pre-defined Alert Templates
 * Common alert configurations for quick setup
 */
export interface AlertTemplate {
  name: string;
  description: string;
  category: AlertCategory;
  severity: AlertSeverity;
  rule_type: AlertRuleType;
  default_conditions: Partial<AlertRuleCondition>[];
  recommended_recipients: NotificationChannel[];
  runbook_template?: string;
}

/**
 * Alert Rule Validation Result
 */
export interface AlertRuleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Export utility functions for common operations
 */

/**
 * Get severity color for UI display
 */
export function getSeverityColor(severity: AlertSeverity): string {
  const colors = {
    [AlertSeverity.CRITICAL]: 'text-red-600 bg-red-50 border-red-200',
    [AlertSeverity.HIGH]: 'text-orange-600 bg-orange-50 border-orange-200',
    [AlertSeverity.MEDIUM]: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    [AlertSeverity.LOW]: 'text-blue-600 bg-blue-50 border-blue-200',
    [AlertSeverity.INFO]: 'text-gray-600 bg-gray-50 border-gray-200',
  };
  return colors[severity];
}

/**
 * Get severity icon emoji
 */
export function getSeverityIcon(severity: AlertSeverity): string {
  const icons = {
    [AlertSeverity.CRITICAL]: '🚨',
    [AlertSeverity.HIGH]: '⚠️',
    [AlertSeverity.MEDIUM]: '⚡',
    [AlertSeverity.LOW]: 'ℹ️',
    [AlertSeverity.INFO]: '📋',
  };
  return icons[severity];
}

/**
 * Get channel icon emoji
 */
export function getChannelIcon(channel: NotificationChannel): string {
  const icons = {
    [NotificationChannel.EMAIL]: '📧',
    [NotificationChannel.SMS]: '📱',
    [NotificationChannel.SLACK]: '💬',
    [NotificationChannel.WEBHOOK]: '🔗',
    [NotificationChannel.IN_APP]: '🔔',
    [NotificationChannel.PAGERDUTY]: '📟',
  };
  return icons[channel];
}

/**
 * Calculate priority score for alert sorting (higher = more urgent)
 */
export function calculateAlertPriority(alert: AlertInstance): number {
  const severityScores = {
    [AlertSeverity.CRITICAL]: 100,
    [AlertSeverity.HIGH]: 75,
    [AlertSeverity.MEDIUM]: 50,
    [AlertSeverity.LOW]: 25,
    [AlertSeverity.INFO]: 10,
  };
  
  const statusScores = {
    [AlertStatus.ACTIVE]: 10,
    [AlertStatus.ACKNOWLEDGED]: 5,
    [AlertStatus.RESOLVED]: 0,
    [AlertStatus.SILENCED]: 0,
    [AlertStatus.EXPIRED]: 0,
  };
  
  return severityScores[alert.severity] + statusScores[alert.status];
}

/**
 * Format time window for display
 */
export function formatTimeWindow(size: number, unit: TimeWindowUnit): string {
  const unitLabels = {
    [TimeWindowUnit.SECONDS]: 'second',
    [TimeWindowUnit.MINUTES]: 'minute',
    [TimeWindowUnit.HOURS]: 'hour',
    [TimeWindowUnit.DAYS]: 'day',
  };
  
  const label = unitLabels[unit];
  return size === 1 ? `1 ${label}` : `${size} ${label}s`;
}
