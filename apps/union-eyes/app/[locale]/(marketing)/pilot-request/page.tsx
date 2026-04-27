/**
 * Locale-aware Pilot-Request page
 * Accessible at /{locale}/pilot-request
 *
 * Full multi-step readiness form. All copy comes from next-intl
 * (`marketing.pilotRequest.*`) so every supported locale is covered.
 */
'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PilotApplicationInput } from '@/types/marketing';
import {
  calculateReadinessScore,
  ReadinessAssessmentResult,
} from '@/lib/pilot/readiness-assessment';
import { HumanCenteredCallout } from '@/components/marketing/human-centered-callout';
import { logger } from '@/lib/logger';

// Canonical (English) values stored in form data, but rendered via t().
const SECTORS = [
  { value: 'Healthcare', key: 'Healthcare' },
  { value: 'Education', key: 'Education' },
  { value: 'Construction & Trades', key: 'ConstructionTrades' },
  { value: 'Transportation & Logistics', key: 'TransportationLogistics' },
  { value: 'Public Service', key: 'PublicService' },
  { value: 'Manufacturing', key: 'Manufacturing' },
  { value: 'Protective Services', key: 'ProtectiveServices' },
  { value: 'Hospitality & Service', key: 'HospitalityService' },
  { value: 'Other', key: 'Other' },
] as const;

const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK'];

const CHALLENGES = [
  { value: 'No financial audit trail', key: 'noFinancialAudit' },
  { value: 'Manual tracking or spreadsheets', key: 'manualTracking' },
  { value: 'Inconsistent case handling across locals', key: 'inconsistentCases' },
  { value: 'No role-based access control', key: 'noRoleAccess' },
  { value: 'Parent/local allocation opacity', key: 'allocationOpacity' },
  { value: 'Difficult compliance reporting', key: 'complianceReporting' },
  { value: 'Limited member transparency', key: 'memberTransparency' },
  { value: 'Fragmented document management', key: 'fragmentedDocs' },
  { value: 'No centralized governance oversight', key: 'noGovernanceOversight' },
] as const;

const GOALS = [
  { value: 'Auditable financial controls', key: 'auditableFinance' },
  { value: 'Role-based access and entitlements', key: 'roleBasedAccess' },
  { value: 'Structured grievance and case workflows', key: 'structuredCases' },
  { value: 'Parent-to-local fund allocation transparency', key: 'fundAllocation' },
  { value: 'Real-time governance dashboards', key: 'governanceDashboards' },
  { value: 'Member self-service portal', key: 'memberPortal' },
  { value: 'Compliance-ready documentation', key: 'complianceDocs' },
  { value: 'Intelligence-assisted decision support', key: 'intelligenceSupport' },
] as const;

const MODULES = [
  { value: 'Case & Grievance Management', key: 'caseGrievance' },
  { value: 'Member Portal & Engagement', key: 'memberPortal' },
  { value: 'Financial Allocation & Billing', key: 'financialBilling' },
  { value: 'Intelligence & Insights', key: 'intelligenceInsights' },
  { value: 'Governance & Oversight', key: 'governanceOversight' },
] as const;

export default function LocalePilotRequestPage() {
  const params = useParams();
  const locale = (params.locale as string) ?? 'en-CA';
  const t = useTranslations('marketing.pilotRequest');

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<PilotApplicationInput>>({
    organizationType: 'local',
    jurisdictions: [],
    sectors: [],
    challenges: [],
    goals: [],
    responses: { modules: [] as string[] },
  });
  const [assessment, setAssessment] = useState<ReadinessAssessmentResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (field: keyof PilotApplicationInput, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const toggle = (field: 'jurisdictions' | 'sectors' | 'challenges' | 'goals', value: string) =>
    setFormData((prev) => {
      const current = (prev[field] as string[]) ?? [];
      return {
        ...prev,
        [field]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });

  const toggleModule = (value: string) =>
    setFormData((prev) => {
      const current = ((prev.responses as Record<string, unknown>)?.modules as string[]) ?? [];
      return {
        ...prev,
        responses: {
          ...(prev.responses as object),
          modules: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
        },
      };
    });

  const isStep1Valid =
    !!formData.organizationName &&
    !!formData.contactName &&
    !!formData.contactEmail &&
    !!formData.memberCount;

  const isStep2Valid =
    (formData.jurisdictions?.length ?? 0) > 0 && (formData.sectors?.length ?? 0) > 0;

  const isStep3Valid = (formData.goals?.length ?? 0) > 0;

  const isFormValid = isStep1Valid && isStep2Valid && isStep3Valid;

  const handleAssessReadiness = () => {
    if (isFormValid) {
      const result = calculateReadinessScore(formData as PilotApplicationInput);
      setAssessment(result);
      setStep(5);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/pilot/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, assessment }),
      });
      if (response.ok) {
        setStep(6);
      } else {
        alert(t('alerts.submitFailed'));
      }
    } catch (error) {
      logger.error('Submission error:', error);
      alert(t('alerts.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = [
    t('stepLabels.organization'),
    t('stepLabels.context'),
    t('stepLabels.modulesGoals'),
    t('stepLabels.readiness'),
    t('stepLabels.assessment'),
  ];

  // Tag locale so React renders updated strings on locale change.
  void locale;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('heroHeading')}</h1>
          <p className="text-xl text-gray-600">{t('heroDescription')}</p>
        </div>

        <HumanCenteredCallout
          variant="trust"
          message={t('trustCallout')}
          className="mb-8"
        />

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 mx-1 rounded ${s <= step ? 'bg-blue-600' : 'bg-gray-300'}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            {stepLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-8">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">{t('step1.heading')}</h2>

              <Field label={t('step1.orgNameLabel')}>
                <input
                  type="text"
                  value={formData.organizationName ?? ''}
                  onChange={(e) => set('organizationName', e.target.value)}
                  className={inputCls}
                  placeholder={t('step1.orgNamePlaceholder')}
                />
              </Field>

              <Field label={t('step1.orgTypeLabel')}>
                {(['local', 'regional', 'national'] as const).map((type) => (
                  <label key={type} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="orgType"
                      value={type}
                      checked={formData.organizationType === type}
                      onChange={() => set('organizationType', type)}
                    />
                    {t(`step1.orgType${type.charAt(0).toUpperCase()}${type.slice(1)}` as 'step1.orgTypeLocal')}
                  </label>
                ))}
              </Field>

              <Field label={t('step1.contactNameLabel')}>
                <input
                  type="text"
                  value={formData.contactName ?? ''}
                  onChange={(e) => set('contactName', e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label={t('step1.contactEmailLabel')}>
                <input
                  type="email"
                  value={formData.contactEmail ?? ''}
                  onChange={(e) => set('contactEmail', e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label={t('step1.contactPhoneLabel')}>
                <input
                  type="tel"
                  value={formData.contactPhone ?? ''}
                  onChange={(e) => set('contactPhone', e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label={t('step1.memberCountLabel')} hint={t('step1.memberCountHint')}>
                <input
                  type="number"
                  value={formData.memberCount ?? ''}
                  onChange={(e) => set('memberCount', parseInt(e.target.value))}
                  className={inputCls}
                  placeholder="e.g., 1200"
                />
              </Field>

              <Btn onClick={() => setStep(2)} disabled={!isStep1Valid}>
                {t('buttons.continue')}
              </Btn>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">{t('step2.heading')}</h2>

              <Field label={t('step2.jurisdictionsLabel')}>
                <div className="grid grid-cols-2 gap-2">
                  {PROVINCES.map((prov) => (
                    <label key={prov} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.jurisdictions?.includes(prov)}
                        onChange={() => toggle('jurisdictions', prov)}
                      />
                      <span>{prov}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field label={t('step2.sectorsLabel')}>
                {SECTORS.map((sector) => (
                  <label key={sector.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.sectors?.includes(sector.value)}
                      onChange={() => toggle('sectors', sector.value)}
                    />
                    <span>{t(`sectors.${sector.key}` as 'sectors.Healthcare')}</span>
                  </label>
                ))}
              </Field>

              <Field label={t('step2.currentSystemLabel')}>
                <input
                  type="text"
                  value={formData.currentSystem ?? ''}
                  onChange={(e) => set('currentSystem', e.target.value)}
                  className={inputCls}
                  placeholder={t('step2.currentSystemPlaceholder')}
                />
              </Field>

              <Field label={t('step2.challengesLabel')}>
                {CHALLENGES.map((challenge) => (
                  <label key={challenge.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.challenges?.includes(challenge.value)}
                      onChange={() => toggle('challenges', challenge.value)}
                    />
                    <span>{t(`challenges.${challenge.key}` as 'challenges.noFinancialAudit')}</span>
                  </label>
                ))}
              </Field>

              <div className="flex gap-4">
                <Btn variant="secondary" onClick={() => setStep(1)}>{t('buttons.back')}</Btn>
                <Btn onClick={() => setStep(3)} disabled={!isStep2Valid}>{t('buttons.continue')}</Btn>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">{t('step3.heading')}</h2>

              <Field label={t('step3.modulesLabel')}>
                {MODULES.map((mod) => (
                  <label key={mod.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(((formData.responses as Record<string, unknown>)?.modules as string[]) ?? []).includes(mod.value)}
                      onChange={() => toggleModule(mod.value)}
                    />
                    <span>{t(`modules.${mod.key}` as 'modules.caseGrievance')}</span>
                  </label>
                ))}
              </Field>

              <Field label={t('step3.goalsLabel')}>
                {GOALS.map((goal) => (
                  <label key={goal.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.goals?.includes(goal.value)}
                      onChange={() => toggle('goals', goal.value)}
                    />
                    <span>{t(`goals.${goal.key}` as 'goals.auditableFinance')}</span>
                  </label>
                ))}
              </Field>

              <Field label={t('step3.additionalNotesLabel')}>
                <textarea
                  value={(formData.responses as Record<string, string>)?.additionalNotes ?? ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      responses: { ...(prev.responses as object), additionalNotes: e.target.value },
                    }))
                  }
                  rows={4}
                  className={inputCls}
                  placeholder={t('step3.additionalNotesPlaceholder')}
                />
              </Field>

              <div className="flex gap-4">
                <Btn variant="secondary" onClick={() => setStep(2)}>{t('buttons.back')}</Btn>
                <Btn onClick={() => setStep(4)} disabled={!isStep3Valid}>{t('buttons.continue')}</Btn>
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">{t('step4.heading')}</h2>

              <Field label={t('step4.leadershipSupportLabel')}>
                {(['yes', 'no', 'unsure'] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="leaderSupport"
                      value={v}
                      checked={(formData.responses as Record<string, string>)?.leadershipSupport === v}
                      onChange={() =>
                        setFormData((prev) => ({
                          ...prev,
                          responses: { ...(prev.responses as object), leadershipSupport: v },
                        }))
                      }
                    />
                    {t(`step4.leadership${v.charAt(0).toUpperCase()}${v.slice(1)}` as 'step4.leadershipYes')}
                  </label>
                ))}
              </Field>

              <Field label={t('step4.timelineLabel')}>
                <select
                  value={(formData.responses as Record<string, string>)?.timeline ?? ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      responses: { ...(prev.responses as object), timeline: e.target.value },
                    }))
                  }
                  className={inputCls}
                >
                  <option value="">{t('step4.timelineSelect')}</option>
                  <option value="immediate">{t('step4.timelineImmediate')}</option>
                  <option value="3months">{t('step4.timeline3months')}</option>
                  <option value="6months">{t('step4.timeline6months')}</option>
                  <option value="exploring">{t('step4.timelineExploring')}</option>
                </select>
              </Field>

              <div className="flex gap-4">
                <Btn variant="secondary" onClick={() => setStep(3)}>{t('buttons.back')}</Btn>
                <Btn onClick={handleAssessReadiness} disabled={!isFormValid}>
                  {t('buttons.assessReadiness')}
                </Btn>
              </div>
            </div>
          )}

          {/* Step 5: Assessment */}
          {step === 5 && assessment && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">{t('step5.heading')}</h2>

              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <p className="text-5xl font-bold text-blue-700">{assessment.score}/100</p>
                <p className="text-lg font-medium text-blue-900 mt-2">{assessment.level}</p>
                <p className="text-sm text-blue-700 mt-1">
                  {t('step5.estimatedTimeline')} {assessment.estimatedSetupTime}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">{t('step5.strengths')}</h3>
                <ul className="space-y-1">
                  {assessment.strengths.map((s: string) => (
                    <li key={s} className="text-sm text-green-700 flex items-center gap-2">
                      <span>✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>

              {assessment.concerns?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">{t('step5.areasToAddress')}</h3>
                  <ul className="space-y-1">
                    {assessment.concerns.map((c: string) => (
                      <li key={c} className="text-sm text-amber-700 flex items-center gap-2">
                        <span>→</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {assessment.recommendations?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">{t('step5.recommendations')}</h3>
                  <ul className="space-y-1">
                    {assessment.recommendations.map((r: string) => (
                      <li key={r} className="text-sm text-blue-700 flex items-center gap-2">
                        <span>•</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-4">
                <Btn variant="secondary" onClick={() => setStep(4)}>{t('buttons.back')}</Btn>
                <Btn onClick={handleSubmit} disabled={submitting}>
                  {submitting ? t('buttons.submitting') : t('buttons.submit')}
                </Btn>
              </div>
            </div>
          )}

          {/* Step 6: Submitted */}
          {step === 6 && (
            <div className="text-center space-y-4 py-8">
              <div className="text-5xl">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900">{t('step6.heading')}</h2>
              <p className="text-gray-600 max-w-md mx-auto">{t('step6.body')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const cls =
    variant === 'secondary'
      ? 'flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-md font-medium hover:bg-gray-300 transition-colors'
      : 'flex-1 bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors';
  return (
    <button onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}
