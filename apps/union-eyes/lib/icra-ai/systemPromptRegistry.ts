/**
 * systemPromptRegistry
 * ────────────────────
 * Canonical, version-locked, guardrail-stamped system prompts for every
 * NarrativeArtifactKind. The registry refuses to surface any entry that has
 * not been stamped by `promptGuardrails.stampGuardrail`.
 *
 * Doctrine: docs/oci/ai/OCRA_AI_BOUNDARY_MODEL.md
 */

import type {
  PromptInvocation,
  RegisteredPrompt,
} from './promptContracts';
import { hasGuardrail, stampGuardrail } from './promptGuardrails';
import type {
  NarrativeArtifactKind,
  NarrativeContext,
} from './narrativePromptContracts';

const RAW_PROMPTS: ReadonlyArray<Omit<RegisteredPrompt, 'systemPrompt'> & { body: string }> = [
  {
    artifactKind: 'ExecutiveSummary',
    promptId: 'executive-summary',
    version: '1.0.0',
    body: `Draft a calm, institutional executive summary of the continuity findings.
Synthesize the maturity bands, archetypes, and breakpoints into a short
narrative (3–5 paragraphs) that an executive can read in under three
minutes. Reference signal identifiers in parentheses where helpful. Do
not score or rank. Preserve institutional dignity.`,
  },
  {
    artifactKind: 'ContinuityNarrative',
    promptId: 'continuity-narrative',
    version: '1.0.0',
    body: `Articulate the institution's continuity narrative using the supplied
structural and confidence signals. Stay descriptive, not prescriptive.`,
  },
  {
    artifactKind: 'OperationalObservation',
    promptId: 'operational-observation',
    version: '1.0.0',
    body: `Summarize operational fragility observations calmly. Avoid alarmist
framing. Reference deterministic findings by identifier.`,
  },
  {
    artifactKind: 'GovernanceReflection',
    promptId: 'governance-reflection',
    version: '1.0.0',
    body: `Reflect on governance continuity observations. No legal conclusions.
No HR diagnostics.`,
  },
  {
    artifactKind: 'StewardshipObservation',
    promptId: 'stewardship-observation',
    version: '1.0.0',
    body: `Observe stewardship signals. Roles and responsibilities only — never
characterise named individuals.`,
  },
  {
    artifactKind: 'ContinuityTransitionNarrative',
    promptId: 'continuity-transition-narrative',
    version: '1.0.0',
    body: `Narrate the continuity transition implied by the breakpoint signals.
Stay calm; transition is normal.`,
  },
  {
    artifactKind: 'ModernizationAlignmentNarrative',
    promptId: 'modernization-alignment-narrative',
    version: '1.0.0',
    body: `Articulate modernization alignment opportunities suggested by the
maturity bands and adaptive context. Frame as opportunities, not deficits.`,
  },
  {
    artifactKind: 'BoardBriefNarrative',
    promptId: 'board-brief-narrative',
    version: '1.0.0',
    body: `Draft a board-level brief. Short, structured, no jargon. Acknowledge
uncertainty using moderated language.`,
  },
  {
    artifactKind: 'FacilitatorSummary',
    promptId: 'facilitator-summary',
    version: '1.0.0',
    body: `Summarize the workshop themes implied by the structured signals.
Group repeated operational patterns. Propose 2–3 follow-up facilitation
questions the facilitator may consider. Do not determine truth.`,
  },
];

const REGISTRY: ReadonlyMap<NarrativeArtifactKind, RegisteredPrompt> = new Map(
  RAW_PROMPTS.map((p) => {
    const systemPrompt = stampGuardrail(p.body.trim());
    if (!hasGuardrail(systemPrompt)) {
      throw new Error(
        `[ai/systemPromptRegistry] prompt ${p.promptId} failed to stamp guardrail`,
      );
    }
    return [
      p.artifactKind,
      {
        artifactKind: p.artifactKind,
        promptId: p.promptId,
        version: p.version,
        systemPrompt,
      },
    ];
  }),
);

export function getRegisteredPrompt(
  kind: NarrativeArtifactKind,
): RegisteredPrompt {
  const entry = REGISTRY.get(kind);
  if (!entry) {
    throw new Error(`[ai/systemPromptRegistry] no prompt registered for ${kind}`);
  }
  return entry;
}

export function listRegisteredPrompts(): ReadonlyArray<RegisteredPrompt> {
  return Array.from(REGISTRY.values());
}

/**
 * Build the user-side prompt payload. We serialize NarrativeContext as JSON
 * so the model receives a structured input, and never receives any free-text
 * forbidden field (the type system + buildNarrativeContext have already
 * verified that).
 */
export function buildPromptInvocation(
  context: NarrativeContext,
): PromptInvocation {
  const entry = getRegisteredPrompt(context.artifactKind);
  const userPrompt = [
    `Locale: ${context.locale}`,
    `Artifact: ${context.artifactKind}`,
    `Synthesis engine version: ${context.synthesisEngineVersion}`,
    `Prompt registry version: ${context.promptRegistryVersion}`,
    '',
    'Structured continuity signals:',
    JSON.stringify(
      {
        maturityBands: context.maturityBands,
        adaptiveContext: context.adaptiveContext,
        archetypes: context.archetypes,
        breakpoints: context.breakpoints,
        confidence: context.confidence,
        structuralSignals: context.structuralSignals,
        onboardingFindings: context.onboardingFindings,
        governanceObservations: context.governanceObservations,
        ...(context.reviewerSteer
          ? { reviewerSteer: context.reviewerSteer }
          : {}),
      },
      null,
      2,
    ),
  ].join('\n');

  return {
    artifactKind: context.artifactKind,
    promptId: entry.promptId,
    promptVersion: entry.version,
    systemPrompt: entry.systemPrompt,
    userPrompt,
  };
}
