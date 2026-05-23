/**
 * Institutional Storytelling
 *
 * Higher-order narrative composition layered on top of `organizational-narratives`.
 * Where `narratives` projects a single envelope into a calm narrative, this
 * module composes MULTI-ENVELOPE longitudinal stories: governance evolution,
 * resilience progression, continuity maturity, organizational adaptation.
 *
 * Pure functions. No new cognition. No LLM. Deterministic.
 *
 * Forbidden: workforce framing, individual descriptions, optimization or
 * surveillance vocabulary. All output goes through the canonical
 * `detectForbiddenVocabulary` check before being returned.
 */

import {
  detectForbiddenVocabulary,
  taxonomyForDomain,
  type CognitionDomain,
  type InstitutionalExplainabilityEnvelope,
  type SemanticTaxonomyNode,
} from '@nzila/institutional-cognition-core';

import {
  composeExecutiveBriefing,
  narrateEnvelopes,
  type InstitutionalNarrative,
} from '../organizational-narratives/index';

/* -------------------------------------------------------------------------- */
/* Story shapes                                                                */
/* -------------------------------------------------------------------------- */

export const STORY_VERSION = '1.0.0' as const;

export interface InstitutionalStoryChapter {
  /** Stable id used for animation / playback ordering. */
  readonly id: string;
  /** Human-friendly chapter heading. */
  readonly heading: string;
  /** 1–2 sentence chapter body. */
  readonly body: string;
  /** Linked taxonomy nodes (for graph navigation surfaces). */
  readonly anchors: readonly { id: string; label: string }[];
  /** ISO timestamp the chapter is anchored to (envelope provenance). */
  readonly anchoredAt: string;
  /** Confidence band of the underlying envelope. */
  readonly confidence: string;
}

export interface InstitutionalStory {
  readonly storyVersion: typeof STORY_VERSION;
  readonly title: string;
  readonly subtitle: string;
  readonly domain: CognitionDomain;
  /** Chronologically ordered chapters. */
  readonly chapters: readonly InstitutionalStoryChapter[];
  /** Top review signals from the underlying envelopes. */
  readonly reviewSignals: readonly string[];
  /** Optional 1-paragraph executive summary. */
  readonly executiveSummary: string;
}

export interface InstitutionalStorybook {
  readonly storyVersion: typeof STORY_VERSION;
  readonly organizationId: string;
  readonly composedAt: string;
  readonly stories: readonly InstitutionalStory[];
  /** A unified executive briefing across all composed stories. */
  readonly briefing: ReturnType<typeof composeExecutiveBriefing>;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const DOMAIN_TITLES: Readonly<Record<CognitionDomain, { title: string; subtitle: string }>> = {
  governance: {
    title: 'Governance Evolution',
    subtitle: 'How institutional governance has matured over the reviewed period.',
  },
  continuity: {
    title: 'Continuity Maturity',
    subtitle: 'Trajectory of institutional continuity posture.',
  },
  resilience: {
    title: 'Resilience Progression',
    subtitle: 'How resilience baselines have shifted across reviewed cycles.',
  },
  procedural_intelligence: {
    title: 'Procedural Continuity',
    subtitle: 'Persistence of institutional procedure through change.',
  },
  operational_trust: {
    title: 'Operational Trust',
    subtitle: 'Confidence that institutional procedures execute as authored.',
  },
  institutional_memory: {
    title: 'Institutional Memory',
    subtitle: 'What the institution has retained, captured, and surfaced.',
  },
  coordination: {
    title: 'Coordination Coherence',
    subtitle: 'Cross-actor alignment across governed institutional work.',
  },
  adaptation: {
    title: 'Institutional Adaptation',
    subtitle: 'Durable shifts derived from reviewed institutional experience.',
  },
  precedent: {
    title: 'Institutional Precedent',
    subtitle: 'Memory captures elevated to reusable governance reference.',
  },
  systems_coherence: {
    title: 'Systems Coherence',
    subtitle: 'Integrated alignment across cognition domains.',
  },
};

function anchorsForDomain(domain: CognitionDomain): SemanticTaxonomyNode[] {
  return taxonomyForDomain(domain).filter((n) => !n.parentId);
}

function chapterFromNarrative(
  narrative: InstitutionalNarrative,
  envelope: InstitutionalExplainabilityEnvelope<unknown>,
): InstitutionalStoryChapter {
  const anchors = anchorsForDomain(envelope.domain).map((n) => ({ id: n.id, label: n.label }));
  return {
    id: `${narrative.engine}-${envelope.provenance.generatedAt}`,
    heading: narrative.headline,
    body: narrative.summary,
    anchors,
    anchoredAt: envelope.provenance.generatedAt,
    confidence: envelope.confidence,
  };
}

function buildExecutiveSummary(
  story: Omit<InstitutionalStory, 'executiveSummary'>,
): string {
  const total = story.chapters.length;
  if (total === 0) return 'No chapters available for this domain in the current period.';
  const reviewCount = story.reviewSignals.length;
  const last = story.chapters[total - 1]!;
  const first = story.chapters[0]!;
  const periodNote =
    first.anchoredAt === last.anchoredAt
      ? `Anchored at ${first.anchoredAt}.`
      : `Spans ${first.anchoredAt} → ${last.anchoredAt}.`;
  const reviewNote =
    reviewCount > 0
      ? ` ${reviewCount} review signal${reviewCount === 1 ? '' : 's'} surfaced for human governance.`
      : ' No review signals were surfaced in this period.';
  return `${total} chapter${total === 1 ? '' : 's'} composed for ${story.title.toLowerCase()}. ${periodNote}${reviewNote}`;
}

/* -------------------------------------------------------------------------- */
/* Composition                                                                 */
/* -------------------------------------------------------------------------- */

export interface StorybookInput {
  readonly organizationId: string;
  readonly envelopes: ReadonlyArray<InstitutionalExplainabilityEnvelope<unknown>>;
}

/**
 * Compose a domain-grouped institutional storybook from a flat set of
 * envelopes (typically produced by an orchestration pass).
 *
 * Throws if any chapter body would contain forbidden labor/surveillance
 * vocabulary — a hard contract for downstream UI safety.
 */
export function composeInstitutionalStorybook(
  input: StorybookInput,
): InstitutionalStorybook {
  // Project envelopes → narratives via the existing canonical layer.
  const narrationResult = narrateEnvelopes(input.envelopes);
  const narrativesByEngine = narrationResult.narratives;

  // Group envelopes by domain.
  const envelopesByDomain = new Map<CognitionDomain, InstitutionalExplainabilityEnvelope<unknown>[]>();
  for (const env of input.envelopes) {
    const list = envelopesByDomain.get(env.domain) ?? [];
    list.push(env);
    envelopesByDomain.set(env.domain, list);
  }

  const stories: InstitutionalStory[] = [];

  for (const [domain, envelopes] of envelopesByDomain) {
    const sorted = envelopes
      .slice()
      .sort((a, b) => a.provenance.generatedAt.localeCompare(b.provenance.generatedAt));

    const chapters: InstitutionalStoryChapter[] = [];
    const reviewSignals = new Set<string>();

    for (const env of sorted) {
      const narrative = narrativesByEngine[env.provenance.engine];
      if (!narrative) continue;
      chapters.push(chapterFromNarrative(narrative, env));
      for (const sig of narrative.reviewSignals) reviewSignals.add(sig);
    }

    const titleInfo = DOMAIN_TITLES[domain];
    const partial: Omit<InstitutionalStory, 'executiveSummary'> = {
      storyVersion: STORY_VERSION,
      title: titleInfo.title,
      subtitle: titleInfo.subtitle,
      domain,
      chapters,
      reviewSignals: [...reviewSignals].slice(0, 8),
    };

    const executiveSummary = buildExecutiveSummary(partial);
    stories.push({ ...partial, executiveSummary });
  }

  // Stable order: governance, continuity, resilience first; then alphabetical.
  const PRIORITY_ORDER: CognitionDomain[] = [
    'governance',
    'continuity',
    'resilience',
    'systems_coherence',
    'procedural_intelligence',
    'operational_trust',
    'institutional_memory',
    'precedent',
    'coordination',
    'adaptation',
  ];
  stories.sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.domain) - PRIORITY_ORDER.indexOf(b.domain),
  );

  // Single-pass forbidden-vocabulary safety net over composed text.
  const composedText = stories
    .flatMap((s) => [
      s.title,
      s.subtitle,
      s.executiveSummary,
      ...s.chapters.flatMap((c) => [c.heading, c.body]),
      ...s.reviewSignals,
    ])
    .join('\n');
  const issues = detectForbiddenVocabulary(composedText, 'composeInstitutionalStorybook');
  if (issues.length > 0) {
    throw new Error(
      `composeInstitutionalStorybook: forbidden vocabulary detected — ${issues.map((i) => i.message).join('; ')}`,
    );
  }

  const briefing = composeExecutiveBriefing(Object.values(narrativesByEngine));

  return {
    storyVersion: STORY_VERSION,
    organizationId: input.organizationId,
    composedAt: new Date().toISOString(),
    stories,
    briefing,
  };
}

/* -------------------------------------------------------------------------- */
/* Public surface                                                              */
/* -------------------------------------------------------------------------- */

export type { InstitutionalNarrative } from '../organizational-narratives/index';
