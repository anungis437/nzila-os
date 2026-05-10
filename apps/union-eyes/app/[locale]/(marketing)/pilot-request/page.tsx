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
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PilotApplicationInput } from '@/types/marketing';
import {
  calculateReadinessScore,
  ReadinessAssessmentResult,
} from '@/lib/pilot/readiness-assessment';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { InstitutionalContinuityNote } from '@/components/marketing/institutional-continuity-note';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { getInstitutionalModeProfile, parseInstitutionalMode, withInstitutionalContext } from '@/lib/institutional-context';
import { logger } from '@/lib/logger';
import {
  executiveDecisionPathwaySystems,
  buildContinuityReadinessProfile,
  federationScaleContinuityScenarios,
  governanceFrictionSimulationFlows,
  leadershipTransitionContinuityScenarios,
  onboardingContinuityIntelligenceScenarios,
  institutionalRolloutPathway,
  executiveBriefingFlows,
  pilotSimulationArtifacts,
} from '@/lib/operational-legitimacy';

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
  { value: 'Inbox', key: 'caseGrievance' },
  { value: 'Priorities', key: 'memberPortal' },
  { value: 'Work', key: 'financialBilling' },
  { value: 'Intelligence', key: 'intelligenceInsights' },
  { value: 'Outcomes', key: 'governanceOversight' },
] as const;

export default function LocalePilotRequestPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params.locale as string) ?? 'en-CA';
  const t = useTranslations('marketing.pilotRequest');
  const tNote = useTranslations('continuityNotes.pilot');
  const contextMode = parseInstitutionalMode(searchParams.get('context') ?? undefined);
  const contextProfile = getInstitutionalModeProfile(contextMode);

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

  const continuityProfile = buildContinuityReadinessProfile(formData);

  // Tag locale so React renders updated strings on locale change.
  void locale;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* Hero Section with Imagery */}
      <MarketingHeroSection
        imageUrl={heroImagery.pilotRequest}
        heading={t('heroHeading')}
        description={t('heroDescription')}
        contextKicker={`${contextProfile.label} context`}
        contextNote={contextProfile.heroFraming}
      />

      <InstitutionalContinuityNote
        surface={tNote('label')}
        posture={tNote('posture')}
      />

      <div className="max-w-3xl mx-auto mt-12">

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
                  aria-label={t('step1.contactNameLabel')}
                  placeholder={t('step1.contactNameLabel')}
                />
              </Field>

              <Field label={t('step1.contactEmailLabel')}>
                <input
                  type="email"
                  value={formData.contactEmail ?? ''}
                  onChange={(e) => set('contactEmail', e.target.value)}
                  className={inputCls}
                  aria-label={t('step1.contactEmailLabel')}
                  placeholder={t('step1.contactEmailLabel')}
                />
              </Field>

              <Field label={t('step1.contactPhoneLabel')}>
                <input
                  type="tel"
                  value={formData.contactPhone ?? ''}
                  onChange={(e) => set('contactPhone', e.target.value)}
                  className={inputCls}
                  aria-label={t('step1.contactPhoneLabel')}
                  placeholder={t('step1.contactPhoneLabel')}
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
                    <span>{mod.value}</span>
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
                  aria-label={t('step4.timelineLabel')}
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

              <div className="grid gap-4 md:grid-cols-2">
                <section className="p-5 rounded-lg border border-gray-200 bg-white">
                  <h3 className="font-semibold text-gray-900 mb-3">Continuity profile</h3>
                  <p className="text-sm text-gray-700 leading-relaxed mb-3">{assessment.continuityProfile}</p>
                  <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Governance alignment:</span> {assessment.governanceAlignmentSummary}</p>
                </section>

                <section className="p-5 rounded-lg border border-gray-200 bg-white">
                  <h3 className="font-semibold text-gray-900 mb-3">Institutional resilience direction</h3>
                  <p className="text-sm text-gray-700 leading-relaxed mb-3">{assessment.institutionalResilienceDirection}</p>
                  <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Rollout recommendation:</span> {assessment.rolloutRecommendation}</p>
                </section>
              </div>

              <section className="p-5 rounded-lg border border-gray-200 bg-white">
                <h3 className="font-semibold text-gray-900 mb-3">Executive continuity overview</h3>
                <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-700">
                  <article className="p-3 rounded bg-gray-50 border border-gray-100">
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Continuity posture</p>
                    <p>{assessment.continuityOverview.continuityPosture}</p>
                  </article>
                  <article className="p-3 rounded bg-gray-50 border border-gray-100">
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Governance coherence</p>
                    <p>{assessment.continuityOverview.governanceCoherence}</p>
                  </article>
                  <article className="p-3 rounded bg-gray-50 border border-gray-100">
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Operational stability</p>
                    <p>{assessment.continuityOverview.operationalStability}</p>
                  </article>
                  <article className="p-3 rounded bg-gray-50 border border-gray-100">
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Institutional memory health</p>
                    <p>{assessment.continuityOverview.institutionalMemoryHealth}</p>
                  </article>
                </div>
              </section>

              <section className="p-5 rounded-lg border border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900 mb-3">Fragmentation observations</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  {assessment.fragmentationObservations.map((observation) => (
                    <li key={observation} className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span>{observation}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="p-5 rounded-lg border border-gray-200 bg-navy text-white">
                <h3 className="font-semibold mb-3">Continuity risk narratives</h3>
                <ul className="space-y-2 text-sm text-white/85">
                  {assessment.continuityRiskNarratives.map((narrative) => (
                    <li key={narrative}>• {narrative}</li>
                  ))}
                </ul>
              </section>

              <section className="p-5 rounded-lg border border-gray-200 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Pilot simulation artifacts</h3>
                    <p className="text-sm text-gray-600">Reviewable institutional examples for controlled modernization.</p>
                  </div>
                  <Link href={withInstitutionalContext(`/${locale}/proof`, contextMode)} className="text-sm font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1">
                    View proof architecture <span aria-hidden>→</span>
                  </Link>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {pilotSimulationArtifacts.map((artifact) => (
                    <article key={artifact.title} className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">{artifact.title}</h4>
                      <p className="text-xs text-gray-600 leading-relaxed mb-2">{artifact.continuityProfile}</p>
                      <p className="text-xs text-gray-500">Stabilization outcomes: {artifact.stabilizationOutcomes[0]}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="p-5 rounded-lg border border-gray-200 bg-white">
                <h3 className="font-semibold text-gray-900 mb-3">{t('phase6.leadershipTitle')}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {leadershipTransitionContinuityScenarios.map((item) => (
                    <article key={item.scenario} className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                      <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">{item.focus}</p>
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">{item.scenario}</h4>
                      <p className="text-xs text-gray-600 mb-1">{item.livedSignal}</p>
                      <p className="text-xs text-gray-700"><span className="font-medium text-gray-900">{t('phase6.stabilizationMoveLabel')}</span> {item.stabilizationMove}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="p-5 rounded-lg border border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900 mb-3">{t('phase6.frictionTitle')}</h3>
                <div className="space-y-2">
                  {governanceFrictionSimulationFlows.map((item) => (
                    <article key={item.friction} className="p-3 rounded-md bg-white border border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{item.friction}</p>
                      <p className="text-xs text-gray-600 mt-1">{item.continuityImpact}</p>
                      <p className="text-xs text-gray-700 mt-1"><span className="font-medium text-gray-900">{t('phase6.manageThroughLabel')}</span> {item.managementPath}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <article className="p-5 rounded-lg border border-gray-200 bg-white">
                  <h3 className="font-semibold text-gray-900 mb-3">{t('phase6.onboardingTitle')}</h3>
                  <div className="space-y-2">
                    {onboardingContinuityIntelligenceScenarios.map((item) => (
                      <div key={item.scenario} className="p-3 rounded-md bg-gray-50 border border-gray-100">
                        <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">{item.focus}</p>
                        <p className="text-sm font-medium text-gray-900">{item.scenario}</p>
                        <p className="text-xs text-gray-600 mt-1">{item.continuityGuide}</p>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="p-5 rounded-lg border border-gray-200 bg-white">
                  <h3 className="font-semibold text-gray-900 mb-3">{t('phase6.federationTitle')}</h3>
                  <div className="space-y-2">
                    {federationScaleContinuityScenarios.map((item) => (
                      <div key={item.area} className="p-3 rounded-md bg-gray-50 border border-gray-100">
                        <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">{item.focus}</p>
                        <p className="text-sm font-medium text-gray-900">{item.area}</p>
                        <p className="text-xs text-gray-600 mt-1">{item.realism}</p>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <section className="p-5 rounded-lg border border-blue-100 bg-blue-50/70">
                <h3 className="font-semibold text-blue-950 mb-3">{t('phase6.decisionTitle')}</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {executiveDecisionPathwaySystems.map((item) => (
                    <article key={item.decision} className="p-3 rounded-md bg-white border border-blue-100">
                      <p className="text-[11px] uppercase tracking-widest text-blue-400 mb-1">{item.continuityFocus}</p>
                      <p className="text-sm font-medium text-gray-900">{item.decision}</p>
                      <p className="text-xs text-gray-600 mt-1">{item.pathway}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="p-5 rounded-lg border border-gray-200 bg-white">
                <h3 className="font-semibold text-gray-900 mb-3">Executive continuity briefing flow</h3>
                <div className="grid sm:grid-cols-2 gap-2 text-sm text-gray-700">
                  {executiveBriefingFlows.map((item) => (
                    <div key={item} className="p-3 rounded bg-gray-50 border border-gray-100">{item}</div>
                  ))}
                </div>
              </section>

              <section className="p-5 rounded-lg border border-blue-100 bg-blue-50/70">
                <h3 className="font-semibold text-blue-950 mb-2">Continuity and Governance Readiness Profile</h3>
                <p className="text-sm text-blue-900 mb-4">
                  {continuityProfile.level}: {continuityProfile.summary}
                </p>
                <div className="space-y-2">
                  {continuityProfile.dimensions.map((dimension) => (
                    <article key={dimension.label} className="p-3 rounded-md bg-white border border-blue-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">{dimension.label}</p>
                        <span className="text-xs font-semibold text-blue-700">{dimension.score}/5</span>
                      </div>
                      <p className="text-xs text-gray-600">{dimension.summary}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="p-5 rounded-lg border border-gray-200 bg-white">
                <h3 className="font-semibold text-gray-900 mb-3">Recommended Institutional Rollout Pathway</h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {institutionalRolloutPathway.map((stage, index) => (
                    <div key={stage} className="text-sm text-gray-700 p-2 rounded bg-gray-50 border border-gray-100">
                      {index + 1}. {stage}
                    </div>
                  ))}
                </div>
              </section>

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
