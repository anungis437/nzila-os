/**
 * Tests — Domain Layer Zod Schemas
 *
 * Validates all domain schemas accept well-formed data
 * and reject malformed data with proper error messages.
 */
import { describe, it, expect } from 'vitest'
import {
  ReportSchema,
  LedgerEntrySchema,
  AdvisoryAlertSchema,
  WorkflowStepSchema,
  AuditEventSchema,
  ClientSchema,
  TaskSchema,
  ReportType,
  ReportStatus,
  LedgerSource,
  AlertSeverity,
  AlertCategory,
  WorkflowTrigger,
  WorkflowStatus,
  StepStatus,
  AssigneeRole,
} from '@/domain'

/* ── 1. Enum completeness ─────────────────────────────────────────────────── */

describe('Domain enums', () => {
  it('ReportType has all expected values', () => {
    expect(Object.values(ReportType)).toEqual(
      expect.arrayContaining(['pnl', 'balance-sheet', 'cash-flow', 'tax-summary', 'audit-trail', 'custom']),
    )
  })

  it('ReportStatus has all expected values', () => {
    expect(Object.values(ReportStatus)).toEqual(
      expect.arrayContaining(['draft', 'generated', 'reviewed', 'published']),
    )
  })

  it('LedgerSource includes xero and sage', () => {
    expect(Object.values(LedgerSource)).toContain('xero')
    expect(Object.values(LedgerSource)).toContain('sage')
    expect(Object.values(LedgerSource)).toContain('stripe')
    expect(Object.values(LedgerSource)).toContain('qbo')
    expect(Object.values(LedgerSource)).toContain('manual')
  })

  it('AlertSeverity has all levels', () => {
    expect(Object.values(AlertSeverity)).toEqual(
      expect.arrayContaining(['critical', 'high', 'medium', 'info']),
    )
  })

  it('AlertCategory has all types', () => {
    expect(Object.values(AlertCategory)).toEqual(
      expect.arrayContaining(['tax-deadline', 'cash-flow', 'compliance', 'tax-optimization', 'receivables', 'payroll']),
    )
  })

  it('WorkflowTrigger has all types', () => {
    expect(Object.values(WorkflowTrigger)).toEqual(
      expect.arrayContaining(['report_created', 'alert_triggered', 'document_uploaded', 'client_onboarded', 'manual']),
    )
  })

  it('WorkflowStatus has all states', () => {
    expect(Object.values(WorkflowStatus)).toEqual(
      expect.arrayContaining(['in-progress', 'completed', 'rejected']),
    )
  })

  it('StepStatus has all states', () => {
    expect(Object.values(StepStatus)).toEqual(
      expect.arrayContaining(['pending', 'completed', 'rejected', 'skipped']),
    )
  })

  it('AssigneeRole has all roles', () => {
    expect(Object.values(AssigneeRole)).toEqual(
      expect.arrayContaining(['accountant', 'manager', 'partner', 'client']),
    )
  })
})

/* ── 2. ReportSchema ──────────────────────────────────────────────────────── */

describe('ReportSchema', () => {
  const validReport = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    title: 'Q1 P&L',
    type: 'pnl',
    status: 'draft',
    period: '2026-Q1',
    createdAt: '2026-01-15T10:00:00Z',
    generatedBy: 'user-1',
    narrativeSummary: 'Revenue grew 12%.',
  }

  it('accepts a valid report', () => {
    const result = ReportSchema.safeParse(validReport)
    expect(result.success).toBe(true)
  })

  it('coerces date strings to Date objects', () => {
    const result = ReportSchema.parse(validReport)
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  it('allows null narrativeSummary', () => {
    const result = ReportSchema.safeParse({ ...validReport, narrativeSummary: null })
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = ReportSchema.safeParse({ ...validReport, title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid report type', () => {
    const result = ReportSchema.safeParse({ ...validReport, type: 'quarterly' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid UUID', () => {
    const result = ReportSchema.safeParse({ ...validReport, id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

/* ── 3. LedgerEntrySchema ─────────────────────────────────────────────────── */

describe('LedgerEntrySchema', () => {
  const validEntry = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    date: '2026-01-15',
    description: 'Stripe payout',
    account: '1000',
    debit: 5000,
    credit: null,
    source: 'stripe',
    reference: 'po_abc123',
  }

  it('accepts a valid entry', () => {
    const result = LedgerEntrySchema.safeParse(validEntry)
    expect(result.success).toBe(true)
  })

  it('accepts xero and sage sources', () => {
    expect(LedgerEntrySchema.safeParse({ ...validEntry, source: 'xero' }).success).toBe(true)
    expect(LedgerEntrySchema.safeParse({ ...validEntry, source: 'sage' }).success).toBe(true)
  })

  it('rejects invalid source', () => {
    const result = LedgerEntrySchema.safeParse({ ...validEntry, source: 'freshbooks' })
    expect(result.success).toBe(false)
  })

  it('allows null debit and credit', () => {
    const result = LedgerEntrySchema.safeParse({ ...validEntry, debit: null, credit: null })
    expect(result.success).toBe(true)
  })

  it('allows null reference', () => {
    const result = LedgerEntrySchema.safeParse({ ...validEntry, reference: null })
    expect(result.success).toBe(true)
  })
})

/* ── 4. AdvisoryAlertSchema ───────────────────────────────────────────────── */

describe('AdvisoryAlertSchema', () => {
  const validAlert = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    clientId: 'c-001',
    clientName: 'Acme Corp',
    category: 'cash-flow',
    severity: 'critical',
    title: 'Low Cash Runway',
    message: 'Cash runway is 15 days.',
    estimatedImpact: 50000,
    suggestedAction: 'Accelerate AR collections.',
    createdAt: '2026-01-15T10:00:00Z',
    dismissed: false,
  }

  it('accepts a valid alert', () => {
    const result = AdvisoryAlertSchema.safeParse(validAlert)
    expect(result.success).toBe(true)
  })

  it('allows optional expiresAt', () => {
    const result = AdvisoryAlertSchema.safeParse({ ...validAlert, expiresAt: '2026-02-15' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid severity', () => {
    const result = AdvisoryAlertSchema.safeParse({ ...validAlert, severity: 'low' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid category', () => {
    const result = AdvisoryAlertSchema.safeParse({ ...validAlert, category: 'fraud' })
    expect(result.success).toBe(false)
  })

  it('requires all payroll category alerts', () => {
    const payrollAlert = { ...validAlert, category: 'payroll' }
    const result = AdvisoryAlertSchema.safeParse(payrollAlert)
    expect(result.success).toBe(true)
  })
})

/* ── 5. WorkflowStepSchema ────────────────────────────────────────────────── */

describe('WorkflowStepSchema', () => {
  it('accepts a valid step', () => {
    const result = WorkflowStepSchema.safeParse({
      name: 'Manager Review',
      assigneeRole: 'manager',
      actionType: 'approve',
      dueHours: 24,
    })
    expect(result.success).toBe(true)
  })

  it('rejects zero dueHours', () => {
    const result = WorkflowStepSchema.safeParse({
      name: 'Review',
      assigneeRole: 'accountant',
      actionType: 'review',
      dueHours: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative dueHours', () => {
    const result = WorkflowStepSchema.safeParse({
      name: 'Review',
      assigneeRole: 'accountant',
      actionType: 'review',
      dueHours: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid actionType', () => {
    const result = WorkflowStepSchema.safeParse({
      name: 'Test',
      assigneeRole: 'accountant',
      actionType: 'delete',
      dueHours: 8,
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid action types', () => {
    for (const actionType of ['review', 'approve', 'edit', 'sign', 'notify']) {
      const result = WorkflowStepSchema.safeParse({
        name: `${actionType} step`,
        assigneeRole: 'accountant',
        actionType,
        dueHours: 8,
      })
      expect(result.success).toBe(true)
    }
  })
})

/* ── 6. AuditEventSchema ─────────────────────────────────────────────────── */

describe('AuditEventSchema', () => {
  it('accepts a valid audit event', () => {
    const result = AuditEventSchema.safeParse({
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      action: 'report.generated',
      actorId: 'user-1',
      entityType: 'report',
      orgId: 'org-1',
      metadata: { title: 'Q1 P&L', type: 'pnl' },
      createdAt: '2026-01-15T10:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('coerces createdAt to Date', () => {
    const result = AuditEventSchema.parse({
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      action: 'ledger.entry_created',
      actorId: 'user-1',
      entityType: 'ledger_entry',
      orgId: 'org-1',
      metadata: {},
      createdAt: '2026-01-15T10:00:00Z',
    })
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  it('accepts empty metadata', () => {
    const result = AuditEventSchema.safeParse({
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      action: 'workflow.completed',
      actorId: 'user-1',
      entityType: 'workflow',
      orgId: 'org-1',
      metadata: {},
      createdAt: '2026-01-15',
    })
    expect(result.success).toBe(true)
  })
})

/* ── 7. ClientSchema ──────────────────────────────────────────────────────── */

describe('ClientSchema', () => {
  const validClient = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'Acme Corp',
    email: 'finance@acme.com',
    phone: '+1-514-555-1234',
    businessNumber: 'BN123456',
    industry: 'Manufacturing',
    status: 'active',
    notes: 'Enterprise client',
  }

  it('accepts a valid client', () => {
    const result = ClientSchema.safeParse(validClient)
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = ClientSchema.safeParse({ ...validClient, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = ClientSchema.safeParse({ ...validClient, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('defaults status to active', () => {
    const result = ClientSchema.parse({ id: validClient.id, name: 'Test' })
    expect(result.status).toBe('active')
  })

  it('allows minimal client (id + name only)', () => {
    const result = ClientSchema.safeParse({ id: validClient.id, name: 'Minimal Co' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = ClientSchema.safeParse({ ...validClient, status: 'deleted' })
    expect(result.success).toBe(false)
  })

  it('accepts prospect status', () => {
    const result = ClientSchema.safeParse({ ...validClient, status: 'prospect' })
    expect(result.success).toBe(true)
  })
})

/* ── 8. TaskSchema ────────────────────────────────────────────────────────── */

describe('TaskSchema', () => {
  const validTask = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    title: 'Prepare Q1 Tax Filing',
    description: 'Complete GST/HST filing for Q1.',
    assigneeRole: 'accountant',
    priority: 'high',
    status: 'pending',
    dueDate: '2026-04-30',
    clientId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  }

  it('accepts a valid task', () => {
    const result = TaskSchema.safeParse(validTask)
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = TaskSchema.safeParse({ ...validTask, title: '' })
    expect(result.success).toBe(false)
  })

  it('defaults priority to medium', () => {
    const result = TaskSchema.parse({
      id: validTask.id,
      title: 'Basic Task',
      assigneeRole: 'accountant',
    })
    expect(result.priority).toBe('medium')
  })

  it('defaults status to pending', () => {
    const result = TaskSchema.parse({
      id: validTask.id,
      title: 'New Task',
      assigneeRole: 'manager',
    })
    expect(result.status).toBe('pending')
  })

  it('accepts all priority levels', () => {
    for (const priority of ['low', 'medium', 'high', 'urgent']) {
      const result = TaskSchema.safeParse({ ...validTask, priority })
      expect(result.success).toBe(true)
    }
  })

  it('accepts all status values', () => {
    for (const status of ['pending', 'in-progress', 'completed', 'cancelled']) {
      const result = TaskSchema.safeParse({ ...validTask, status })
      expect(result.success).toBe(true)
    }
  })

  it('coerces dueDate string to Date', () => {
    const result = TaskSchema.parse(validTask)
    expect(result.dueDate).toBeInstanceOf(Date)
  })

  it('allows task without clientId or dueDate', () => {
    const result = TaskSchema.safeParse({
      id: validTask.id,
      title: 'Internal Task',
      assigneeRole: 'partner',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid clientId (non-uuid)', () => {
    const result = TaskSchema.safeParse({ ...validTask, clientId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})
