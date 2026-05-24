/**
 * ARTIFACT TYPE: Result-Page Block
 * MODULE: OCRA Adaptive Interpretation
 * DOCTRINE_VERSION: 1.0.0
 *
 * Calm, locale-aware presentation of the adaptive context that shaped the
 * assessment's interpretation. Renders bands + counts + a brief assurance
 * statement. NEVER exposes routing internals, question IDs, rationale prose,
 * or scoring weights.
 *
 * Designed to drop in between the metadata header and the ICRAProfile body.
 */

import type { AdaptiveContextResolution } from '@/lib/icra/adaptation';

const COPY = {
  'en-CA': {
    overline: 'Adaptive Interpretation Context',
    body: 'This assessment was interpreted using the organizational context you provided. Core continuity questions remained included to preserve comparability across institutions, while interpretation reflected your organizational scale, governance structure, and continuity exposure.',
    institutionalScale: 'Organizational scale',
    governanceComplexity: 'Governance structure',
    continuityExposure: 'Continuity exposure',
    routedQuestions: 'Adapted question set',
    fallbackNote:
      'Limited organizational context was provided; a calibrated default interpretation was applied to keep results comparable.',
    questionsCountLabel: (n: number, total: number) =>
      `${n} of ${total} questions interpreted in context`,
  },
  'fr-CA': {
    overline: "Contexte d'interprétation adaptatif",
    body: "Cette évaluation a été interprétée en fonction du contexte organisationnel que vous avez fourni. Les questions essentielles de continuité ont été maintenues pour préserver la comparabilité entre institutions, tandis que l'interprétation reflétait votre échelle organisationnelle, votre structure de gouvernance et votre exposition à la continuité.",
    institutionalScale: 'Échelle organisationnelle',
    governanceComplexity: 'Structure de gouvernance',
    continuityExposure: 'Exposition à la continuité',
    routedQuestions: 'Ensemble de questions adapté',
    fallbackNote:
      "Le contexte organisationnel fourni étant limité, une interprétation par défaut calibrée a été appliquée pour préserver la comparabilité.",
    questionsCountLabel: (n: number, total: number) =>
      `${n} questions sur ${total} interprétées en contexte`,
  },
} as const;

const BAND_LABELS = {
  'en-CA': {
    institutionalScale: {
      small: 'Small',
      mid: 'Mid-size',
      large: 'Large',
      federated: 'Federated',
      unknown: 'Not specified',
    },
    governanceComplexity: {
      simple: 'Simple',
      moderate: 'Moderate',
      complex: 'Complex',
      federated: 'Federated',
      unknown: 'Not specified',
    },
    continuityExposure: {
      low: 'Low',
      moderate: 'Moderate',
      elevated: 'Elevated',
      high: 'High',
      unknown: 'Not specified',
    },
  },
  'fr-CA': {
    institutionalScale: {
      small: 'Petite',
      mid: 'Moyenne',
      large: 'Grande',
      federated: 'Fédérée',
      unknown: 'Non spécifiée',
    },
    governanceComplexity: {
      simple: 'Simple',
      moderate: 'Modérée',
      complex: 'Complexe',
      federated: 'Fédérée',
      unknown: 'Non spécifiée',
    },
    continuityExposure: {
      low: 'Faible',
      moderate: 'Modérée',
      elevated: 'Élevée',
      high: 'Haute',
      unknown: 'Non spécifiée',
    },
  },
} as const;

interface Props {
  resolution: AdaptiveContextResolution;
  locale: 'en-CA' | 'fr-CA';
}

function bandLabel(
  locale: 'en-CA' | 'fr-CA',
  field: 'institutionalScale' | 'governanceComplexity' | 'continuityExposure',
  value: string,
): string {
  const map = BAND_LABELS[locale][field] as Record<string, string>;
  return map[value] ?? map.unknown ?? value;
}

export function AdaptiveInterpretationBlock({ resolution, locale }: Props) {
  const t = COPY[locale] ?? COPY['en-CA'];
  const a = resolution.adaptiveContext;
  const total = a.includedQuestionIds.length + a.deferredQuestionIds.length;

  return (
    <section
      className="rounded-2xl border border-stone-200 bg-white px-6 py-7 print:border-stone-300"
      aria-labelledby="adaptive-interp-headline"
      data-testid="adaptive-interpretation-block"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
        {t.overline}
      </p>
      <h2
        id="adaptive-interp-headline"
        className="mt-2 font-sans text-xl font-semibold tracking-tight text-stone-900"
      >
        {t.overline}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-700">
        {t.body}
      </p>

      <dl className="mt-6 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
          <dt className="text-[10px] font-medium uppercase tracking-widest text-stone-500">
            {t.institutionalScale}
          </dt>
          <dd className="mt-1 text-sm font-medium text-stone-900">
            {bandLabel(locale, 'institutionalScale', a.profileBands.institutionalScale)}
          </dd>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
          <dt className="text-[10px] font-medium uppercase tracking-widest text-stone-500">
            {t.governanceComplexity}
          </dt>
          <dd className="mt-1 text-sm font-medium text-stone-900">
            {bandLabel(locale, 'governanceComplexity', a.profileBands.governanceComplexity)}
          </dd>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
          <dt className="text-[10px] font-medium uppercase tracking-widest text-stone-500">
            {t.continuityExposure}
          </dt>
          <dd className="mt-1 text-sm font-medium text-stone-900">
            {bandLabel(locale, 'continuityExposure', a.profileBands.continuityExposure)}
          </dd>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
          <dt className="text-[10px] font-medium uppercase tracking-widest text-stone-500">
            {t.routedQuestions}
          </dt>
          <dd className="mt-1 text-sm font-medium text-stone-900">
            {t.questionsCountLabel(a.includedQuestionIds.length, total)}
          </dd>
        </div>
      </dl>

      {a.fallbackUsed && (
        <p
          className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          role="note"
        >
          {t.fallbackNote}
        </p>
      )}
    </section>
  );
}
