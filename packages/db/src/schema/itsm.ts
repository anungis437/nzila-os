/**
 * Nzila OS — Service Operations Layer schema
 *
 * Tables:
 *   itsmTickets          — Unified support desk (incidents, requests, changes…)
 *   itsmTicketEvents     — Immutable event / audit log per ticket
 *   itsmAssets           — Asset & vendor register
 *   itsmSlas             — SLA profile definitions (per-org or per-client)
 *   itsmQueues           — Team / product queues
 *   itsmApprovals        — Approval requests linked to tickets or changes
 *   itsmProblems         — Incident root-cause investigations
 *   itsmChanges          — Change log (what changed, who approved, rollback plan)
 *   itsmContracts        — Client support contracts
 *   itsmKbArticles       — Internal SOPs and knowledge base
 *   opsClients           — Client success / onboarding tracker (NEW)
 *
 * All tables:
 *  - are scoped by org_id (→ orgs.id)
 *  - include created_at / updated_at
 *  - store actor references as text (user IDs from platform-auth)
 *  - use pgEnum for stable discriminators
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { orgs } from './orgs'

// ── Enums ─────────────────────────────────────────────────────────────────────

export const itsmTicketTypeEnum = pgEnum('itsm_ticket_type', [
  'incident',
  'service_request',
  'access_request',
  'change_request',
  'problem',
  'procurement',
  'vendor_escalation',
  'security_event',
  'project_task',
])

export const itsmTicketStatusEnum = pgEnum('itsm_ticket_status', [
  'new',
  'triage',
  'assigned',
  'in_progress',
  'waiting_user',
  'waiting_vendor',
  'resolved',
  'closed',
  'reopened',
])

export const itsmPriorityEnum = pgEnum('itsm_priority', [
  'p1_critical',
  'p2_high',
  'p3_medium',
  'p4_low',
])

export const itsmAssetTypeEnum = pgEnum('itsm_asset_type', [
  'laptop',
  'desktop',
  'phone',
  'printer',
  'network_device',
  'server',
  'saas_license',
  'cloud_resource',
  'facilities',
  'other',
])

export const itsmAssetLifecycleEnum = pgEnum('itsm_asset_lifecycle', [
  'active',
  'in_stock',
  'deployed',
  'under_repair',
  'retired',
  'disposed',
])

export const itsmChangeTypeEnum = pgEnum('itsm_change_type', [
  'standard',
  'normal',
  'emergency',
])

export const itsmChangeStatusEnum = pgEnum('itsm_change_status', [
  'proposed',
  'under_review',
  'approved',
  'scheduled',
  'implementing',
  'completed',
  'failed',
  'rolled_back',
  'closed',
])

export const itsmProblemStatusEnum = pgEnum('itsm_problem_status', [
  'open',
  'under_investigation',
  'known_error',
  'remediation_in_progress',
  'resolved',
  'closed',
])

export const itsmApprovalStatusEnum = pgEnum('itsm_approval_status', [
  'pending',
  'approved',
  'rejected',
  'escalated',
])

export const itsmContractStatusEnum = pgEnum('itsm_contract_status', [
  'active',
  'expiring_soon',
  'expired',
  'suspended',
  'cancelled',
])

export const itsmKbStatusEnum = pgEnum('itsm_kb_status', [
  'draft',
  'under_review',
  'published',
  'archived',
])

// ── itsmQueues ────────────────────────────────────────────────────────────────

export const itsmQueues = pgTable(
  'itsm_queues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    /** Human-readable queue name (e.g. "Tier 1 Support", "Network Ops") */
    name: text('name').notNull(),
    description: text('description'),
    /** JSON array of user-IDs that are queue members */
    memberIds: jsonb('member_ids').notNull().default([]),
    /** Default SLA profile applied to tickets routed here */
    defaultSlaId: uuid('default_sla_id'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('itsm_queues_org_idx').on(t.orgId)],
)

// ── itsmSlas ──────────────────────────────────────────────────────────────────

export const itsmSlas = pgTable(
  'itsm_slas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    name: text('name').notNull(),
    description: text('description'),
    /**
     * SLA targets in minutes, keyed by priority.
     * Schema: { p1_critical: { response: 15, resolution: 240 }, … }
     */
    targets: jsonb('targets').notNull(),
    /** MSP — if set, this SLA profile is linked to a specific client contract */
    contractId: uuid('contract_id'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('itsm_slas_org_idx').on(t.orgId)],
)

// ── itsmContracts ─────────────────────────────────────────────────────────────

export const itsmContracts = pgTable(
  'itsm_contracts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** MSP provider org */
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    /** Client org (may be external — stored as text if not in orgs table) */
    clientOrgId: uuid('client_org_id').references(() => orgs.id),
    clientName: text('client_name').notNull(),
    status: itsmContractStatusEnum('status').notNull().default('active'),
    /** ISO date strings */
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    /** Included ticket volume per month (null = unlimited) */
    includedTicketsPerMonth: integer('included_tickets_per_month'),
    /** Billable-work threshold in minutes per month */
    billableMinutesThreshold: integer('billable_minutes_threshold'),
    /** Applied SLA profile for this client */
    slaId: uuid('sla_id'),
    /** Arbitrary terms metadata */
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('itsm_contracts_org_idx').on(t.orgId),
    index('itsm_contracts_client_idx').on(t.clientOrgId),
  ],
)

// ── itsmTickets ───────────────────────────────────────────────────────────────

export const itsmTickets = pgTable(
  'itsm_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    /** Human-readable ticket number (e.g. INC-0042) */
    ticketNumber: text('ticket_number').notNull(),
    type: itsmTicketTypeEnum('type').notNull(),
    status: itsmTicketStatusEnum('status').notNull().default('new'),
    priority: itsmPriorityEnum('priority').notNull().default('p3_medium'),
    title: text('title').notNull(),
    description: text('description'),
    /** User ID of the reporter */
    reportedById: text('reported_by_id').notNull(),
    /** User ID of assigned technician */
    assignedToId: text('assigned_to_id'),
    queueId: uuid('queue_id').references(() => itsmQueues.id),
    slaId: uuid('sla_id').references(() => itsmSlas.id),
    /** MSP — which client contract this ticket is billed under */
    contractId: uuid('contract_id').references(() => itsmContracts.id),
    /** Linked problem record */
    problemId: uuid('problem_id'),
    /** Linked asset record */
    assetId: uuid('asset_id'),
    /** Linked ITSM change request */
    changeId: uuid('change_id'),
    /** SLA due timestamps (ISO-8601 strings for portability) */
    slaResponseDue: text('sla_response_due'),
    slaResolutionDue: text('sla_resolution_due'),
    slaBreached: boolean('sla_breached').notNull().default(false),
    /** Channel of origin */
    channel: text('channel').notNull().default('portal'),
    /** Intake tags for smart routing */
    tags: jsonb('tags').notNull().default([]),
    /** Attachment references (blob URLs or storage keys) */
    attachments: jsonb('attachments').notNull().default([]),
    /** Custom field bag */
    metadata: jsonb('metadata').default({}),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('itsm_tickets_org_idx').on(t.orgId),
    index('itsm_tickets_org_status_idx').on(t.orgId, t.status),
    index('itsm_tickets_org_type_idx').on(t.orgId, t.type),
    index('itsm_tickets_org_assignee_idx').on(t.orgId, t.assignedToId),
    index('itsm_tickets_org_created_idx').on(t.orgId, t.createdAt),
    index('itsm_tickets_contract_idx').on(t.contractId),
  ],
)

// ── itsmTicketEvents ──────────────────────────────────────────────────────────

export const itsmTicketEvents = pgTable(
  'itsm_ticket_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => itsmTickets.id),
    /**
     * Event type discriminator.
     * Examples: status_changed, note_added, assignment_changed,
     *           sla_breached, approval_requested, attachment_added,
     *           escalated, ai_suggestion_generated, automation_triggered
     */
    eventType: text('event_type').notNull(),
    actorId: text('actor_id').notNull(),
    /** Previous state snapshot (for status_changed, assignment_changed) */
    fromValue: text('from_value'),
    /** New state value */
    toValue: text('to_value'),
    /** Free-text body for notes */
    body: text('body'),
    /** Whether this event is visible to the end user (vs. internal note) */
    internal: boolean('internal').notNull().default(false),
    /** Structured event payload for automation / AI consumption */
    payload: jsonb('payload').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('itsm_ticket_events_ticket_idx').on(t.ticketId),
    index('itsm_ticket_events_org_idx').on(t.orgId),
    index('itsm_ticket_events_created_idx').on(t.ticketId, t.createdAt),
  ],
)

// ── itsmAssets ────────────────────────────────────────────────────────────────

export const itsmAssets = pgTable(
  'itsm_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    type: itsmAssetTypeEnum('type').notNull(),
    lifecycle: itsmAssetLifecycleEnum('lifecycle').notNull().default('active'),
    name: text('name').notNull(),
    manufacturer: text('manufacturer'),
    model: text('model'),
    serialNumber: text('serial_number'),
    /** User ID of assigned owner */
    ownerId: text('owner_id'),
    /** ISO date string */
    warrantyExpiry: text('warranty_expiry'),
    purchaseDate: text('purchase_date'),
    purchaseCost: text('purchase_cost'),
    /** Current book value (depreciation) */
    bookValue: text('book_value'),
    location: text('location'),
    /** JSON list of software identifiers installed on this asset */
    softwareInstalled: jsonb('software_installed').default([]),
    /** Computed risk score 0-100 (staleness, warranty, vulnerability signals) */
    riskScore: integer('risk_score').default(0),
    tags: jsonb('tags').default([]),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('itsm_assets_org_idx').on(t.orgId),
    index('itsm_assets_org_type_idx').on(t.orgId, t.type),
    index('itsm_assets_owner_idx').on(t.orgId, t.ownerId),
  ],
)

// ── itsmProblems ──────────────────────────────────────────────────────────────

export const itsmProblems = pgTable(
  'itsm_problems',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    problemNumber: text('problem_number').notNull(),
    status: itsmProblemStatusEnum('status').notNull().default('open'),
    title: text('title').notNull(),
    description: text('description'),
    rootCause: text('root_cause'),
    workaround: text('workaround'),
    /** IDs of known-error KB articles */
    knownErrorRefs: jsonb('known_error_refs').default([]),
    /** IDs of linked itsmTickets */
    linkedIncidentIds: jsonb('linked_incident_ids').default([]),
    remediationTaskIds: jsonb('remediation_task_ids').default([]),
    priority: itsmPriorityEnum('priority').notNull().default('p3_medium'),
    assignedToId: text('assigned_to_id'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('itsm_problems_org_idx').on(t.orgId)],
)

// ── itsmChanges ───────────────────────────────────────────────────────────────

export const itsmChanges = pgTable(
  'itsm_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    changeNumber: text('change_number').notNull(),
    type: itsmChangeTypeEnum('type').notNull().default('normal'),
    status: itsmChangeStatusEnum('status').notNull().default('proposed'),
    title: text('title').notNull(),
    description: text('description'),
    riskLevel: text('risk_level').notNull().default('medium'),
    impactSummary: text('impact_summary'),
    rollbackPlan: text('rollback_plan'),
    requestedById: text('requested_by_id').notNull(),
    /** JSON array of user IDs required to approve */
    approverIds: jsonb('approver_ids').notNull().default([]),
    /** JSON array of user IDs who have approved */
    approvedByIds: jsonb('approved_by_ids').notNull().default([]),
    /** ISO date strings */
    scheduledStart: text('scheduled_start'),
    scheduledEnd: text('scheduled_end'),
    implementationChecklist: jsonb('implementation_checklist').default([]),
    /** Reference to platform-change-management change_id if bridged */
    platformChangeId: text('platform_change_id'),
    /** Evidence and test reference IDs */
    evidenceRefs: jsonb('evidence_refs').default([]),
    postReviewNotes: text('post_review_notes'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('itsm_changes_org_idx').on(t.orgId),
    index('itsm_changes_status_idx').on(t.orgId, t.status),
  ],
)

// ── itsmApprovals ─────────────────────────────────────────────────────────────

export const itsmApprovals = pgTable(
  'itsm_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    /** Subject type — which table this approval belongs to */
    subjectType: text('subject_type').notNull(), // 'ticket' | 'change' | 'access_request'
    subjectId: uuid('subject_id').notNull(),
    status: itsmApprovalStatusEnum('status').notNull().default('pending'),
    requestedById: text('requested_by_id').notNull(),
    approverId: text('approver_id').notNull(),
    decision: text('decision'), // 'approved' | 'rejected'
    decisionNote: text('decision_note'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    dueBy: timestamp('due_by', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('itsm_approvals_subject_idx').on(t.subjectType, t.subjectId),
    index('itsm_approvals_approver_idx').on(t.approverId, t.status),
    index('itsm_approvals_org_idx').on(t.orgId),
  ],
)

// ── opsClients — Client success / onboarding tracker ─────────────────────────
//
// The operational home for every Nzila client.
// Tracks onboarding stage, health, ownership, and renewal dates so that
// support tickets can always be linked back to a named account.

export const opsClientOnboardingStageEnum = pgEnum('ops_client_onboarding_stage', [
  'prospect',
  'contract_signed',
  'tenant_created',
  'kickoff_booked',
  'training_complete',
  'live',
  'at_risk',
  'churned',
])

export const opsClientHealthEnum = pgEnum('ops_client_health', [
  'healthy',
  'needs_attention',
  'at_risk',
  'churned',
])

export const opsClients = pgTable(
  'ops_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    /** Client company / organisation name */
    companyName: text('company_name').notNull(),
    /** Primary contact name at the client */
    contactName: text('contact_name'),
    contactEmail: text('contact_email'),
    /** Which Nzila portfolio product this client is using */
    product: text('product').notNull(), // 'union_eyes' | 'faircase' | 'flow' | 'zonga' | 'agrimo' | 'other'
    onboardingStage: opsClientOnboardingStageEnum('onboarding_stage').notNull().default('prospect'),
    health: opsClientHealthEnum('health').notNull().default('healthy'),
    /** Nzila user ID of the account owner / CSM */
    accountOwnerId: text('account_owner_id'),
    /** ISO date string — when client went live */
    goLiveDate: text('go_live_date'),
    /** ISO date string — contract / subscription renewal */
    renewalDate: text('renewal_date'),
    /** Annual contract value (text to avoid float precision issues) */
    contractValue: text('contract_value'),
    /** Internal notes — visible only to Nzila team */
    notes: text('notes'),
    /** Structured expansion notes / feature requests */
    expansionNotes: text('expansion_notes'),
    /** 0–100 computed health score */
    healthScore: integer('health_score').default(100),
    /** Number of open tickets linked to this client */
    openTickets: integer('open_tickets').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ops_clients_org_idx').on(t.orgId),
    index('ops_clients_product_idx').on(t.orgId, t.product),
    index('ops_clients_stage_idx').on(t.orgId, t.onboardingStage),
    index('ops_clients_health_idx').on(t.orgId, t.health),
  ],
)

// ── itsmKbArticles ────────────────────────────────────────────────────────────

export const itsmKbArticles = pgTable(
  'itsm_kb_articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    status: itsmKbStatusEnum('status').notNull().default('draft'),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    category: text('category'),
    /** Tags for AI retrieval and smart-suggest */
    tags: jsonb('tags').default([]),
    body: text('body').notNull(),
    authorId: text('author_id').notNull(),
    reviewedById: text('reviewed_by_id'),
    /** View count for relevance scoring */
    viewCount: integer('view_count').notNull().default(0),
    /** Helpfulness votes */
    helpfulCount: integer('helpful_count').notNull().default(0),
    notHelpfulCount: integer('not_helpful_count').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('itsm_kb_org_status_idx').on(t.orgId, t.status),
    index('itsm_kb_slug_idx').on(t.orgId, t.slug),
  ],
)

// ── Command Center: Alerts ─────────────────────────────────────────────────────
//
// Smart alerts surface renewal risk, product spikes, onboarding stalls, and
// overload signals to the CEO/COO one-screen view.

export const commandAlertTypeEnum = pgEnum('command_alert_type', [
  'renewal_risk',
  'product_spike',
  'onboarding_stall',
  'overload',
  'churn_signal',
  'invoice_overdue',
])

export const commandAlertSeverityEnum = pgEnum('command_alert_severity', [
  'critical',
  'high',
  'medium',
])

export const commandAlerts = pgTable(
  'command_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    type: commandAlertTypeEnum('type').notNull(),
    severity: commandAlertSeverityEnum('severity').notNull().default('medium'),
    title: text('title').notNull(),
    body: text('body'),
    /** Optional: linked client account */
    clientId: uuid('client_id').references(() => opsClients.id),
    /** Optional: product key string (e.g. 'union_eyes') */
    productKey: text('product_key'),
    /** Optional: Nzila user ID of the assigned owner */
    ownerId: text('owner_id'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('command_alerts_org_idx').on(t.orgId),
    index('command_alerts_org_severity_idx').on(t.orgId, t.severity),
    index('command_alerts_client_idx').on(t.clientId),
  ],
)

// ── Command Center: Revenue Events ────────────────────────────────────────────

export const revenueEventTypeEnum = pgEnum('revenue_event_type', [
  'contract_signed',
  'renewal',
  'expansion',
  'churn',
  'payment_received',
  'invoice_overdue',
])

export const revenueEvents = pgTable(
  'revenue_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => opsClients.id),
    type: revenueEventTypeEnum('type').notNull(),
    /** Contract value in ZAR cents (integer to avoid float issues) */
    amountZar: integer('amount_zar').notNull().default(0),
    notes: text('notes'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('revenue_events_org_idx').on(t.orgId),
    index('revenue_events_client_idx').on(t.clientId),
    index('revenue_events_org_type_idx').on(t.orgId, t.type),
  ],
)

// ── Command Center: Renewal Tasks ─────────────────────────────────────────────

export const renewalTaskStatusEnum = pgEnum('renewal_task_status', [
  'open',
  'completed',
  'snoozed',
])

export const renewalTasks = pgTable(
  'renewal_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => opsClients.id),
    dueDate: text('due_date').notNull(), // ISO date string
    status: renewalTaskStatusEnum('status').notNull().default('open'),
    assignedTo: text('assigned_to'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('renewal_tasks_org_idx').on(t.orgId),
    index('renewal_tasks_client_idx').on(t.clientId),
    index('renewal_tasks_status_idx').on(t.orgId, t.status),
  ],
)

// ── Command Center: Product Health Snapshots ──────────────────────────────────

export const productHealthSnapshots = pgTable(
  'product_health_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    /** Product key: 'union_eyes' | 'faircase' | 'flow' | 'zonga' | 'agrimo' | 'other' */
    product: text('product').notNull(),
    incidentsThisMonth: integer('incidents_this_month').notNull().default(0),
    supportLoad: integer('support_load').notNull().default(0),
    deploymentsShipped: integer('deployments_shipped').notNull().default(0),
    openBugs: integer('open_bugs').notNull().default(0),
    /** ISO date string for snapshot granularity */
    snapshotDate: text('snapshot_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('product_health_org_idx').on(t.orgId),
    index('product_health_product_idx').on(t.orgId, t.product),
  ],
)

// ── Command Center: Founder Priorities ────────────────────────────────────────

export const founderPriorityTypeEnum = pgEnum('founder_priority_type', [
  'renewal',
  'incident',
  'proposal',
  'risk',
  'ops',
])

export const founderPriorities = pgTable(
  'founder_priorities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    title: text('title').notNull(),
    type: founderPriorityTypeEnum('type').notNull().default('ops'),
    /** Optional reference to a related entity (ticket, client, etc.) */
    linkedEntityId: text('linked_entity_id'),
    linkedEntityType: text('linked_entity_type'), // 'ticket' | 'client' | 'alert'
    done: boolean('done').notNull().default(false),
    dueDate: text('due_date'), // ISO date string, nullable
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('founder_priorities_org_idx').on(t.orgId),
    index('founder_priorities_done_idx').on(t.orgId, t.done),
  ],
)

// ── itsmAutomationRules ───────────────────────────────────────────────────────
//
// Persisted automation rules per org. Mirrors the AutomationRule interface
// in @nzila/itsm-core. The rule body (conditions + actions + logic) is
// stored as JSON so the schema does not need to change every time a new
// operator or action type is added to itsm-core.

export const itsmAutomationRules = pgTable(
  'itsm_automation_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    name: text('name').notNull(),
    description: text('description'),
    enabled: boolean('enabled').notNull().default(true),
    /** 'all' = AND of every condition, 'any' = OR */
    conditionLogic: text('condition_logic').notNull().default('all'),
    /** AutomationCondition[] — see @nzila/itsm-core types */
    conditions: jsonb('conditions').notNull().default([]),
    /** AutomationAction[] — see @nzila/itsm-core types */
    actions: jsonb('actions').notNull().default([]),
    /** Debounce: do not re-fire within N minutes per subject */
    cooldownMinutes: integer('cooldown_minutes'),
    /** When this rule was last evaluated and fired */
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    triggerCount: integer('trigger_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('itsm_automation_rules_org_idx').on(t.orgId),
    index('itsm_automation_rules_org_enabled_idx').on(t.orgId, t.enabled),
  ],
)

// ── itsmTicketFieldDefs ───────────────────────────────────────────────────────
//
// Org-defined custom fields for one or more ticket types. Adds tenant-level
// extensibility on top of the platform's TICKET_TYPES set without forcing
// a schema migration each time an org wants to track a new attribute.

export const itsmTicketFieldDefs = pgTable(
  'itsm_ticket_field_defs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    /** Stable machine-readable key, unique per (org, ticketType) */
    fieldKey: text('field_key').notNull(),
    /** Which ticket type this field applies to (must be a value from TICKET_TYPES) */
    ticketType: itsmTicketTypeEnum('ticket_type').notNull(),
    /** Display label */
    label: text('label').notNull(),
    /** Field type — drives the input widget */
    fieldType: text('field_type').notNull(), // 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'date' | 'boolean'
    /** Select / multiselect options (ignored for other field types) */
    options: jsonb('options').notNull().default([]),
    required: boolean('required').notNull().default(false),
    helpText: text('help_text'),
    /** Display order within the form */
    sortOrder: integer('sort_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('itsm_ticket_field_defs_org_idx').on(t.orgId),
    index('itsm_ticket_field_defs_type_idx').on(t.orgId, t.ticketType, t.sortOrder),
    uniqueIndex('itsm_ticket_field_defs_key_uq').on(t.orgId, t.ticketType, t.fieldKey),
  ],
)
