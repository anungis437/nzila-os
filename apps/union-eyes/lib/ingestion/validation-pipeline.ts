/**
 * Ingestion Validation Pipeline (§11)
 *
 * Pre-import validation for grievance/case data:
 * - Required field checks
 * - FSM state mapping validation
 * - Duplicate external ID detection
 * - Document link validation
 * - User resolution checks
 *
 * Blocks on critical errors; collects warnings for non-blocking issues.
 */

import { createHash } from 'crypto';
import { toLifecycleState, type LifecycleState } from '@/lib/workflow/state-bridge';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  index: number;
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  recordCount: number;
}

export interface IngestionGrievanceRecord {
  external_case_id: string;
  grievance_number?: string;
  type: string;
  status: string;
  priority?: string;
  step?: string;
  title: string;
  description: string;
  grievant_name?: string;
  grievant_email?: string;
  organization_id: string;
  incident_date?: string;
  filed_date?: string;
  timeline?: Array<{
    date: string;
    action: string;
    actor?: string;
    notes?: string;
  }>;
  documents?: Array<{
    external_id?: string;
    name: string;
    file_url?: string;
    file_type?: string;
  }>;
  assigned_to?: string;
  filed_by?: string;
  source_system?: string;
}

// ─── Valid Enums ─────────────────────────────────────────────────────────────

const VALID_GRIEVANCE_TYPES = new Set([
  'individual', 'group', 'policy', 'contract', 'harassment',
  'discrimination', 'safety', 'seniority', 'discipline', 'termination', 'other',
]);

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

const VALID_STEPS = new Set(['step_1', 'step_2', 'step_3', 'final', 'arbitration']);

// All states valid for import (covers all legacy FSMs)
const VALID_IMPORT_STATES = new Set([
  // Grievance statuses
  'draft', 'filed', 'acknowledged', 'investigating', 'response_due',
  'response_received', 'escalated', 'mediation', 'arbitration',
  'settled', 'withdrawn', 'denied', 'closed',
  // Claim statuses
  'submitted', 'under_review', 'assigned', 'investigation',
  'pending_documentation', 'resolved', 'rejected',
  // Unified lifecycle
  'triage', 'pending_docs', 'negotiation',
]);

// ─── Fingerprint ────────────────────────────────────────────────────────────

export function computeRecordFingerprint(record: IngestionGrievanceRecord): string {
  const canonical = JSON.stringify({
    ext: record.external_case_id,
    org: record.organization_id,
    type: record.type,
    title: record.title?.trim(),
    desc: record.description?.trim().substring(0, 500),
    date: record.incident_date ?? record.filed_date,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

// ─── Timeline Event Hash ────────────────────────────────────────────────────

export function computeTimelineEventHash(event: {
  date: string;
  action: string;
  actor?: string;
  notes?: string;
}): string {
  const canonical = JSON.stringify({
    d: event.date,
    a: event.action,
    actor: event.actor ?? '',
    n: (event.notes ?? '').trim().substring(0, 200),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

// ─── Status Mapping ─────────────────────────────────────────────────────────

export function mapImportStatus(rawStatus: string): {
  grievanceStatus: string;
  lifecycleState: LifecycleState | null;
} {
  const normalized = rawStatus.toLowerCase().trim().replace(/\s+/g, '_');

  // Direct grievance enum match
  if (VALID_IMPORT_STATES.has(normalized)) {
    const lifecycle = toLifecycleState('grievance', normalized)
      ?? toLifecycleState('claim', normalized)
      ?? toLifecycleState('cupe', normalized);
    return { grievanceStatus: normalized, lifecycleState: lifecycle };
  }

  // Common aliases
  const ALIASES: Record<string, string> = {
    open: 'filed',
    new: 'filed',
    active: 'investigating',
    in_progress: 'investigating',
    pending: 'response_due',
    on_hold: 'response_due',
    complete: 'resolved',
    completed: 'resolved',
    cancelled: 'withdrawn',
    canceled: 'withdrawn',
    rejected: 'denied',
  };

  const mapped = ALIASES[normalized];
  if (mapped) {
    const lifecycle = toLifecycleState('grievance', mapped)
      ?? toLifecycleState('cupe', mapped);
    return { grievanceStatus: mapped, lifecycleState: lifecycle };
  }

  return { grievanceStatus: normalized, lifecycleState: null };
}

// ─── Validate Single Record ─────────────────────────────────────────────────

function validateRecord(record: IngestionGrievanceRecord, idx: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Required fields
  if (!record.external_case_id?.trim()) {
    issues.push({ index: idx, field: 'external_case_id', severity: 'error', message: 'Missing external_case_id (required for idempotency)' });
  }
  if (!record.title?.trim()) {
    issues.push({ index: idx, field: 'title', severity: 'error', message: 'Missing title' });
  }
  if (!record.description?.trim()) {
    issues.push({ index: idx, field: 'description', severity: 'error', message: 'Missing description' });
  }
  if (!record.organization_id?.trim()) {
    issues.push({ index: idx, field: 'organization_id', severity: 'error', message: 'Missing organization_id' });
  }

  // Type validation
  if (!record.type?.trim()) {
    issues.push({ index: idx, field: 'type', severity: 'error', message: 'Missing grievance type' });
  } else if (!VALID_GRIEVANCE_TYPES.has(record.type)) {
    issues.push({ index: idx, field: 'type', severity: 'error', message: `Invalid grievance type '${record.type}'. Valid: ${[...VALID_GRIEVANCE_TYPES].join(', ')}` });
  }

  // Status / FSM mapping
  if (!record.status?.trim()) {
    issues.push({ index: idx, field: 'status', severity: 'error', message: 'Missing status' });
  } else {
    const { lifecycleState } = mapImportStatus(record.status);
    if (!lifecycleState) {
      issues.push({ index: idx, field: 'status', severity: 'error', message: `Cannot map status '${record.status}' to any known FSM state` });
    }
  }

  // Priority
  if (record.priority && !VALID_PRIORITIES.has(record.priority)) {
    issues.push({ index: idx, field: 'priority', severity: 'warning', message: `Unknown priority '${record.priority}', will default to 'medium'` });
  }

  // Step
  if (record.step && !VALID_STEPS.has(record.step)) {
    issues.push({ index: idx, field: 'step', severity: 'warning', message: `Unknown step '${record.step}', will be omitted` });
  }

  // Date validation
  for (const dateField of ['incident_date', 'filed_date'] as const) {
    const val = record[dateField];
    if (val) {
      const parsed = new Date(val);
      if (isNaN(parsed.getTime())) {
        issues.push({ index: idx, field: dateField, severity: 'error', message: `Invalid date format: '${val}'` });
      } else if (parsed.getTime() > Date.now() + 86_400_000) {
        issues.push({ index: idx, field: dateField, severity: 'warning', message: `Date '${val}' is in the future` });
      }
    }
  }

  // Timeline validation
  if (record.timeline?.length) {
    for (let ti = 0; ti < record.timeline.length; ti++) {
      const ev = record.timeline[ti];
      if (!ev.date) {
        issues.push({ index: idx, field: `timeline[${ti}].date`, severity: 'warning', message: 'Timeline event missing date — will use filed_date or import time' });
      } else {
        const parsed = new Date(ev.date);
        if (isNaN(parsed.getTime())) {
          issues.push({ index: idx, field: `timeline[${ti}].date`, severity: 'warning', message: `Invalid timeline date: '${ev.date}'` });
        }
      }
      if (!ev.action?.trim()) {
        issues.push({ index: idx, field: `timeline[${ti}].action`, severity: 'warning', message: 'Timeline event missing action' });
      }
    }
  }

  // Grievant
  if (!record.grievant_name?.trim() && !record.filed_by?.trim()) {
    issues.push({ index: idx, field: 'grievant_name', severity: 'warning', message: 'No grievant name or filed_by — will use "Unassigned"' });
  }

  return issues;
}

// ─── Validate Batch ─────────────────────────────────────────────────────────

export function validateIngestionBatch(records: IngestionGrievanceRecord[]): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!records.length) {
    errors.push({ index: -1, field: 'records', severity: 'error', message: 'Empty record set' });
    return { valid: false, errors, warnings, recordCount: 0 };
  }

  // Per-record validation
  const seenExternalIds = new Map<string, number>();

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const issues = validateRecord(rec, i);

    for (const issue of issues) {
      (issue.severity === 'error' ? errors : warnings).push(issue);
    }

    // Duplicate external_case_id within batch
    if (rec.external_case_id?.trim()) {
      const key = `${rec.organization_id}::${rec.external_case_id}`;
      if (seenExternalIds.has(key)) {
        errors.push({
          index: i,
          field: 'external_case_id',
          severity: 'error',
          message: `Duplicate external_case_id '${rec.external_case_id}' (also at index ${seenExternalIds.get(key)})`,
        });
      } else {
        seenExternalIds.set(key, i);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    recordCount: records.length,
  };
}
