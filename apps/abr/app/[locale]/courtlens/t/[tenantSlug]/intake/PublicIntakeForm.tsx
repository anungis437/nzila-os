'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createIdempotencyKey } from '@/lib/idempotency';

/**
 * PublicIntakeForm — Phase 2F + Phase 2H (i18n).
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
 * - Copy is fully localized via next-intl (courtlens.publicIntake + courtlens.errors).
 */

const HOUSING_SUB_ISSUES = [
  'eviction', 'rent_arrears', 'illegal_rent_increase', 'repairs_maintenance',
  'harassment', 'lockout', 'discrimination', 'safety', 'utility_shutoff',
  'deposit', 'notice_validity', 'other_housing',
] as const;

const EMPLOYMENT_SUB_ISSUES = [
  'unpaid_wages', 'termination', 'workplace_harassment', 'unsafe_work',
  'missing_records', 'employment_status', 'scheduling_dispute', 'other_employment',
] as const;

const DEBT_SUB_ISSUES = [
  'collection_letter', 'debt_buyer_claim', 'wage_garnishment', 'payday_loan',
  'credit_card_debt', 'utility_telecom_debt', 'court_debt_paperwork',
  'identity_theft_debt', 'collector_harassment', 'unclear_debt_records', 'other_debt',
] as const;

const RISK_FLAG_KEYS_BY_AREA: Record<string, readonly string[]> = {
  housing: ['risk_lockout', 'risk_eviction', 'risk_utility_shutoff', 'risk_homelessness', 'risk_safety'],
  employment: ['risk_income_loss', 'risk_unsafe_work', 'risk_retaliation', 'risk_harassment'],
  debt: ['risk_garnishment', 'risk_bank_freeze', 'risk_identity_theft', 'risk_essential_services', 'risk_harassment'],
};

type PracticeArea = 'housing' | 'employment' | 'debt';

interface Confirmation {
  matterId: string;
  practiceArea: string;
  statusLabel: string;
  submittedAt: string;
  legalBoundaryNotice: string;
}

export function PublicIntakeForm({ tenantSlug }: { tenantSlug: string }) {
  const t = useTranslations('courtlens.publicIntake');
  const tErr = useTranslations('courtlens.errors');

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

  const riskFlagOptions = practiceArea ? RISK_FLAG_KEYS_BY_AREA[practiceArea] ?? [] : [];

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
    for (const key of riskFlagOptions) {
      if (selectedRiskFlags[key]) riskFlags[key] = true;
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
          setError(tErr('publicIntakeRateLimit'));
        } else if (res.status === 400) {
          setError(
            typeof data.error === 'string'
              ? data.error
              : tErr('publicIntakeInvalid'),
          );
        } else if (res.status === 403 || res.status === 404) {
          setError(tErr('publicIntakeUnavailable'));
        } else {
          setError(tErr('publicIntakeGeneric'));
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
        <h2 className="text-2xl font-semibold text-navy">{t('confirmationTitle')}</h2>
        <p>
          {t('confirmationReference')}: <span className="font-mono text-xs">{confirmation.matterId}</span>
        </p>
        <p>
          {t('confirmationStatus')}: <span data-testid="confirmation-status">{confirmation.statusLabel}</span>
        </p>
        <p>
          {t('confirmationSubmitted')}: {confirmation.submittedAt}
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
        <p className="font-medium text-navy">{t('beforeYouStart')}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>{t('framingHumanReview')}</li>
          <li>{t('framingReviewer')}</li>
          <li>{t('framingSensitive')}</li>
          <li>{t('framingNoAi')}</li>
        </ul>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-600" htmlFor="practiceArea">
          {t('practiceAreaLabel')}
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
          <option value="">{t('practiceAreaPlaceholder')}</option>
          <option value="housing">{t('practiceAreaHousing')}</option>
          <option value="employment">{t('practiceAreaEmployment')}</option>
          <option value="debt">{t('practiceAreaDebt')}</option>
        </select>
      </div>

      {practiceArea && (
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-600" htmlFor="subIssue">
            {t('subIssueLabel')}
          </label>
          <select
            id="subIssue"
            data-testid="field-sub-issue"
            value={subIssue}
            onChange={(e) => setSubIssue(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            required
          >
            <option value="">{t('subIssuePlaceholder')}</option>
            {subIssues.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-600" htmlFor="summary">
          {t('summaryLabel')}
        </label>
        <textarea
          id="summary"
          data-testid="field-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={5}
          minLength={10}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          placeholder={t('summaryPlaceholder')}
          required
        />
      </div>

      {riskFlagOptions.length > 0 && (
        <fieldset data-testid="field-risk-flags">
          <legend className="text-xs font-medium uppercase tracking-wide text-slate-600">
            {t('riskFlagsLabel')}
          </legend>
          <div className="mt-1 space-y-1">
            {riskFlagOptions.map((key) => (
              <label key={key} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  data-testid={`risk-${key}`}
                  checked={selectedRiskFlags[key] ?? false}
                  onChange={(e) =>
                    setSelectedRiskFlags((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                />
                <span>{key.replace(/^risk_/, '').replaceAll('_', ' ')}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-600" htmlFor="hearingDate">
            {t('hearingDateLabel')}
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
            {t('deadlineDateLabel')}
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
          {t('contactSectionTitle')}
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="contactName">
              {t('contactNameLabel')}
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
              {t('contactEmailLabel')}
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
              {t('householdSizeLabel')}
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
            <span>{t('hasChildrenLabel')}</span>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              data-testid="field-has-disability"
              checked={hasDisability}
              onChange={(e) => setHasDisability(e.target.checked)}
            />
            <span>{t('hasDisabilityLabel')}</span>
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
          {t('consentLabel')}
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
          {pending ? t('submitting') : t('submit')}
        </button>
      </div>
    </form>
  );
}
