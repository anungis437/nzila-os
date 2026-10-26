# Gate 0 scope lock

Mission: `UE-FINAL-CONVERGENCE-2026-10`. Verdict: `READY_FOR_ADVERSARIAL_REVIEW`.

This report locks the engineering inventory. It does not implement Gates 1–15, and it does not declare Union Eyes source-implementation complete. `CURSOR_IMPLEMENTATION_COMPLETE` stays false. Staging and production stay NO-GO.

## Evaluated SHAs

| Fact | SHA |
| --- | --- |
| Source inventories read at HEAD before these artifacts | `ce854162cae5595f2f00e65db14444229da0a6ab` |
| Matrix and validator commit | `3f452bf7cbd9e92e4f8910e8b3f7c51521b35bf0` |

The matrix field `evaluatedBaselineSha` is the inventory SHA. The matrix commit adds the matrix, the builder, and the checker. This report is a later commit and does not change that matrix. The branch tip after the report commit is the closure commit; a file cannot contain its own commit SHA.

## Register reconciliation

The register at the inventory SHA has 41 entries. The counts match the expected census:

| Status | Count |
| --- | --- |
| CLOSED | 8 |
| OPEN | 12 |
| IN_PROGRESS | 17 |
| EXTERNAL_GATE | 4 |

No historical count was forced. The checker reads `docs/union-eyes/convergence/register/ue-convergence-register.json` and requires one owner capability `UE-CAP-<suffix>` for each `UE-CONV-<suffix>`. All 41 owners are present. `UE-CONV-H-007` remains one capability, `UE-CAP-H-007`, with `censusCount` 231, `individuallyReclassified` false, and primary gate `schema-census`. The 231 census rows were not copied into the matrix.

## Capabilities and persona actions

52 distinct capabilities. 41 own a register entry. 11 are additional obligations: member review intake, plus the 10 omissions below.

102 mandatory persona actions were extracted from the frozen sources and mapped:

| Persona | Source | Actions |
| --- | --- | --- |
| Governance officer | `docs/union-eyes/governance-officer/UE-GOVERNANCE-OFFICER-CANONICAL-2.1.md` | G01–G30 (30) |
| Officer / executive | `apps/union-eyes/lib/executive/capability-matrix.ts` | O01–O26 (26) |
| Senior representative | `docs/union-eyes/reality-remediation/32_UE_SENIOR_REPRESENTATIVE_2_1_CONVERGENCE_DISPOSITION.md` section 4 | SR01–SR22 (22) |
| Member | `docs/union-eyes/reality-remediation/UE_MEMBER_CANONICAL_2_1.md` | M01–M10 (10) |
| Financial officer | `docs/union-eyes/financial-officer/UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION.md` | 14 tokens that actually appear |

Each action maps to exactly one capability. Review intake (`UE-CAP-REVIEW-INTAKE`) is a separate obligation from `UE-CONV-I-001` and `UE-CONV-K-009`. It does not close either register entry.

## Mapping by primary gate

| Gate | Capabilities |
| --- | --- |
| 1 Identity, sessions and membership | 7 |
| 2 Case ownership and representation | 1 |
| 3 Bargaining units, territories and respondents | 1 |
| 4 Claims/grievances convergence | 2 |
| 5 Finance operating model | 5 |
| 6 Documents, privacy and records | 4 |
| 7 WorkAid union-side completion | 3 |
| 8 Thirteen stubbed operations | 3 |
| 9 Runtime and installation architecture | 5 |
| 10 Frozen persona journeys | 6 |
| 11 Member/staff messaging | 2 |
| 12 Voting, elections and reviews | 2 |
| 13 Generic CRUD and route authorization | 2 |
| 14 Audit, mutation isolation and security | 3 |
| 15 Machine-enforced completion and cleanroom readiness | 5 |
| schema-census (`UE-CONV-H-007` only) | 1 |

Status counts inside the matrix: `NOT_IMPLEMENTED` 11, `PARTIAL` 25, `SOURCE_IMPLEMENTED` 2, `SOURCE_VERIFIED` 6, `NATIVE_PENDING` 2, `EXTERNAL_GATE` 4, `SOURCE_UNSPECIFIED` 2. `SOURCE_VERIFIED` means the cited source test or checker file exists. It is not a native PostgreSQL pass and not a credentialed browser pass. No capability has `nativeQualification` or `browserQualification` of `PASS`. No `EXTERNAL_GATE` is operationally activated.

## Newly identified obligations

These were not separate rows in the 41-entry register. Each has source evidence in the matrix.

| ID | Evidence | Status |
| --- | --- | --- |
| `UE-OMIT-M04-MEMBER-REQUESTS` | Member canonical M04: withdrawal, clarification, and acknowledgement are not implemented. Own-case read exists. | `PARTIAL` |
| `UE-OMIT-M04-LEGAL-DEADLINE` | Member canonical M04: legal-deadline calculation is unavailable. | `NOT_IMPLEMENTED` |
| `UE-OMIT-DEADLINE-OVERDUE` | Senior-representative SR10. Deadline-engine source exists; overdue processing is unproven. | `PARTIAL` |
| `UE-OMIT-PRIVACY-RIGHTS` | Member M09 and capability-registry DSAR, incident, jurisdictional privacy, and breach-notification entries. | `PARTIAL` |
| `UE-OMIT-MAIN-APP-CRONS` | Registry ids `UE-CRON-MONTHLY-DUES`, `UE-CRON-OVERDUE-NOTIFICATIONS`, `UE-CRON-PROCESS-MESSAGES`, `UE-CRON-PROCESS-NOTIFICATIONS`, `UE-CRON-SCHEDULED-REPORTS`. | `NOT_IMPLEMENTED` |
| `UE-OMIT-A11Y-BILINGUAL` | G30, O26, M10, SR22. Locale catalogs exist. WCAG 2.2 AA journey evidence does not. | `PARTIAL` |
| `UE-OMIT-FINANCE-UNAVAILABLE` | Financial disposition F10, F11–F14, F17, F18, and the matching registry entries. | `NOT_IMPLEMENTED` |
| `UE-OMIT-FINANCE-RANGE-UNSPECIFIED` | The disposition cites F01–F28 and FJ01–FJ10. Titles exist only for the named codes above plus F08, F09, and F19. | `SOURCE_UNSPECIFIED` |
| `UE-OMIT-REP-CANONICAL-ABSENT` | `UE_REPRESENTATIVE_2_2_CONVERGENCE_DISPOSITION.md` cites `UE-REPRESENTATIVE-CANONICAL-2.2`. That canonical file is not in the repository. | `SOURCE_UNSPECIFIED` |
| `UE-OMIT-DELIVERY-EVIDENCE` | `apps/union-eyes/lib/services/delivery-reconciliation.ts`. Native proof stays skipped unless `UE_DELIVERY_NATIVE_PROOF=1`. | `NATIVE_PENDING` |

`UE-CAP-REVIEW-INTAKE` is a split of work already named by the updated `UE-CONV-I-001` text. It is not an undiscovered product. Source commit `08f20236c540b556e022d7b430ba0cbf3e8470e2`. PGlite tests are not native proof.

## Outside committed scope

| ID | Why it is not an implementation obligation |
| --- | --- |
| `UE-SCOPE-ORG-HIERARCHY-SEED` | `UE-CONV-H-005` treats a canonical seed as optional. The route stays HTTP 501. |
| `UE-SCOPE-M07-UNADOPTED-SURFACES` | The member canonical tells My Union to show agreement, benefits, events, participation, and the digital card as not available. |
| `UE-SCOPE-REPORTS-DASHBOARD-REMOVED` | The capability registry records `/dashboard/reports` as removed. |
| `UE-SCOPE-WORKAID-SYNTHETIC-JOURNEYS` | `docs/union-eyes/workaid/14_PERSONA_JOURNEY_CONTRACTS.md` is an in-memory contract, not a Union Eyes route. |
| `UE-SCOPE-COUNSEL-HTTP-ROUTE` | No counsel HTTP route is in scope. Counsel verification stays `UE-CONV-G-003`. |
| `UE-SCOPE-STEWARD-NO-ACTION-MATRIX` | `UE-CONV-I-001` names the steward experience. No steward action-id matrix is in the repository, so none was invented. |

## Ownership, routes, and persistence

The checker found no duplicate `obligationKey` and no register entry with two owners.

The route manifest remains the inventory: 993 routes, hash `702046516e2d8cc8f70e9f50df62364bfe481f3fdc9733a1136d1891a1a56ecd`. Coverage is by guard class plus that hash and the per-guard counts. A new route or a new guard fails the checker until the matrix records it. The 993 routes were not copied into a second inventory.

Kernel actions: 41, hash `79252abd9e10b12af272c33ae7f3d9905865dd152682ce38f193710e81941954`, each assigned. Source: `apps/union-eyes/lib/authority/ontology.ts`.

The thirteen stub routes are listed on `UE-CAP-H-002` and checked against `UE-ACTION-*` `ownedBy` paths, including paths that contain brackets. Each file exists. Their current response is HTTP 501. That is not implementation.

Persistence still absent, as recorded on the owning capability and not created here: `unit_id`, `territory_id`, and `case_respondents` (`UE-CAP-B-002`); document grant, expiry, and revocation (`UE-CAP-F-002`); the thirteen stub operations; the five main-app crons.

Additional cron routes exist beyond those five registry ids, including `app/api/cron/deadline-overdue/route.ts`, whose own header says partially implemented. They stay under the route-manifest guard count. Gate 0 does not reclassify each one.

## External gates

`UE-CAP-A-007`, `UE-CAP-F-003`, `UE-CAP-G-003`, and `UE-CAP-J-001` stay `EXTERNAL_GATE` with `operationallyActivated` false. Missing proofs are the owners and texts already on the register: webhook and Whop evidence, an institutional classification instrument, counsel verifier and key custody, and clone qualification of kernel migrations. Code cited for the classification workflow does not activate the gate.

## Tests

Run from `/home/ubuntu/ue-cursor-final-closure` on Monday, October 26, 2026, about 3:47 PM America/Toronto, against the matrix commit's tree before this report.

| Command | Result |
| --- | --- |
| `node --test tooling/scripts/lib/ue-gate0-scope-lock.test.mjs` | 14 passed, 0 failed |
| `node --test tooling/scripts/lib/ue-convergence-check.test.mjs` | 12 passed, 0 failed |
| `node tooling/scripts/check-ue-convergence.mjs` | Register validation passed (41 entries, same counts). Migration lineage verified. Two pre-existing ratchet failures, below. |

The Gate 0 file includes negative cases for a missing register owner, a missing persona action, a duplicate obligation, an invalid gate, a missing source file, missing test evidence, native PASS without evidence, a skipped native suite cited as PASS, browser PASS without evidence, a new route, a new kernel action, an activated external gate, a disappeared required capability, and an individually reclassified census.

No Union Eyes typecheck was required. Gate 0 did not change TypeScript application code. Docker and native PostgreSQL were not run.

### Pre-existing ratchet failures

`node tooling/scripts/check-ue-convergence.mjs` failed on two matches that already exist on this branch and that Gate 0 did not introduce or allowlist:

- `MUTABLE-REP-IDENTIFIER`: `apps/union-eyes/lib/authority/store/case-ownership-backfill.ts`
- `DIRECT-MANDATORY-AUDIT-IMPORT`: `apps/union-eyes/lib/voting/election-succession.ts`

The checker also printed a stale allowlist note for `apps/union-eyes/app/api/grievances/[id]/convert/route.ts`. Stale notes do not fail the command. Gate 0 did not edit the ratchet file. Editing it to silence these matches would weaken the ratchet. Fixing the two files is implementation work for later gates, not a Gate 0 inventory change.

## Inventory changes

No change to the convergence register, the route-coverage manifest, the route-coverage baselines, the schema-mutation batches, the census, the authority kernel, migrations, or production configuration. New files are the matrix, its builder, the checker, this report, and a queue note that Gate 0 is not a native suite.

## Next-gate order

The next action is an independent adversarial review of these artifacts, then an explicit GO or REWORK. Gate 1 does not start from this report.

If that review returns GO, the primary order is: Gate 1, then Gates 2 and 3, then Gate 4's entity choice before `UE-CAP-K-010` can finish, then Gates 5 and 6, Gate 7's remaining native qualification with counsel still external, Gate 8, Gate 9 including the five crons and external clone qualification, Gates 10–12, then Gates 13 and 14, then Gate 15. `UE-CAP-K-004` stays open until controls consume this matrix. `UE-CONV-H-007` stays a single later census workstream and is not one of the 15 gates.

## Assumptions

Guard-class route assignment plus the manifest hash is the mechanical lock for new routes. It is not a claim that every route of a class is implemented. Financial codes that appear only as range endpoints have no titles in this repository; those titles were not invented. The representative canonical file's absence is treated as an unspecified action list, not as permission to write one. Stale WorkAid sentences in the member and senior-representative documents are not current evidence that the union-side code is absent.
