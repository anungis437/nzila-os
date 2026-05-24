/**
 * OCI Facilitation — Type definitions.
 *
 * This file is the canonical type spine for the OCI facilitation
 * libraries. All facilitation guides, workshop flows, discovery
 * frameworks, and conversation prompt catalogues consume these
 * types.
 *
 * Locale strategy: every authored string value is recorded as a
 * `LocalizedString` keyed by IETF BCP 47 locale tag. The current
 * sprint authors `en-CA` only; the `fr-CA` slot is reserved.
 *
 * Doctrine:
 *  - docs/oci/OCI_PILOT_FRAMEWORK.md
 *  - docs/oci/OCI_DELIVERY_MODEL.md
 *  - docs/oci/OCI_WORKSHOP_OPENING_SCRIPT.md
 *  - docs/doctrine/ANTI_SURVEILLANCE_DOCTRINE.md
 */

/** Supported facilitation locales. EN-CA is authored; FR-CA is reserved. */
export type Locale = 'en-CA' | 'fr-CA';

/**
 * A locale-keyed string. EN-CA is required; other locales are
 * optional and may be filled in by later translation passes.
 */
export type LocalizedString = {
  readonly 'en-CA': string;
} & Partial<Record<Exclude<Locale, 'en-CA'>, string>>;

/** A locale-keyed list of strings, with the same EN-CA-required posture. */
export type LocalizedStringList = {
  readonly 'en-CA': readonly string[];
} & Partial<Record<Exclude<Locale, 'en-CA'>, readonly string[]>>;

/**
 * The five canonical facilitation session types. These map one-to-one
 * to the five workshop scripts in
 * `docs/oci/OCI_WORKSHOP_OPENING_SCRIPT.md` and to the five flows in
 * `executiveWorkshopFlows.ts`.
 */
export type FacilitationSessionType =
  | 'executive-interpretation'
  | 'workbook-orientation'
  | 'stewardship-density-review'
  | 'continuity-breakpoint-working-session'
  | 'governance-continuity-plan-ratification';

/**
 * The eight canonical conversation categories for the continuity
 * conversation prompt catalogue. Each category captures a distinct
 * facet of the organizational continuity question.
 */
export type ConversationCategory =
  | 'governance-survivability'
  | 'stewardship-burden'
  | 'operational-reconstruction'
  | 'institutional-memory'
  | 'onboarding-fragility'
  | 'continuity-fairness'
  | 'modernization-risk'
  | 'governance-interpretation-drift';

/**
 * The five canonical discovery framework sections. Each names a
 * facet of the institution's landscape that the OCI Mapping phase
 * surveys.
 */
export type DiscoverySectionId =
  | 'governance-landscape'
  | 'stewardship-hotspots'
  | 'continuity-fragility'
  | 'modernization-pressure'
  | 'political-sensitivities';

/**
 * A single facilitation guide entry — one entry per session type.
 * Records the editorial posture and the operational guidance the
 * facilitator carries into the session.
 */
export interface FacilitationGuideEntry {
  /** Canonical session type. Must be unique across the catalogue. */
  readonly sessionType: FacilitationSessionType;
  /** Short organizational title of the session, in editorial voice. */
  readonly title: LocalizedString;
  /** Why the session exists. One or two sentences. */
  readonly purpose: LocalizedString;
  /** Named organizational roles expected in the room. */
  readonly audience: LocalizedStringList;
  /** Default duration, in minutes. */
  readonly durationMinutes: number;
  /** The recognition the facilitator opens with. */
  readonly openingPosture: LocalizedString;
  /**
   * The mapping arc — what the conversation moves through, in the
   * facilitator's mental model, between opening and closing.
   */
  readonly mappingArc: LocalizedStringList;
  /** The posture the facilitator closes the session with. */
  readonly closingPosture: LocalizedString;
  /** Observable signals that the session has succeeded institutionally. */
  readonly successSignals: LocalizedStringList;
  /** Observable signals that the session has slipped off doctrine. */
  readonly failureSignals: LocalizedStringList;
  /** Materials the facilitator brings to the room. */
  readonly materialsRequired: LocalizedStringList;
  /** Practices the facilitator explicitly avoids during this session. */
  readonly whatToAvoid: LocalizedStringList;
}

/**
 * A single step inside a workshop flow. The flow is the structured
 * representation of a session script.
 */
export interface WorkshopStep {
  /** Stable identifier, unique within the flow. */
  readonly stepId: string;
  /** The prompt or move the facilitator makes at this step. */
  readonly prompt: LocalizedString;
  /** What the facilitator is listening to surface from the room. */
  readonly expectedSurface: LocalizedString;
  /** Facilitator-only notes on how to hold the step. */
  readonly facilitatorNotes: LocalizedString;
  /** The tone the facilitator carries into the step. */
  readonly tonePosture: LocalizedString;
  /** Red lines — things the facilitator refuses to do at this step. */
  readonly redLines: LocalizedStringList;
}

/**
 * A workshop flow — the structured five-stage arc that corresponds
 * to one facilitation session type.
 */
export interface WorkshopFlow {
  /** Canonical session type this flow belongs to. */
  readonly sessionType: FacilitationSessionType;
  /** Short organizational title. */
  readonly title: LocalizedString;
  /** One- or two-sentence summary of the arc. */
  readonly summary: LocalizedString;
  /** The ordered steps of the flow. */
  readonly steps: readonly WorkshopStep[];
}

/**
 * A single discovery prompt the facilitator may use during the
 * Mapping phase. Discovery prompts are open questions, never
 * diagnostic.
 */
export interface DiscoveryPrompt {
  /** Stable identifier, unique within the section. */
  readonly promptId: string;
  /** The question the facilitator may pose. */
  readonly prompt: LocalizedString;
  /** Why this question is asked. */
  readonly rationale: LocalizedString;
}

/**
 * A discovery framework section — one of five sections that, taken
 * together, give the institution a complete landscape view during
 * Mapping.
 */
export interface DiscoveryPromptSection {
  /** Canonical section identifier. */
  readonly sectionId: DiscoverySectionId;
  /** Short organizational title. */
  readonly title: LocalizedString;
  /** One- or two-sentence section purpose. */
  readonly purpose: LocalizedString;
  /** The discovery prompts contained in this section. */
  readonly prompts: readonly DiscoveryPrompt[];
  /**
   * A short sentence the facilitator uses to open the section's
   * synthesis discussion after the prompts have been worked through.
   */
  readonly synthesisStarter: LocalizedString;
}

/**
 * A single continuity conversation prompt. These are catalogue-level
 * prompts the facilitator may draw on across many sessions; they are
 * not bound to a specific workshop flow.
 */
export interface ConversationPrompt {
  /** Stable identifier, unique across the catalogue. */
  readonly id: string;
  /** The category this prompt belongs to. */
  readonly category: ConversationCategory;
  /** The question, as posed in editorial voice. */
  readonly question: LocalizedString;
  /** Why this question matters institutionally. */
  readonly whyItMatters: LocalizedString;
  /** What the facilitator is listening for in the reply. */
  readonly whatToListenFor: LocalizedStringList;
  /**
   * Conditions under which this prompt should not be raised, or
   * topics the facilitator declines to pursue if they are raised
   * in response.
   */
  readonly avoidIfShared: LocalizedStringList;
}
