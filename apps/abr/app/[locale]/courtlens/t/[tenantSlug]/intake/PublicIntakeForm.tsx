'use client';

import { useMemo, useState, useTransition } from 'react';
import { createIdempotencyKey } from '@/lib/idempotency';

/**
 * PublicIntakeForm — Phase 2F.
 *
 * Public, unauthenticated intake form.
 * Collects legal need; it does not answer the legal problem.
 *
 * Hard rules enforced in this component:
 * - No AI output.
 * - No review packet exposure.
 * - No "legal advice" framing.
 * - Explicit consent required before submit.
 * - Idempotency-Key on every submit (proxy.ts contract).
 * - No x-abr-role or x-org-id headers.
 * - Success state shows only the safe public confirmation from the server.
 */

const PRACTICE_AREAS = [
  { value: 'housing', label: 'Housing (landlord–tenant, eviction, repairs)' },
  { value: 'employment', label: 'Employment (unpaid wages, termination, safety)' },
  { value: 'debt', label: 'Consumer debt / collections' },
] as const;

const HOUSING_SUB_ISSUES = [
  { value: 'eviction', label: 'Eviction' },
  { value: 'rent_arrears', label: 'Rent arrears' },
  { value: 'illegal_rent_increase', label: 'Illegal rent increase' },
  { value: 'repairs_maintenance', label: 'Repairs / maintenance' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'lockout', label: 'Lockout' },
  { value: 'discrimination', label: 'Discrimination' },
  { value: 'safety', label: 'Safety concern' },
  { value: 'utility_shutoff', label: 'Utility shutoff' },
  { value: 'deposit', label: 'Deposit issue' },
  { value: 'notice_validity', label: 'Notice validity' },
  { value: 'other_housing', label: 'Other housing issue' },
] as const;

const EMPLOYMENT_SUB_ISSUES = [
  { value: 'unpaid_wages', label: 'Unpaid wages' },
  { value: 'termination', label: 'Termination / dismissal' },
  { value: 'workplace_harassment', label: 'Workplace harassment / discrimination' },
  { value: 'unsafe_work', label: 'Unsafe work' },
  { value: 'missing_records', label: 'Missing employment records' },
  { value: 'employment_status', label: 'Unclear employment status' },
  { value: 'scheduling_dispute', label: 'Scheduling / hours dispute' },
  { value: 'other_employment', label: 'Other employment issue' },
] as const;

const DEBT_SUB_ISSUES = [
  { value: 'collection_letter', label: 'Collection letter received' },
  { value: 'debt_buyer_claim', label: 'Debt buyer claim' },
  { value: 'wage_garnishment', label: 'Wage garnishment' },
  { value: 'payday_loan', label: 'Payday loan issue' },
  { value: 'credit_card_debt', label: 'Credit card / loan debt' },
  { value: 'utility_telecom_debt', label: 'Utility / telecom debt' },
  { value: 'court_debt_paperwork', label: 'Court / tribunal debt paperwork' },
  { value: 'identity_theft_debt', label: 'Identity theft / mistaken debt' },
  { value: 'collector_harassment', label: 'Collector harassment' },
  { value: 'unclear_debt_records', label: 'Unclear debt records' },
  { value: 'other_debt', label: 'Other debt concern' },
] as const;

const RISK_FLAGS_BY_AREA: Record<string, Array<{ key: string; label: string }>> = {
  housing: [
    { key: 'risk_lockout', label: 'At risk of being locked out' },
    { key: 'risk_eviction', label: 'At risk of eviction' },
    { key: 'risk_utility_shutoff', label: 'At risk of utility shutoff' },
    { key: 'risk_homelessness', label: 'At risk of homelessness' },
    { key: 'risk_safety', label: 'Safety concern at home' },
  ],
  employment: [
    { key: 'risk_income_loss', label: 'At risk of losing income' },
    { key: 'risk_unsafe_work', label: 'Unsafe workplace condition' },
    { key: 'risk_retaliation', label: 'At risk of employer retaliation' },
    { key: 'risk_harassment', label: 'Workplace harassment' },
  ],
  debt: [
    { key: 'risk_garnishment', label: 'Wage garnishment in progress or threatened' },
    { key: 'risk_bank_freeze', label: 'Bank account freeze threatened' },
    { key: 'risk_identity_theft', label: 'Identity theft concern' },
    { key: 'risk_essential_services', label: 'Essential services at risk' },
    { key: 'risk_harassment', label: 'Collector harassment' },
  ],
};

type PracticeArea = (typeof PRACTICE_AREAS)[number]['value'];

interface Confirmation {
  matterId: string;
  practiceArea: string;
  statusLabel: string;
  submittedAt: string;
  legalBoundaryNotice: string;
}

export function PublicIntakeForm({ tenantSlug }: { tenantSlug: string }) {
  const [practiceArea, setPracticeArea] = useState<PracticeArea | ''>('');
  const [subIssue, setSubIssue] = useState('');
  const [summary, setSummary] = useState('');
  const [consent, setConsent] = useState(false);
  const [hearingDate, setHearingDate] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [householdSize, setHouseholdSize] = useState('');
  const [hasChildren, setHasChildren] = useState(false);
  const [hasDisability, setHasDisability] = useState(false);
  const [selectedRiskFlags, setSelectedRiskFlags] = useState<Record<string, boolean>>({});

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const subIssues = useMemo(() => {
    if (practiceArea === 'housing') return HOUSING_SUB_ISSUES;
    if (practiceArea === 'employment') return EMPLOYMENT_SUB_ISSUES;
    if (practiceArea === 'debt') return DEBT_SUB_ISSUES;
    return [];
  }, [practiceArea]);

  const riskFlagOptions = practiceArea ? RISK_FLAGS_BY_AREA[practiceArea] ?? [] : [];

  const canSubmit =
    practiceArea !== '' &&
    subIssue !== '' &&
    summary.trim().length >= 10 &&
    consent === true &&
    !pending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    const riskFlags: Record<string, boolean> = {};
    for (const opt of riskFlagOptions) {
      if (selectedRiskFlags[opt.key]) riskFlags[opt.key] = true;
    }

    const body: Record<string, unknown> = {
      tenantSlug,
      practiceArea,
      subIssue,
      summary: summary.trim(),
      consentAcknowledged: true,
    };
    if (Object.keys(riskFlags).length > 0) body.riskFlags = riskFlags;
    if (hearingDate) body.hearingDate = hearingDate;
    if (deadlineDate) body.deadlineDate = deadlineDate;
    if (contactName.trim()) body.contactName = contactName.trim();
    if (contactEmail.trim()) body.contactEmail = contactEmail.trim();
    if (householdSize) {
      const n = Number(householdSize);
      if (Number.isFinite(n) && n > 0) body.householdSize = n;
    }
    if (hasChildren) body.hasChildren = true;
    if (hasDisability) body.hasDisability = true;

    startTransition(async () => {
      const res = await fetch('/api/courtlens/public-intake', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': createIdempotencyKey(),
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
        if (res.status === 429) {
          setError('Too many submissions. Please wait a moment and try again.');
        } else if (res.status === 400) {
          setError(
            typeof data.error === 'string'
              ? data.error
              : 'Some information was missing or invalid. Please review the form and resubmit.',
          );
        } else if (res.status === 403 || res.status === 404) {
          setError('This intake is not available for the requested organisation.');
        } else {
          setError('Your intake could not be submitted. Please try again later.');
        }
        return;
      }

      setConfirmation({
        matterId: String(data.matterId ?? ''),
        practiceArea: String(data.practiceArea ?? ''),
        statusLabel: String(data.statusLabel ?? ''),
        submittedAt: String(data.submittedAt ?? ''),
        legalBoundaryNotice: String(data.legalBoundaryNotice ?? ''),
      });
    });
  }

  if (confirmation) {
    return (
      <section
        className="mx-auto max-w-2xl space-y-4 p-6 text-sm text-slate-800"
        data-testid="public-intake-confirmation"
      >
        <h2 className="text-2xl font-semibold text-navy">Intake received</h2>
        <p>
          Reference: <span className="font-mono text-xs">{confirmation.matterId}</span>
        </p>
        <p>
          Status: <span data-testid="confirmation-status">{confirmation.statusLabel}</span>
        </p>
        <p>
          Submitted: {confirmation.submittedAt}
        </p>
        <div
          className="rounded border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700"
          data-testid="confirmation-legal-notice"
        >
          {confirmation.legalBoundaryNotice}
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-2xl space-y-6 p-6 text-sm text-slate-800"
      data-testid="public-intake-form"
      noValidate
    >
      <div className="rounded border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
        <p className="font-medium text-navy">Before you start</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>This form collects information for supervised human review. It is not legal advice.</li>
          <li>A qualified reviewer will look at your intake before any action is taken on your behalf.</li>
          <li>Please share only what you are comfortable sharing. Do not include unnecessary sensitive information.</li>
          <li>You will not receive an AI-generated legal opinion from this form.</li>
        </ul>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-600" htmlFor="practiceArea">
          What kind of problem?
        </label>
        <select
          id="practiceArea"
          data-testid="field-practice-area"
          value={practiceArea}
          onChange={(e) => {
            setPracticeArea(e.target.value as PracticeArea);
            setSubIssue('');
            setSelectedRiskFlags({});
          }}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          required
        >
          <option value="">Select a problem area…</option>
          {PRACTICE_AREAS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {practiceArea && (
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-600" htmlFor="subIssue">
            More specifically?
          </label>
          <select
            id="subIssue"
            data-testid="field-sub-issue"
            value={subIssue}
            onChange={(e) => setSubIssue(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            required
          >
            <option value="">Select a sub-issue…</option>
            {subIssues.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-600" htmlFor="summary">
          Describe your situation
        </label>
        <textarea
          id="summary"
          data-testid="field-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={5}
          minLength={10}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          placeholder="A few sentences about what is happening, in your own words. Do not include sensitive information you would rather keep private."
          required
        />
      </div>

      {riskFlagOptions.length > 0 && (
        <fieldset data-testid="field-risk-flags">
          <legend className="text-xs font-medium uppercase tracking-wide text-slate-600">
            Any of these apply? (optional)
          </legend>
          <div className="mt-1 space-y-1">
            {riskFlagOptions.map((r) => (
              <label key={r.key} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  data-testid={`risk-${r.key}`}
                  checked={selectedRiskFlags[r.key] ?? false}
                  onChange={(e) =>
                    setSelectedRiskFlags((prev) => ({ ...prev, [r.key]: e.target.checked }))
                  }
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-600" htmlFor="hearingDate">
            Hearing date (optional)
          </label>
          <input
            id="hearingDate"
            data-testid="field-hearing-date"
            type="date"
            value={hearingDate}
            onChange={(e) => setHearingDate(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-600" htmlFor="deadlineDate">
            Deadline date (optional)
          </label>
          <input
            id="deadlineDate"
            data-testid="field-deadline-date"
            type="date"
            value={deadlineDate}
            onChange={(e) => setDeadlineDate(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
      </div>

      <details className="rounded border border-slate-200 p-3">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-slate-600">
          Optional: your contact and household info
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="contactName">
              Your name (optional)
            </label>
            <input
              id="contactName"
              data-testid="field-contact-name"
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="contactEmail">
              Contact email (optional)
            </label>
            <input
              id="contactEmail"
              data-testid="field-contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="householdSize">
              Household size (optional)
            </label>
            <input
              id="householdSize"
              data-testid="field-household-size"
              type="number"
              min={1}
              value={householdSize}
              onChange={(e) => setHouseholdSize(e.target.value)}
              className="mt-1 w-32 rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              data-testid="field-has-children"
              checked={hasChildren}
              onChange={(e) => setHasChildren(e.target.checked)}
            />
            <span>Children in the household</span>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              data-testid="field-has-disability"
              checked={hasDisability}
              onChange={(e) => setHasDisability(e.target.checked)}
            />
            <span>Someone in the household has a disability</span>
          </label>
        </div>
      </details>

      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          data-testid="field-consent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
        />
        <span>
          I understand this is not legal advice and my intake will be reviewed by a qualified person.
          I consent to this information being sent to the organisation named on this page for supervised review.
        </span>
      </label>

      {error && (
        <p className="text-xs text-red-600" data-testid="public-intake-error">
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          data-testid="public-intake-submit"
        >
          {pending ? 'Submitting…' : 'Submit intake'}
        </button>
      </div>
    </form>
  );
}
