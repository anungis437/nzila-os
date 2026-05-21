'use client';

/**
 * ARTIFACT TYPE: React Component
 * DOCTRINE_VERSION: 1.0.0
 *
 * ConsentGate — informed consent before assessment begins.
 * Maps directly to ConsentRecord type. No dark patterns.
 * All three acknowledgements required to proceed.
 */

import { useState } from 'react';
import type { ConsentRecord } from '@/lib/icra/types';

interface ConsentGateProps {
  onConsent: (record: ConsentRecord) => void;
  doctrineVersion: string;
  locale?: string;
}

const CONSENT_COPY = {
  'en-CA': {
    title: 'Before You Begin',
    intro:
      'This assessment is designed to produce an honest institutional continuity profile for your organization. Please review what this assessment does and does not do before proceeding.',
    principles: 'Assessment Design Principles',
    principleItems: [
      {
        lead: 'No surveillance.',
        body: "This assessment does not ask about named individuals, personal performance, or individual behaviour. It asks about your organization's systems, processes, and institutional practices.",
      },
      {
        lead: 'No opaque AI scoring.',
        body: 'Every score is computed using published, explicitly weighted criteria. You will receive a full explanation of how your results were determined.',
      },
      {
        lead: 'Pseudonymous by design.',
        body: 'You are not required to provide identifying information. Your responses are associated with a session identifier, not a user account.',
      },
      {
        lead: 'Continuity intelligence, not a quiz.',
        body: 'This is a structured institutional assessment. The results are intended for organizational use, not individual evaluation.',
      },
    ],
    acknowledgements: 'Acknowledgements Required to Proceed',
    checks: [
      'I understand this assessment is designed to evaluate organizational systems and practices — not to surveil, evaluate, or score individual people.',
      'I understand that my responses will be stored pseudonymously. No account is required. Results are accessible via the link provided after submission.',
      'I understand that all scoring is deterministic and explainable. My results will include a full trace of how scores were computed from my responses.',
    ],
    proceed: 'Begin Assessment',
    required: 'All three acknowledgements are required to proceed.',
  },
  'fr-CA': {
    title: 'Avant de commencer',
    intro:
      "Cette évaluation produit un profil honnête de continuité institutionnelle pour votre organisation. Veuillez examiner ce que l'évaluation fait et ne fait pas avant de poursuivre.",
    principles: "Principes de conception de l'évaluation",
    principleItems: [
      {
        lead: 'Aucune surveillance.',
        body: "Cette évaluation ne pose pas de questions sur des personnes nommées, la performance personnelle ou les comportements individuels. Elle porte sur les systèmes, processus et pratiques institutionnelles de votre organisation.",
      },
      {
        lead: 'Aucune notation IA opaque.',
        body: 'Chaque score est calculé à partir de critères publiés et explicitement pondérés. Vous recevrez une explication complète de la détermination des résultats.',
      },
      {
        lead: 'Pseudonyme par conception.',
        body: "Aucune information d'identification n'est requise. Vos réponses sont associées à un identifiant de session, pas à un compte utilisateur.",
      },
      {
        lead: "Intelligence de continuité, pas questionnaire d'évaluation personnelle.",
        body: "Il s'agit d'une évaluation institutionnelle structurée. Les résultats servent à l'organisation, pas à l'évaluation individuelle.",
      },
    ],
    acknowledgements: 'Reconnaissances requises pour continuer',
    checks: [
      "Je comprends que cette évaluation vise les systèmes et pratiques organisationnels, et non la surveillance, l'évaluation ou la notation de personnes individuelles.",
      'Je comprends que mes réponses seront stockées de façon pseudonyme. Aucun compte n’est requis. Les résultats sont accessibles par le lien fourni après la soumission.',
      'Je comprends que tous les scores sont déterministes et explicables. Mes résultats incluront une trace complète du calcul des scores à partir de mes réponses.',
    ],
    proceed: "Commencer l'évaluation",
    required: 'Les trois reconnaissances sont requises pour continuer.',
  },
};

export function ConsentGate({ onConsent, doctrineVersion, locale = 'en-CA' }: ConsentGateProps) {
  const [antiSurveillance, setAntiSurveillance] = useState(false);
  const [dataHandling, setDataHandling] = useState(false);
  const [explainability, setExplainability] = useState(false);
  const copy = CONSENT_COPY[locale as keyof typeof CONSENT_COPY] ?? CONSENT_COPY['en-CA'];

  const allAcknowledged = antiSurveillance && dataHandling && explainability;

  function handleProceed() {
    if (!allAcknowledged) return;
    const record: ConsentRecord = {
      acceptedAt: new Date().toISOString(),
      doctrineVersion,
      acknowledgedAntiSurveillance: true,
      acknowledgedDataHandling: true,
      acknowledgedExplainability: true,
    };
    onConsent(record);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-12">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          {copy.title}
        </h1>
        <p className="text-base leading-relaxed text-stone-600">
          {copy.intro}
        </p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-stone-50 p-6 space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          {copy.principles}
        </h2>

        <div className="space-y-4 text-sm text-stone-700 leading-relaxed">
          {copy.principleItems.map((item) => (
            <p key={item.lead}>
              <strong>{item.lead}</strong> {item.body}
            </p>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          {copy.acknowledgements}
        </h2>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={antiSurveillance}
            onChange={(e) => setAntiSurveillance(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-stone-300 text-stone-800 focus:ring-stone-600"
          />
          <span className="text-sm text-stone-700 leading-relaxed group-hover:text-stone-900">
            {copy.checks[0]}
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={dataHandling}
            onChange={(e) => setDataHandling(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-stone-300 text-stone-800 focus:ring-stone-600"
          />
          <span className="text-sm text-stone-700 leading-relaxed group-hover:text-stone-900">
            {copy.checks[1]}
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={explainability}
            onChange={(e) => setExplainability(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-stone-300 text-stone-800 focus:ring-stone-600"
          />
          <span className="text-sm text-stone-700 leading-relaxed group-hover:text-stone-900">
            {copy.checks[2]}
          </span>
        </label>
      </div>

      <div className="pt-2">
        <button
          onClick={handleProceed}
          disabled={!allAcknowledged}
          className="inline-flex items-center justify-center rounded-md bg-stone-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copy.proceed}
        </button>
        {!allAcknowledged && (
          <p className="mt-3 text-xs text-stone-500">
            {copy.required}
          </p>
        )}
      </div>
    </div>
  );
}
