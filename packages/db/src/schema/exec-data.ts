/**
 * Nzila OS — Executive/ops read-only surfaces.
 *
 * These tables use `organization_id` referencing the public `organizations`
 * domain (separate from platform `orgs`). Declared without FK so they
 * don't pull in the business schema graph.
 */
import { pgTable, uuid, text, integer, date, timestamp, numeric, boolean } from 'drizzle-orm/pg-core'

export const jobPostings = pgTable('job_postings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull().default('active'),
  postedDate: date('posted_date').notNull(),
  closingDate: date('closing_date'),
  filledDate: date('filled_date'),
  applicationsCount: integer('applications_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const jobApplications = pgTable('job_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  jobPostingId: uuid('job_posting_id').notNull(),
  applicationStatus: text('application_status').notNull().default('new'),
  appliedAt: timestamp('applied_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const customerOnboardingMilestones = pgTable('customer_onboarding_milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  milestone: text('milestone').notNull(),
  status: text('status').notNull().default('pending'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── FP&A: budget lines (planned + actual, minimal combined model) ──────────
// Actuals stored inline on the same row (actual_amount) to avoid a second
// join-heavy table in the MVP. Split into budget_lines + budget_actuals
// later if/when multi-source actuals reconciliation is needed.
export const budgetLines = pgTable('budget_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  periodKey: text('period_key').notNull(), // '2026-04' monthly, or '2026-Q2'
  budgetType: text('budget_type').notNull(), // 'opex' | 'revenue' | 'capex'
  category: text('category').notNull(),
  subcategory: text('subcategory'),
  productKey: text('product_key'),
  departmentKey: text('department_key'),
  owner: text('owner'),
  plannedAmount: numeric('planned_amount', { precision: 18, scale: 2 }).notNull(),
  actualAmount: numeric('actual_amount', { precision: 18, scale: 2 }),
  currency: text('currency').default('CAD'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── CS / Renewals accounts ──────────────────────────────────────────────────
export const csAccounts = pgTable('cs_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  clientName: text('client_name').notNull(),
  accountOwner: text('account_owner'),
  productKey: text('product_key'),
  contractValue: numeric('contract_value', { precision: 18, scale: 2 }),
  renewalDate: date('renewal_date'),
  renewalStatus: text('renewal_status'), // 'pending' | 'in_negotiation' | 'renewed' | 'lost'
  healthScore: text('health_score'), // 'green' | 'yellow' | 'red'
  sponsorLastContactAt: timestamp('sponsor_last_contact_at', { withTimezone: true }),
  lastQbrAt: timestamp('last_qbr_at', { withTimezone: true }),
  usageState: text('usage_state'), // 'up' | 'flat' | 'down'
  openSupportCount: integer('open_support_count').default(0),
  expansionSignal: boolean('expansion_signal').default(false),
  riskNotes: text('risk_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── Security findings (finding-shaped, replaces gap with check-shaped posture) ──
export const securityFindings = pgTable('security_findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  source: text('source').notNull(), // 'dependency_scan' | 'iac_scan' | 'manual_review' | 'runtime' | 'vendor'
  severity: text('severity').notNull(), // 'low' | 'medium' | 'high' | 'critical'
  status: text('status').notNull().default('open'), // 'open' | 'accepted_risk' | 'in_progress' | 'resolved' | 'suppressed'
  title: text('title').notNull(),
  description: text('description'),
  affectedSurface: text('affected_surface'),
  productKey: text('product_key'),
  owner: text('owner'),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
  dueAt: timestamp('due_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  fingerprint: text('fingerprint'),
  evidenceUrl: text('evidence_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const securityWaivers = pgTable('security_waivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  findingId: uuid('finding_id').notNull(),
  approvedBy: text('approved_by').notNull(),
  reason: text('reason').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── ERP invoices (AR bridge for collections agent) ─────────────────────────
// Physical table already exists via business schema; re-declared here without
// FK so the executive host can query AR without importing the full
// organizations graph. Columns map 1:1 to the live `erp_invoices` table.
export const erpInvoices = pgTable('erp_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  invoiceDate: timestamp('invoice_date', { withTimezone: true }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  customerId: text('customer_id').notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email'),
  currency: text('currency').notNull().default('CAD'),
  totalAmount: numeric('total_amount', { precision: 19, scale: 4 }).notNull(),
  amountPaid: numeric('amount_paid', { precision: 19, scale: 4 }).notNull().default('0'),
  amountDue: numeric('amount_due', { precision: 19, scale: 4 }).notNull(),
  status: text('status').notNull(),
  memo: text('memo'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
