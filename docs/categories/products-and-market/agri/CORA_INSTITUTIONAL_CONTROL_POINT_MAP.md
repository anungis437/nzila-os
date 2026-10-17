# Cora Institutional Control-Point Map

**Status:** strategy and evidence-relationship doctrine. Nodes describe
institutional roles, not established partnerships, source permissions, or
runtime dependencies.

## Product role

Cora supports legitimate institutional action across evidence streams while
preserving each source's authority, provenance, scope, methodology,
limitations, and the receiving institution's decision rights. Cora is not the
source authority and does not convert evidence into a universal truth.

## Control-point classes

| Control-point class            | Example node                                         | Role                                                                                                            | Cora value                                                                                                         | Boundary                                                                                                                                       |
| ------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Scheme/regulatory authority    | CFIA                                                 | `SCHEME_AUTHORITY`; source for `CERTIFICATION_BODY_ACCREDITATION`                                               | Establish scheme and accredited-body authority context                                                             | The CFIA certifier register is not operator certification evidence; OGL applies only to information explicitly offered under it.               |
| Certification authority        | Accredited certification body                        | Source of its own certification decision and status assertion                                                   | Preserve operator-level evidence with source provenance                                                            | Cora and aggregators do not certify or replace the body's certificate.                                                                         |
| Public trust/social legitimacy | Canadian Centre for Food Integrity (CCFI)            | `PUBLIC_TRUST_RESEARCH_INSTITUTION`, `KNOWLEDGE_SOURCE`, `OUTCOME_EVIDENCE_SOURCE`, potential `SECTOR_CONVENOR` | Longitudinal evidence about public trust, attitudes, confidence, concerns, expectations, understanding, and trends | CCFI research is evidence from CCFI, not `OBJECTIVE_UNIVERSAL_PUBLIC_TRUTH`, regulator authority, certifier authority, or standards authority. |
| Sector/trade infrastructure    | COTA                                                 | Sector representation, organic-sector convening, market intelligence, member network                            | Industry context and market-intelligence evidence                                                                  | Not a certification authority; membership is not certification evidence or a Cota–NzilaOS partnership.                                         |
| Ecosystem orchestration        | NL Eats                                              | Potential coalition and ecosystem orchestration surface                                                         | Help identify who needs to work together                                                                           | Not a certification authority or substitute for research evidence. Partnership/role assumptions require their own evidence.                    |
| Research/knowledge institution | University of Guelph and other research institutions | Research evidence and knowledge production                                                                      | Evidence about what a particular study establishes                                                                 | A study's result remains bound by its method, sample, question, context, and limitations.                                                      |

CCFI's possible roles are class-level design roles. A specific research
observation or convening relationship must be verified against the relevant
CCFI report, event, methodology, and source. No CCFI membership, partnership,
data access, or ingestion is asserted here.

## CCFI evidence envelope

When a CCFI-derived observation is separately and legitimately used, retain
the following context when applicable:

- study/report title and stable source reference;
- source organization and the role supported by the cited material;
- publication date and the observation/fieldwork period;
- methodology, instrument, sample size, recruitment and weighting;
- geography and population represented;
- exact question wording and response context;
- funder, sponsor, or other disclosed study context;
- limitations, uncertainty, and comparability caveats;
- source URL/reference and any licence/use conditions.

Do not transform a reported survey result into a universal claim about every
person, institution, producer, buyer, or food-system participant. Preserve
the report's language, context, and uncertainty. Apply the same provenance
discipline used for certification bodies, universities, industry groups, and
regulators. This doctrine does not authorize CCFI collection or reuse.

## Institutional action-to-public-legitimacy loop

```text
Institution
  → Action / Claim / Program
  → Supporting Evidence
  → Public Communication
  → Public Interpretation
  → Trust Response
  → Behaviour / Policy Consequence
  → Institutional Learning
  → (informs next) Institutional Action
```

Name: `INSTITUTIONAL_ACTION_TO_PUBLIC_LEGITIMACY`.

This loop is separate from regulatory or certification validity. A technically
valid certification can coexist with low public confidence. A trusted claim
can still be technically unsupported. Cora should preserve both evidence
streams without allowing either to stand in for the other.

## Canada Organic Alpha boundary

```text
CCFI_ALPHA_DEPENDENCY = NON_BLOCKING
CCFI_ALPHA_PLUS_RELEVANCE = HIGH_RELEVANCE
CCFI_RUNTIME_INGESTION = NOT_ENABLED
```

CCFI is not part of the minimum Canada Organic Alpha dependency graph.
Alpha+ or later evaluation may test these hypotheses:

- Do buyers understand the certification evidence and its limits?
- Do consumers understand organic claims and distinctions?
- Do institutional claims preserve the source's qualifications?
- Does evidence portability improve confidence or confidence in whom?
- What conditions cause trust degradation or recovery?

These are future research questions, not settled facts or product commitments.

## Handoffs to reserve

The following doctrine-level handoffs describe seams to investigate; they do
not authorize runtime workflows.

| Handoff                                               | From → to                                                                     | Gap                                                                                 | Evidence-preserving question                                                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **H29 — Institution → Public Trust**                  | Institutional action/claim/program → public interpretation and trust evidence | An institution cannot reliably determine how an action or claim affects confidence. | Which population, question, period, and method support the observed trust response?                                  |
| **H30 — Evidence → Public Claim**                     | Source evidence → communication, marketing, or policy statement               | Scope, provenance, or qualification may be lost as evidence becomes a public claim. | Can the original evidence → supported statement → transformed/public claim lineage be shown without claim inflation? |
| **H31 — Public Trust Finding → Institutional Action** | Trust evidence → accountable institutional intervention and learning          | A published trust finding may not become a traceable, evaluated intervention.       | Which institution acted, why, with what evidence, and what subsequent outcome was observed?                          |

## Keep institutional roles distinct

- **CCFI:** public trust and social-legitimacy research/convening; asks how the
  food system is understood and trusted.
- **COTA:** organic-sector/trade representation, member network, sector
  convening, and market intelligence.
- **NL Eats:** ecosystem orchestration; asks who needs to work together.
- **Guelph/research institutions:** research evidence; asks what a particular
  study establishes.
- **Cora:** institutional coordination; asks how institutions can legitimately
  act together on those independently sourced evidence streams.

These are complementary nodes, not interchangeable authorities. No membership,
partnership, or data-sharing relationship is established merely by inclusion
in this conceptual map.

## Organic authority graph cross-reference

The organic certification authority graph remains distinct: CFIA governs the
scheme and accredits certification bodies; each body is authoritative for its
own certification decisions; CARTV/SIPAB may aggregate Québec evidence without
replacing the certifier. CCFI is not in this certification-authority chain.
See [Cora Organic Institutional Graph](CORA_ORGANIC_INSTITUTIONAL_GRAPH.md)
and the [first live source decision](CORA_ORGANIC_FIRST_LIVE_SOURCE_DECISION.md).
The proposed cross-institutional proof remains design-only and has no selected
second consumer; see the [proof contract](CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md)
and [selection matrix](CORA_SECOND_CONSUMER_SELECTION_MATRIX.md). Neither
artifact changes the Phase 2B source-rights decision or authorizes collection.

## Reference

CCFI's public [Research page](https://www.foodintegrity.ca/research/) is a
discovery reference for its research/report materials. Each specific CCFI
claim must cite its actual report and methodology rather than relying on this
general page.
