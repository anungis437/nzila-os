/**
 * Alerting & Automation Schema
 * 
 * Drizzle ORM schema definitions for configurable alerting and workflow automation system.
 * Supports alert rules with conditions/actions, escalations, and automated workflows.
 */

import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb, pgEnum, time, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../../../schema-organizations';
import { profiles } from '../../profiles-schema';

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

export const alertConditions = pgTable('alert_conditions', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),
  alertRuleId: uuid('alert_rule_id').notNull().references(() => alertRules.id, { onDelete: 'cascade' }),
  
  // Condition Definition
  fieldPath: varchar('field_path', { length: 255 }).notNull(),
  operator: alertConditionOperator('operator').notNull(),
  value: jsonb('value'),
  
  // Logical Grouping
  conditionGroup: integer('condition_group').notNull().default(1),
  isOrCondition: boolean('is_or_condition').notNull().default(false),
  
  // Execution Order
  orderIndex: integer('order_index').notNull().default(0),
  
  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ruleIdx: index('idx_alert_conditions_rule').on(table.alertRuleId, table.orderIndex),
}));

export const alertActions = pgTable('alert_actions', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),
  alertRuleId: uuid('alert_rule_id').notNull().references(() => alertRules.id, { onDelete: 'cascade' }),
  
  // Action Definition
  actionType: alertActionType('action_type').notNull(),
  actionConfig: jsonb('action_config').notNull(),
  
  // Execution Order
  orderIndex: integer('order_index').notNull().default(0),
  
  // Conditional Execution
  executeIfCondition: jsonb('execute_if_condition'),
  
  // Retry Configuration
  maxRetries: integer('max_retries').notNull().default(3),
  retryDelaySeconds: integer('retry_delay_seconds').notNull().default(60),
  
  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ruleIdx: index('idx_alert_actions_rule').on(table.alertRuleId, table.orderIndex),
}));

export const alertEscalations = pgTable('alert_escalations', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  alertRuleId: uuid('alert_rule_id').notNull().references(() => alertRules.id, { onDelete: 'cascade' }),
  
  // Escalation Definition
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  escalationLevels: jsonb('escalation_levels').notNull(),
  
  // Current State
  currentLevel: integer('current_level').notNull().default(1),
  status: escalationStatus('status').notNull().default('pending'),
  
  // Timing
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  nextEscalationAt: timestamp('next_escalation_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  
  // Resolution
  resolvedBy: text('resolved_by').references(() => profiles.userId),
  resolutionNotes: text('resolution_notes'),
  
  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  organizationIdx: index('idx_alert_escalations_organization').on(table.organizationId),
  ruleIdx: index('idx_alert_escalations_rule').on(table.alertRuleId),
  statusIdx: index('idx_alert_escalations_status').on(table.status, table.nextEscalationAt),
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

export const workflowDefinitions = pgTable('workflow_definitions', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Workflow Definition
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  
  // Trigger Configuration
  triggerType: workflowTriggerType('trigger_type').notNull(),
  triggerConfig: jsonb('trigger_config').notNull(),
  
  // Workflow Steps
  workflowSteps: jsonb('workflow_steps').notNull(),
  
  // Status
  isEnabled: boolean('is_enabled').notNull().default(true),
  isDeleted: boolean('is_deleted').notNull().default(false),
  version: integer('version').notNull().default(1),
  
  // Execution Tracking
  lastExecutedAt: timestamp('last_executed_at', { withTimezone: true }),
  executionCount: integer('execution_count').notNull().default(0),
  successCount: integer('success_count').notNull().default(0),
  failureCount: integer('failure_count').notNull().default(0),
  
  // Metadata
  createdBy: text('created_by').references(() => profiles.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  organizationIdx: index('idx_workflow_definitions_organization').on(table.organizationId),
  triggerIdx: index('idx_workflow_definitions_trigger').on(table.triggerType),
  categoryIdx: index('idx_workflow_definitions_category').on(table.category),
}));

export const workflowExecutions = pgTable('workflow_executions', {
  // Identity
  id: uuid('id').primaryKey().defaultRandom(),
  workflowDefinitionId: uuid('workflow_definition_id').notNull().references(() => workflowDefinitions.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Execution Context
  triggeredBy: workflowTriggerType('triggered_by').notNull(),
  triggerData: jsonb('trigger_data'),
  
  // Execution Status
  status: workflowExecutionStatus('status').notNull().default('pending'),
  currentStep: integer('current_step').notNull().default(1),
  
  // Timing
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  pausedAt: timestamp('paused_at', { withTimezone: true }),
  resumedAt: timestamp('resumed_at', { withTimezone: true }),
  
  // Results
  stepResults: jsonb('step_results'),
  variables: jsonb('variables'),
  
  // Error Handling
  errorMessage: text('error_message'),
  errorDetails: jsonb('error_details'),
  failedStep: integer('failed_step'),
  
  // Performance
  totalExecutionTimeMs: integer('total_execution_time_ms'),
  
  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workflowIdx: index('idx_workflow_executions_workflow').on(table.workflowDefinitionId, table.createdAt),
  organizationIdx: index('idx_workflow_executions_organization').on(table.organizationId, table.status),
  statusIdx: index('idx_workflow_executions_status').on(table.status, table.startedAt),
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
  conditions: many(alertConditions),
  actions: many(alertActions),
  escalations: many(alertEscalations),
  executions: many(alertExecutions),
  recipients: many(alertRecipients),
}));

export const alertConditionsRelations = relations(alertConditions, ({ one }) => ({
  alertRule: one(alertRules, {
    fields: [alertConditions.alertRuleId],
    references: [alertRules.id],
  }),
}));

export const alertActionsRelations = relations(alertActions, ({ one }) => ({
  alertRule: one(alertRules, {
    fields: [alertActions.alertRuleId],
    references: [alertRules.id],
  }),
}));

export const alertEscalationsRelations = relations(alertEscalations, ({ one }) => ({
  organization: one(organizations, {
    fields: [alertEscalations.organizationId],
    references: [organizations.id],
  }),
  alertRule: one(alertRules, {
    fields: [alertEscalations.alertRuleId],
    references: [alertRules.id],
  }),
  resolver: one(profiles, {
    fields: [alertEscalations.resolvedBy],
    references: [profiles.userId],
  }),
}));

export const alertExecutionsRelations = relations(alertExecutions, ({ one }) => ({
  alertRule: one(alertRules, {
    fields: [alertExecutions.alertRuleId],
    references: [alertRules.id],
  }),
}));

export const workflowDefinitionsRelations = relations(workflowDefinitions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workflowDefinitions.organizationId],
    references: [organizations.id],
  }),
  creator: one(profiles, {
    fields: [workflowDefinitions.createdBy],
    references: [profiles.userId],
  }),
  executions: many(workflowExecutions),
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({ one }) => ({
  organization: one(organizations, {
    fields: [workflowExecutions.organizationId],
    references: [organizations.id],
  }),
  workflowDefinition: one(workflowDefinitions, {
    fields: [workflowExecutions.workflowDefinitionId],
    references: [workflowDefinitions.id],
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

export type AlertCondition = typeof alertConditions.$inferSelect;
export type NewAlertCondition = typeof alertConditions.$inferInsert;

export type AlertAction = typeof alertActions.$inferSelect;
export type NewAlertAction = typeof alertActions.$inferInsert;

export type AlertEscalation = typeof alertEscalations.$inferSelect;
export type NewAlertEscalation = typeof alertEscalations.$inferInsert;

export type AlertExecution = typeof alertExecutions.$inferSelect;
export type NewAlertExecution = typeof alertExecutions.$inferInsert;

export type WorkflowDefinition = typeof workflowDefinitions.$inferSelect;
export type NewWorkflowDefinition = typeof workflowDefinitions.$inferInsert;

export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type NewWorkflowExecution = typeof workflowExecutions.$inferInsert;

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

