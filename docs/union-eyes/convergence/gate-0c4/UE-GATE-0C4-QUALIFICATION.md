# Union Eyes Gate 0C.4 - independent scope-lock qualification

Gate: GATE-0C.4. Accepted Gate 0C.3 commit: `ab9c184263020a95b91066014395f16dc3ec78e8`. Gate 0 verdict: IN_PROGRESS. Release authorization: NOT_GRANTED. UE_SAAS_OPERATIONAL_READINESS: NO_GO.

This gate challenges the Gate 0C.3 evidence and prepares decision dossiers. It repairs nothing, accepts no disposition, ratifies no persona, adopts no institutional decision, accepts no release risk and changes no application source, schema, migration or allowlist.

## Review provenance

The reviewer belongs to the same engineering-agent family that prepared the Gate 0C.3 registers. The review re-reads the source with a separate extractor and shares no code with the Gate 0C.3 builder, so it is independent in method. It is not an authority-independent approval and it accepts, ratifies and authorizes nothing.

- Route wrappers and role floors are re-extracted from each route file by a separate extractor that does not read any Gate 0C.3 register.
- Each cited quotation is searched in its cited file.
- Each affected operation is looked up in the classified inventory and in its route file.
- Each proposed disposition is tested against the rubric precondition the Gate 0C.3 register itself states.
- Each absence claim is searched for a contradicting token in the cited source.
- The 150-item index is rebuilt from the frozen registers and compared.

Not done: No test, database, browser, deployment or role-title check was run. No disposition, severity, owner or decision was changed. No authority-independent reviewer has accepted any record.

## Registers

| Register | File | sha256 |
| --- | --- | --- |
| qualification | `docs/union-eyes/convergence/register/ue-high-defect-qualification-0c4.json` | `9b924f1ecc99790e92e85279048502f7ea6902e9ee5a99ac96ba0692159e1e83` |
| evidence | `docs/union-eyes/convergence/register/ue-evidence-qualification-0c4.json` | `8185f1ce82d487ce1f4d040000922f2fb1f2249dcd59336fa20c3b25b0a45bf7` |
| supersessions | `docs/union-eyes/convergence/register/ue-supersession-clarification-0c4.json` | `dfd5d5bfe781392ced7613a89237ea6912e32615ccb3430a0310fb36c81f5930` |
| certification | `docs/union-eyes/convergence/register/ue-gate0-certification-model-0c4.json` | `51a4f0e84a694afccaefb1aec3f957917b5a11d19d7c9c62ae063c049471baa3` |
| product | `docs/union-eyes/convergence/register/ue-product-ratification-dossier-0c4.json` | `00f39e355722557800713c51367a61d81b68b275102602a02d7e3667e7f637da` |
| institutional | `docs/union-eyes/convergence/register/ue-institutional-decision-dossier-0c4.json` | `fddc314609ff653aed3d9f46f2e5affe64e191e5cb0aae07fce2ac73bdf7ed93` |

## Qualification of the 71 proposed dispositions

Every proposed disposition stays PROPOSED_NOT_ACCEPTED, no approval field is filled and no severity changed.

| Review status | Count |
| --- | --- |
| PARTIALLY_VERIFIED | 13 |
| REQUIRES_RUNTIME_PROOF | 34 |
| SOURCE_VERIFIED | 24 |

Source verification before the runtime rule is applied:

| Source verification | Count |
| --- | --- |
| PARTIALLY_VERIFIED | 31 |
| SOURCE_VERIFIED | 40 |

Stated activation state against the recomputed route declarations:

| Verdict | Count |
| --- | --- |
| CONSISTENT | 59 |
| CUSTOM_CHECK_UNPROVEN | 3 |
| MIXED | 4 |
| OVERSTATED | 2 |
| UNDERSTATED | 3 |

Independent finding codes:

| Code | Count |
| --- | --- |
| ABSENCE_CLAIM_CONTESTED | 7 |
| FLOOR_OVERSTATED | 2 |
| FLOOR_RESTS_ON_HANDLER_BODY | 3 |
| FLOOR_UNDERSTATED | 7 |
| LOCAL_GUARD_RETURNS_TRUE | 2 |
| RUBRIC_PRECEDENCE_AMBIGUOUS | 5 |
| RUBRIC_PRECONDITION_NOT_MET | 1 |
| STATED_FLOOR_ROLE_NOT_DECLARED | 6 |

Disposition sensitivity flags (for an authorized reviewer; nothing was changed):

| Flag | Count |
| --- | --- |
| POSSIBLY_TOO_LENIENT | 4 |
| POSSIBLY_TOO_STRICT | 2 |
| RUBRIC_APPLICATION_UNCLEAR | 6 |

### Records with a qualifying or challenge finding (22)

| Defect | Proposed | Review status | Findings |
| --- | --- | --- | --- |
| 0B1-BILLING-TARGET-ORG-UNBOUND | CONDITIONALLY_BLOCKING | REQUIRES_RUNTIME_PROOF | RUBRIC_PRECEDENCE_AMBIGUOUS |
| 0B1-CRUD-FACADE-ORG-MEMBERS | CONDITIONALLY_BLOCKING | PARTIALLY_VERIFIED | FLOOR_UNDERSTATED |
| 0B1-ORGANIZATIONS-CROSS-ORG-CONTACTS | CONDITIONALLY_BLOCKING | REQUIRES_RUNTIME_PROOF | RUBRIC_PRECEDENCE_AMBIGUOUS |
| 0B2-ANALYTICS-CRUD-FACADE | CONDITIONALLY_BLOCKING | PARTIALLY_VERIFIED | FLOOR_UNDERSTATED, LOCAL_GUARD_RETURNS_TRUE |
| 0B2-PLATFORM-DIRECTORY-UNSCOPED-READ | CONDITIONALLY_BLOCKING | REQUIRES_RUNTIME_PROOF | RUBRIC_PRECEDENCE_AMBIGUOUS, ABSENCE_CLAIM_CONTESTED |
| 0B2-UPDATE-ROLE-INERT | CONDITIONALLY_BLOCKING | PARTIALLY_VERIFIED | STATED_FLOOR_ROLE_NOT_DECLARED |
| 0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT | RELEASE_BLOCKING | REQUIRES_RUNTIME_PROOF | FLOOR_UNDERSTATED |
| 0B3-ARBITRATION-DECISIONS-ORG-ADMIN-DELETES-SHARED-ROW | RELEASE_BLOCKING | REQUIRES_RUNTIME_PROOF | STATED_FLOOR_ROLE_NOT_DECLARED |
| 0B3-BARGAINING-PROPOSALS-NO-TENANT-PREDICATE | RELEASE_BLOCKING | REQUIRES_RUNTIME_PROOF | FLOOR_UNDERSTATED, ABSENCE_CLAIM_CONTESTED |
| 0B3-BILLING-REPLAY-INVOICE-CROSS-TENANT-READ | RELEASE_BLOCKING | REQUIRES_RUNTIME_PROOF | ABSENCE_CLAIM_CONTESTED |
| 0B3-BULK-IMPORT-INERT | CONDITIONALLY_BLOCKING | PARTIALLY_VERIFIED | STATED_FLOOR_ROLE_NOT_DECLARED |
| 0B3-CRUD-BODY-MASS-ASSIGNMENT | RELEASE_BLOCKING | REQUIRES_RUNTIME_PROOF | LOCAL_GUARD_RETURNS_TRUE |
| 0B3-WEEKLY-SUMMARY-FABRICATED-MODEL-CLAIM | RELEASE_BLOCKING | PARTIALLY_VERIFIED | STATED_FLOOR_ROLE_NOT_DECLARED |
| 0B4-CALENDAR-ITEM-LOCKED-CHECK-INERT | RELEASE_BLOCKING | PARTIALLY_VERIFIED | FLOOR_OVERSTATED, STATED_FLOOR_ROLE_NOT_DECLARED |
| 0B4-CALENDAR-SYNC-ANY-MEMBER-CONNECTION | RELEASE_BLOCKING | PARTIALLY_VERIFIED | ABSENCE_CLAIM_CONTESTED |
| 0B4-CBA-CHILD-RECORDS-READ-BY-AGREEMENT-ID-ONLY | RELEASE_BLOCKING | REQUIRES_RUNTIME_PROOF | FLOOR_UNDERSTATED, ABSENCE_CLAIM_CONTESTED |
| 0B4-CLAUSE-LIBRARY-ANONYMIZATION-NOT-ENFORCED-ON-READ | RELEASE_BLOCKING | REQUIRES_RUNTIME_PROOF | FLOOR_OVERSTATED, STATED_FLOOR_ROLE_NOT_DECLARED |
| 0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES | CONDITIONALLY_BLOCKING | REQUIRES_RUNTIME_PROOF | FLOOR_UNDERSTATED, RUBRIC_PRECEDENCE_AMBIGUOUS |
| 0B5-SURVEY-RESPONSES-IDENTIFY-RESPONDENTS-TO-STEWARDS | RELEASE_BLOCKING | PARTIALLY_VERIFIED | RUBRIC_PRECONDITION_NOT_MET |
| 0B5-SURVEY-RESULTS-NO-ORG-PREDICATE-LOADS-ALL-ANSWERS | RELEASE_BLOCKING | REQUIRES_RUNTIME_PROOF | ABSENCE_CLAIM_CONTESTED |
| 0B6-SYS-INHERITANCE-ORG-SCOPE-NO-OP-ON-PENDING-PROFILES | CONDITIONALLY_BLOCKING | REQUIRES_RUNTIME_PROOF | RUBRIC_PRECEDENCE_AMBIGUOUS, ABSENCE_CLAIM_CONTESTED |
| 0B6-SYS-LOCATION-RETENTION-HAS-NO-SCHEDULER-IN-REPOSITORY | REVIEW_REQUIRED | REQUIRES_RUNTIME_PROOF | FLOOR_UNDERSTATED |

## The 150-item index

The sets are rebuilt from the frozen defect register (release dispositions and the release-blocking flag), the review queue and the handoff register. The Gate 0C.3 debt index is read only to compare.

| Measure | Value |
| --- | --- |
| Release-blocking dispositions | 32 |
| Conditional dispositions | 41 |
| Older HIGH defects awaiting assessment | 71 |
| Release-blocking exposure defects | 2 |
| Tracked ratchet, test and source items | 4 |
| Unique recomputed | 150 |
| Overlaps between groups | 0 |
| Indexed items | 150 |
| Matches the Gate 0C.3 index | yes |

This verifies that the index counts each frozen record once. It does not verify that the frozen records are complete: a defect never recorded in the register cannot appear in either count.

## The two OPL challenges

The files the two challenges cite are compared by blob between the challenge commit and the working tree, and every file that names the flag is compared by name.

| Challenge | Frozen disposition | Challenge position | Containment status |
| --- | --- | --- | --- |
| CHALLENGE-0B10-OPL-01 | CONDITIONALLY_BLOCKING | RELEASE_BLOCKING_PENDING_CONTAINMENT_PROOF | REQUIRES_RUNTIME_PROOF |
| CHALLENGE-0B10-OPL-07 | CONDITIONALLY_BLOCKING | RELEASE_BLOCKING_PENDING_CONTAINMENT_PROOF | REQUIRES_RUNTIME_PROOF |

The challenges are not additional defects and neither supersedes the frozen conditional disposition. Row-level-security enforcement for the connecting database role and the deployed flag value cannot be read from the repository.

## The three public exposures

Each of the three handlers is a plain exported function with no authentication wrapper, so the handler itself does not restrict the caller. None of the three paths is in the proxy allowlist the proxy consults (only /api/docs/openapi.json is), so whether an unauthenticated caller reaches them is decided by the proxy and the deployment, which the repository cannot show. The record keeps the exposure contract as release blocking and does not rely on either reading.

| Operation | Handler | In proxy allowlist | Justification recorded | Public reachability |
| --- | --- | --- | --- | --- |
| docs/openapi/route.ts\|GET | FUNCTION_DECLARATION | no | NONE_RECORDED | REQUIRES_RUNTIME_PROOF |
| docs/route.ts\|GET | FUNCTION_DECLARATION | no | NONE_RECORDED | REQUIRES_RUNTIME_PROOF |
| version/route.ts\|GET | FUNCTION_DECLARATION | no | NONE_RECORDED | REQUIRES_RUNTIME_PROOF |

## Per-capita relationship

The health-and-welfare path and the four tax paths are separate advertised paths over the same table at the same member read floor. The source shows the same exposure on both. The difference between the MEDIUM and the HIGH rating is therefore not explained by the route source.

| Defect | Severity | In the 150-item index |
| --- | --- | --- |
| 0B8-JUR-HEALTH-WELFARE-PLANS-PATH-IS-THE-PER-CAPITA-REMITTANCE-LEDGER-AT-MEMBER-FLOOR | MEDIUM | no |
| 0B12-CRUD-TAX-PATHS-SERVE-THE-PER-CAPITA-REMITTANCE-LEDGER-TO-ANY-MEMBER | HIGH | yes |

The MEDIUM record is not an item of the 150-item index although the route it describes exposes the same ledger at the same floor as the indexed HIGH record. It is cross-referenced here and remains an obligation of its engineering owner; it is not added to the index by this gate.

## Carbon evidence

Superseded statement (frozen text is preserved, not edited): No table, service, persona source, register entry or product caller names carbon accounting or Azure emissions monitoring.

Narrower supported finding: Sources outside the four route files do name carbon accounting. None of them has been demonstrated to supply measured evidence to the four classified routes: no route file imports a carbon component, and the components record their figures as estimates or caller-entered amounts.

Not established: That no measured carbon data source exists anywhere in the platform. That the backend recording path is outside the released scope. That a source citation is absent from every register for the four operations.

Absence of an import in the four files shows no source-level link. It does not show that the components are unused at runtime or that no measured feed exists in a deployment.

## Retention scheduler search

Files outside the route name it; each needs reading to decide whether it schedules the route. It does not establish: That no retention mechanism exists. A scheduler can be configured in a deployment, a platform console or another repository, none of which is searched. That location data is or is not deleted in any deployment.

## Supersession and clarification records

38 records (CLARIFICATION 37, SUPERSESSION 1), 30 of them about claims in the 71 assessments. Each names the frozen record by hash and changes nothing.

## Presentation of the Gate 0 criteria

The seven criteria are documentary criteria. They carry the label DOCUMENTARY_SCOPE_RECORD_COMPLETE. They are shown only with the qualifiers that sit beside them: independent Gate 0 certification NOT_GRANTED, persona ratification PENDING, institutional authority decisions OUTSTANDING, release authorization NOT_GRANTED and UE_SAAS_OPERATIONAL_READINESS NO_GO.
