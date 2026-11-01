# Union Eyes Gate 0C.4 - product-owner ratification dossier

Gate: GATE-0C.4. Accepted Gate 0C.3 commit: `ab9c184263020a95b91066014395f16dc3ec78e8`. Gate 0 verdict: IN_PROGRESS. Release authorization: NOT_GRANTED. UE_SAAS_OPERATIONAL_READINESS: NO_GO.

Register: `docs/union-eyes/convergence/register/ue-product-ratification-dossier-0c4.json`. Status: PREPARED_FOR_DECISION_NOT_DECIDED. Nothing in this dossier is a decision.

A product ratification fixes a product-specification baseline only. It cannot issue an institutional permission, mandate, office, delegation or authority decision, and it changes no implementation, security, release or runtime status.

## The three proposed canonicals

| Persona | Record | Proposed canonical | State | Decisions to settle | Institutional ids listed |
| --- | --- | --- | --- | --- | --- |
| steward | PDR-0C2-STEWARD-V1 | UE-STEWARD-PROPOSED-CANONICAL-R1 1.0-R1 | PROPOSED_FOR_RATIFICATION | 10 | 0 |
| representative | PDR-0C2-REPRESENTATIVE-V1 | UE-REPRESENTATIVE-PROPOSED-CANONICAL-2.2-R1 2.2-R1 | PROPOSED_FOR_RATIFICATION | 13 | 6 |
| financial-officer | PDR-0C2-FINANCIAL-OFFICER-V1 | UE-FINANCIAL-OFFICER-PROPOSED-CANONICAL-2.1-R1 2.1-R1 | PROPOSED_FOR_RATIFICATION | 9 | 5 |

### steward

Artifact: `docs/union-eyes/convergence/register/ue-persona-decision-package-steward-0c2.json` (`a01076343d199a98554756e577edabb8150fec6353baddab749d6efe00fa9cea`). Decision owner role: AUTHORIZED_PRODUCT_OWNER. Approval evidence on file: none.

Decisions the owner may take:

| Option | Resulting state | Effect |
| --- | --- | --- |
| APPROVE | ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER | Establishes the named artifact version as the engineering canonical for this persona. Settles or explicitly defers each listed product decision. Issues no institutional authority and activates nothing. |
| REJECT | REJECTED_BY_AUTHORIZED_PRODUCT_OWNER | The artifact version is not the engineering canonical. The persona stays unresolved and its Gate 0 blocker stays. |
| RETURN_FOR_REWORK | RETURNED_FOR_REWORK | The named reasons are recorded and a new artifact version is prepared. The returned version stays preserved. |

Required approval evidence: decisionMaker.name, decisionMaker.role, decidedOn, artifactVersion, artifactSha256, scope, evidenceDocument.reference, evidenceDocument.sha256, independentOfPreparer.

Product decisions this record settles or defers: DEC-PD-01, DEC-PD-02, DEC-PD-03, DEC-PD-04, DEC-PD-05, DEC-PD-12, DEC-PD-0C2-01, DEC-PD-0C2-02, DEC-PD-0C2-03, DEC-PD-0C2-10.

Institutional authority decisions this record lists: none. The decision identifiers beginning DEC-IA are institutional authority decisions. Approving the package cannot settle, adopt or issue them; they stay outstanding.

Decisions shared with another persona record: DEC-PD-01 (PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1); DEC-PD-03 (PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1); DEC-PD-04 (PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1); DEC-PD-05 (PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1); DEC-PD-12 (PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1); DEC-PD-0C2-10 (PDR-0C2-FINANCIAL-OFFICER-V1, PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1).

Depends on: financial-officer via SHARED_OBLIGATION; representative via RELATED_REQUIREMENT; representative via SHARED_OBLIGATION.

Evidence still unavailable:

- GAP-STW-NO-CANONICAL (IRREDUCIBLE_HISTORICAL): No Steward canonical exists in any of the 526 refs scanned. The eight recovered evidence items S1 to S8 define no action. Every one of the Steward contracts is a new design, and no historical Steward action list can be recovered.
- GAP-STW-STRUCTURE (PRODUCT_DECISION): Whether Steward is a distinct persona or a scoped profile of Representative 2.2 is undecided (DEC-PD-01).
- GAP-STW-OFFICE (INSTITUTIONAL): No source names a steward office, and none may be created here (DEC-IA-32).

A product approval does not:

- Issue, approve or activate any of the 79 outstanding institutional decisions or the 32 baseline institutional authority decisions.
- Issue a financial mandate, a triage designation, a supervisory mandate, a delegation, an appointment or any other instrument.
- Create, name or fill an institutional office, including a steward office.
- Change an implementation status, a security status, a release disposition or a runtime qualification status.
- Resolve any ratchet, test or route defect.

### representative

Artifact: `docs/union-eyes/convergence/register/ue-persona-decision-package-representative-0c2.json` (`e4dcbf3635b8807c9e923f2f12b5a1dc9b53196fadf864664393ff19f3af6861`). Decision owner role: AUTHORIZED_PRODUCT_OWNER. Approval evidence on file: none.

Decisions the owner may take:

| Option | Resulting state | Effect |
| --- | --- | --- |
| APPROVE | ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER | Establishes the named artifact version as the engineering canonical for this persona. Settles or explicitly defers each listed product decision. Issues no institutional authority and activates nothing. |
| REJECT | REJECTED_BY_AUTHORIZED_PRODUCT_OWNER | The artifact version is not the engineering canonical. The persona stays unresolved and its Gate 0 blocker stays. |
| RETURN_FOR_REWORK | RETURNED_FOR_REWORK | The named reasons are recorded and a new artifact version is prepared. The returned version stays preserved. |

Required approval evidence: decisionMaker.name, decisionMaker.role, decidedOn, artifactVersion, artifactSha256, scope, evidenceDocument.reference, evidenceDocument.sha256, independentOfPreparer.

Product decisions this record settles or defers: DEC-PD-01, DEC-PD-03, DEC-PD-04, DEC-PD-05, DEC-PD-06, DEC-PD-07, DEC-PD-08, DEC-PD-12, DEC-PD-14, DEC-PD-0C2-04, DEC-PD-0C2-05, DEC-PD-0C2-06, DEC-PD-0C2-10.

Institutional authority decisions this record lists: DEC-IA-03, DEC-IA-07, DEC-IA-08, DEC-IA-09, DEC-IA-10, DEC-IA-11. The decision identifiers beginning DEC-IA are institutional authority decisions. Approving the package cannot settle, adopt or issue them; they stay outstanding.

Decisions shared with another persona record: DEC-PD-01 (PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1); DEC-PD-03 (PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1); DEC-PD-04 (PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1); DEC-PD-05 (PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1); DEC-PD-12 (PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1); DEC-PD-14 (PDR-0C2-FINANCIAL-OFFICER-V1, PDR-0C2-REPRESENTATIVE-V1); DEC-PD-0C2-10 (PDR-0C2-FINANCIAL-OFFICER-V1, PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1).

Depends on: financial-officer via SHARED_OBLIGATION; steward via RELATED_REQUIREMENT; steward via SHARED_OBLIGATION.

Evidence still unavailable:

- GAP-REP-CANONICAL-CITED-NOT-RECOVERED (IRREDUCIBLE_HISTORICAL): UE-REPRESENTATIVE-CANONICAL-2.2 is cited as FROZEN by a disposition and exists in no ref. The package is a reconstruction candidate and is not that document.
- GAP-REP-R-RANGE (IRREDUCIBLE_HISTORICAL): The first disposition carried the R01 to R24 matrix and was rewritten. Only R01, R02, R09, R13, R14, R15 and R18 carry their own titles. The other seventeen share group labels, and pairing a label to an identifier is an inference.
- GAP-REP-R18-CONFLICT (IRREDUCIBLE_HISTORICAL): R18 is recorded BLOCKED in the first disposition and MISSING in the second. The conflict is preserved, not resolved. Both agree nothing is operational.
- GAP-REP-JOURNEYS-UNDEFINED (IRREDUCIBLE_HISTORICAL): Journeys A to G and the institutional scenario proofs are named by range only. No journey or scenario is defined in any source.

A product approval does not:

- Issue, approve or activate any of the 79 outstanding institutional decisions or the 32 baseline institutional authority decisions.
- Issue a financial mandate, a triage designation, a supervisory mandate, a delegation, an appointment or any other instrument.
- Create, name or fill an institutional office, including a steward office.
- Change an implementation status, a security status, a release disposition or a runtime qualification status.
- Resolve any ratchet, test or route defect.

### financial-officer

Artifact: `docs/union-eyes/convergence/register/ue-persona-decision-package-financial-officer-0c2.json` (`5ec3e9a10eb6c4458f467f5b8e659d746f6631924664d9f7ca062c6e435c3889`). Decision owner role: AUTHORIZED_PRODUCT_OWNER. Approval evidence on file: none.

Decisions the owner may take:

| Option | Resulting state | Effect |
| --- | --- | --- |
| APPROVE | ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER | Establishes the named artifact version as the engineering canonical for this persona. Settles or explicitly defers each listed product decision. Issues no institutional authority and activates nothing. |
| REJECT | REJECTED_BY_AUTHORIZED_PRODUCT_OWNER | The artifact version is not the engineering canonical. The persona stays unresolved and its Gate 0 blocker stays. |
| RETURN_FOR_REWORK | RETURNED_FOR_REWORK | The named reasons are recorded and a new artifact version is prepared. The returned version stays preserved. |

Required approval evidence: decisionMaker.name, decisionMaker.role, decidedOn, artifactVersion, artifactSha256, scope, evidenceDocument.reference, evidenceDocument.sha256, independentOfPreparer.

Product decisions this record settles or defers: DEC-PD-09, DEC-PD-10, DEC-PD-11, DEC-PD-13, DEC-PD-14, DEC-PD-0C2-07, DEC-PD-0C2-08, DEC-PD-0C2-09, DEC-PD-0C2-10.

Institutional authority decisions this record lists: DEC-IA-16, DEC-IA-24, DEC-IA-25, DEC-IA-26, DEC-IA-31. The decision identifiers beginning DEC-IA are institutional authority decisions. Approving the package cannot settle, adopt or issue them; they stay outstanding.

Decisions shared with another persona record: DEC-PD-14 (PDR-0C2-FINANCIAL-OFFICER-V1, PDR-0C2-REPRESENTATIVE-V1); DEC-PD-0C2-10 (PDR-0C2-FINANCIAL-OFFICER-V1, PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1).

Depends on: representative via RELATED_REQUIREMENT; representative via SHARED_OBLIGATION; steward via SHARED_OBLIGATION.

Evidence still unavailable:

- GAP-FO-CANONICAL-CITED-NOT-RECOVERED (IRREDUCIBLE_HISTORICAL): UE-FINANCIAL-OFFICER-CANONICAL-2.1 is cited as FROZEN (design only) and exists in no ref. The package is a reconstruction candidate and is not that document.
- GAP-FO-IDENTIFIERS-UNSPECIFIED (IRREDUCIBLE_HISTORICAL): Of the 38 historical identifiers, four carry their own title or status, six carry only group labels and twenty-eight have no individual meaning in any source. F01 to F28 meanings are new design under a historical status or group.
- GAP-FO-NO-FINANCE-SOURCE (SOURCE): No source describes any organization’s finance structure. The four organization scenarios are hypotheses. The existing finance page is Nzila platform billing and is not union finance.
- GAP-FO-NO-CAPABILITY-OWNER (ENGINEERING_OWNERSHIP): The navigation and several domain contracts have no implementation capability. Their completion owner is the Financial Officer tracking capability UE-OMIT-FINANCE-RANGE-UNSPECIFIED until a finance capability exists.

A product approval does not:

- Issue, approve or activate any of the 79 outstanding institutional decisions or the 32 baseline institutional authority decisions.
- Issue a financial mandate, a triage designation, a supervisory mandate, a delegation, an appointment or any other instrument.
- Create, name or fill an institutional office, including a steward office.
- Change an implementation status, a security status, a release disposition or a runtime qualification status.
- Resolve any ratchet, test or route defect.


## Steward structure

The preparer recommends OPT-C-SCOPED-PROFILE. The recommendation is not a selection and nothing is selected or ratified. The recommendation is not a selection. If the product owner selects another option, the Steward package is returned or rejected rather than approved as written.

| Option | Title |
| --- | --- |
| OPT-A-DISTINCT-PERSONA | Distinct persona with an independent action universe |
| OPT-B-LEVEL-WITHIN-REPRESENTATIVE | Scoped level within Representative 2.2 only |
| OPT-C-SCOPED-PROFILE | Scoped profile of Representative 2.2 with its own presentation profile and acceptance profile |

## Order of ratification

The Steward structure decision and DEC-PD-01 are listed by more than one persona record, and DEC-PD-0C2-10 asks for the order of product acceptance. Decisions shared by more than one persona record: DEC-PD-01, DEC-PD-03, DEC-PD-04, DEC-PD-05, DEC-PD-0C2-10, DEC-PD-12, DEC-PD-14. The dossier states no sequencing opinion.

## The 24 outstanding product decisions

| Decision | Family | Title | Personas | Settled by |
| --- | --- | --- | --- | --- |
| DEC-PD-01 | BASELINE_PRODUCT | Steward as a distinct persona | representative, steward | PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1 |
| DEC-PD-02 | BASELINE_PRODUCT | Steward navigation | steward | PDR-0C2-STEWARD-V1 |
| DEC-PD-03 | BASELINE_PRODUCT | Default visibility of working notes | representative, steward | PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1 |
| DEC-PD-04 | BASELINE_PRODUCT | Intake classification | representative, steward | PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1 |
| DEC-PD-05 | BASELINE_PRODUCT | Assignment acknowledgement and handoff summary | representative, steward | PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1 |
| DEC-PD-06 | BASELINE_PRODUCT | Representative R-domain meanings | representative | PDR-0C2-REPRESENTATIVE-V1 |
| DEC-PD-07 | BASELINE_PRODUCT | R18 status vocabulary | representative | PDR-0C2-REPRESENTATIVE-V1 |
| DEC-PD-08 | BASELINE_PRODUCT | Journeys A–G acceptance form | representative | PDR-0C2-REPRESENTATIVE-V1 |
| DEC-PD-09 | BASELINE_PRODUCT | Financial Officer domain map | financial-officer | PDR-0C2-FINANCIAL-OFFICER-V1 |
| DEC-PD-10 | BASELINE_PRODUCT | Financial navigation names | financial-officer | PDR-0C2-FINANCIAL-OFFICER-V1 |
| DEC-PD-11 | BASELINE_PRODUCT | Financial journeys FJ01–FJ10 | financial-officer | PDR-0C2-FINANCIAL-OFFICER-V1 |
| DEC-PD-12 | BASELINE_PRODUCT | Deadline extension workflow | representative, steward | PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1 |
| DEC-PD-13 | BASELINE_PRODUCT | Financial reporting scope | financial-officer | PDR-0C2-FINANCIAL-OFFICER-V1 |
| DEC-PD-14 | BASELINE_PRODUCT | Organization scenario coverage | financial-officer, representative | PDR-0C2-FINANCIAL-OFFICER-V1, PDR-0C2-REPRESENTATIVE-V1 |
| DEC-PD-0C2-01 | GATE_0C2_PRODUCT | Steward access when a relationship or the platform role ends | steward | PDR-0C2-STEWARD-V1 |
| DEC-PD-0C2-02 | GATE_0C2_PRODUCT | Steward scope across federations, locals and territories | steward | PDR-0C2-STEWARD-V1 |
| DEC-PD-0C2-03 | GATE_0C2_PRODUCT | Steward absence cover and substitution | steward | PDR-0C2-STEWARD-V1 |
| DEC-PD-0C2-04 | GATE_0C2_PRODUCT | Representative scope across federations and affiliated organizations | representative | PDR-0C2-REPRESENTATIVE-V1 |
| DEC-PD-0C2-05 | GATE_0C2_PRODUCT | Explicit denial of financial authority for the representative | representative | PDR-0C2-REPRESENTATIVE-V1 |
| DEC-PD-0C2-06 | GATE_0C2_PRODUCT | Former representative access and mandate termination | representative | PDR-0C2-REPRESENTATIVE-V1 |
| DEC-PD-0C2-07 | GATE_0C2_PRODUCT | Finance scope across affiliates and multiple organizations | financial-officer | PDR-0C2-FINANCIAL-OFFICER-V1 |
| DEC-PD-0C2-08 | GATE_0C2_PRODUCT | Absent mandate holder without delegation | financial-officer | PDR-0C2-FINANCIAL-OFFICER-V1 |
| DEC-PD-0C2-09 | GATE_0C2_PRODUCT | Financial notifications and workflow transitions | financial-officer | PDR-0C2-FINANCIAL-OFFICER-V1 |
| DEC-PD-0C2-10 | GATE_0C2_PRODUCT | Order of product acceptance and the Steward structure | all | PDR-0C2-FINANCIAL-OFFICER-V1, PDR-0C2-REPRESENTATIVE-V1, PDR-0C2-STEWARD-V1 |

## Boundary with institutional decisions

None of the institutional decisions is settled by a product ratification. They are carried in the institutional decision dossier. 111 institutional decisions stay outstanding. A product ratification issues no institutional permission.
