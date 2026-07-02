/**
 * CourtLens public intake service — Phase 2A.
 *
 * Handles the first public-facing write path:
 *   validated intake payload → tenant resolver → createMatter → safe response
 *
 * Hard constraints enforced here:
 * - Consent must be explicitly acknowledged.
 * - Practice area and sub-issue must be valid A2J values (not 'unknown').
 * - Risk flag keys must be known; unknown keys are rejected.
 * - tenantSlug is validated for format and resolved to orgId server-side.
 * - Public response never includes internal notes, evidence, reviewer data,
 *   org internals, raw event payloads, or legal advice.
 * - Legal boundary notice is mandatory on every confirmation response.
 *
 * Tenant resolver: Phase 2B uses tenantSlug (resolved to orgId server-side).
 * See modules/tenants/tenant-resolver.ts for the resolver strategy.
 */

import {
  type CourtLensPracticeArea,
  type CourtLensSubIssue,
  type CourtLensRiskFlags,
  COURTLENS_PRACTICE_AREAS,
  COURTLENS_SUB_ISSUES,
  getMatterStatusLabel,
  defaultRiskFlags,
} from './courtlens';
import {
  createMatter,
  recordCourtLensFieldUpdate,
  CourtLensValidationError,
  assertValidRiskKeys,
} from './matter-service';
import {
  resolveTenantSlug,
  isValidTenantSlug,
  TenantNotFoundError,
} from '@/modules/tenants/tenant-resolver';

// ── Date validation ───────────────────────────────────────────────────────────

function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

// ── Input/output types ────────────────────────────────────────────────────────

export interface PublicIntakeInput {
  /**
   * Public tenant slug. Resolved to orgId server-side via tenant resolver.
   * Phase 2B: tenantSlug === orgId. See modules/tenants/tenant-resolver.ts.
   */
  tenantSlug: string;
  practiceArea: string;
  subIssue: string;
  /** Client problem summary. Minimum 10 characters. */
  summary: string;
  clientGoal?: string;
  /** Must be explicitly true. Intake is rejected if false or missing. */
  consentAcknowledged: boolean;
  riskFlags?: Partial<Record<string, boolean>>;
  hearingDate?: string;
  deadlineDate?: string;
  contactName?: string;
  contactEmail?: string;
  householdSize?: number;
  hasChildren?: boolean;
  hasDisability?: boolean;
}

export interface IntakeValidationError {
  error: string;
  field?: string;
  code: string;
}

/**
 * Safe public confirmation response.
 * Never exposes internal IDs of reviews, org members, event payloads,
 * evidence, notes, or any AI-generated output.
 */
export interface PublicIntakeConfirmation {
  matterId: string;
  practiceArea: CourtLensPracticeArea;
  statusLabel: string;
  submittedAt: string;
  /** Mandatory legal boundary notice on every public response. */
  legalBoundaryNotice: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validatePublicIntakeInput(
  raw: unknown,
): { ok: true; input: PublicIntakeInput } | { ok: false; errors: IntakeValidationError[] } {
  const errs: IntakeValidationError[] = [];

  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: [{ error: 'Request body must be a JSON object', code: 'INVALID_BODY' }] };
  }

  const body = raw as Record<string, unknown>;

  // tenantSlug — format-validated here; existence verified in createMatterFromPublicIntake
  const tenantSlug = typeof body.tenantSlug === 'string' ? body.tenantSlug.trim() : '';
  if (!tenantSlug) {
    errs.push({ error: 'tenantSlug is required', field: 'tenantSlug', code: 'MISSING_TENANT_SLUG' });
  } else if (!isValidTenantSlug(tenantSlug)) {
    errs.push({ error: 'tenantSlug must be a valid slug (3–64 alphanumeric/hyphen/underscore characters, starting with alphanumeric)', field: 'tenantSlug', code: 'INVALID_TENANT_SLUG' });
  }

  // practiceArea — must be a known A2J value; 'unknown' is not valid here
  const practiceArea = typeof body.practiceArea === 'string' ? body.practiceArea.trim() : '';
  if (!practiceArea) {
    errs.push({ error: 'practiceArea is required', field: 'practiceArea', code: 'MISSING_PRACTICE_AREA' });
  } else if (!(COURTLENS_PRACTICE_AREAS as readonly string[]).includes(practiceArea)) {
    errs.push({
      error: `practiceArea must be one of: ${COURTLENS_PRACTICE_AREAS.join(', ')}`,
      field: 'practiceArea',
      code: 'INVALID_PRACTICE_AREA',
    });
  }

  // subIssue
  const subIssue = typeof body.subIssue === 'string' ? body.subIssue.trim() : '';
  if (!subIssue) {
    errs.push({ error: 'subIssue is required', field: 'subIssue', code: 'MISSING_SUB_ISSUE' });
  } else if (!(COURTLENS_SUB_ISSUES as readonly string[]).includes(subIssue)) {
    errs.push({ error: 'subIssue must be a known A2J sub-issue', field: 'subIssue', code: 'INVALID_SUB_ISSUE' });
  }

  // summary
  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  if (!summary || summary.length < 10) {
    errs.push({ error: 'summary is required and must be at least 10 characters', field: 'summary', code: 'INVALID_SUMMARY' });
  }

  // consent — hard gate
  if (body.consentAcknowledged !== true) {
    errs.push({ error: 'consentAcknowledged must be true to submit an intake', field: 'consentAcknowledged', code: 'CONSENT_REQUIRED' });
  }

  // riskFlags — optional but all keys must be known
  if (body.riskFlags != null) {
    if (typeof body.riskFlags !== 'object' || Array.isArray(body.riskFlags)) {
      errs.push({ error: 'riskFlags must be an object', field: 'riskFlags', code: 'INVALID_RISK_FLAGS' });
    } else {
      try {
        assertValidRiskKeys(body.riskFlags as Partial<CourtLensRiskFlags>);
      } catch (e: unknown) {
        if (e instanceof CourtLensValidationError) {
          errs.push({ error: e.message, field: 'riskFlags', code: 'INVALID_RISK_FLAG_KEY' });
        }
      }
    }
  }

  // dates — optional ISO YYYY-MM-DD
  if (body.hearingDate != null) {
    if (typeof body.hearingDate !== 'string' || !isValidIsoDate(body.hearingDate)) {
      errs.push({ error: 'hearingDate must be a valid date (YYYY-MM-DD)', field: 'hearingDate', code: 'INVALID_HEARING_DATE' });
    }
  }
  if (body.deadlineDate != null) {
    if (typeof body.deadlineDate !== 'string' || !isValidIsoDate(body.deadlineDate)) {
      errs.push({ error: 'deadlineDate must be a valid date (YYYY-MM-DD)', field: 'deadlineDate', code: 'INVALID_DEADLINE_DATE' });
    }
  }

  if (errs.length > 0) return { ok: false, errors: errs };

  return {
    ok: true,
    input: {
      tenantSlug,
      practiceArea,
      subIssue,
      summary,
      clientGoal: typeof body.clientGoal === 'string' ? body.clientGoal.trim() || undefined : undefined,
      consentAcknowledged: true,
      riskFlags: body.riskFlags != null
        ? (body.riskFlags as Partial<CourtLensRiskFlags>)
        : undefined,
      hearingDate: typeof body.hearingDate === 'string' ? body.hearingDate : undefined,
      deadlineDate: typeof body.deadlineDate === 'string' ? body.deadlineDate : undefined,
      contactName: typeof body.contactName === 'string' ? body.contactName.trim() || undefined : undefined,
      contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail.trim().toLowerCase() || undefined : undefined,
      householdSize: typeof body.householdSize === 'number' && body.householdSize > 0 ? body.householdSize : undefined,
      hasChildren: typeof body.hasChildren === 'boolean' ? body.hasChildren : undefined,
      hasDisability: typeof body.hasDisability === 'boolean' ? body.hasDisability : undefined,
    },
  };
}

// ── Legal boundary notice ─────────────────────────────────────────────────────
// Mandatory on every public intake confirmation response.
// Must not contain legal advice, legal conclusions, or outcome predictions.

const LEGAL_BOUNDARY_NOTICE =
  'Your intake has been received and will be reviewed by a qualified person. ' +
  'This service does not provide legal advice. All information will be handled ' +
  'confidentially and reviewed by a supervised human reviewer before any action ' +
  'is taken on your behalf.';

// ── Severity derivation from risk signals ────────────────────────────────────
// Derives initial urgency from risk flags. ABR `severity` maps to CourtLens
// urgency label. Reviewers can override after intake.

function deriveInitialSeverity(
  riskFlags?: Partial<CourtLensRiskFlags>,
  hasDeadline?: boolean,
): 'low' | 'medium' | 'high' | 'critical' {
  if (!riskFlags) return hasDeadline ? 'medium' : 'low';
  const flags = riskFlags as Record<string, unknown>;
  const critical = ['risk_lockout', 'risk_eviction', 'risk_safety', 'risk_homelessness'];
  const high = ['risk_utility_shutoff', 'risk_income_loss', 'risk_garnishment', 'risk_bank_freeze'];
  if (critical.some((k) => flags[k] === true)) return 'critical';
  if (high.some((k) => flags[k] === true)) return 'high';
  return hasDeadline ? 'medium' : 'low';
}

function deriveMatterTitle(practiceArea: string, subIssue: string): string {
  const area = practiceArea.charAt(0).toUpperCase() + practiceArea.slice(1);
  const issue = subIssue.replaceAll('_', ' ');
  return `${area} intake — ${issue}`;
}

// ── Service function ──────────────────────────────────────────────────────────

/**
 * Create a CourtLens matter from a validated public intake payload.
 * Returns a safe, redacted public confirmation. No internal data is exposed.
 */
export async function createMatterFromPublicIntake(
  input: PublicIntakeInput,
): Promise<PublicIntakeConfirmation> {
  // Resolve tenant slug → orgId server-side.
  // Throws TenantNotFoundError for unknown/inactive tenants.
  const tenant = await resolveTenantSlug(input.tenantSlug);
  const orgId = tenant.orgId;
  const hasDeadline = Boolean(input.hearingDate || input.deadlineDate);
  const severity = deriveInitialSeverity(input.riskFlags, hasDeadline);

  const matter = await createMatter(orgId, 'public-intake', {
    title: deriveMatterTitle(input.practiceArea, input.subIssue),
    category: 'service_delivery',
    severity,
    intakeChannel: 'web',
    summary: input.summary,
    practiceArea: input.practiceArea as CourtLensPracticeArea,
    subIssue: input.subIssue as CourtLensSubIssue,
    clientGoal: input.clientGoal,
    hearingDate: input.hearingDate,
    deadlineDate: input.deadlineDate,
  });

  // Write client profile and risk flags as an additional CourtLens field event.
  // This supplements the initial courtlens_fields_set written by createMatter.
  const clientProfile = {
    clientName: input.contactName ?? null,
    clientContact: input.contactEmail ?? null,
    householdSize: input.householdSize ?? null,
    hasChildren: input.hasChildren ?? false,
    hasDisability: input.hasDisability ?? false,
    consentStatus: 'granted' as const,
  };

  const riskFlags = input.riskFlags
    ? { ...defaultRiskFlags(), ...input.riskFlags }
    : undefined;

  await recordCourtLensFieldUpdate(matter.id, 'public-intake', {
    clientProfile,
    ...(riskFlags ? { riskFlags } : {}),
  });

  // Return only the safe public confirmation — no internal matter data.
  return {
    matterId: matter.id,
    practiceArea: input.practiceArea as CourtLensPracticeArea,
    statusLabel: getMatterStatusLabel(matter.status),
    submittedAt: matter.createdAt,
    legalBoundaryNotice: LEGAL_BOUNDARY_NOTICE,
  };
}
