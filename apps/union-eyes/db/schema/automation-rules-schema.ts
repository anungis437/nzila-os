/**
 * Automation Rules Schema
 * 
 * Stores automation rules for workflow automation.
 * Enables automatic notifications, escalations, and actions.
 */

import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

export const automationRuleStatusEnum = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DISABLED: 'disabled',
  DRAFT: 'draft',
} as const;

export const automationTriggerTypeEnum = {
  EVENT: 'event',
  SCHEDULE: 'schedule',
  CONDITION: 'condition',
  WEBHOOK: 'webhook',
} as const;

export const automationActionTypeEnum = {
  NOTIFICATION: 'notification',
  ESCALATION: 'escalation',
  STATUS_CHANGE: 'status_change',
  ASSIGNMENT: 'assignment',
  WEBHOOK: 'webhook',
  EMAIL: 'email',
  SMS: 'sms',
  CREATE_TASK: 'create_task',
  UPDATE_FIELD: 'update_field',
} as const;

export const automationTargetEntityEnum = {
  GRIEVANCE: 'grievance',
  ARBITRATION: 'arbitration',
  CERTIFICATION: 'certification',
  CBA: 'cba',
  MEMBER: 'member',
  CASE: 'case',
  DEADLINE: 'deadline',
} as const;

export const automationRules = pgTable("automation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default('draft'),
  priority: integer("priority").default(100),
  
  // Target entity
  targetEntity: varchar("target_entity", { length: 50 }).notNull(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  targetFilter: jsonb("target_filter").$type<Record<string, any>>(),
  
  // Trigger configuration
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  triggerConfig: jsonb("trigger_config").$type<{
    event?: string;
    schedule?: string;
    condition?: string;
    webhookPath?: string;
  }>(),
  
  // Conditions (must all match for action to execute)
  conditions: jsonb("conditions").$type<Array<{
    field: string;
    operator: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
  }>>(),
  
  // Actions to execute
  actions: jsonb("actions").$type<Array<{
    type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: Record<string, any>;
    order: number;
  }>>(),
  
  // Execution limits
  maxExecutions: integer("max_executions"),
  executionsCount: integer("executions_count").default(0),
  lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),
  
  // Time windows
  activeFrom: timestamp("active_from", { withTimezone: true }),
  activeUntil: timestamp("active_until", { withTimezone: true }),
  timezone: varchar("timezone", { length: 50 }).default('UTC'),
  
  // Organization
  organizationId: varchar("organization_id", { length: 255 }),
  
  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }),
}, (table) => [
  index("idx_automation_rules_status").on(table.status),
  index("idx_automation_rules_target").on(table.targetEntity),
  index("idx_automation_rules_org").on(table.organizationId),
  index("idx_automation_rules_priority").on(table.priority),
]);

export const automationExecutionLog = pgTable("automation_execution_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id").references(() => automationRules.id).notNull(),
  
  // Execution details
  triggeredBy: varchar("triggered_by", { length: 255 }).notNull(),
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  
  // Target
  targetEntityType: varchar("target_entity_type", { length: 50 }).notNull(),
  targetEntityId: varchar("target_entity_id", { length: 255 }).notNull(),
  
  // Result
  status: varchar("status", { length: 20 }).notNull(), // success, failed, skipped
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  
  // Actions executed
  actionsExecuted: jsonb("actions_executed").$type<Array<{
    actionType: string;
    status: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: Record<string, any>;
    duration: number;
  }>>(),
  
  // Timing
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  duration: integer("duration_ms"),
}, (table) => [
  index("idx_automation_log_rule").on(table.ruleId),
  index("idx_automation_log_target").on(table.targetEntityId),
  index("idx_automation_log_status").on(table.status),
  index("idx_automation_log_started").on(table.startedAt),
]);

export const automationSchedules = pgTable("automation_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id").references(() => automationRules.id).notNull(),
  
  // Schedule configuration
  scheduleType: varchar("schedule_type", { length: 50 }).notNull(), // daily, weekly, monthly, cron
  scheduleConfig: jsonb("schedule_config").$type<{
    cron?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    time?: string;
    timezone?: string;
  }>(),
  
  // Next run
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  
  // Status
  status: varchar("status", { length: 20 }).notNull().default('active'),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_automation_schedule_rule").on(table.ruleId),
  index("idx_automation_schedule_next").on(table.nextRunAt),
]);

export type AutomationRuleStatus = typeof automationRuleStatusEnum[keyof typeof automationRuleStatusEnum];
export type AutomationTriggerType = typeof automationTriggerTypeEnum[keyof typeof automationTriggerTypeEnum];
export type AutomationActionType = typeof automationActionTypeEnum[keyof typeof automationActionTypeEnum];
export type AutomationTargetEntity = typeof automationTargetEntityEnum[keyof typeof automationTargetEntityEnum];

export type AutomationRule = typeof automationRules.$inferSelect;
export type AutomationRuleInsert = typeof automationRules.$inferInsert;
export type AutomationExecutionLogRecord = typeof automationExecutionLog.$inferSelect;
export type AutomationSchedule = typeof automationSchedules.$inferSelect;

