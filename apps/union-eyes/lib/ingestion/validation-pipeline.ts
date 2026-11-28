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
import { toLifecycleState } from '@/lib/workflow/state-bridge';
import type { LifecycleState } from '@/lib/workflow/case-lifecycle';

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
    /** The SHA-256 (lowercase hex) the source declares for the file's bytes; verification compares fetched bytes with it. */
    sha256?: string;
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

// grievances.status is varchar(20): a longer status (a claim's 'pending_documentation') fails the row in the database, so it fails here, with the reason.
const GRIEVANCE_STATUS_MAX_LENGTH = 20;

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

/** Stable JSON: object keys sorted, undefined members left out, so the same record always has the same bytes. */
export function canonicalImportJson(value: unknown): string {
  if (value === null || value === undefined || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalImportJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalImportJson(v)}`).join(',')}}`;
}

export const RECORD_FINGERPRINT_VERSION = 2;

/**
 * The exact digest of everything an import takes from a record (MIG-09). Version 1 hashed the first 500 characters of
 * the description and left out the status, priority, step, parties, timeline and documents, so two different records
 * could share a fingerprint. Nothing is truncated or omitted here.
 */
export function computeRecordFingerprint(record: IngestionGrievanceRecord): string {
  return createHash('sha256').update(canonicalImportJson({
    v: RECORD_FINGERPRINT_VERSION,
    ext: record.external_case_id,
    num: record.grievance_number,
    org: record.organization_id,
    type: record.type,
    status: record.status,
    priority: record.priority,
    step: record.step,
    title: record.title,
    desc: record.description,
    grievant: record.grievant_name,
    email: record.grievant_email,
    incident: record.incident_date,
    filed: record.filed_date,
    assigned: record.assigned_to,
    filedBy: record.filed_by,
    timeline: record.timeline,
    documents: record.documents,
  })).digest('hex');
}

// ─── Timeline Event Hash ────────────────────────────────────────────────────

// The notes are hashed in full: a 200-character prefix made two different events one. For notes of 200 characters or
// fewer the bytes are unchanged, so re-importing an earlier import adds no duplicate event.
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
    n: (event.notes ?? '').trim(),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

// ─── Explicit value mapping (MIG-02) ────────────────────────────────────────

/** Source values the platform does not use, mapped explicitly by the operator to a platform value. */
export interface ImportValueMapping {
  priority?: Record<string, string>;
  step?: Record<string, string>;
}

export const STATUS_MAPPING_VERSION = 'status-aliases-v1';

export function importMappingDigest(mapping: ImportValueMapping | undefined): string {
  return createHash('sha256').update(canonicalImportJson({
    status: STATUS_MAPPING_VERSION,
    priority: mapping?.priority ?? {},
    step: mapping?.step ?? {},
  })).digest('hex');
}

type Resolved = { value: string | null; error?: string };

/** An absent priority is the platform default (the raw absence is kept in provenance); an unknown one is mapped explicitly or refused, never defaulted. */
export function resolveImportPriority(raw: string | undefined, mapping?: ImportValueMapping): Resolved {
  const value = raw?.trim();
  if (!value) return { value: 'medium' };
  if (VALID_PRIORITIES.has(value)) return { value };
  const mapped = mapping?.priority?.[value];
  if (mapped !== undefined) {
    return VALID_PRIORITIES.has(mapped) ? { value: mapped } : { value: null, error: `Priority mapping for '${value}' names '${mapped}', which is not a platform priority` };
  }
  return { value: null, error: `Unknown priority '${value}'. Map it explicitly (value_mapping.priority); it is never defaulted` };
}

/** An absent stage stays absent; an unknown one is mapped explicitly or refused, never dropped. */
export function resolveImportStep(raw: string | undefined, mapping?: ImportValueMapping): Resolved {
  const value = raw?.trim();
  if (!value) return { value: null };
  if (VALID_STEPS.has(value)) return { value };
  const mapped = mapping?.step?.[value];
  if (mapped !== undefined) {
    return VALID_STEPS.has(mapped) ? { value: mapped } : { value: null, error: `Stage mapping for '${value}' names '${mapped}', which is not a platform stage` };
  }
  return { value: null, error: `Unknown procedural stage '${value}'. Map it to a known stage before import (value_mapping.step); it is never dropped` };
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

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

function validateRecord(record: IngestionGrievanceRecord, idx: number, mapping?: ImportValueMapping): ValidationIssue[] {
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
    const { lifecycleState, grievanceStatus } = mapImportStatus(record.status);
    if (!lifecycleState) {
      issues.push({ index: idx, field: 'status', severity: 'error', message: `Cannot map status '${record.status}' to any known FSM state` });
    } else if (grievanceStatus.length > GRIEVANCE_STATUS_MAX_LENGTH) {
      issues.push({ index: idx, field: 'status', severity: 'error', message: `Status '${record.status}' is stored as '${grievanceStatus}', which is longer than the ${GRIEVANCE_STATUS_MAX_LENGTH} characters a grievance status can hold` });
    }
  }

  // Priority and stage: the source's value is kept, and an unknown one must be mapped explicitly; it is never defaulted or dropped.
  const priority = resolveImportPriority(record.priority, mapping);
  if (priority.error) issues.push({ index: idx, field: 'priority', severity: 'error', message: priority.error });
  const step = resolveImportStep(record.step, mapping);
  if (step.error) issues.push({ index: idx, field: 'step', severity: 'error', message: step.error });

  // A declared document digest must be a SHA-256: anything else could never verify the bytes.
  record.documents?.forEach((doc, di) => {
    if (doc.sha256 !== undefined && !SHA256_HEX.test(doc.sha256)) {
      issues.push({ index: idx, field: `documents[${di}].sha256`, severity: 'error', message: 'A declared document digest must be 64 lowercase hexadecimal characters (SHA-256)' });
    }
  });

  // Date validation. The filed date is the case's history: when the source does not give it the record is refused, because the import date is never written in its place.
  if (!record.filed_date?.trim()) {
    issues.push({ index: idx, field: 'filed_date', severity: 'error', message: 'Missing filed_date. The import date is never substituted for a historical date' });
  }
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
      // A historical event without a valid date of its own is refused: dating it at the import would present an import observation as history.
      if (!ev.date?.trim()) {
        issues.push({ index: idx, field: `timeline[${ti}].date`, severity: 'error', message: 'Timeline event missing date. The import date is never substituted for a historical date' });
      } else {
        const parsed = new Date(ev.date);
        if (isNaN(parsed.getTime())) {
          issues.push({ index: idx, field: `timeline[${ti}].date`, severity: 'error', message: `Invalid timeline date: '${ev.date}'` });
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

export function validateIngestionBatch(records: IngestionGrievanceRecord[], mapping?: ImportValueMapping): ValidationResult {
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
    const issues = validateRecord(rec, i, mapping);

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
