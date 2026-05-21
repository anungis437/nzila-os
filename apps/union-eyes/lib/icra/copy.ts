/**
 * ICRA — Canonical Copy
 *
 * One source of truth for institutional, calm, anti-surveillance language.
 * No marketing claims. No hype. No urgency. No surveillance vocabulary.
 *
 * If a phrase is added here, it has been considered against doctrine.
 */
export const DOCTRINE_VERSION = '1.0.0';

export const COPY = {
  brand: {
    productName: 'Institutional Continuity Risk Assessment',
    shortName: 'Continuity Assessment',
    trademark: 'Institutional Continuity Risk Assessment™',
    categoryName: 'Organizational Continuity Infrastructure',
  },
  hero: {
    eyebrow: 'Institutional Continuity Risk Assessment™',
    headline:
      'Most Institutions Are Carrying More Continuity Risk Than They Realize.',
    humanContinuityLine:
      'Every organization has people quietly holding continuity together long after the systems around them stopped doing so.',
    sub:
      'Operational knowledge often lives inside people instead of systems. Leadership transitions should not feel like rebuilding the institution from scratch. Modernization without continuity often creates operationally forgetful organizations.',
    primaryCta: 'Assess Institutional Continuity Risk',
    secondaryCta: 'Read what this is, and what it is not',
  },
  /**
   * The recurring OCI motif — appears on landing, results, and report.
   * This is category language infrastructure.
   */
  ociMotif:
    'Institutions are ultimately shaped not only by what they build, but by what they choose to remember.',
  /**
   * Technology With Soul — operationalized. Not a philosophy block.
   * Each line is a concrete commitment.
   */
  techWithSoul: {
    title: 'Technology With Soul Means',
    lines: [
      'Continuity without surveillance.',
      'Modernization without institutional forgetting.',
      'Operational intelligence without dehumanization.',
      'Governance support without replacing human judgment.',
      'Technology that helps institutions remember their obligations to people.',
    ],
  },
  /**
   * Canonical quiet-risk vocabulary — used throughout landing and output.
   * This creates the emotional texture that distinguishes this category.
   */
  quietRisk: {
    erosion: 'quiet continuity erosion',
    drift: 'silent governance drift',
    forgetting: 'quiet institutional forgetting',
    burden: 'invisible continuity burden',
    fragility: 'quiet operational fragility',
    labour: 'invisible continuity labour',
  },
  /**
   * Institutional Memory Holders — the people quietly carrying continuity.
   * Naming this concept is itself a category act.
   */
  institutionalMemoryHolders: {
    title: 'Institutional Memory Holders',
    definition:
      'In most organizations, there are people who carry continuity not because it is their formal role, but because no system was built to hold it instead.',
    roles: [
      {
        id: 'continuity_carrier',
        label: 'The Continuity Carrier',
        description:
          'The person who knows why things work the way they do — and who quietly ensures operations continue through every transition.',
      },
      {
        id: 'context_keeper',
        label: 'The Context Keeper',
        description:
          'The person everyone consults before making decisions, because they hold the relational and historical context no system has ever captured.',
      },
      {
        id: 'governance_historian',
        label: 'The Governance Historian',
        description:
          'The person who remembers what was decided, why, and what alternatives were rejected — when meeting minutes record only outcomes.',
      },
      {
        id: 'operational_interpreter',
        label: 'The Operational Interpreter',
        description:
          'The person who translates between institutional fragments — bridging teams, systems, and practices that were never designed to speak to each other.',
      },
      {
        id: 'organizational_memory',
        label: 'The Organizational Memory',
        description:
          'The person whose departure would make the institution feel, for a time, like it had forgotten what it knew about itself.',
      },
    ],
  },
  positionStatement: {
    title: 'Our position on human dignity and governance',
    body: [
      'This assessment is not employee surveillance.',
      'It is not productivity monitoring.',
      'It is not hidden behavioural analytics.',
      'It is not punitive workforce scoring.',
      'It is a structured examination of institutional continuity: the operational memory, governance visibility, and transition readiness that allow an institution to outlast any individual within it.',
      'We treat institutional continuity as governance infrastructure, not as workforce control.',
    ],
  },
  overview: {
    title: 'What this assessment looks at',
    bullets: [
      'Operational dependency — where institutional function relies on specific people rather than institutional procedure.',
      'Governance visibility — whether governance bodies can see operational reality without heroic reporting.',
      'Institutional memory — whether decisions and precedent outlast the individuals who shaped them.',
      'Transition readiness — whether the institution can absorb role and leadership change without disruption.',
      'Explainability and trust — whether decisions can be explained from evidence.',
      'Sovereignty and governance control — whether the institution controls its own institutional data and direction.',
    ],
    duration: 'Most institutions complete the assessment in 15 to 25 minutes.',
    privacy: [
      'Responses are stored with a pseudonymous assessment identifier.',
      'No personally-identifying information is required to complete the assessment.',
      'Data is used to generate your continuity profile, and, in aggregated and anonymized form, to inform our continuity benchmark research.',
      'You may request deletion of your assessment at any time.',
    ],
  },
  consent: {
    title: 'Before you begin',
    items: [
      {
        id: 'antiSurveillance',
        label:
          'I understand this assessment is governance-focused and does not collect surveillance or productivity data about individuals.',
      },
      {
        id: 'dataHandling',
        label:
          'I understand my responses will be stored under a pseudonymous assessment identifier and may be aggregated, in anonymized form, into continuity benchmark research.',
      },
      {
        id: 'explainability',
        label:
          'I understand the resulting profile is generated by an explainable scoring procedure, not by an opaque model, and can be reviewed and explained on request.',
      },
    ],
    proceed: 'Acknowledge and begin',
    decline: 'Return to overview',
  },
  intake: {
    saveNoticeTitle: 'Your progress is saved locally',
    saveNoticeBody:
      'You can leave and return to this assessment on the same device. Closing the browser does not lose your progress.',
    sectionEyebrow: 'Section',
    next: 'Continue',
    back: 'Back',
    submit: 'Generate continuity profile',
    optionalNote: 'Optional context (will not affect scoring)',
    likertHelp: 'Select the option that best reflects your honest assessment.',
  },
  results: {
    title: 'Institutional Continuity Profile',
    profileSub:
      'A calm, structured view of your institution’s continuity posture. This profile is generated deterministically from your responses; nothing here is produced by an opaque model.',
    bandLabel: 'Continuity Band',
    operationalPatternLabel: 'Operational Pattern',
    compositeLabel: 'Composite continuity indicator',
    dimensionsTitle: 'Continuity dimensions',
    sectionsTitle: 'Section observations',
    observationsTitle: 'Continuity observations',
    insightsTitle: 'Continuity Insights',
    continuitySignalsTitle: 'Continuity Signals Observed',
    stewardshipSignalsTitle: 'Stewardship Signals',
    burdenIndexTitle: 'Continuity Burden Index',
    burdenIndexSub:
      'How much of your institutional continuity currently depends on people compensating manually.',
    recommendationsTitle: 'Suggested next steps',
    privacyFooter:
      'This profile is yours. We retain a pseudonymous record for benchmark research and may delete it on request. We do not contact you unless you ask us to.',
    explainabilityNote:
      'Each indicator above is the deterministic result of your weighted responses. We can show you exactly which questions contributed to each dimension on request.',
  },
  /**
   * Revenue tiers — institutional naming, not SaaS vocabulary.
   */
  tiers: {
    reflection: {
      id: 'continuity_reflection' as const,
      name: 'Continuity Reflection',
      tagline: 'A structured look at where your institution stands.',
      price: null,
      priceLabel: 'Complimentary',
    },
    brief: {
      id: 'executive_continuity_brief' as const,
      name: 'Executive Continuity Brief',
      tagline: 'A board-grade analysis of your continuity posture, for leadership conversations.',
      price: '$1,200 CAD',
      priceLabel: '$1,200 CAD',
    },
    diagnostic: {
      id: 'institutional_continuity_diagnostic' as const,
      name: 'Institutional Continuity Diagnostic',
      tagline: 'A facilitated institutional review for organizations ready to act.',
      price: '$6,500 CAD',
      priceLabel: '$6,500 CAD',
    },
  },
  /**
   * Report gate copy — calm, institutional, non-coercive.
   */
  reportGate: {
    briefLockedLabel: 'This analysis is available in the Executive Continuity Brief.',
    diagnosticLockedLabel: 'This section is part of the Institutional Continuity Diagnostic.',
    briefCtaLabel: 'Request the Executive Continuity Brief',
    briefCtaHref: '/contact?topic=executive-continuity-brief',
    diagnosticCtaLabel: 'Open an Institutional Continuity Diagnostic conversation',
    diagnosticCtaHref: '/contact?topic=institutional-continuity-diagnostic',
    gateNote:
      'The Executive Continuity Brief is available at $1,200 CAD and is designed for board presentation and executive decision-making.',
  },
  governance: {
    auditableNote:
      'This intake is governed by Nzila OS continuity doctrine. Every captured answer is reproducible against the question version active at the time of capture.',
  },
} as const;

export type CopyShape = typeof COPY;
