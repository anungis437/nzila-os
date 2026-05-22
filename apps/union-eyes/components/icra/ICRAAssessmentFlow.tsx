'use client';

/**
 * ARTIFACT TYPE: React Component
 * DOCTRINE_VERSION: 1.0.0
 *
 * ICRAAssessmentFlow — full multi-section assessment flow.
 * Step 0: Consent. Step 1: Org context. Steps 2-8: Seven scored sections.
 *
 * Client component. Submits to /api/icra/submit on completion.
 * No auth required. Redirects to /continuity-assessment/results/[id].
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Answer, ConsentRecord, SectionId } from '@/lib/icra/types';
import type { MetadataQuestion } from '@/lib/icra/questions';
import {
  SECTIONS,
  QUESTIONS_BY_SECTION,
  METADATA_QUESTIONS,
  QUESTION_BANK_VERSION,
  CTX_PRIMARY_CHALLENGE_MAX_LENGTH,
} from '@/lib/icra/questions';
import { ConsentGate } from './ConsentGate';

const DOCTRINE_VERSION = '1.0.0';
const PERSIST_KEY = 'icra.flow.v1';
const PERSIST_TTL_MS = 1000 * 60 * 60 * 24; // 24h — abandoned drafts expire

const SCORED_SECTIONS: SectionId[] = [
  'operational_dependency',
  'governance_visibility',
  'institutional_memory',
  'transition_readiness',
  'operational_coordination',
  'explainability_trust',
  'sovereignty_governance',
];

type OrgContextAnswers = Record<string, string>;

/** Persisted draft snapshot (sessionStorage). */
interface PersistedDraft {
  v: 1;
  step: number;
  consent: ConsentRecord | null;
  orgContext: OrgContextAnswers;
  answers: Answer[];
  currentSectionAnswers: Array<[string, string]>;
  savedAt: number;
}

/** Fire-and-forget client telemetry. Uses sendBeacon when possible so
 *  abandonment signals survive page unload. */
function emitTelemetry(
  kind: string,
  sectionId?: string,
  metadata?: Record<string, string | number | boolean>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify({ kind, sectionId, metadata });
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/icra/telemetry', blob);
      return;
    }
    void fetch('/api/icra/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Telemetry must never break the flow.
  }
}

const FLOW_COPY = {
  'en-CA': {
    generatingTitle: 'Generating your continuity profile…',
    generatingBody: 'This takes a moment. Please do not close this page.',
    submissionFailed: 'Submission failed. Please try again.',
    section: 'Section',
    of: 'of',
    complete: 'complete',
    previous: '← Previous section',
    next: 'Next section →',
    submit: 'Submit assessment',
    remainingPrefix: '',
    remainingSingular: 'question remaining in this section',
    remainingPlural: 'questions remaining in this section',
    orgTitle: 'Organizational Context',
    orgBody:
      'This information helps contextualize your results. It is not scored and does not affect your continuity profile.',
    selectPlaceholder: 'Select…',
    optionalPlaceholder: 'Optional',
    begin: 'Begin Assessment →',
  },
  'fr-CA': {
    generatingTitle: 'Génération de votre profil de continuité...',
    generatingBody: 'Cela prendra un moment. Veuillez ne pas fermer cette page.',
    submissionFailed: 'La soumission a échoué. Veuillez réessayer.',
    section: 'Section',
    of: 'sur',
    complete: 'complété',
    previous: '← Section précédente',
    next: 'Section suivante →',
    submit: "Soumettre l'évaluation",
    remainingPrefix: '',
    remainingSingular: 'question restante dans cette section',
    remainingPlural: 'questions restantes dans cette section',
    orgTitle: 'Contexte organisationnel',
    orgBody:
      "Ces informations aident à contextualiser vos résultats. Elles ne sont pas notées et n'ont aucun effet sur votre profil de continuité.",
    selectPlaceholder: 'Sélectionner...',
    optionalPlaceholder: 'Facultatif',
    begin: "Commencer l'évaluation →",
  },
};

export function ICRAAssessmentFlow({ locale = 'en-CA' }: { locale?: string }) {
  const router = useRouter();
  const copy = FLOW_COPY[locale as keyof typeof FLOW_COPY] ?? FLOW_COPY['en-CA'];

  // Step: 0=consent, 1=org context, 2-8=scored sections, 9=submitting
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [orgContext, setOrgContext] = useState<OrgContextAnswers>({});
  const [answers, setAnswers] = useState<Map<string, Answer>>(new Map());
  const [currentSectionAnswers, setCurrentSectionAnswers] = useState<Map<string, string>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const lastReportedStepRef = useRef<number>(-1);

  // ── Hydrate from sessionStorage on mount ─────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') {
      setHydrated(true);
      return;
    }
    try {
      const raw = window.sessionStorage.getItem(PERSIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedDraft>;
        const fresh = typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt < PERSIST_TTL_MS;
        if (
          fresh &&
          parsed.v === 1 &&
          typeof parsed.step === 'number' &&
          parsed.step > 0 &&
          parsed.step < 9
        ) {
          setStep(parsed.step);
          if (parsed.consent) setConsent(parsed.consent);
          if (parsed.orgContext) setOrgContext(parsed.orgContext);
          if (Array.isArray(parsed.answers)) {
            setAnswers(new Map(parsed.answers.map((a) => [a.questionId, a])));
          }
          if (Array.isArray(parsed.currentSectionAnswers)) {
            setCurrentSectionAnswers(new Map(parsed.currentSectionAnswers));
          }
          emitTelemetry('assessment_resumed', undefined, { step: parsed.step });
        }
      }
    } catch {
      // Corrupt draft — fall back to fresh state.
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist on every meaningful change ────────────────────────────────────
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    if (step === 0 || step >= 9) return; // Don't persist pre-consent or post-submit.
    try {
      const draft: PersistedDraft = {
        v: 1,
        step,
        consent,
        orgContext,
        answers: Array.from(answers.values()),
        currentSectionAnswers: Array.from(currentSectionAnswers.entries()),
        savedAt: Date.now(),
      };
      window.sessionStorage.setItem(PERSIST_KEY, JSON.stringify(draft));
    } catch {
      // Quota exceeded / private mode — silent.
    }
  }, [hydrated, step, consent, orgContext, answers, currentSectionAnswers]);

  // ── Abandonment telemetry on unload mid-flow ──────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      if (step >= 1 && step <= 8) {
        emitTelemetry('section_abandoned', currentSectionId ?? undefined, {
          step,
          answered: answers.size,
        });
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, answers.size]);

  // ── Per-step advance telemetry ────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (lastReportedStepRef.current === step) return;
    lastReportedStepRef.current = step;
    if (step === 1) emitTelemetry('consent_accepted');
    else if (step === 2) emitTelemetry('org_context_completed');
    else if (step >= 3 && step <= 8) {
      const advancedFrom = SCORED_SECTIONS[step - 3];
      if (advancedFrom) emitTelemetry('section_advanced', advancedFrom, { step });
    }
  }, [step, hydrated]);

  // Scroll to top whenever the user advances to a new step (section transition,
  // consent → org context, org context → first section, etc.).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // Step 0 → 1
  function handleConsent(record: ConsentRecord, token: string | null) {
    setConsent(record);
    setTurnstileToken(token);
    setStep(1);
  }

  // Step 1 → 2
  function handleOrgContext(ctx: OrgContextAnswers) {
    setOrgContext(ctx);
    setStep(2);
  }

  // Steps 2–8: current section index is (step - 2)
  const currentSectionId = step >= 2 && step <= 8 ? SCORED_SECTIONS[step - 2] : null;
  const currentSectionDef = currentSectionId
    ? SECTIONS.find((s) => s.id === currentSectionId)
    : null;
  const currentQuestions = currentSectionId
    ? (QUESTIONS_BY_SECTION[currentSectionId] ?? [])
    : [];

  // ── Back navigation: restore the prior section's selections from `answers`.
  function handleSectionBack() {
    if (step <= 2) return;
    const targetSectionId = SCORED_SECTIONS[step - 3];
    const targetQuestions = targetSectionId
      ? (QUESTIONS_BY_SECTION[targetSectionId] ?? [])
      : [];
    const restored = new Map<string, string>();
    for (const q of targetQuestions) {
      const a = answers.get(q.id);
      if (a) restored.set(q.id, String(a.rawValue));
    }
    setCurrentSectionAnswers(restored);
    setStep(step - 1);
  }

  function handleOptionSelect(questionId: string, value: string) {
    setCurrentSectionAnswers((prev) => new Map(prev).set(questionId, value));
  }

  /**
   * Keyboard handler for radiogroup arrow-key navigation. Moves focus to the
   * next / previous radio option in the same group and selects it, matching
   * the WAI-ARIA Authoring Practices radio pattern.
   */
  function handleRadioKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    questionId: string,
    values: string[],
    currentIndex: number,
  ) {
    const last = values.length - 1;
    let nextIndex: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = currentIndex >= last ? 0 : currentIndex + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = currentIndex <= 0 ? last : currentIndex - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = last;
        break;
      default:
        return;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const nextValue = values[nextIndex];
    handleOptionSelect(questionId, nextValue);
    const container = event.currentTarget.closest('[role="radiogroup"]');
    if (container) {
      const nextEl = container.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex];
      nextEl?.focus();
    }
  }

  function handleSectionNext() {
    if (!currentSectionId) return;

    const questions = QUESTIONS_BY_SECTION[currentSectionId] ?? [];
    const newAnswers = new Map(answers);

    for (const q of questions) {
      const rawValue = currentSectionAnswers.get(q.id);
      if (!rawValue) continue;

      let normalizedScore: number | null = null;

      if (q.type === 'likert_5') {
        // Likert: rawValue is "1".."5". Normalize to 0..1.
        // Confidence-sensing questions: higher = better → (raw-1)/4.
        // Risk-inverted: higher raw = worse → (5-raw)/4.
        const numeric = Number.parseInt(rawValue, 10);
        if (!Number.isFinite(numeric) || numeric < q.scale.min || numeric > q.scale.max) continue;
        const linear = (numeric - q.scale.min) / (q.scale.max - q.scale.min);
        normalizedScore = q.riskInverted ? 1 - linear : linear;
      } else if ('options' in q) {
        const selectedOption = q.options.find((o) => o.value === rawValue);
        if (!selectedOption) continue;
        normalizedScore = selectedOption.score;
      }

      if (normalizedScore === null) continue;

      const answer: Answer = {
        questionId: q.id,
        questionVersion: QUESTION_BANK_VERSION,
        rawValue,
        normalizedScore,
        weightsSnapshot: { ...q.weights },
        riskInverted: q.riskInverted ?? false,
        answeredAt: new Date().toISOString(),
      };
      newAnswers.set(q.id, answer);
    }

    setAnswers(newAnswers);
    setCurrentSectionAnswers(new Map());

    if (step < 8) {
      setStep(step + 1);
    } else {
      void handleSubmit(newAnswers);
    }
  }

  const handleSubmit = useCallback(
    async (finalAnswers: Map<string, Answer>) => {
      if (!consent) return;
      setSubmitting(true);
      setStep(9);
      setError(null);

      try {
        const body = {
          consent,
          orgContext,
          answers: Array.from(finalAnswers.values()),
          locale,
          turnstileToken,
        };

        const res = await fetch('/api/icra/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Submission failed (${res.status})`);
        }

        const data = (await res.json()) as { assessmentId: string };
        // Successful submission — clear any in-flight draft.
        try {
          if (typeof window !== 'undefined') window.sessionStorage.removeItem(PERSIST_KEY);
        } catch {
          // ignore
        }
        emitTelemetry('assessment_submitted', undefined, { answered: finalAnswers.size });
        router.push(`/${locale}/continuity-assessment/results/${data.assessmentId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.submissionFailed);
        setSubmitting(false);
        setStep(8);
      }
    },
    [consent, copy.submissionFailed, locale, orgContext, router, turnstileToken],
  );

  // Progress: 0=0%, 1=10%, 2-8=20-90%, 9=100%
  const progressPercent = step === 0 ? 0 : step === 1 ? 10 : step === 9 ? 100 : 10 + (step - 1) * 12.85;

  if (step === 0) {
    return <ConsentGate onConsent={handleConsent} doctrineVersion={DOCTRINE_VERSION} locale={locale} />;
  }

  if (step === 1) {
    return <OrgContextForm questions={METADATA_QUESTIONS} onSubmit={handleOrgContext} copy={copy} />;
  }

  if (step === 9 || submitting) {
    return (
      <div className="mx-auto max-w-xl py-24 text-center space-y-4">
        <div className="text-stone-400 text-4xl">⟳</div>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
          {copy.generatingTitle}
        </h2>
        <p className="text-stone-500 text-sm">{copy.generatingBody}</p>
        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!currentSectionDef || currentQuestions.length === 0) return null;

  const sectionIndex = step - 2;
  const answeredInSection = currentQuestions.filter((q) => currentSectionAnswers.has(q.id)).length;
  const sectionComplete = answeredInSection === currentQuestions.length;

  return (
    <div className="mx-auto max-w-3xl py-8 space-y-8">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-stone-500">
          <span>
          <span>{copy.section} {sectionIndex + 1} {copy.of} {SCORED_SECTIONS.length} — {currentSectionDef.title}</span>
          <span aria-live="polite" aria-atomic="true">{Math.round(progressPercent)}% {copy.complete}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-stone-200">
          <div
            className="h-1.5 rounded-full bg-stone-800 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Section header */}
      <div className="space-y-2 border-b border-stone-200 pb-6">
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">{currentSectionDef.title}</h2>
        {currentSectionDef.intro && (
          <p className="text-stone-600 text-sm leading-relaxed">{currentSectionDef.intro}</p>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-10">
        {currentQuestions
          .sort((a, b) => a.order - b.order)
          .map((q) => {
            const selected = currentSectionAnswers.get(q.id);

            if (q.type === 'likert_5') {
              const { min, max, minLabel, maxLabel } = q.scale;
              const values: number[] = [];
              for (let v = min; v <= max; v += 1) values.push(v);
              const stringValues = values.map(String);
              const selectedIndex = stringValues.indexOf(selected ?? '');
              const labelId = `${q.id}-label`;
              return (
                <div key={q.id} className="space-y-3">
                  <div className="space-y-1">
                    <p id={labelId} className="text-sm font-medium text-stone-900 leading-snug">{q.prompt}</p>
                    {q.helpText && (
                      <p className="text-xs text-stone-500 leading-relaxed">{q.helpText}</p>
                    )}
                  </div>
                  <div
                    role="radiogroup"
                    aria-labelledby={labelId}
                    className="flex items-stretch gap-2"
                  >
                    {values.map((v, idx) => {
                      const isSelected = selected === String(v);
                      const isTabStop = selectedIndex === -1 ? idx === 0 : isSelected;
                      return (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          tabIndex={isTabStop ? 0 : -1}
                          onClick={() => handleOptionSelect(q.id, String(v))}
                          onKeyDown={(e) => handleRadioKeyDown(e, q.id, stringValues, idx)}
                          className={`flex-1 rounded-md border px-3 py-3 text-center text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-600 focus-visible:ring-offset-1 ${
                            isSelected
                              ? 'border-stone-800 bg-stone-900 text-white'
                              : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50'
                          }`}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-stone-500">
                    <span>{minLabel}</span>
                    <span className="text-right">{maxLabel}</span>
                  </div>
                </div>
              );
            }

            if (!('options' in q)) return null;
            const optionValues = q.options.map((o) => o.value);
            const selectedIdx = optionValues.indexOf(selected ?? '');
            const labelId = `${q.id}-label`;
            return (
              <div key={q.id} className="space-y-3">
                <div className="space-y-1">
                  <p id={labelId} className="text-sm font-medium text-stone-900 leading-snug">{q.prompt}</p>
                  {q.helpText && (
                    <p className="text-xs text-stone-500 leading-relaxed">{q.helpText}</p>
                  )}
                </div>
                <div role="radiogroup" aria-labelledby={labelId} className="space-y-2">
                  {q.options.map((opt, idx) => {
                    const isSelected = selected === opt.value;
                    const isTabStop = selectedIdx === -1 ? idx === 0 : isSelected;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={isTabStop ? 0 : -1}
                        onClick={() => handleOptionSelect(q.id, opt.value)}
                        onKeyDown={(e) => handleRadioKeyDown(e, q.id, optionValues, idx)}
                        className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-600 focus-visible:ring-offset-1 ${
                          isSelected
                            ? 'border-stone-800 bg-stone-900 text-white'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-stone-200 pt-6">
        <button
          onClick={handleSectionBack}
          disabled={step <= 2}
          className="text-sm text-stone-500 hover:text-stone-800 disabled:opacity-30"
        >
          {copy.previous}
        </button>
        <button
          onClick={handleSectionNext}
          disabled={!sectionComplete}
          className="inline-flex items-center justify-center rounded-md bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {step < 8 ? copy.next : copy.submit}
        </button>
      </div>

      {!sectionComplete && (
        <p className="text-center text-xs text-stone-400">
          {currentQuestions.length - answeredInSection}{' '}
          {currentQuestions.length - answeredInSection === 1 ? copy.remainingSingular : copy.remainingPlural}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Org context form
// ─────────────────────────────────────────────────────────────────────────────

interface OrgContextFormProps {
  questions: MetadataQuestion[];
  onSubmit: (ctx: OrgContextAnswers) => void;
  copy: typeof FLOW_COPY['en-CA'];
}

function OrgContextForm({ questions, onSubmit, copy }: OrgContextFormProps) {
  const [values, setValues] = useState<OrgContextAnswers>({});

  const requiredIds = questions.filter((q) => q.required).map((q) => q.id);
  const allRequiredAnswered = requiredIds.every((id) => values[id]?.trim());

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-10">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">{copy.orgTitle}</h2>
        <p className="text-sm text-stone-600 leading-relaxed">
          {copy.orgBody}
        </p>
      </div>

      <div className="space-y-6">
        {questions.sort((a, b) => a.order - b.order).map((q) => (
          <div key={q.id} className="space-y-1.5">
            <label className="block text-sm font-medium text-stone-900">
              {q.prompt}
              {q.required && <span className="ml-1 text-stone-400">*</span>}
            </label>
            {q.helpText && <p className="text-xs text-stone-500">{q.helpText}</p>}

            {q.type === 'select' && q.options ? (
              <select
                value={values[q.id] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [q.id]: e.target.value }))}
                className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-600"
              >
                <option value="">{copy.selectPlaceholder}</option>
                {(() => {
                  const hasGroups = q.options.some((o) => Boolean(o.group));
                  if (!hasGroups) {
                    return q.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ));
                  }
                  // Preserve option order while grouping by `group`.
                  const groupsInOrder: string[] = [];
                  const byGroup = new Map<string, typeof q.options>();
                  for (const o of q.options) {
                    const g = o.group ?? 'Other';
                    if (!byGroup.has(g)) {
                      groupsInOrder.push(g);
                      byGroup.set(g, []);
                    }
                    byGroup.get(g)!.push(o);
                  }
                  return groupsInOrder.map((g) => (
                    <optgroup key={g} label={g}>
                      {(byGroup.get(g) ?? []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                  ));
                })()}
              </select>
            ) : (
              <div className="space-y-1">
                <textarea
                  value={values[q.id] ?? ''}
                  onChange={(e) => {
                    const next = e.target.value.slice(0, CTX_PRIMARY_CHALLENGE_MAX_LENGTH);
                    setValues((prev) => ({ ...prev, [q.id]: next }));
                  }}
                  rows={3}
                  maxLength={CTX_PRIMARY_CHALLENGE_MAX_LENGTH}
                  placeholder={copy.optionalPlaceholder}
                  className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-600 resize-none"
                />
                <p className="text-right text-[11px] text-stone-400 tabular-nums">
                  {(values[q.id] ?? '').length} / {CTX_PRIMARY_CHALLENGE_MAX_LENGTH}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => onSubmit(values)}
        disabled={!allRequiredAnswered}
        className="inline-flex items-center justify-center rounded-md bg-stone-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {copy.begin}
      </button>
    </div>
  );
}
