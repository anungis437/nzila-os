/**
 * Alert Rules Management
 * 
 * Core functionality for defining, validating, and managing alert rules
 * for Union Eyes monitoring and observability system.
 */

import {
  AlertRule,
  AlertRuleSchema,
  AlertCategory,
  AlertSeverity,
  AlertRuleType,
  AlertRuleValidationResult,
  AlertTemplate,
  NotificationChannel,
  ThresholdOperator,
  TimeWindowUnit,
} from '@/types/alerts';

/**
 * Pre-defined Alert Templates
 * Enterprise-grade monitoring configurations for common scenarios
 */
export const ALERT_TEMPLATES: AlertTemplate[] = [
  // === SECURITY ALERTS ===
  {
    name: 'RLS Bypass Attempt',
    description: 'Detects attempts to bypass Row-Level Security policies',
    category: AlertCategory.SECURITY,
    severity: AlertSeverity.CRITICAL,
    rule_type: AlertRuleType.THRESHOLD,
    default_conditions: [
      {
        metric: 'rls_bypass_attempts',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 0,
        windowSize: 5,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'count',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SLACK, NotificationChannel.PAGERDUTY],
    runbook_template: 'RLS-VIOLATION',
  },
  {
    name: 'Failed Login Spike',
    description: 'Unusual number of failed authentication attempts',
    category: AlertCategory.SECURITY,
    severity: AlertSeverity.HIGH,
    rule_type: AlertRuleType.THRESHOLD,
    default_conditions: [
      {
        metric: 'failed_logins',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 10,
        windowSize: 5,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'count',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SLACK],
    runbook_template: 'AUTHENTICATION-FAILURE',
  },
  {
    name: 'Admin Permission Escalation',
    description: 'User granted admin permissions',
    category: AlertCategory.SECURITY,
    severity: AlertSeverity.HIGH,
    rule_type: AlertRuleType.PATTERN,
    default_conditions: [
      {
        metric: 'role_change_to_admin',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 0,
        windowSize: 1,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'count',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SLACK],
    runbook_template: 'PERMISSION-ESCALATION',
  },
  {
    name: 'Data Export Volume Spike',
    description: 'Unusual volume of data exports (potential data breach)',
    category: AlertCategory.SECURITY,
    severity: AlertSeverity.CRITICAL,
    rule_type: AlertRuleType.ANOMALY,
    default_conditions: [
      {
        metric: 'data_exports_mb',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 1000,
        windowSize: 15,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'sum',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PAGERDUTY],
    runbook_template: 'DATA-BREACH',
  },

  // === PERFORMANCE ALERTS ===
  {
    name: 'High API Response Time',
    description: 'API response time exceeds acceptable threshold',
    category: AlertCategory.PERFORMANCE,
    severity: AlertSeverity.MEDIUM,
    rule_type: AlertRuleType.THRESHOLD,
    default_conditions: [
      {
        metric: 'api_response_time_ms',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 2000,
        windowSize: 5,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'p95',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SLACK],
    runbook_template: 'PERFORMANCE-DEGRADATION',
  },
  {
    name: 'Database Connection Pool Exhaustion',
    description: 'Database connection pool near capacity',
    category: AlertCategory.PERFORMANCE,
    severity: AlertSeverity.HIGH,
    rule_type: AlertRuleType.THRESHOLD,
    default_conditions: [
      {
        metric: 'db_connection_pool_usage_pct',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 90,
        windowSize: 2,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'avg',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SLACK, NotificationChannel.PAGERDUTY],
    runbook_template: 'DATABASE-PERFORMANCE',
  },
  {
    name: 'High Error Rate',
    description: 'Error rate exceeds acceptable threshold',
    category: AlertCategory.PERFORMANCE,
    severity: AlertSeverity.HIGH,
    rule_type: AlertRuleType.RATE,
    default_conditions: [
      {
        metric: 'error_rate_pct',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 5,
        windowSize: 5,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'avg',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SLACK],
    runbook_template: 'HIGH-ERROR-RATE',
  },

  // === AVAILABILITY ALERTS ===
  {
    name: 'Service Health Check Failure',
    description: 'Health check endpoint returning errors',
    category: AlertCategory.AVAILABILITY,
    severity: AlertSeverity.CRITICAL,
    rule_type: AlertRuleType.PATTERN,
    default_conditions: [
      {
        metric: 'health_check_failures',
        operator: ThresholdOperator.GREATER_THAN_OR_EQUAL,
        threshold: 3,
        windowSize: 5,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'count',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PAGERDUTY],
    runbook_template: 'SERVICE-OUTAGE',
  },
  {
    name: 'Deployment Failure',
    description: 'Application deployment failed',
    category: AlertCategory.AVAILABILITY,
    severity: AlertSeverity.CRITICAL,
    rule_type: AlertRuleType.PATTERN,
    default_conditions: [
      {
        metric: 'deployment_failures',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 0,
        windowSize: 1,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'count',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SLACK, NotificationChannel.PAGERDUTY],
    runbook_template: 'DEPLOYMENT-FAILURE',
  },

  // === DATA INTEGRITY ALERTS ===
  {
    name: 'Database Constraint Violation',
    description: 'Database constraint violation detected',
    category: AlertCategory.DATA_INTEGRITY,
    severity: AlertSeverity.HIGH,
    rule_type: AlertRuleType.THRESHOLD,
    default_conditions: [
      {
        metric: 'constraint_violations',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 5,
        windowSize: 15,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'count',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SLACK],
    runbook_template: 'DATA-INTEGRITY',
  },
  {
    name: 'Orphaned Record Detection',
    description: 'Orphaned records found in database',
    category: AlertCategory.DATA_INTEGRITY,
    severity: AlertSeverity.MEDIUM,
    rule_type: AlertRuleType.THRESHOLD,
    default_conditions: [
      {
        metric: 'orphaned_records',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 10,
        windowSize: 1,
        windowUnit: TimeWindowUnit.HOURS,
        aggregation: 'count',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL],
    runbook_template: 'DATA-INTEGRITY',
  },

  // === COMPLIANCE ALERTS ===
  {
    name: 'Audit Log Gap Detected',
    description: 'Gap in audit log continuity',
    category: AlertCategory.COMPLIANCE,
    severity: AlertSeverity.HIGH,
    rule_type: AlertRuleType.ABSENCE,
    default_conditions: [
      {
        metric: 'audit_log_entries',
        operator: ThresholdOperator.EQUAL,
        threshold: 0,
        windowSize: 10,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'count',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SLACK],
    runbook_template: 'AUDIT-LOG-FAILURE',
  },
  {
    name: 'PII Access Without Justification',
    description: 'Personally identifiable information accessed without documented justification',
    category: AlertCategory.COMPLIANCE,
    severity: AlertSeverity.HIGH,
    rule_type: AlertRuleType.PATTERN,
    default_conditions: [
      {
        metric: 'pii_access_no_justification',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 0,
        windowSize: 5,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'count',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL],
    runbook_template: 'PRIVACY-VIOLATION',
  },

  // === OPERATIONS ALERTS ===
  {
    name: 'Backup Failure',
    description: 'Scheduled backup job failed',
    category: AlertCategory.OPERATIONS,
    severity: AlertSeverity.HIGH,
    rule_type: AlertRuleType.PATTERN,
    default_conditions: [
      {
        metric: 'backup_failures',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 0,
        windowSize: 1,
        windowUnit: TimeWindowUnit.HOURS,
        aggregation: 'count',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SLACK],
    runbook_template: 'BACKUP-FAILURE',
  },
  {
    name: 'Certificate Expiration Warning',
    description: 'SSL/TLS certificate expiring soon',
    category: AlertCategory.OPERATIONS,
    severity: AlertSeverity.MEDIUM,
    rule_type: AlertRuleType.THRESHOLD,
    default_conditions: [
      {
        metric: 'certificate_days_until_expiry',
        operator: ThresholdOperator.LESS_THAN,
        threshold: 30,
        windowSize: 1,
        windowUnit: TimeWindowUnit.DAYS,
        aggregation: 'min',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL],
    runbook_template: 'CERTIFICATE-RENEWAL',
  },
  {
    name: 'Disk Space Low',
    description: 'Server disk space below threshold',
    category: AlertCategory.OPERATIONS,
    severity: AlertSeverity.MEDIUM,
    rule_type: AlertRuleType.THRESHOLD,
    default_conditions: [
      {
        metric: 'disk_space_available_pct',
        operator: ThresholdOperator.LESS_THAN,
        threshold: 20,
        windowSize: 5,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'avg',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SLACK],
    runbook_template: 'DISK-SPACE',
  },

  // === BUSINESS ALERTS ===
  {
    name: 'Payment Processing Failure Rate',
    description: 'High rate of payment processing failures',
    category: AlertCategory.BUSINESS,
    severity: AlertSeverity.HIGH,
    rule_type: AlertRuleType.THRESHOLD,
    default_conditions: [
      {
        metric: 'payment_failure_rate_pct',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 10,
        windowSize: 15,
        windowUnit: TimeWindowUnit.MINUTES,
        aggregation: 'avg',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL, NotificationChannel.SLACK],
    runbook_template: 'PAYMENT-FAILURE',
  },
  {
    name: 'User Registration Anomaly',
    description: 'Unusual spike or drop in user registrations',
    category: AlertCategory.BUSINESS,
    severity: AlertSeverity.MEDIUM,
    rule_type: AlertRuleType.ANOMALY,
    default_conditions: [
      {
        metric: 'user_registrations',
        operator: ThresholdOperator.GREATER_THAN,
        threshold: 100,
        windowSize: 1,
        windowUnit: TimeWindowUnit.HOURS,
        aggregation: 'count',
      },
    ],
    recommended_recipients: [NotificationChannel.EMAIL],
    runbook_template: 'BUSINESS-ANOMALY',
  },
];

/**
 * Validate an alert rule configuration
 */
export function validateAlertRule(rule: Partial<AlertRule>): AlertRuleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Schema validation
    AlertRuleSchema.parse(rule);
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any).errors) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errors.push(...(error as any).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`));
    }
  }

  // Business logic validation
  if (rule.conditions && rule.conditions.length > 0) {
    // Check time window reasonableness
    rule.conditions.forEach((condition, index) => {
      const windowMinutes = convertToMinutes(condition.windowSize, condition.windowUnit);
      
      if (windowMinutes < 1) {
        warnings.push(`Condition ${index + 1}: Time window less than 1 minute may cause excessive alerts`);
      }
      
      if (windowMinutes > 1440) { // 24 hours
        warnings.push(`Condition ${index + 1}: Time window greater than 24 hours may delay detection`);
      }
    });
  }

  // Check cooldown reasonableness
  if (rule.cooldown_minutes !== undefined && rule.cooldown_minutes < 5 && rule.severity !== AlertSeverity.CRITICAL) {
    warnings.push('Cooldown less than 5 minutes may cause notification spam for non-critical alerts');
  }

  // Check if recipients match severity
  if (rule.recipients && rule.severity === AlertSeverity.CRITICAL) {
    const hasUrgentChannel = rule.recipients.some(
      r => r.channel === NotificationChannel.SMS || r.channel === NotificationChannel.PAGERDUTY
    );
    if (!hasUrgentChannel) {
      warnings.push('Critical alerts should include SMS or PagerDuty notification');
    }
  }

  // Check auto-resolve configuration
  if (rule.auto_resolve_minutes !== undefined && rule.auto_resolve_minutes > 0) {
    if (rule.severity === AlertSeverity.CRITICAL || rule.severity === AlertSeverity.HIGH) {
      warnings.push('Auto-resolve for high-severity alerts should be manually reviewed');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Convert time window to minutes for comparison
 */
function convertToMinutes(size: number, unit: TimeWindowUnit): number {
  const multipliers = {
    [TimeWindowUnit.SECONDS]: 1 / 60,
    [TimeWindowUnit.MINUTES]: 1,
    [TimeWindowUnit.HOURS]: 60,
    [TimeWindowUnit.DAYS]: 1440,
  };
  return size * multipliers[unit];
}

/**
 * Get alert template by name
 */
export function getAlertTemplate(name: string): AlertTemplate | undefined {
  return ALERT_TEMPLATES.find(t => t.name === name);
}

/**
 * Get alert templates by category
 */
export function getAlertTemplatesByCategory(category: AlertCategory): AlertTemplate[] {
  return ALERT_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get alert templates by severity
 */
export function getAlertTemplatesBySeverity(severity: AlertSeverity): AlertTemplate[] {
  return ALERT_TEMPLATES.filter(t => t.severity === severity);
}

/**
 * Create a rule from template with custom overrides
 */
export function createRuleFromTemplate(
  template: AlertTemplate,
  overrides: Partial<AlertRule>
): Partial<AlertRule> {
  return {
    name: template.name,
    description: template.description,
    category: template.category,
    severity: template.severity,
    rule_type: template.rule_type,
    conditions: template.default_conditions as AlertRule['conditions'],
    recipients: template.recommended_recipients.map(channel => ({
      channel,
      target: '', // Must be filled in by user
    })),
    cooldown_minutes: getSuggestedCooldown(template.severity),
    enabled: true,
    tags: [template.category, template.severity],
    runbook_url: template.runbook_template 
      ? `/docs/runbooks/${template.runbook_template}.md`
      : undefined,
    ...overrides,
  };
}

/**
 * Get suggested cooldown period based on severity
 */
function getSuggestedCooldown(severity: AlertSeverity): number {
  const cooldowns = {
    [AlertSeverity.CRITICAL]: 5,
    [AlertSeverity.HIGH]: 15,
    [AlertSeverity.MEDIUM]: 30,
    [AlertSeverity.LOW]: 60,
    [AlertSeverity.INFO]: 120,
  };
  return cooldowns[severity];
}

/**
 * Get all alert template names grouped by category
 */
export function getTemplateOverview(): Record<AlertCategory, string[]> {
  const overview: Record<AlertCategory, string[]> = {
    [AlertCategory.SECURITY]: [],
    [AlertCategory.PERFORMANCE]: [],
    [AlertCategory.AVAILABILITY]: [],
    [AlertCategory.DATA_INTEGRITY]: [],
    [AlertCategory.COMPLIANCE]: [],
    [AlertCategory.OPERATIONS]: [],
    [AlertCategory.BUSINESS]: [],
  };

  ALERT_TEMPLATES.forEach(template => {
    overview[template.category].push(template.name);
  });

  return overview;
}

/**
 * Export template count for dashboard display
 */
export const ALERT_TEMPLATE_COUNT = ALERT_TEMPLATES.length;
