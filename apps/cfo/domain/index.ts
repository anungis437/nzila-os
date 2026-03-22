/**
 * Domain layer — canonical entity types, enums, and Zod schemas for CFO.
 *
 * CFO is FINANCE-CENTRIC: Reports → Ledger → Reconciliation → Advisory.
 * All finance entity types live here; actions/ and components/ consume them.
 */
import { z } from 'zod'

// ── Enums / Status types ─────────────────────────────────────────────────────

export const ReportType = {
  PNL: 'pnl',
  BALANCE_SHEET: 'balance-sheet',
  CASH_FLOW: 'cash-flow',
  TAX_SUMMARY: 'tax-summary',
  AUDIT_TRAIL: 'audit-trail',
  CUSTOM: 'custom',
} as const
export type ReportType = (typeof ReportType)[keyof typeof ReportType]

export const ReportStatus = {
  DRAFT: 'draft',
  GENERATED: 'generated',
  REVIEWED: 'reviewed',
  PUBLISHED: 'published',
} as const
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus]

export const LedgerSource = {
  STRIPE: 'stripe',
  QBO: 'qbo',
  XERO: 'xero',
  SAGE: 'sage',
  MANUAL: 'manual',
} as const
export type LedgerSource = (typeof LedgerSource)[keyof typeof LedgerSource]

export const AlertSeverity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  INFO: 'info',
} as const
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity]

export const AlertCategory = {
  TAX_DEADLINE: 'tax-deadline',
  CASH_FLOW: 'cash-flow',
  COMPLIANCE: 'compliance',
  TAX_OPTIMIZATION: 'tax-optimization',
  RECEIVABLES: 'receivables',
  PAYROLL: 'payroll',
} as const
export type AlertCategory = (typeof AlertCategory)[keyof typeof AlertCategory]

export const WorkflowTrigger = {
  REPORT_CREATED: 'report_created',
  ALERT_TRIGGERED: 'alert_triggered',
  DOCUMENT_UPLOADED: 'document_uploaded',
  CLIENT_ONBOARDED: 'client_onboarded',
  MANUAL: 'manual',
} as const
export type WorkflowTrigger = (typeof WorkflowTrigger)[keyof typeof WorkflowTrigger]

export const WorkflowStatus = {
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
} as const
export type WorkflowStatus = (typeof WorkflowStatus)[keyof typeof WorkflowStatus]

export const StepStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  SKIPPED: 'skipped',
} as const
export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus]

export const AssigneeRole = {
  ACCOUNTANT: 'accountant',
  MANAGER: 'manager',
  PARTNER: 'partner',
  CLIENT: 'client',
} as const
export type AssigneeRole = (typeof AssigneeRole)[keyof typeof AssigneeRole]

// ── Zod Schemas ──────────────────────────────────────────────────────────────

export const ReportSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  type: z.enum(['pnl', 'balance-sheet', 'cash-flow', 'tax-summary', 'audit-trail', 'custom']),
  status: z.enum(['draft', 'generated', 'reviewed', 'published']),
  period: z.string(),
  createdAt: z.coerce.date(),
  generatedBy: z.string(),
  narrativeSummary: z.string().nullable(),
})

export const LedgerEntrySchema = z.object({
  id: z.string().uuid(),
  date: z.coerce.date(),
  description: z.string(),
  account: z.string(),
  debit: z.number().nullable(),
  credit: z.number().nullable(),
  source: z.enum(['stripe', 'qbo', 'xero', 'sage', 'manual']),
  reference: z.string().nullable(),
})

export const AdvisoryAlertSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string(),
  clientName: z.string(),
  category: z.enum(['tax-deadline', 'cash-flow', 'compliance', 'tax-optimization', 'receivables', 'payroll']),
  severity: z.enum(['critical', 'high', 'medium', 'info']),
  title: z.string(),
  message: z.string(),
  estimatedImpact: z.number(),
  suggestedAction: z.string(),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  dismissed: z.boolean(),
})

export const WorkflowStepSchema = z.object({
  name: z.string(),
  assigneeRole: z.enum(['accountant', 'manager', 'partner', 'client']),
  actionType: z.enum(['review', 'approve', 'edit', 'sign', 'notify']),
  dueHours: z.number().positive(),
})

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  actorId: z.string(),
  entityType: z.string(),
  orgId: z.string(),
  metadata: z.record(z.unknown()),
  createdAt: z.coerce.date(),
})

export const ClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Client name is required'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  businessNumber: z.string().optional(),
  industry: z.string().optional(),
  status: z.enum(['active', 'inactive', 'prospect']).default('active'),
  notes: z.string().optional(),
})

export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  assigneeRole: z.enum(['accountant', 'manager', 'partner', 'client']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['pending', 'in-progress', 'completed', 'cancelled']).default('pending'),
  dueDate: z.coerce.date().optional(),
  clientId: z.string().uuid().optional(),
})

// ── Types (inferred from schemas) ────────────────────────────────────────────

export type Report = z.infer<typeof ReportSchema>
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>
export type AdvisoryAlert = z.infer<typeof AdvisoryAlertSchema>
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>
export type AuditEvent = z.infer<typeof AuditEventSchema>
export type Client = z.infer<typeof ClientSchema>
export type Task = z.infer<typeof TaskSchema>

// ── Composite types (not schema-backed) ──────────────────────────────────────

export interface LedgerSummary {
  entries: LedgerEntry[]
  totalDebits: number
  totalCredits: number
  netBalance: number
  entryCount: number
}

export interface ClientMetrics {
  clientId: string
  clientName: string
  cashRunwayDays: number
  overdueReceivables: number
  overdueReceivablesCount: number
  totalReceivables: number
  daysToNextDeadline: number
  nextDeadlineType: string
  effectiveTaxRate: number
  optimalTaxRate: number
  payrollNextRun?: string
  gstBalance: number
  qboSyncAge: number
}

// ── Re-exports from commerce-core ────────────────────────────────────────────

export type {
  Invoice,
  InvoiceLine,
  Payment,
  CreditNote,
  Refund,
  Dispute,
  Order,
  OrderLine,
  Quote,
  QuoteLine,
  Customer,
  TaxBreakdown,
  TaxLine,
  EvidenceArtifact,
  SyncJob,
  SyncReceipt,
  OrgContext,
} from '@nzila/commerce-core'

export {
  QuoteStatus,
  OrderStatus,
  InvoiceStatus,
  FulfillmentStatus,
  ApprovalDecision,
  PricingTier,
  EvidenceType,
} from '@nzila/commerce-core'
