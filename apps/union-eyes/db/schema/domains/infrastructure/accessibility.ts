/**
 * Accessibility Audit Schema
 * 
 * WCAG 2.2 AA compliance tracking
 * Automated accessibility testing
 * Manual review workflows
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  pgEnum,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { organizations } from "../../../schema-organizations";
import { profiles } from "../../profiles-schema";

// WCAG conformance level
export const wcagLevelEnum = pgEnum("wcag_level", ["A", "AA", "AAA"]);

// Audit status
export const auditStatusEnum = pgEnum("audit_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
]);

// Issue severity
export const a11yIssueSeverityEnum = pgEnum("a11y_issue_severity", [
  "critical",
  "serious",
  "moderate",
  "minor",
]);

// Issue status
export const a11yIssueStatusEnum = pgEnum("a11y_issue_status", [
  "open",
  "in_progress",
  "resolved",
  "wont_fix",
  "duplicate",
]);

/**
 * Accessibility Audits
 * Automated and manual accessibility testing sessions
 */
export const accessibilityAudits = pgTable(
  "accessibility_audits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Audit details
    auditName: text("audit_name").notNull(),
    auditType: text("audit_type").notNull(), // automated, manual, hybrid
    targetUrl: text("target_url").notNull(),
    targetEnvironment: text("target_environment").notNull(), // production, staging, dev
    
    // WCAG version and level
    wcagVersion: text("wcag_version").notNull().default("2.2"),
    conformanceLevel: wcagLevelEnum("conformance_level").notNull().default("AA"),
    
    // Status
    status: auditStatusEnum("status").notNull().default("pending"),
    
    // Tools used
    toolsUsed: jsonb("tools_used").$type<
      Array<{
        name: string;
        version: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config?: any;
      }>
    >(),
    
    // Results summary
    totalIssues: integer("total_issues").notNull().default(0),
    criticalIssues: integer("critical_issues").notNull().default(0),
    seriousIssues: integer("serious_issues").notNull().default(0),
    moderateIssues: integer("moderate_issues").notNull().default(0),
    minorIssues: integer("minor_issues").notNull().default(0),
    
    // Score (0-100)
    accessibilityScore: integer("accessibility_score"),
    
    // Performance
    pagesScanned: integer("pages_scanned").notNull().default(0),
    elementsScanned: integer("elements_scanned").notNull().default(0),
    scanDurationMs: integer("scan_duration_ms"),
    
    // Reports
    reportUrl: text("report_url"),
    reportData: jsonb("report_data"),
    
    // Metadata
    triggeredBy: text("triggered_by"), // manual, scheduled, ci/cd, pre-deploy
    scheduledBy: text("scheduled_by").references(() => profiles.userId),
    
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index("accessibility_audits_organization_id_idx").on(
      table.organizationId
    ),
    statusIdx: index("accessibility_audits_status_idx").on(table.status),
    createdAtIdx: index("accessibility_audits_created_at_idx").on(
      table.createdAt
    ),
  })
);

/**
 * Accessibility Issues
 * Individual WCAG violations found during audits
 */
export const accessibilityIssues = pgTable(
  "accessibility_issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => accessibilityAudits.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Issue details
    issueTitle: text("issue_title").notNull(),
    issueDescription: text("issue_description").notNull(),
    severity: a11yIssueSeverityEnum("severity").notNull(),
    
    // WCAG criteria
    wcagCriteria: text("wcag_criteria").notNull(), // e.g., "1.4.3"
    wcagLevel: wcagLevelEnum("wcag_level").notNull(),
    wcagTitle: text("wcag_title").notNull(), // e.g., "Contrast (Minimum)"
    wcagUrl: text("wcag_url"), // Link to WCAG documentation
    
    // Location
    pageUrl: text("page_url").notNull(),
    elementSelector: text("element_selector"),
    elementHtml: text("element_html"),
    elementXpath: text("element_xpath"),
    
    // Context
    context: jsonb("context").$type<{
      screenshot?: string;
      viewport?: { width: number; height: number };
      userAgent?: string;
    }>(),
    
    // Fix suggestion
    fixSuggestion: text("fix_suggestion"),
    codeExample: text("code_example"),
    
    // Impact
    impactedUsers: text("impacted_users"), // Estimated or known
    affectsScreenReaders: boolean("affects_screen_readers").notNull().default(false),
    affectsKeyboardNav: boolean("affects_keyboard_nav").notNull().default(false),
    affectsColorBlindness: boolean("affects_color_blindness").notNull().default(false),
    
    // Status and assignment
    status: a11yIssueStatusEnum("status").notNull().default("open"),
    assignedTo: text("assigned_to").references(() => profiles.userId),
    priority: integer("priority").notNull().default(3), // 1-5
    
    // Resolution
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: text("resolved_by").references(() => profiles.userId),
    resolutionNotes: text("resolution_notes"),
    verifiedAt: timestamp("verified_at"),
    
    // Recurrence
    firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    auditIdIdx: index("accessibility_issues_audit_id_idx").on(table.auditId),
    organizationIdIdx: index("accessibility_issues_organization_id_idx").on(
      table.organizationId
    ),
    statusIdx: index("accessibility_issues_status_idx").on(table.status),
    severityIdx: index("accessibility_issues_severity_idx").on(
      table.severity
    ),
    wcagCriteriaIdx: index("accessibility_issues_wcag_criteria_idx").on(
      table.wcagCriteria
    ),
  })
);

/**
 * WCAG Success Criteria
 * Reference table for WCAG 2.2 success criteria
 */
export const wcagSuccessCriteria = pgTable(
  "wcag_success_criteria",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Criteria identification
    criteriaNumber: text("criteria_number").notNull().unique(), // "1.4.3"
    criteriaTitle: text("criteria_title").notNull(),
    criteriaDescription: text("criteria_description").notNull(),
    
    // Level and version
    level: wcagLevelEnum("level").notNull(),
    wcagVersion: text("wcag_version").notNull().default("2.2"),
    
    // Categorization
    principle: text("principle").notNull(), // Perceivable, Operable, Understandable, Robust
    guideline: text("guideline").notNull(),
    
    // Documentation
    understandingUrl: text("understanding_url"),
    howToMeetUrl: text("how_to_meet_url"),
    
    // Testing
    testingProcedure: text("testing_procedure"),
    commonFailures: jsonb("common_failures").$type<string[]>(),
    sufficientTechniques: jsonb("sufficient_techniques").$type<string[]>(),
    
    // Keywords for search
    keywords: jsonb("keywords").$type<string[]>(),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    criteriaNumberIdx: index("wcag_criteria_number_idx").on(
      table.criteriaNumber
    ),
    levelIdx: index("wcag_criteria_level_idx").on(table.level),
    principleIdx: index("wcag_criteria_principle_idx").on(table.principle),
  })
);

/**
 * Accessibility Test Suites
 * Pre-defined test suites for common patterns
 */
export const accessibilityTestSuites = pgTable(
  "accessibility_test_suites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    
    // Suite details
    suiteName: text("suite_name").notNull(),
    suiteDescription: text("suite_description"),
    suiteType: text("suite_type").notNull(), // component, page, workflow, full-site
    
    // Configuration
    urlPatterns: jsonb("url_patterns").$type<string[]>(),
    excludePatterns: jsonb("exclude_patterns").$type<string[]>(),
    
    // Rules
    enabledRules: jsonb("enabled_rules").$type<string[]>(),
    disabledRules: jsonb("disabled_rules").$type<string[]>(),
    customRules: jsonb("custom_rules").$type<
      Array<{
        id: string;
        selector: string;
        check: string;
        message: string;
      }>
    >(),
    
    // Schedule
    isScheduled: boolean("is_scheduled").notNull().default(false),
    scheduleExpression: text("schedule_expression"), // Cron expression
    
    // Notifications
    notifyOnFailure: boolean("notify_on_failure").notNull().default(true),
    notifyEmails: jsonb("notify_emails").$type<string[]>(),
    notifySlackChannel: text("notify_slack_channel"),
    
    // Status
    isActive: boolean("is_active").notNull().default(true),
    lastRunAt: timestamp("last_run_at"),
    lastRunStatus: auditStatusEnum("last_run_status"),
    
    createdBy: text("created_by").references(() => profiles.userId),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index("accessibility_test_suites_organization_id_idx").on(
      table.organizationId
    ),
    isActiveIdx: index("accessibility_test_suites_is_active_idx").on(
      table.isActive
    ),
  })
);

/**
 * Accessibility User Testing
 * Manual testing sessions with real users
 */
export const accessibilityUserTesting = pgTable(
  "accessibility_user_testing",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Session details
    sessionName: text("session_name").notNull(),
    sessionDate: timestamp("session_date").notNull(),
    
    // Participant
    participantName: text("participant_name").notNull(),
    participantEmail: text("participant_email"),
    assistiveTechnology: text("assistive_technology"), // screen reader, keyboard-only, voice control
    assistiveTechVersion: text("assistive_tech_version"),
    disability: text("disability"), // Optional, for context
    
    // Testing scope
    featuresTested: jsonb("features_tested").$type<string[]>(),
    taskList: jsonb("task_list").$type<
      Array<{
        task: string;
        completed: boolean;
        duration: number;
        difficulty: number; // 1-5
        notes: string;
      }>
    >(),
    
    // Results
    overallRating: integer("overall_rating"), // 1-5
    issuesFound: jsonb("issues_found").$type<
      Array<{
        description: string;
        severity: string;
        pageUrl: string;
      }>
    >(),
    positiveFindings: jsonb("positive_findings").$type<string[]>(),
    
    // Session data
    recordingUrl: text("recording_url"),
    transcriptUrl: text("transcript_url"),
    notes: text("notes"),
    
    // Follow-up
    followUpRequired: boolean("follow_up_required").notNull().default(false),
    followUpNotes: text("follow_up_notes"),
    
    conductedBy: text("conducted_by")
      .notNull()
      .references(() => profiles.userId),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index("accessibility_user_testing_organization_id_idx").on(
      table.organizationId
    ),
    sessionDateIdx: index("accessibility_user_testing_session_date_idx").on(
      table.sessionDate
    ),
  })
);

// Type exports
export type AccessibilityAudit = typeof accessibilityAudits.$inferSelect;
export type NewAccessibilityAudit = typeof accessibilityAudits.$inferInsert;
export type AccessibilityIssue = typeof accessibilityIssues.$inferSelect;
export type NewAccessibilityIssue = typeof accessibilityIssues.$inferInsert;
export type WcagSuccessCriteria = typeof wcagSuccessCriteria.$inferSelect;
export type NewWcagSuccessCriteria = typeof wcagSuccessCriteria.$inferInsert;
export type AccessibilityTestSuite = typeof accessibilityTestSuites.$inferSelect;
export type NewAccessibilityTestSuite = typeof accessibilityTestSuites.$inferInsert;
export type AccessibilityUserTesting = typeof accessibilityUserTesting.$inferSelect;
export type NewAccessibilityUserTesting = typeof accessibilityUserTesting.$inferInsert;

