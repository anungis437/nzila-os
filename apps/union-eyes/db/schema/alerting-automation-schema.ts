/**
 * Alerting & Automation Schema
 * 
 * Drizzle ORM schema definitions for configurable alerting and workflow automation system.
 * Supports alert rules with conditions/actions, escalations, and automated workflows.
 */

import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb, pgEnum, time, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../schema-organizations';
import { profiles } from './profiles-schema';

// =====================================================================================
// ENUMS
// =====================================================================================

export const alertTriggerType = pgEnum('alert_trigger_type', [
  'schedule',
  'event',
  'threshold',
  'manual',
]);

export const alertConditionOperator = pgEnum('alert_condition_operator', [
  'equals',
  'not_equals',
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'in',
  'not_in',
  'is_null',
  'is_not_null',
  'between',
  'regex_match',
]);

export const alertActionType = pgEnum('alert_action_type', [
  'send_email',
  'send_sms',
  'send_push_notification',
  'create_task',
  'update_record',
  'trigger_webhook',
  'escalate',
  'run_script',
  'send_slack_message',
]);

export const alertFrequency = pgEnum('alert_frequency', [
  'once',
  'every_occurrence',
  'daily_digest',
  'hourly_digest',
  'rate_limited',
]);

export const alertSeverity = pgEnum('alert_severity', [
  'critical',
  'high',
  'medium',
  'low',
  'info',
]);

export const alertExecutionStatus = pgEnum('alert_execution_status', [
  'pending',
  'running',
  'success',
  'failed',
  'skipped',
  'rate_limited',
]);

export const escalationStatus = pgEnum('escalation_status', [
  'pending',
  'in_progress',
  'escalated',
  'resolved',
  'cancelled',
]);

export const workflowTriggerType = pgEnum('workflow_trigger_type', [
  'manual',
  'schedule',
  'record_created',
  'record_updated',
  'record_deleted',
  'field_changed',
  'status_changed',
  'deadline_approaching',
  'webhook',
]);

export const workflowActionType = pgEnum('workflow_action_type', [
  'send_notification',
  'update_field',
  'create_record',
  'delete_record',
  'call_api',
  'run_query',
  'wait_for_duration',
  'wait_for_condition',
  'branch_condition',
  'loop',
  'send_webhook',
]);

export const workflowExecutionStatus = pgEnum('workflow_execution_status', [
  'pending',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);

// =====================================================================================
// TABLES
// =====================================================================================

export const alertRules = pgTable('alert_rules', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Rule Definition
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  
  // Trigger Configuration
  triggerType: alertTriggerType('trigger_type').notNull(),
  triggerConfig: jsonb('trigger_config').notNull(),
  
  // Alert Configuration
  severity: alertSeverity('severity').notNull().default('medium'),
  frequency: alertFrequency('frequency').notNull().default('every_occurrence'),
  rateLimitMinutes: integer('rate_limit_minutes'),
  
  // Status
  isEnabled: boolean('is_enabled').notNull().default(true),
  isDeleted: boolean('is_deleted').notNull().default(false),
  
  // Execution Tracking
  lastExecutedAt: timestamp('last_executed_at', { withTimezone: true }),
  lastExecutionStatus: alertExecutionStatus('last_execution_status'),
  executionCount: integer('execution_count').notNull().default(0),
  successCount: integer('success_count').notNull().default(0),
  failureCount: integer('failure_count').notNull().default(0),
  
  // Metadata
  createdBy: text('created_by').references(() => profiles.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  organizationIdx: index('idx_alert_rules_organization').on(table.organizationId),
  categoryIdx: index('idx_alert_rules_category').on(table.category),
  triggerIdx: index('idx_alert_rules_trigger').on(table.triggerType),
  executionIdx: index('idx_alert_rules_next_execution').on(table.lastExecutedAt),
}));

export const alertExecutions = pgTable('alert_executions', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),
  alertRuleId: uuid('alert_rule_id').notNull().references(() => alertRules.id, { onDelete: 'cascade' }),
  
  // Execution Context
  triggeredBy: alertTriggerType('triggered_by').notNull(),
  triggerData: jsonb('trigger_data'),
  
  // Execution Status
  status: alertExecutionStatus('status').notNull().default('pending'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  
  // Results
  conditionsMet: boolean('conditions_met'),
  conditionsEvaluated: jsonb('conditions_evaluated'),
  actionsExecuted: jsonb('actions_executed'),
  
  // Error Handling
  errorMessage: text('error_message'),
  errorDetails: jsonb('error_details'),
  
  // Performance
  executionTimeMs: integer('execution_time_ms'),
  
  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ruleIdx: index('idx_alert_executions_rule').on(table.alertRuleId, table.createdAt),
  statusIdx: index('idx_alert_executions_status').on(table.status, table.startedAt),
  createdIdx: index('idx_alert_executions_created').on(table.createdAt),
}));

export const alertRecipients = pgTable('alert_recipients', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),
  alertRuleId: uuid('alert_rule_id').notNull().references(() => alertRules.id, { onDelete: 'cascade' }),
  
  // Recipient Definition
  recipientType: varchar('recipient_type', { length: 50 }).notNull(),
  recipientId: uuid('recipient_id'),
  recipientValue: varchar('recipient_value', { length: 255 }),
  
  // Delivery Preferences
  deliveryMethods: varchar('delivery_methods', { length: 50 }).array().notNull().default(['email']),
  quietHoursStart: time('quiet_hours_start'),
  quietHoursEnd: time('quiet_hours_end'),
  
  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ruleIdx: index('idx_alert_recipients_rule').on(table.alertRuleId),
  typeIdx: index('idx_alert_recipients_type').on(table.recipientType, table.recipientId),
}));

// =====================================================================================
// RELATIONS
// =====================================================================================

export const alertRulesRelations = relations(alertRules, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [alertRules.organizationId],
    references: [organizations.id],
  }),
  creator: one(profiles, {
    fields: [alertRules.createdBy],
    references: [profiles.userId],
  }),
  executions: many(alertExecutions),
  recipients: many(alertRecipients),
}));

export const alertExecutionsRelations = relations(alertExecutions, ({ one }) => ({
  alertRule: one(alertRules, {
    fields: [alertExecutions.alertRuleId],
    references: [alertRules.id],
  }),
}));

export const alertRecipientsRelations = relations(alertRecipients, ({ one }) => ({
  alertRule: one(alertRules, {
    fields: [alertRecipients.alertRuleId],
    references: [alertRules.id],
  }),
}));

// =====================================================================================
// TYPESCRIPT TYPES
// =====================================================================================

export type AlertRule = typeof alertRules.$inferSelect;
export type NewAlertRule = typeof alertRules.$inferInsert;




export type AlertExecution = typeof alertExecutions.$inferSelect;
export type NewAlertExecution = typeof alertExecutions.$inferInsert;



export type AlertRecipient = typeof alertRecipients.$inferSelect;
export type NewAlertRecipient = typeof alertRecipients.$inferInsert;

// Type aliases for enum values
export type AlertTriggerType = typeof alertTriggerType.enumValues[number];
export type AlertConditionOperator = typeof alertConditionOperator.enumValues[number];
export type AlertActionType = typeof alertActionType.enumValues[number];
export type AlertFrequency = typeof alertFrequency.enumValues[number];
export type AlertSeverity = typeof alertSeverity.enumValues[number];
export type AlertExecutionStatus = typeof alertExecutionStatus.enumValues[number];
export type EscalationStatus = typeof escalationStatus.enumValues[number];
export type WorkflowTriggerType = typeof workflowTriggerType.enumValues[number];
export type WorkflowActionType = typeof workflowActionType.enumValues[number];
export type WorkflowExecutionStatus = typeof workflowExecutionStatus.enumValues[number];

// =====================================================================================
// HELPER TYPES FOR JSONB FIELDS
// =====================================================================================

export interface TriggerConfig {
  schedule?: string; // Cron expression
  event?: string; // Event name
  threshold?: {
    metric: string;
    operator: AlertConditionOperator;
    value: number | string;
  };
}

export interface ActionConfig {
  // Email action
  emailTemplate?: string;
  emailSubject?: string;
  emailRecipients?: string[];
  
  // SMS action
  smsTemplate?: string;
  smsRecipients?: string[];
  
  // Push notification action
  pushTitle?: string;
  pushBody?: string;
  pushRecipients?: string[];
  
  // Webhook action
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  webhookHeaders?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webhookBody?: any;
  
  // Task action
  taskTitle?: string;
  taskDescription?: string;
  taskAssignee?: string;
  taskDueDate?: string;
  
  // Record update action
  recordTable?: string;
  recordId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recordUpdates?: Record<string, any>;
}

export interface EscalationLevel {
  level: number;
  delayMinutes: number;
  recipients: string[];
  actions: ActionConfig[];
  severity: AlertSeverity;
}

export interface WorkflowStep {
  step: number;
  type: WorkflowActionType;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conditions?: any[];
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
  };
}

export interface ConditionEvaluation {
  conditionId: string;
  fieldPath: string;
  operator: AlertConditionOperator;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expectedValue: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actualValue: any;
  result: boolean;
}

export interface ActionExecution {
  actionId: string;
  actionType: AlertActionType;
  status: 'success' | 'failed' | 'skipped';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
  error?: string;
  executionTime: number;
}

