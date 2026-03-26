/**
 * Locale-aware Pilot-Request page
 * Accessible at /{locale}/pilot-request
 *
 * Full multi-step readiness form with locale-aware labels.
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

const SECTORS = [
  'Healthcare',
  'Education',
  'Construction & Trades',
  'Transportation & Logistics',
  'Public Service',
  'Manufacturing',
  'Protective Services',
  'Hospitality & Service',
  'Other',
];

const SECTOR_FR: Record<string, string> = {
  Healthcare: 'Santé',
  Education: 'Éducation',
  'Construction & Trades': 'Construction et métiers',
  'Transportation & Logistics': 'Transport et logistique',
  'Public Service': 'Fonction publique',
  Manufacturing: 'Fabrication',
  'Protective Services': 'Services de protection',
  'Hospitality & Service': 'Hôtellerie et services',
  Other: 'Autre',
};

const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK'];

const CHALLENGES_EN = [
  'No financial audit trail',
  'Manual tracking or spreadsheets',
  'Inconsistent case handling across locals',
  'No role-based access control',
  'Parent/local allocation opacity',
  'Difficult compliance reporting',
  'Limited member transparency',
  'Fragmented document management',
  'No centralized governance oversight',
];

const CHALLENGES_FR: Record<string, string> = {
  'No financial audit trail': "Aucune piste d'audit financière",
  'Manual tracking or spreadsheets': 'Suivi manuel ou feuilles de calcul',
  'Inconsistent case handling across locals': 'Traitement de dossiers incohérent entre les sections locales',
  'No role-based access control': "Pas de contrôle d'accès basé sur les rôles",
  'Parent/local allocation opacity': 'Opacité des allocations parent/local',
  'Difficult compliance reporting': 'Rapports de conformité difficiles',
  'Limited member transparency': 'Transparence limitée envers les membres',
  'Fragmented document management': 'Gestion documentaire fragmentée',
  'No centralized governance oversight': 'Aucune surveillance de gouvernance centralisée',
};

const GOALS_EN = [
  'Auditable financial controls',
  'Role-based access and entitlements',
  'Structured grievance and case workflows',
  'Parent-to-local fund allocation transparency',
  'Real-time governance dashboards',
  'Member self-service portal',
  'Compliance-ready documentation',
  'Intelligence-assisted decision support',
];

const GOALS_FR: Record<string, string> = {
  'Auditable financial controls': 'Contrôles financiers vérifiables',
  'Role-based access and entitlements': 'Accès et droits basés sur les rôles',
  'Structured grievance and case workflows': 'Flux de travail structurés pour griefs et dossiers',
  'Parent-to-local fund allocation transparency': 'Transparence de l\'allocation des fonds parent-local',
  'Real-time governance dashboards': 'Tableaux de bord de gouvernance en temps réel',
  'Member self-service portal': 'Portail libre-service pour les membres',
  'Compliance-ready documentation': 'Documentation prête pour la conformité',
  'Intelligence-assisted decision support': "Aide à la décision assistée par l'intelligence",
};

const MODULES_EN = [
  'Case & Grievance Management',
  'Member Portal & Engagement',
  'Financial Allocation & Billing',
  'Intelligence & Insights',
  'Governance & Oversight',
];

const MODULES_FR: Record<string, string> = {
  'Case & Grievance Management': 'Gestion des griefs et dossiers',
  'Member Portal & Engagement': 'Portail et engagement des membres',
  'Financial Allocation & Billing': 'Allocation financière et facturation',
  'Intelligence & Insights': 'Intelligence et analyse',
  'Governance & Oversight': 'Gouvernance et supervision',
};

export default function LocalePilotRequestPage() {
  const params = useParams();
  const locale = (params.locale as string) ?? 'en-CA';
  const t = useTranslations('marketing.pilotRequest');
  const isFr = locale === 'fr-CA';

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
        alert(isFr ? 'Échec de la soumission. Veuillez réessayer.' : 'Submission failed. Please try again.');
      }
    } catch (error) {
      logger.error('Submission error:', error);
      alert(isFr ? 'Échec de la soumission. Veuillez réessayer.' : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = isFr
    ? ['Organisation', 'Contexte', 'Modules & Objectifs', 'Pr\u00e9paration', '\u00c9valuation']
    : ['Organization', 'Context', 'Modules & Goals', 'Readiness', 'Assessment'];

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
          message={
            isFr
              ? "Chaque d\u00e9ploiement pilote est d\u00e9limit\u00e9 par contrat, contr\u00f4l\u00e9 par module et assujetti aux exigences de gouvernance de votre organisation."
              : "Every pilot deployment is contract-scoped, module-controlled, and subject to your organization\u2019s governance requirements."
          }
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
              <h2 className="text-2xl font-bold text-gray-900">
                {isFr ? 'Parlez-nous de votre organisation' : 'Tell us about your organization'}
              </h2>

              <Field label={isFr ? "Nom de l'organisation *" : 'Organization Name *'}>
                <input
                  type="text"
                  value={formData.organizationName ?? ''}
                  onChange={(e) => set('organizationName', e.target.value)}
                  className={inputCls}
                  placeholder={isFr ? 'ex. SCFP Section locale 123' : 'e.g., CUPE Local 123'}
                />
              </Field>

              <Field label={isFr ? "Type d'organisation *" : 'Organization Type *'}>
                {(['local', 'regional', 'national'] as const).map((type) => (
                  <label key={type} className="flex items-center gap-2 capitalize">
                    <input
                      type="radio"
                      name="orgType"
                      value={type}
                      checked={formData.organizationType === type}
                      onChange={() => set('organizationType', type)}
                    />
                    {isFr ? { local: 'Local', regional: 'Régional', national: 'National' }[type] : type.charAt(0).toUpperCase() + type.slice(1)}
                  </label>
                ))}
              </Field>

              <Field label={isFr ? 'Nom du contact *' : 'Contact Name *'}>
                <input type="text" value={formData.contactName ?? ''} onChange={(e) => set('contactName', e.target.value)} className={inputCls} />
              </Field>

              <Field label={isFr ? 'Courriel du contact *' : 'Contact Email *'}>
                <input type="email" value={formData.contactEmail ?? ''} onChange={(e) => set('contactEmail', e.target.value)} className={inputCls} />
              </Field>

              <Field label={isFr ? 'Téléphone du contact (facultatif)' : 'Contact Phone (Optional)'}>
                <input type="tel" value={formData.contactPhone ?? ''} onChange={(e) => set('contactPhone', e.target.value)} className={inputCls} />
              </Field>

              <Field label={isFr ? 'Nombre de membres *' : 'Member Count *'} hint={isFr ? 'Adhésion totale approximative' : 'Approximate total membership'}>
                <input type="number" value={formData.memberCount ?? ''} onChange={(e) => set('memberCount', parseInt(e.target.value))} className={inputCls} placeholder="e.g., 1200" />
              </Field>

              <Btn onClick={() => setStep(2)} disabled={!isStep1Valid}>
                {isFr ? 'Continuer' : 'Continue'}
              </Btn>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {isFr ? 'Votre contexte op\u00e9rationnel' : 'Your operational context'}
              </h2>

              <Field label={isFr ? 'Juridictions *' : 'Jurisdictions *'}>
                <div className="grid grid-cols-2 gap-2">
                  {PROVINCES.map((prov) => (
                    <label key={prov} className="flex items-center gap-2">
                      <input type="checkbox" checked={formData.jurisdictions?.includes(prov)} onChange={() => toggle('jurisdictions', prov)} />
                      <span>{prov}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field label={isFr ? 'Secteurs *' : 'Sectors *'}>
                {SECTORS.map((sector) => (
                  <label key={sector} className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.sectors?.includes(sector)} onChange={() => toggle('sectors', sector)} />
                    <span>{isFr ? SECTOR_FR[sector] : sector}</span>
                  </label>
                ))}
              </Field>

              <Field label={isFr ? 'Système actuel (facultatif)' : 'Current System (Optional)'}>
                <input
                  type="text"
                  value={formData.currentSystem ?? ''}
                  onChange={(e) => set('currentSystem', e.target.value)}
                  className={inputCls}
                  placeholder={isFr ? 'ex. Feuilles Excel, fichiers papier, logiciel existant' : 'e.g., Excel spreadsheets, paper files, legacy software'}
                />
              </Field>

              <Field label={isFr ? 'Défis de gouvernance actuels (cochez tout ce qui s\'applique)' : 'Current governance challenges (select all that apply)'}>
                {CHALLENGES_EN.map((challenge) => (
                  <label key={challenge} className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.challenges?.includes(challenge)} onChange={() => toggle('challenges', challenge)} />
                    <span>{isFr ? CHALLENGES_FR[challenge] : challenge}</span>
                  </label>
                ))}
              </Field>

              <div className="flex gap-4">
                <Btn variant="secondary" onClick={() => setStep(1)}>{isFr ? 'Retour' : 'Back'}</Btn>
                <Btn onClick={() => setStep(3)} disabled={!isStep2Valid}>{isFr ? 'Continuer' : 'Continue'}</Btn>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {isFr ? 'Modules et objectifs' : 'Modules & goals'}
              </h2>

              <Field label={isFr ? 'Modules d\u2019int\u00e9r\u00eat *' : 'Modules of Interest *'}>
                {MODULES_EN.map((mod) => (
                  <label key={mod} className="flex items-center gap-2">
                    <input type="checkbox" checked={((formData.responses as Record<string, unknown>)?.modules as string[] ?? []).includes(mod)} onChange={() => toggleModule(mod)} />
                    <span>{isFr ? MODULES_FR[mod] : mod}</span>
                  </label>
                ))}
              </Field>

              <Field label={isFr ? 'Objectifs de gouvernance (cochez tout ce qui s\u2019applique) *' : 'Governance objectives (select all that apply) *'}>
                {GOALS_EN.map((goal) => (
                  <label key={goal} className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.goals?.includes(goal)} onChange={() => toggle('goals', goal)} />
                    <span>{isFr ? GOALS_FR[goal] : goal}</span>
                  </label>
                ))}
              </Field>

              <Field label={isFr ? 'Informations supplémentaires (facultatif)' : 'Additional notes (Optional)'}>
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
                  placeholder={isFr ? 'Partagez tout contexte supplémentaire…' : 'Share any additional context…'}
                />
              </Field>

              <div className="flex gap-4">
                <Btn variant="secondary" onClick={() => setStep(2)}>{isFr ? 'Retour' : 'Back'}</Btn>
                <Btn onClick={() => setStep(4)} disabled={!isStep3Valid}>{isFr ? 'Continuer' : 'Continue'}</Btn>
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {isFr ? 'Préparation de la gouvernance' : 'Governance readiness'}
              </h2>

              <Field label={isFr ? 'Avez-vous le soutien de la direction exécutive?' : 'Do you have executive leadership support?'}>
                {(['yes', 'no', 'unsure'] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2 capitalize">
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
                    {isFr
                      ? { yes: 'Oui', no: 'Non', unsure: 'Incertain' }[v]
                      : v.charAt(0).toUpperCase() + v.slice(1)}
                  </label>
                ))}
              </Field>

              <Field label={isFr ? 'Quel est votre délai de déploiement préféré?' : 'What is your preferred deployment timeline?'}>
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
                  <option value="">{isFr ? 'Sélectionnez…' : 'Select…'}</option>
                  <option value="immediate">{isFr ? 'Immédiatement' : 'Immediately'}</option>
                  <option value="3months">{isFr ? 'Dans 3 mois' : 'Within 3 months'}</option>
                  <option value="6months">{isFr ? 'Dans 6 mois' : 'Within 6 months'}</option>
                  <option value="exploring">{isFr ? 'Juste en train d\'explorer' : 'Just exploring'}</option>
                </select>
              </Field>

              <div className="flex gap-4">
                <Btn variant="secondary" onClick={() => setStep(3)}>{isFr ? 'Retour' : 'Back'}</Btn>
                <Btn onClick={handleAssessReadiness} disabled={!isFormValid}>
                  {isFr ? 'Évaluer la préparation' : 'Assess deployment readiness'}
                </Btn>
              </div>
            </div>
          )}

          {/* Step 5: Assessment */}
          {step === 5 && assessment && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {isFr ? 'Votre évaluation de déploiement' : 'Your Deployment Readiness Assessment'}
              </h2>

              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <p className="text-5xl font-bold text-blue-700">{assessment.score}/100</p>
                <p className="text-lg font-medium text-blue-900 mt-2">{assessment.level}</p>
                <p className="text-sm text-blue-700 mt-1">{isFr ? 'Délai estimé de déploiement :' : 'Estimated deployment timeline:'} {assessment.estimatedSetupTime}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">{isFr ? 'Points forts' : 'Strengths'}</h3>
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
                  <h3 className="font-semibold text-gray-900 mb-2">{isFr ? 'Points à travailler' : 'Areas to address'}</h3>
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
                  <h3 className="font-semibold text-gray-900 mb-2">{isFr ? 'Recommandations' : 'Recommendations'}</h3>
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
                <Btn variant="secondary" onClick={() => setStep(4)}>{isFr ? 'Retour' : 'Back'}</Btn>
                <Btn onClick={handleSubmit} disabled={submitting}>
                  {submitting
                    ? (isFr ? 'Envoi en cours…' : 'Submitting…')
                    : (isFr ? 'Soumettre la demande de pilote' : 'Submit pilot request')}
                </Btn>
              </div>
            </div>
          )}

          {/* Step 6: Submitted */}
          {step === 6 && (
            <div className="text-center space-y-4 py-8">
              <div className="text-5xl">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isFr ? 'Demande de pilote reçue!' : 'Pilot request received!'}
              </h2>
              <p className="text-gray-600 max-w-md mx-auto">
                {isFr
                  ? "Merci de votre intérêt pour Union Eyes. Notre équipe de déploiement examinera votre demande et vous contactera dans les 2 à 3 jours ouvrables pour discuter du cadrage."
                  : "Thank you for your interest in Union Eyes. Our deployment team will review your request and be in touch within 2\u20133 business days to discuss scoping."}
              </p>
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
