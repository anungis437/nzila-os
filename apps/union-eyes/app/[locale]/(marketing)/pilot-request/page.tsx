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
  'Construction',
  'Transportation',
  'Public Service',
  'Manufacturing',
  'Other',
];

const SECTOR_FR: Record<string, string> = {
  Healthcare: 'Santé',
  Education: 'Éducation',
  Construction: 'Construction',
  Transportation: 'Transport',
  'Public Service': 'Fonction publique',
  Manufacturing: 'Fabrication',
  Other: 'Autre',
};

const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK'];

const CHALLENGES_EN = [
  'Lost or missing documents',
  'Manual tracking processes',
  'No audit trail',
  'Inconsistent case handling',
  'Long resolution times',
  'Poor member communication',
  'Difficult reporting',
  'Limited transparency',
];

const CHALLENGES_FR: Record<string, string> = {
  'Lost or missing documents': 'Documents perdus ou manquants',
  'Manual tracking processes': 'Processus de suivi manuels',
  'No audit trail': "Pas de piste d'audit",
  'Inconsistent case handling': 'Traitement de dossiers incohérent',
  'Long resolution times': 'Délais de résolution trop longs',
  'Poor member communication': 'Communication insuffisante avec les membres',
  'Difficult reporting': 'Rapports difficiles à produire',
  'Limited transparency': 'Transparence limitée',
};

const GOALS_EN = [
  'Faster grievance resolution',
  'Better documentation',
  'Member self-service',
  'Real-time reporting',
  'Improved transparency',
  'AI-assisted case management',
];

const GOALS_FR: Record<string, string> = {
  'Faster grievance resolution': 'Résolution plus rapide des griefs',
  'Better documentation': 'Meilleure documentation',
  'Member self-service': 'Libre-service pour les membres',
  'Real-time reporting': 'Rapports en temps réel',
  'Improved transparency': 'Transparence améliorée',
  'AI-assisted case management': 'Gestion des dossiers assistée par IA',
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
    responses: {},
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
    ? ['Organisation', 'Contexte', 'Objectifs', 'Préparation', 'Évaluation']
    : ['Organization', 'Context', 'Goals', 'Readiness', 'Assessment'];

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
              ? "Ceci est une démarche sans pression. Vous obtiendrez une évaluation instantanée de préparation avant tout engagement."
              : "This is a no-pressure exploration. You'll get an instant readiness assessment before any commitment."
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
                  placeholder={isFr ? 'ex. Syndicat des travailleurs de la santé local 123' : 'e.g., Healthcare Workers Union Local 123'}
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
                {isFr ? 'Votre contexte actuel' : 'Your current context'}
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
                  placeholder={isFr ? 'ex. Feuilles Excel, dossiers papier, logiciel existant' : 'e.g., Excel spreadsheets, paper files, existing software'}
                />
              </Field>

              <Field label={isFr ? 'Défis actuels (cochez tout ce qui s\'applique)' : 'Current Challenges (Select all that apply)'}>
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
                {isFr ? 'Vos objectifs' : 'Your goals'}
              </h2>

              <Field label={isFr ? 'Que souhaitez-vous accomplir? *' : 'What do you want to accomplish? *'}>
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
                {isFr ? 'Niveau de préparation' : 'Readiness level'}
              </h2>

              <Field label={isFr ? 'Avez-vous le soutien de la direction? *' : 'Do you have leadership support? *'}>
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

              <Field label={isFr ? 'Quel est votre délai préféré?' : 'What is your preferred timeline?'}>
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
                  {isFr ? 'Évaluer ma préparation' : 'Assess my readiness'}
                </Btn>
              </div>
            </div>
          )}

          {/* Step 5: Assessment */}
          {step === 5 && assessment && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {isFr ? 'Votre évaluation de préparation' : 'Your Readiness Assessment'}
              </h2>

              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <p className="text-5xl font-bold text-blue-700">{assessment.score}/100</p>
                <p className="text-lg font-medium text-blue-900 mt-2">{assessment.level}</p>
                <p className="text-sm text-blue-700 mt-1">{isFr ? 'Délai estimé de mise en place :' : 'Estimated setup time:'} {assessment.estimatedSetupTime}</p>
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
                    : (isFr ? 'Soumettre ma demande' : 'Submit my application')}
                </Btn>
              </div>
            </div>
          )}

          {/* Step 6: Submitted */}
          {step === 6 && (
            <div className="text-center space-y-4 py-8">
              <div className="text-5xl">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isFr ? 'Demande reçue!' : 'Application received!'}
              </h2>
              <p className="text-gray-600 max-w-md mx-auto">
                {isFr
                  ? "Merci de votre intérêt pour Union Eyes. Nous vous répondrons dans les 2 à 3 jours ouvrables."
                  : "Thank you for your interest in Union Eyes. We'll be in touch within 2–3 business days."}
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
