/**
 * ARTIFACT TYPE: Narrative Engine
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Commercial
 *
 * Executive Continuity Brief — Report Narrative Engine
 *
 * The heart of the PDF system.
 *
 * This engine synthesizes institutional prose from dimension scores, signals,
 * burden index, and persona context. Output must feel authored, not assembled.
 *
 * Principles:
 * - No LLM. Fully deterministic. Every paragraph traces to scores.
 * - Prose varies genuinely because institutional situations differ genuinely.
 * - Tone: calm, observational, institutionally serious. Never alarming.
 * - Language: OCI doctrine vocabulary. No tech-company, no consulting boilerplate.
 * - Persona adaptation: subtle word-level, not structural. Doctrine is consistent.
 */

import type {
  ContinuityBurdenIndex,
  ContinuityInsight,
  ContinuitySignal,
  DimensionId,
  DimensionScore,
  ExecutivePersonaId,
  MaturityBand,
  MaturityBandId,
  StewardshipSignal,
} from '../icra/types';

// ─────────────────────────────────────────────────────────────────────────────
// Score helpers
// ─────────────────────────────────────────────────────────────────────────────

function dim(scores: DimensionScore[], id: DimensionId): number {
  return scores.find((d) => d.dimension === id)?.score ?? 50;
}

type Band = 1 | 2 | 3 | 4 | 5;

function scoreBand(score: number): Band {
  if (score < 30) return 1;
  if (score < 50) return 2;
  if (score < 65) return 3;
  if (score < 80) return 4;
  return 5;
}

/** Pick from a pool deterministically using a score as index seed */
function pick<T>(pool: T[], seed: number): T {
  return pool[Math.abs(Math.floor(seed)) % pool.length];
}

/** Observed-signal label list (only observed ones) */
function observedSignals(signals: ContinuitySignal[]): string[] {
  return signals.filter((s) => s.observed).map((s) => s.label);
}

// ─────────────────────────────────────────────────────────────────────────────
// Persona vocabulary adaptation
// ─────────────────────────────────────────────────────────────────────────────

const PERSONA_INSTITUTION: Record<ExecutivePersonaId | '__default', string> = {
  union_leadership: 'local',
  healthcare_ops: 'organization',
  governance_board: 'organization',
  federated_org: 'federation',
  executive_director: 'organization',
  cio_coo: 'organization',
  __default: 'institution',
};

const PERSONA_LEADERSHIP: Record<ExecutivePersonaId | '__default', string> = {
  union_leadership: 'officer body',
  healthcare_ops: 'leadership team',
  governance_board: 'board',
  federated_org: 'national leadership',
  executive_director: 'leadership',
  cio_coo: 'executive team',
  __default: 'leadership',
};

const PERSONA_CONTINUITY_HOLDER: Record<ExecutivePersonaId | '__default', string> = {
  union_leadership: 'stewards, officers, and grievance coordinators',
  healthcare_ops: 'care coordinators, unit leads, and clinical administrators',
  governance_board: 'committee chairs, executive directors, and governance administrators',
  federated_org: 'local representatives, regional coordinators, and national officers',
  executive_director: 'coordinators, program leads, and administrative staff',
  cio_coo: 'technical leads, system administrators, and operations coordinators',
  __default: 'coordinators, administrators, and operational stewards',
};

function institution(p?: ExecutivePersonaId): string {
  return PERSONA_INSTITUTION[p ?? '__default'];
}

function leadership(p?: ExecutivePersonaId): string {
  return PERSONA_LEADERSHIP[p ?? '__default'];
}

function continuityHolders(p?: ExecutivePersonaId): string {
  return PERSONA_CONTINUITY_HOLDER[p ?? '__default'];
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 1 — Executive Summary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates the executive summary: 3–4 paragraphs that frame the assessment,
 * synthesize the continuity posture, surface the primary tension, and orient
 * the reader toward what this brief contains.
 */
export function generateExecutiveSummary(
  band: MaturityBand,
  composite: number,
  dimensions: DimensionScore[],
  insights: ContinuityInsight[],
  burden?: ContinuityBurdenIndex,
  persona?: ExecutivePersonaId,
): string[] {
  const inst = institution(persona);
  const lead = leadership(persona);
  const holders = continuityHolders(persona);
  const icScore = dim(dimensions, 'institutional_continuity');
  const opMemScore = dim(dimensions, 'operational_memory');
  const govFragScore = dim(dimensions, 'governance_fragility');
  const trScore = dim(dimensions, 'transition_readiness');

  const bandId = band.id as MaturityBandId;
  const burdenScore = burden?.score ?? 50;

  // ── Paragraph 1: Opening framing ──────────────────────────────────────────

  const openings: Record<MaturityBandId, string> = {
    personality_dependent: `Much of what keeps this ${inst} running lives in the working memory of a small number of people. The procedural history, the relational context, the reasoning behind current practice — these things are largely carried, not stored. That is not a failing. It is a pattern that develops quietly in every institution that has grown faster than its documentation.`,

    fragmented_coordination: `This is an ${inst} in transition. Practices are documented in parts. Teams maintain their own procedures. Coordination works — and yet the institution does not yet function as a single, coherent continuity entity. What each team knows well, the institution as a whole holds imperfectly. The picture that reaches governance bodies is reconstructed from fragments rather than drawn from a shared institutional record.`,

    structured_governance: `Meaningful investment in governance structure is visible throughout this profile. Processes exist. Roles are defined. Decision records are maintained, and onboarding follows a documented path. That is a real accomplishment — one that many institutions underestimate. The pattern this brief surfaces is the next one: structured governance and embedded continuity intelligence are not the same thing, and the distance between them is usually wider than it appears.`,

    continuity_aware: `Continuity is treated here as a governance discipline. Operational knowledge is systematically captured, succession planning is active, and transitions are structured rather than improvised. The ${lead} of this ${inst} has made deliberate investments in continuity infrastructure, and those investments are visible in this profile. The question for institutions at this level is not whether continuity exists, but how deeply it has been embedded and how it holds under stress.`,

    continuity_intelligence: `Continuity here has moved from policy into practice, and from structure into culture. The ${inst} maintains operational coherence across transitions. Institutional memory is accessible, evidenced, and actively maintained. This briefing treats that posture with the seriousness it deserves and identifies the remaining gaps in the same spirit — because at this level, the gaps are subtle, and the consequences of missing them are disproportionate.`,
  };

  const p1 = openings[bandId];

  // ── Paragraph 2: Continuity posture synthesis ─────────────────────────────

  const continuityScore = dim(dimensions, 'institutional_continuity');
  const compositeLabel = composite < 35 ? 'early-stage' : composite < 55 ? 'developing' : composite < 70 ? 'structured' : 'mature';

  const p2_high_burden = `The Composite Continuity Indicator for this assessment is ${composite} out of 100 — a ${compositeLabel} posture carrying a Continuity Burden Index of ${burdenScore}. A ${burdenScore >= 65 ? 'substantial' : 'meaningful'} portion of what keeps this ${inst} operational depends on informal human effort rather than embedded institutional systems. ${governance(govFragScore, inst)} The continuity posture is not fragile because of any single failure. It is ${burdenScore >= 65 ? 'concentrated in people in ways that create meaningful transition risk' : 'partially dependent on individual compensation in areas that merit structured attention'}.`;

  const p2_low_burden = `Composite Continuity Indicator: ${composite} out of 100. A ${compositeLabel} posture, with a Continuity Burden Index of ${burdenScore} — ${burdenScore < 30 ? 'a well-distributed' : 'a reasonably distributed'} continuity load across the ${inst}'s operational infrastructure. ${governance(govFragScore, inst)} ${icScore >= 65 ? `Institutional continuity is a relative strength here, with operational knowledge demonstrably embedded beyond individual holders.` : `While individual dimensions reflect areas for development, the overall continuity architecture is more resilient than the composite score alone suggests.`}`;

  const p2 = burdenScore >= 45 ? p2_high_burden : p2_low_burden;

  // ── Paragraph 3: Primary tension ──────────────────────────────────────────

  const materialInsights = insights.filter((i) => i.severity === 'material');
  const notableInsights = insights.filter((i) => i.severity === 'notable');
  const topInsight = materialInsights[0] ?? notableInsights[0];

  let p3: string;

  if (topInsight) {
    const insightBody = topInsight.body;
    const insightCat = topInsight.category;
    const catContext: Record<string, string> = {
      modernization_continuity_gap: `This pattern — modernization posture outpacing continuity preservation — is one of the most consequential quiet risks in institutional management. It tends to become visible only during transitions, when the context required to interpret change is no longer available.`,
      invisible_labour: `This form of institutional dependency is often invisible to governance bodies precisely because it works. The people who carry it rarely describe it as a risk — they simply continue to carry it.`,
      governance_drift: `Governance drift of this nature accumulates over time. Individual decisions that seem reasonable in isolation, when viewed together, reveal an institution that has gradually distanced itself from its own documented commitments.`,
      reconstruction_burden: `Reconstruction burden is the cost of institutional forgetting. It is borne quietly by whoever must reconstruct context that should have been preserved, most often during leadership transitions and external reviews.`,
      institutional_forgetting: `Institutional forgetting is not an event — it is a process. Knowledge does not disappear suddenly; it recedes gradually as the people who hold it move on and the systems that should have captured it were never built.`,
    };

    p3 = `${insightBody} ${catContext[insightCat] ?? ''}`.trim();
  } else if (opMemScore < 45) {
    p3 = `Operational memory — the collective capacity of this ${inst} to access, reference, and apply its institutional history — appears to be an area requiring attention. When operational memory is distributed primarily through individuals, transitions become exercises in reconstruction rather than in handover. What should take days takes weeks. What should require documentation requires relationships. This is the pattern this assessment observes.`;
  } else if (trScore < 40) {
    p3 = `Transition readiness — the ${inst}'s capacity to absorb leadership change, role change, and operational change without disruption — is the area where this assessment identifies the most opportunity for development. Institutions that are otherwise well-structured often discover that their continuity infrastructure was not designed to survive transitions; it was designed for stability. Stability and resilience are not the same thing.`;
  } else {
    p3 = `The dimensions that most shape this ${inst}'s continuity posture are ${continuityScore < 55 ? 'institutional continuity, where the evidence base for operational knowledge requires development' : 'governance fragility, where inconsistencies in governance practice create quiet but meaningful continuity risk'}. These are not acute failures; they are patterns that, if addressed as governance disciplines rather than administrative tasks, can be substantially improved within a planning cycle.`;
  }

  // ── Paragraph 4: Brief orientation ───────────────────────────────────────

  const p4Variants = [
    `This Executive Continuity Brief provides a full dimensional analysis of the ${inst}'s continuity posture, including governance entropy patterns, institutional memory and dependency analysis, modernization risk considerations, and a structured set of recommendations organized by planning horizon. It is intended as a governance document — to be read, discussed, and acted upon by the ${lead}.`,
    `The brief organizes its findings across six dimensions of institutional continuity infrastructure, from governance coherence to operational memory, transition preparedness, and modernization risk. Each section draws directly from the data provided, interpreted through a continuity-native analytical framework built for institutions rather than for technology organizations. The ${lead} of this ${inst} may find it useful as a structured basis for a continuity planning conversation.`,
    `The pages that follow present a full analysis: dimensional scores, governance patterns, memory and dependency analysis, modernization risk, and recommendations calibrated to this ${inst}'s specific situation. These findings are a starting point for governance dialogue, not a definitive verdict. Institutional continuity is a process, not a destination.`,
  ];

  const p4 = pick(p4Variants, composite + (opMemScore ?? 0));

  return [p1, p2, p3, p4];
}

function governance(govFragScore: number, inst: string): string {
  if (govFragScore < 35)
    return `Governance fragility is a material concern here. The consistency and coherence of governance practice across the ${inst} requires structured attention.`;
  if (govFragScore < 55)
    return `Governance practice varies noticeably across this ${inst} — a familiar pattern in institutions that have grown faster than their governance infrastructure.`;
  return `Governance practice in this ${inst} shows reasonable coherence — a foundation on which deeper continuity work can be built.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — Governance Entropy Analysis
// ─────────────────────────────────────────────────────────────────────────────

export function generateGovernanceEntropyAnalysis(
  dimensions: DimensionScore[],
  insights: ContinuityInsight[],
  signals: ContinuitySignal[],
  persona?: ExecutivePersonaId,
): string[] {
  const inst = institution(persona);
  const lead = leadership(persona);
  const govFragScore = dim(dimensions, 'governance_fragility');
  const icScore = dim(dimensions, 'institutional_continuity');
  const trustDebtScore = dim(dimensions, 'trust_debt');

  const govBand = scoreBand(govFragScore);
  const driftInsight = insights.find((i) => i.category === 'governance_drift');
  const observedSigs = observedSignals(signals);

  // ── Paragraph 1: Entropy framing ──────────────────────────────────────────

  const entropyFramings: Partial<Record<Band, string>> = {
    1: `Governance entropy in this ${inst} is operating at a material level. The analysis suggests a meaningful gap between what governance bodies understand to be institutional practice and what operational reality reflects. This gap is not typically the result of neglect — it develops when institutions grow faster than their governance infrastructure, when informal practice gradually diverges from documented procedure, and when the people who hold governance context are never formally asked to transfer it.`,
    2: `This assessment identifies governance entropy as an area requiring attention. Inconsistency in how governance is practised across this ${inst} — variation in how decisions are documented, how policies are applied, and how oversight is conducted — creates quiet risk that accumulates over time. Governance bodies operating from reconstructed or partial information cannot exercise the accountability they intend to.`,
    3: `Governance practice in this ${inst} is reasonably structured, with documented procedures and consistent practice in most areas. The entropy analysis identifies more subtle patterns: areas where documentation exists but is not consulted, where accountability structures are defined but not actively calibrated, and where governance bodies are informed but not yet evidence-driven.`,
    4: `Governance practice in this ${inst} is mature and structured. The entropy analysis identifies no systemic fragility. The patterns this section examines are refinements — the difference between a ${inst} that governs well and one that governs with institutional memory embedded in every governance interaction.`,
    5: `Governance practice in this ${inst} is a recognized strength. The entropy analysis identifies only marginal areas of refinement. The ${lead} of this ${inst} operates from consistent, evidenced, well-maintained governance infrastructure.`,
  };

  const p1 = entropyFramings[govBand] ?? entropyFramings[3]!;

  // ── Paragraph 2: Drift patterns ───────────────────────────────────────────

  const driftPatterns: Partial<Record<Band, string>> = {
    1: `Several patterns in this analysis suggest that institutional governance has drifted from its documented commitments. ${driftInsight ? driftInsight.body : 'Decision rationale is held informally rather than institutionally. Policy adherence is locally interpreted rather than centrally evidenced. Audit trails, where they exist, are reconstructed retrospectively rather than maintained as an ongoing governance practice.'} These are not isolated incidents — they are the structural characteristics of an ${inst} whose governance infrastructure has not kept pace with operational complexity.`,
    2: `The drift patterns identified in this assessment tend to cluster around information continuity: the reliability with which governance-relevant information is captured, maintained, and accessible to those who need it. Where ${icScore < 45 ? 'operational knowledge is fragmented' : 'coordination depends on relationships rather than systems'}, governance bodies are consistently working from less-than-complete information — not because anyone has withheld it, but because the infrastructure to collect and surface it reliably does not yet exist.`,
    3: `${trustDebtScore < 55 ? `Evidence and traceability — the ${inst}'s capacity to demonstrate the basis for its governance decisions — is the entropy dimension most worth developing at this level. Governance that is structured but not evidence-backed is vulnerable to contestation during transitions, audits, and reviews.` : `The drift patterns at this level are subtle. They tend to manifest in the gap between what governance policies say and what routine operational practice does — not out of non-compliance, but because documented procedure and lived practice gradually diverge when no formal reconciliation process exists.`}`,
    4: `At this level of governance maturity, entropy tends to operate at the margins: inconsistencies in how nuanced decisions are documented, variation in how governance bodies are supported with context, and the occasional gap between governance intent and operational translation. None of these represent systemic risk, but each represents an opportunity to move from governance compliance toward governance intelligence.`,
    5: `The governance posture of this ${inst} demonstrates institutional learning — practices that have been refined over time, documented, and embedded in operational reality. Remaining entropy is marginal and concentrated in specific areas that this brief's recommendations address.`,
  };

  const p2 = driftPatterns[govBand] ?? driftPatterns[3]!;

  // ── Paragraph 3: Operational implications ─────────────────────────────────

  const implications: Partial<Record<Band, string>> = {
    1: `The operational implications of governance fragility at this level are significant during transitions. When a long-tenured leader, officer, or administrator departs, the governance context they held — the decisions, the reasoning, the precedents, the relationships — does not transition with them through any formal mechanism. New leadership must reconstruct what should have been preserved. This reconstruction is expensive, slow, and imperfect.`,
    2: `When governance is fragmented, accountability is localized. Teams know their own practice; they do not always know the institutional practice. This creates meaningful risk in three situations: external review (auditors and regulators ask institutional questions, not team questions), leadership transition (incoming leaders inherit fragments, not a coherent picture), and strategic decision-making (the rationale for previous decisions is not reliably available to inform new ones).`,
    3: `The primary operational implication at this level is not fragility — it is optimization. A well-governed ${inst} that has not yet embedded institutional memory as a governance discipline will discover the cost of that gap during its next significant leadership transition. The knowledge exists. The infrastructure to preserve and transmit it is what requires investment.`,
    4: `For ${inst}s at this level, governance entropy is a refinement challenge, not a resilience challenge. The risk is not institutional disruption — it is the gradual accumulation of small inconsistencies that, if left unaddressed, eventually require deliberate effort to reconcile. Maintaining governance intelligence requires ongoing discipline, not just initial investment.`,
    5: `Operational governance in this ${inst} is a genuine asset. The entropy dimensions that remain are refinements that, when addressed, move the ${inst} from governance maturity to governance leadership — a distinction that is visible to external partners, regulators, and oversight bodies.`,
  };

  const p3 = implications[govBand] ?? implications[3]!;

  const paras = [p1, p2, p3];

  if (observedSigs.length > 0 && govBand <= 3) {
    paras.push(
      `Among the continuity signals observed in this assessment, the following are directly relevant to governance entropy: ${observedSigs.slice(0, 3).join('; ')}. These signals represent recognizable institutional patterns — not diagnoses, but observations that the ${lead} of this ${inst} may find useful to hold in context while reading the analysis that follows.`,
    );
  }

  return paras;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3 — Institutional Memory & Continuity Holders
// ─────────────────────────────────────────────────────────────────────────────

export function generateMemoryHoldersAnalysis(
  dimensions: DimensionScore[],
  signals: ContinuitySignal[],
  stewardshipSignals: StewardshipSignal[],
  burden?: ContinuityBurdenIndex,
  persona?: ExecutivePersonaId,
): string[] {
  const inst = institution(persona);
  const lead = leadership(persona);
  const holders = continuityHolders(persona);
  const opMemScore = dim(dimensions, 'operational_memory');
  const trScore = dim(dimensions, 'transition_readiness');
  const icScore = dim(dimensions, 'institutional_continuity');
  const burdenScore = burden?.score ?? 50;
  const elevatedSignals = stewardshipSignals.filter((s) => s.severity === 'elevated');
  const observedSigs = observedSignals(signals);

  const memBand = scoreBand(opMemScore);

  // ── Paragraph 1: Memory concentration ─────────────────────────────────────

  const concentrationFramings: Partial<Record<Band, string>> = {
    1: `Institutional memory in this ${inst} is concentrated in people. The coordinators, administrators, and leaders who have been here longest hold, in their working knowledge, the operational history, governance rationale, and relationship context that the ${inst} depends on. This is not negligence — it is the natural pattern of an ${inst} that has never had the resources, the time, or the urgency to systematically capture what its most experienced people carry. The risk is real, however: when one of those people leaves, a portion of that memory leaves with them.`,
    2: `Institutional memory in this ${inst} is partially embedded and partially personal. Teams maintain records within their domains, and some documentation exists at the institutional level. But the memory that matters most for governance continuity — the context behind past decisions, the rationale for current practices, the relationships that make coordination work — lives primarily in people rather than in the ${inst}'s shared infrastructure.`,
    3: `Institutional memory in this ${inst} is reasonably embedded. Documentation exists, records are maintained, and the most critical institutional knowledge is accessible beyond its original holder. The pattern this section examines is subtler: the depth and quality of that embeddedness — whether institutional memory is truly accessible, truly current, and truly usable by someone encountering it for the first time.`,
    4: `Institutional memory in this ${inst} is a genuine strength. Knowledge is captured, maintained, and accessible. The analysis in this section focuses on the areas where that strength can be deepened — where embeddedness is structural rather than procedural, and where institutional memory functions as a living record rather than a static archive.`,
    5: `Institutional memory in this ${inst} is actively managed as a governance asset. Operational knowledge is captured as a matter of practice, not as an exceptional event, and the ${inst}'s capacity to orient new people, inform new decisions, and survive transitions depends on embedded systems rather than individual heroics.`,
  };

  const p1 = concentrationFramings[memBand] ?? concentrationFramings[3]!;

  // ── Paragraph 2: The soul layer — burden and dignity ─────────────────────

  let p2: string;

  if (burdenScore >= 65) {
    p2 = `Some of the most consequential work in an ${inst} is the work that never appears on an organizational chart. Translating institutional history for new colleagues. Contextualizing current decisions against past rationale. Holding relational coherence in place across personnel transitions. The people doing this work are, almost by definition, the most experienced and least replaceable members of the ${inst}. The Continuity Burden Index for this assessment is ${burdenScore}. That figure indicates the invisible labour is substantive, and that its current distribution concentrates transition risk in ways that warrant governance attention.`;
  } else if (burdenScore >= 40) {
    p2 = `Operational memory here is held partly by embedded systems and partly by individuals. The Continuity Burden Index of ${burdenScore} reflects that division. Under stability, the pattern is manageable. Under simultaneous transitions, it creates meaningful pressure. The ${lead} of this ${inst} carries some awareness of this dynamic. Whether it has been formally named, documented, and addressed as a governance discipline is what this section examines.`;
  } else {
    p2 = `The Continuity Burden Index of ${burdenScore} reflects meaningful investment in distributed continuity infrastructure. Operational memory here is carried more by embedded systems and documented practice than by individual compensation. That is an accomplishment worth naming. It represents deliberate governance investment in institutional resilience, and it protects the ${holders} from bearing disproportionate continuity responsibility.`;
  }

  // ── Paragraph 3: Transition fragility ─────────────────────────────────────

  const trBand = scoreBand(trScore);

  const transitionAnalysis: Partial<Record<Band, string>> = {
    1: `Transition readiness — the ${inst}'s capacity to maintain operational coherence through role changes, leadership changes, and external reviews — is the dimension where this assessment identifies the most acute risk. A score of ${trScore} in transition readiness, combined with the memory concentration profile described above, indicates that a significant leadership or operational transition would require substantial reconstruction effort. What should be a structured handover becomes an emergency knowledge-recovery exercise.`,
    2: `Transition readiness at ${trScore} indicates an ${inst} that handles routine role changes through relational continuity but has limited structured infrastructure for absorbing larger transitions. The difference between a routine personnel change and a significant leadership transition is not just scale — it is that larger transitions require the transfer of governance context, strategic rationale, and institutional relationship history, none of which travels well through informal means.`,
    3: `Transition readiness at ${trScore} reflects a structured but not yet deeply resilient capacity. Standard role transitions are managed adequately. What this score does not yet indicate is an ${inst} whose transitions are governed by systematic knowledge transfer rather than by the goodwill and availability of incumbent personnel.`,
    4: `Transition readiness at ${trScore} is a genuine strength in this profile. The ${inst} has invested in the infrastructure required to absorb personnel change without operational disruption. The remaining dimension for development is depth: whether that readiness extends to executive-level transitions, to governance-level change, and to the situations where the people responsible for transition are themselves the ones transitioning.`,
    5: `Transition readiness at ${trScore} reflects an ${inst} that treats transitions as governed processes rather than operational emergencies. Knowledge transfer is structured, handover is documented, and new entrants are onboarded into institutional context rather than reconstructing it from scratch.`,
  };

  const p3 = transitionAnalysis[trBand] ?? transitionAnalysis[3]!;

  const paras = [p1, p2, p3];

  if (elevatedSignals.length > 0) {
    const sigLabels = elevatedSignals.map((s) => s.label).join('; ');
    paras.push(
      `The stewardship signals observed in this assessment include elevated indicators in: ${sigLabels}. These signals reflect the human dimension of continuity risk — not systems failures, but patterns in how institutional knowledge is distributed, how continuity labour is allocated, and how the ${inst}'s most experienced people are being asked to carry its operational coherence. These are governance questions, not operational ones.`,
    );
  }

  return paras;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 4 — Modernization & Continuity Review
// ─────────────────────────────────────────────────────────────────────────────

export function generateModernizationReview(
  dimensions: DimensionScore[],
  insights: ContinuityInsight[],
  persona?: ExecutivePersonaId,
): string[] {
  const inst = institution(persona);
  const lead = leadership(persona);
  const icScore = dim(dimensions, 'institutional_continuity');
  const opMemScore = dim(dimensions, 'operational_memory');
  const govFragScore = dim(dimensions, 'governance_fragility');
  const trustDebtScore = dim(dimensions, 'trust_debt');

  const modernizationInsight = insights.find(
    (i) => i.category === 'modernization_continuity_gap',
  );
  const modernizationBand = scoreBand(icScore);

  // ── Paragraph 1: Modernization posture ────────────────────────────────────

  const modernizationPostures: Partial<Record<Band, string>> = {
    1: `Modernization in this ${inst} is currently secondary to stabilization. Before any significant investment in new technology, workflow platforms, or digital infrastructure, this ${inst} would benefit from first embedding the continuity infrastructure — the operational memory, governance documentation, and knowledge management practices — that any modernization effort will depend on to succeed. Modernizing before capturing institutional context is one of the most common and most avoidable sources of institutional forgetting.`,
    2: `This ${inst} is at a modernization juncture that requires care. There is sufficient operational structure to support careful technology adoption, and there are operational pain points that technology could address. The risk at this level is that modernization investment outpaces continuity investment — that new tools are adopted before the institutional knowledge required to use them wisely has been captured and made accessible beyond its current holders.`,
    3: `Modernization posture in this ${inst} is reasonable but benefits from continuity-aware framing. Technology investments are most durable when they are made by institutions that understand their own operational context well enough to specify what they need, evaluate what they receive, and recover their institutional knowledge if a modernization effort does not proceed as expected. Continuity infrastructure is not a pre-requisite for modernization — it is a governance safeguard within it.`,
    4: `Modernization posture in this ${inst} is relatively mature. Technology and process investments are being made by an ${inst} with a reasonable evidence base for its own operational context. The continuity consideration at this level is not whether modernization is safe — it is whether the institutional context captured before, during, and after each significant technology transition is being actively preserved as a governance asset.`,
    5: `Modernization in this ${inst} is informed by institutional context. Technology investments are made with awareness of continuity implications, and the ${lead} of this ${inst} applies governance thinking to technology decisions rather than treating them as purely technical matters. The analysis in this section focuses on refining that posture further.`,
  };

  const p1 = modernizationPostures[modernizationBand] ?? modernizationPostures[3]!;

  // ── Paragraph 2: Continuity risk in modernization ─────────────────────────

  let p2: string;

  if (modernizationInsight) {
    p2 = `${modernizationInsight.body} The specific risk pattern this assessment observes is one where the operational and governance structures appear to be more developed than the institutional memory infrastructure that gives those structures meaning. Technology can amplify this gap: systems are adopted, workflows are changed, and the institutional context required to understand why the previous approach existed — and what it was protecting — is not preserved.`;
  } else if (opMemScore < 45) {
    p2 = `The most significant continuity risk in any modernization effort for this ${inst} is operational memory loss. When systems change — whether through technology adoption, process redesign, or workflow migration — the institutional knowledge embedded in the old system does not automatically transfer to the new one. What staff understood implicitly about how things worked, what governance had learned about what didn't work, what the operational history reveals about this ${inst}'s specific context — none of this is captured by the technology transition itself. It must be deliberately preserved.`;
  } else if (trustDebtScore < 50) {
    p2 = `Evidence and traceability — the ${inst}'s capacity to demonstrate the basis for its decisions and the integrity of its operational data — is the continuity consideration that most directly intersects with modernization. Technology investments that are made without an adequate evidence foundation may improve operational efficiency while simultaneously reducing governance accountability. Continuity-aware modernization requires that governance evidence be treated as a first-class output of any system transition, not as an afterthought.`;
  } else {
    p2 = `The continuity consideration most relevant to this ${inst}'s modernization profile is governance coherence across transitions. As systems, platforms, and workflows evolve, the governance rationale that informed previous technology decisions — what was tried, why certain approaches were chosen, what was learned — should be preserved and accessible to the ${lead} who will make the next round of technology decisions. Institutional technology history is a form of operational memory, and its loss is one of the more subtle forms of institutional forgetting.`;
  }

  // ── Paragraph 3: Continuity-safe path ─────────────────────────────────────

  const p3Variants = [
    `A continuity-aware approach to modernization begins with a governance posture, not a procurement plan. What institutional knowledge does this change depend on? What operational context must be preserved through it? What governance evidence is at risk of being lost, and how will it be protected? These are not technology questions. They are governance questions that happen to arise in a technology context, and the ${lead} of this ${inst} is best positioned to answer them.`,
    `Continuity-safe modernization is informed modernization. Tools are chosen by an ${inst} that understands its own context. Implementation pays deliberate attention to what must be preserved. Adoption is governed with the same accountability applied to any significant institutional decision. The Organizational Continuity Infrastructure framework does not oppose change; it asks that change be carried with institutional wisdom rather than operational urgency.`,
    `The most durable path here is to treat continuity infrastructure investment as a co-investment with any significant operational change. Not as a pre-condition. As a discipline that runs alongside the change itself: capturing what is being replaced, what is being learned, and what the ${inst} will need to know about this transition five years from now.`,
  ];

  const p3 = pick(p3Variants, icScore + opMemScore);

  return [p1, p2, p3];
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 5 — Recommendations
// ─────────────────────────────────────────────────────────────────────────────

export interface PdfRecommendation {
  horizon: 'immediate' | 'structural' | 'transformational';
  title: string;
  body: string;
}

export function generateRecommendations(
  band: MaturityBand,
  dimensions: DimensionScore[],
  burden?: ContinuityBurdenIndex,
  persona?: ExecutivePersonaId,
): PdfRecommendation[] {
  const inst = institution(persona);
  const lead = leadership(persona);
  const bandId = band.id as MaturityBandId;
  const icScore = dim(dimensions, 'institutional_continuity');
  const opMemScore = dim(dimensions, 'operational_memory');
  const govFragScore = dim(dimensions, 'governance_fragility');
  const trScore = dim(dimensions, 'transition_readiness');
  const burdenScore = burden?.score ?? 50;

  const immediate: PdfRecommendation[] = [];
  const structural: PdfRecommendation[] = [];
  const transformational: PdfRecommendation[] = [];

  // ── Immediate ─────────────────────────────────────────────────────────────

  if (bandId === 'personality_dependent' || opMemScore < 35) {
    immediate.push({
      horizon: 'immediate',
      title: 'Begin Institutional Memory Documentation',
      body: `Identify the three to five people in your ${inst} who carry the most operational memory and governance context. Begin a structured process — not a technology project, but a governance conversation — to capture the knowledge they hold: key decisions and their rationale, operational procedures not written elsewhere, relationship context critical to ongoing work. This need not be comprehensive to begin; it needs to begin.`,
    });
  }

  if (burdenScore >= 55) {
    immediate.push({
      horizon: 'immediate',
      title: 'Name the Continuity Burden',
      body: `The Continuity Burden Index for this assessment suggests that a meaningful portion of this ${inst}'s operational coherence depends on informal human effort. Naming this as a governance issue — bringing it to the ${lead} as a documented concern rather than a tacit understanding — is the first step toward redistributing it. Continuity burden that is unnamed cannot be managed.`,
    });
  }

  if (govFragScore < 45) {
    immediate.push({
      horizon: 'immediate',
      title: 'Establish a Governance Coherence Baseline',
      body: `Before investing in new governance processes, take stock of what currently exists: what policies are in place, how consistently they are applied, and where the most meaningful gaps between documented practice and operational reality are located. A structured governance coherence review — even a lightweight internal one — creates the foundation for every subsequent governance investment.`,
    });
  }

  if (immediate.length === 0) {
    immediate.push({
      horizon: 'immediate',
      title: 'Conduct a Continuity Assets Review',
      body: `Even institutions with mature continuity postures benefit from a periodic review of their continuity assets: what has been documented, what remains held informally, and where the transition fragility points are. A structured review of the dimensions identified in this assessment, conducted with the ${lead}, is the most direct path to identifying the 90-day priorities.`,
    });
  }

  // ── Structural ────────────────────────────────────────────────────────────

  if (trScore < 55) {
    structural.push({
      horizon: 'structural',
      title: 'Build Transition Infrastructure',
      body: `A structured transition protocol — covering role changes, leadership changes, and program changes — is the governance architecture that most directly addresses this ${inst}'s transition readiness gap. This infrastructure does not need to be elaborate; it needs to be consistent. Roles should have documented handover guides. Decisions should carry their rationale. Context should travel with the work, not only with the people.`,
    });
  }

  if (opMemScore < 60 || bandId === 'fragmented_coordination') {
    structural.push({
      horizon: 'structural',
      title: 'Develop an Operational Memory Architecture',
      body: `An operational memory architecture for this ${inst} would establish where institutional knowledge lives, how it is maintained, and how it is accessed. This is not a knowledge management software project — it is a governance decision about what this ${inst} chooses to remember. The architecture might be simple: a shared record of key decisions, a governance memory log, and a practice of capturing context alongside outcomes. Consistency matters more than comprehensiveness.`,
    });
  }

  if (govFragScore < 60) {
    structural.push({
      horizon: 'structural',
      title: 'Implement Governance Consistency Practices',
      body: `Governance consistency — the reliable application of policies, the systematic documentation of decisions, and the structured production of governance evidence — is the structural investment this assessment most strongly recommends. This is not about bureaucratic compliance; it is about ensuring that governance bodies operate from shared, reliable information rather than from fragmented reconstructions. Consistent governance is accountable governance.`,
    });
  }

  if (structural.length === 0) {
    structural.push({
      horizon: 'structural',
      title: 'Deepen Continuity Governance Integration',
      body: `For ${inst}s at this level, the structural opportunity is to move continuity from a management practice to a governance discipline. This means bringing continuity evidence to governance bodies not just for decisions about continuity, but as background context for all major governance decisions. It means treating operational memory as a board-level concern, not an operational one. And it means holding ${lead} accountable for continuity posture with the same rigour applied to financial and operational performance.`,
    });
  }

  // ── Transformational ──────────────────────────────────────────────────────

  const transformationalByBand: Record<MaturityBandId, PdfRecommendation> = {
    personality_dependent: {
      horizon: 'transformational',
      title: 'Build an Institutional Continuity Architecture',
      body: `The transformational pathway for this ${inst} is the deliberate construction of a continuity architecture — a set of systems, practices, and governance disciplines that embed institutional memory beyond its current individual holders. This is a multi-year commitment, and it begins with governance leadership deciding that continuity is an institutional value, not just an operational nice-to-have. Organizations that make this investment emerge from it with governance resilience that protects them through every subsequent transition.`,
    },
    fragmented_coordination: {
      horizon: 'transformational',
      title: 'Develop an Institutional Continuity Map',
      body: `The transformational opportunity for this ${inst} is an institutional continuity map: a structured, governance-maintained record of where institutional memory lives, how operational knowledge flows, and where continuity concentration creates fragility. This map — built through a facilitated process with the ${lead} and key operational stewards — becomes the foundation for every subsequent continuity investment, and the evidence base against which progress can be measured.`,
    },
    structured_governance: {
      horizon: 'transformational',
      title: 'Evolve from Governance Structure to Continuity Intelligence',
      body: `The transformational pathway for this ${inst} is the evolution from structured governance — which this ${inst} has achieved — to continuity intelligence. Continuity intelligence means the ${inst} not only maintains its operational memory but actively analyzes it: using governance history to inform current decisions, using continuity patterns to anticipate future risk, and using institutional knowledge as a strategic asset rather than an archival one. This is what OCI maturity looks like at its most developed.`,
    },
    continuity_aware: {
      horizon: 'transformational',
      title: 'Embed Continuity as an Institutional Culture',
      body: `The transformational opportunity for this ${inst} is the embedding of continuity as institutional culture rather than as a governance discipline. Culture-level continuity means that the people within the ${inst} — not just the governance bodies — treat operational memory as a shared responsibility. Knowledge is shared as a matter of course. Context travels with decisions. Transitions are supported by the collective, not managed by individuals. This is the state of organizational continuity infrastructure that the OCI framework describes as continuity-native.`,
    },
    continuity_intelligence: {
      horizon: 'transformational',
      title: 'Position as a Continuity Leadership Organization',
      body: `The transformational pathway for an ${inst} at this level is positioning as a continuity leadership organization — one that not only maintains exemplary continuity practice internally but contributes to the development of continuity standards in its sector, mentors peer organizations, and demonstrates that governance excellence and operational intelligence are compatible with mission-first values. This is leadership that extends beyond the ${inst}'s own boundaries.`,
    },
  };

  transformational.push(transformationalByBand[bandId]);

  return [...immediate, ...structural, ...transformational];
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 6 — Executive Reflection
// ─────────────────────────────────────────────────────────────────────────────

export function generateExecutiveReflection(
  band: MaturityBand,
  composite: number,
  persona?: ExecutivePersonaId,
): string[] {
  const inst = institution(persona);
  const bandId = band.id as MaturityBandId;

  // ── Paragraph 1: Institutional acknowledgment ─────────────────────────────

  const acknowledgments: Record<MaturityBandId, string> = {
    personality_dependent: `Every institution operating at the Tribal Continuity level is being held together by people who are choosing to stay, choosing to carry what needs to be carried, and choosing to do the invisible labour of institutional coherence. That deserves acknowledgment. This briefing is not a critique of the people in this ${inst}. It is an argument for giving them better infrastructure, so they don't have to carry it alone.`,
    fragmented_coordination: `Institutions that are growing — in complexity, in scope, in the demands placed on them — often find themselves at exactly this juncture. Capable in parts. Coherent in some domains. Not yet unified as a continuity entity. The people in this ${inst} are doing real work. The question this briefing asks is not whether they are doing enough, but whether the architecture around them is helping or asking more of them than it should.`,
    structured_governance: `Deliberate investment in governance structure is evident throughout this profile, and structure is not a small thing. It is the foundation on which every subsequent continuity investment is built. The distance between structured governance and embedded continuity intelligence is real. It is also a distance that structured governance institutions are uniquely positioned to close — because the foundation is already there.`,
    continuity_aware: `Continuity is understood here as a governance discipline, and that understanding is visible throughout the profile. What this briefing has tried to do is surface the remaining dimensions: the places where the discipline is not yet culture, where the infrastructure is not yet embedded, where the investment has been made but has not yet compounded. These are refinements, not failures.`,
    continuity_intelligence: `This ${inst} has achieved what many aspire to: continuity as an institutional way of operating rather than a governance task. This briefing has identified marginal areas of development because no continuity posture is perfect, and because continuous calibration is what distinguishes mature institutions from merely stable ones. The standard here is high precisely because this ${inst} has demonstrated it can meet it.`,
  };

  const p1 = acknowledgments[bandId];

  // ── Paragraph 2: Stewardship dimension ────────────────────────────────────

  const p2Variants = [
    `Organizations are communities of responsibility. The people within them have accepted obligations to each other, to the communities they serve, and to the institutional mission they carry forward. Continuity infrastructure is how an institution honours those obligations across time — how it ensures that the commitments made today can be fulfilled tomorrow, regardless of who is in the room. This briefing treats that dimension of institutional life with the seriousness it deserves.`,
    `Institutional continuity is, at its core, a form of respect — respect for the people who built what exists, respect for the people who are currently carrying it, and respect for the people who will inherit it. When an institution fails to preserve its operational memory, it is not just creating operational risk. It is asking future stewards to pay again for what was already paid for, to learn again what was already learned, to rebuild what was already built. Continuity infrastructure prevents that.`,
    `The invisible continuity labour this briefing has examined — the knowledge held by individuals, the governance context carried by long-tenured staff, the operational memory distributed across relationships rather than systems — is labour that deserves institutional recognition. The people who carry it are not failing to document; they are succeeding at keeping things running in the absence of the systems that should exist. They deserve better tools. They deserve institutions that take this seriously.`,
  ];

  const p2 = pick(p2Variants, composite);

  // ── Paragraph 3: Closing commitment ───────────────────────────────────────
  //
  // The final line — "Technology should help institutions remember their
  // obligations to people." — is rendered separately by the template, as a
  // standalone italic line at the foot of the closing page. It must not be
  // duplicated here. Let p3 hand the reader gently toward it.

  const p3 =
    `This briefing was prepared by Union Eyes as a contribution to the practice of institutional continuity. It is offered in the belief that organizations do their best work when they can see their own patterns clearly, name what they are carrying, and choose with intention how to move forward. The Organizational Continuity Infrastructure framework exists to make that clarity possible.`;

  return [p1, p2, p3];
}


// ─────────────────────────────────────────────────────────────────────────────
// Phase 8 — Stabilization Movement appendix builders
//
// These builders read the executive stabilization model output and produce
// short, observational paragraphs for the optional Stabilization Movement
// appendix in the Executive Continuity Brief PDF. They are facilitated-edition
// only: the appendix is gated on the presence of an ExecutiveStabilizationResult
// being supplied to the data mapper.
//
// Tone discipline matches the rest of this engine: calm, observational, no
// forbidden vocabulary, no blame framing. Output is fully deterministic and
// traces back to the engine bands and counts.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ExecutiveDomainBand,
  ExecutiveDomainId,
  ExecutiveStabilizationResult,
} from '../workbook/engines/executive/executiveStabilizationModel';

export interface StabilizationAppendixParagraph {
  readonly heading: string;
  readonly body: string;
}

function bandFor(
  result: ExecutiveStabilizationResult,
  domain: ExecutiveDomainId,
): ExecutiveDomainBand {
  return result.domains.find((d) => d.domain === domain)?.band ?? 'not_yet_readable';
}

function describeBand(band: ExecutiveDomainBand): string {
  switch (band) {
    case 'not_yet_readable':
      return 'not yet readable on the available evidence';
    case 'holding':
      return 'holding without movement in either direction';
    case 'stabilizing':
      return 'showing movement consistent with stabilization';
    case 'regressing':
      return 'showing movement away from stabilization';
  }
}

export function buildStabilizationMovementNarrative(
  result: ExecutiveStabilizationResult,
): StabilizationAppendixParagraph {
  const composite = result.compositeBand;
  const body =
    `Across the eight stabilization domains read for this institution, composite continuity operational health is ${describeBand(composite)}. ` +
    `This appendix is offered as a deterministic reading of the artefacts the institution has already produced. It is not a recommendation, and it is not a forward projection. The institution remains the authority on what to make of the reading.`;
  return { heading: 'Stabilization movement', body };
}

export function buildContinuityDebtReductionNarrative(
  result: ExecutiveStabilizationResult,
): StabilizationAppendixParagraph {
  const band = bandFor(result, 'intervention_ledger_health');
  const body =
    `Reading the intervention ledger, the reduction posture for continuity debt is ${describeBand(band)}. ` +
    `Continuity debt reduces when interventions are ratified into the institution''s governance of record and when the reversibility window for a redistribution closes without withdrawal. The runtime reads the ledger only; it does not score the institution.`;
  return { heading: 'Continuity debt reduction', body };
}

export function buildGovernanceRecoveryTrajectoryNarrative(
  result: ExecutiveStabilizationResult,
): StabilizationAppendixParagraph {
  const band = bandFor(result, 'governance_recovery');
  const body =
    `The governance recovery trajectory is ${describeBand(band)}. ` +
    `A recovery move is read only after the governance body has ratified it. Pending recovery moves are not read as recovery; they are read as pending. The institution''s governance body is the source of authority for what counts as ratified.`;
  return { heading: 'Governance recovery trajectory', body };
}

export function buildOnboardingSurvivabilityNarrative(
  result: ExecutiveStabilizationResult,
): StabilizationAppendixParagraph {
  const band = bandFor(result, 'onboarding_survivability');
  const body =
    `Onboarding survivability is ${describeBand(band)}. ` +
    `Survivability is read from the institution''s own onboarding artefacts and the workflow completions that have been recorded for successor stewards. The reading is institutional. It is not a measurement of any individual.`;
  return { heading: 'Onboarding survivability', body };
}

export function buildStewardshipRedistributionEvolutionNarrative(
  result: ExecutiveStabilizationResult,
): StabilizationAppendixParagraph {
  const band = bandFor(result, 'stewardship_redistribution');
  const body =
    `The stewardship redistribution evolution is ${describeBand(band)}. ` +
    `Redistribution evolves only when carriers have consented and the reversibility window has closed without withdrawal. Refusals and withdrawals are read as institutional evidence, not as friction.`;
  return { heading: 'Stewardship redistribution evolution', body };
}
