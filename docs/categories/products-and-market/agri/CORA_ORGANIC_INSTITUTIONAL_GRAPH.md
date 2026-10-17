# Cora Organic Institutional Graph

**Status:** organic design ceiling reached; implementation is a local contract
only. The graph does not establish a partnership, live source connection, or
commercial validation.

## Product boundary

Cora is **Agricultural Institutional Infrastructure** under the
[v3 doctrine](ADR/ADR-AGRI-002-cora-food-economy-ceiling.md). Its
distinguishing capability is **institutional composability**: evidence can
move between institutions while origin authority, provenance, subject control,
recipient decision rights, purpose, freshness, and scope remain explicit.

Cora presents source evidence. It does not become the originating authority by
ingesting or displaying evidence, certify operators on behalf of certification
bodies, or replace regulators.

## Candidate Handoff A - separated relationships

`HANDOFF_A = CANADA_ORGANIC_EVIDENCE`.

```text
Evidence origin: Certification Body -> issues/publishes -> Certification Evidence
Evidence subject: Certification Evidence -> concerns -> Operator / Producer-Operator
Evidence infrastructure: Cora -> observes/references/composes/verifies provenance of -> Evidence
Recipient: Buyer / Program / Institution -> independently evaluates -> Evidence
```

Certification Body -> Producer -> Recipient is not a mandatory transmission
or authority path. An operator may supply a document, but is not necessarily
the evidence authority or intermediary. Cora custody or provenance checking
does not create certification, legal acceptance or source-currentness.
Public and private evidence routes use their actual governing mechanisms.

The [stress-test framework](CORA_STRESS_TEST_FRAMEWORK.md) inherits the
Organic rights gate and tests the best legitimate direct-source baseline.
Handoff B remains `PENDING_CFA_SELECTION`, not this graph's second consumer.

## Regulatory and authority graph

```text
CFIA — Canada Organic Regime scheme authority
  ├── designates/oversees ──> Conformity Verification Body
  └── accredits ────────────> Certification Body
                                ├── certifies ────────> Operator
                                ├── issues/maintains ─> Certification
                                │                        ├── has scope ──> Certification Scope
                                │                        └── covers ─────> Certified Product
                                └── publishes ────────> Certification Evidence

Regulatory authority ── issues ──> Enforcement Action
Certification Program ── governs ──> Certification
```

These are separate institutional roles. The current legal instrument,
accreditation scope, operator relationship, program, certificate, and
enforcement record must be evidenced for an individual case. A diagram edge is
not evidence that a particular institution or operator satisfies it.

## Standards graph

```text
Standards authority ── publishes ──> Standard
Standard ── has versions ─────────> Standard Version
Interpretation Authority ── issues > Interpretation
Interpretation ── interprets ─────> Standard Version
```

Represent identifiers and references for `CAN/CGSB-32.310-2026` and
`CAN/CGSB-32.311-2026` without copying protected standards text. Before using a
version in a real evidence assertion, verify its exact identifier, effective
date, transition state, and source against the authoritative publication.
Interpretation is not certification and does not change an operator's
certification status.

## Sector graph

```text
COTA ── convenes / represents ──> Sector Participants
COTA ── publishes ──────────────> Market Intelligence
Evidence Aggregator ── aggregates > Public Source Evidence
Member ── participates in ───────> Sector Organization
```

COTA (Canada Organic Trade Association / canada-organic.ca) is represented as
a first-class sector institution. Its public directory and research surfaces
support the roles `SECTOR_CONVENOR` and
`MARKET_INTELLIGENCE_PUBLISHER`; an aggregation role applies only to the
specific evidence it actually republishes with traceable sources. COTA is not
a certification authority. Membership or directory presence is not
certification evidence and does not establish a Cota partnership with NzilaOS.
`COTA_PARTNERSHIP = HYPOTHESIS_NOT_DEPENDENCY`.

## Public trust and social legitimacy graph

```text
Institutional Action / Claim / Program
  → Supporting Evidence
  → Public Communication
  → Public Interpretation
  → Trust Response
  → Behaviour / Policy Consequence
  → Institutional Learning
```

`INSTITUTIONAL_ACTION_TO_PUBLIC_LEGITIMACY` is an evidence and learning
relationship, not a regulatory or certification-validity test. A technically
valid certification may coexist with low public confidence; a trusted claim
may still be unsupported by technical evidence. Cora preserves both streams
and does not use one as proof of the other.

The Canadian Centre for Food Integrity (CCFI) is represented as a distinct
`PUBLIC_TRUST_AND_SOCIAL_LEGITIMACY` control-point class. Its possible roles
include `KNOWLEDGE_SOURCE`, `OUTCOME_EVIDENCE_SOURCE`,
`SECTOR_CONVENOR`, and `PUBLIC_TRUST_RESEARCH_INSTITUTION`, subject to
case-specific source evidence. CCFI research may support claims about public
trust, attitudes, confidence, concerns, expectations, understanding, and
longitudinal trends. A finding remains evidence from CCFI, not
`OBJECTIVE_UNIVERSAL_PUBLIC_TRUTH`; preserve report, methodology, date, sample,
geography, question context, funder/context, limitations, and source reference
when applicable. CCFI is not a regulator, certifier, truth authority,
standards authority, or certification authority.

For Canada Organic Alpha, `CCFI = NON_BLOCKING`; it is not in the minimum
dependency graph. For Alpha+ evaluation, `CCFI = HIGH_RELEVANCE`, as a future
hypothesis and not an integration or collection commitment. See the
[Cora Institutional Control-Point Map](CORA_INSTITUTIONAL_CONTROL_POINT_MAP.md)
for CCFI provenance doctrine, the public-legitimacy loop, and handoffs H29,
H30, and H31.

## Québec and national paths

The data model accommodates both:

```text
Certification Body ── publishes ──> Certification Evidence ──> Cora
```

and a Québec directory path:

```text
Certification Body ── certifies ──> Operator
        └── publishes evidence ──> CARTV / SIPAB aggregation
                                      └──> Portail Bio Québec ──> Cora
```

For the Québec path, the source certification body remains the origin of the
certification assertion. CARTV, SIPAB, or Portail Bio Québec must be recorded
in the role actually supported for each dataset (for example, provincial
authority, directory publisher, or aggregator). Aggregation never replaces
the certifier provenance. Québec-specific participants are optional; the
national core does not depend on them.

## Receiving side

Keep the following roles distinct:

- **Recipient Institution** — institution receiving the evidence.
- **Recipient Organization** — the tenant or organization in which it is
  handled.
- **Recipient Role** — the user's or process's canonical role.
- **Institutional Disposition** — the recipient's own accept, reject,
  verification-required, or undecided action.

One institution may occupy multiple roles, but each role and its authority
must remain explicit. A recipient's decision is not a certification and does
not rewrite the source's claim.

See the [evidence taxonomy and freshness/conflict model](CORA_ORGANIC_EVIDENCE_TAXONOMY.md),
[public source authority and registry model](CORA_ORGANIC_PUBLIC_SOURCE_REGISTRY.md),
[passport and change-watch contracts](CORA_ORGANIC_PASSPORT_AND_CHANGE_WATCH.md),
[organic public certification C1 case](CORA_C1_AUTHORITY_CASE_ORGANIC_PUBLIC_CERTIFICATION_001.md),
[source-access request](CORA_ORGANIC_CERTIFIER_DATA_ACCESS_REQUEST.md),
[source-access decision record](CORA_ORGANIC_SOURCE_ACCESS_DECISION_RECORD.md), and
[Cora-wide control-point map](CORA_INSTITUTIONAL_CONTROL_POINT_MAP.md), the
[First Cross-Institutional Proof Contract](CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md),
and the [Second-Consumer Selection Matrix](CORA_SECOND_CONSUMER_SELECTION_MATRIX.md).
