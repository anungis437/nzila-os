# Gate 0 scope lock (adversarial rework)

Mission: `UE-FINAL-CONVERGENCE-2026-10`. Verdict: `IN_PROGRESS`.

The earlier verdict, `READY_FOR_ADVERSARIAL_REVIEW`, is withdrawn. The adversarial review of `2247978bd642a89a7d4f8bd720b978f789cb4437` returned REWORK REQUIRED. This report states what Gate 0 can and cannot prove today. `matrix.gate0Verdict` is computed from the validator's blockers and the validator rejects any other value. `CURSOR_IMPLEMENTATION_COMPLETE` stays false. Staging and production stay NO-GO. This rework does not start Gate 1.

## Evaluated SHAs

| Fact | SHA |
| --- | --- |
| Reviewed HEAD (verdict REWORK REQUIRED) | `2247978bd642a89a7d4f8bd720b978f789cb4437` |
| Evidence recorder | `e9b8cbe6a` |
| First executed-evidence recording | `8c40e84d6` |
| Validator, persona, ownership, lock, and test rework | `b3a7f4046` |
| Regenerated matrix, route ownership, lock, and evidence | `489f16277` |
| This report | the next commit; a file cannot contain its own SHA |

The capability lock is anchored to the reviewed HEAD. It reads that commit's matrix with `git show`, so editing the working-tree matrix cannot rewrite the anchor.

## Why the old 102 of 102 headline was incomplete

The earlier extractor counted only the tokens it could see. It matched 102 persona actions, 14 of them for the Financial Officer, and then reported that all 102 were mapped. That proved the extractor against itself. It did not prove coverage of the personas:

- The Steward had no action list, and the report recorded that as out of scope.
- The Representative disposition cites `UE-REPRESENTATIVE-CANONICAL-2.2`, which is not in the repository, and its action list was never extracted.
- The Financial Officer disposition cites `F01–F28` and `FJ01–FJ10`. Range endpoints were counted as actions and the interior of each range was never expanded.
- Routes were mapped by guard class, not by route and method.

Coverage is now measured against each persona's declared universe. The validator refuses a `READY_FOR_ADVERSARIAL_REVIEW` verdict while any persona universe is unresolved.

## Register reconciliation

The register has 41 entries: CLOSED 8, OPEN 12, IN_PROGRESS 17, EXTERNAL_GATE 4. `UE-CONV-H-007`, `UE-CONV-K-006`, `UE-CONV-K-009`, and `UE-CONV-G-002` stay IN_PROGRESS. The four EXTERNAL_GATE entries stay `operationallyActivated` false. `UE-CONV-H-007` stays one workstream with census 231; the census was not edited and the 231 rows are not copied into the matrix.

## Persona-source coverage

182 persona action identifiers are extracted and mapped to a capability. Individually defined means the source gives that identifier its own definition. Grouped only means the identifier appears only inside a range or a list that carries one shared title. Unspecified means the source cites the identifier as an endpoint or range member and gives it no content.

| Persona | Source | Universe | Individually defined | Grouped only | Unspecified | Resolved |
| --- | --- | --- | --- | --- | --- | --- |
| Member | `UE_MEMBER_CANONICAL_2_1.md` | 10 | 10 | 0 | 0 | yes |
| Steward | no canonical file in the repository | 0 | 0 | 0 | 0 | no |
| Representative | `UE_REPRESENTATIVE_2_2_CONVERGENCE_DISPOSITION.md` (canonical 2.2 file absent) | 56 | 32 | 14 | 10 | no |
| Senior representative | `32_UE_SENIOR_REPRESENTATIVE_2_1_CONVERGENCE_DISPOSITION.md` | 22 | 22 | 0 | 0 | yes |
| Officer / executive | `apps/union-eyes/lib/executive/capability-matrix.ts` | 26 | 26 | 0 | 0 | yes |
| Financial officer | `UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION.md` (canonical file absent) | 38 | 4 | 6 | 28 | no |
| Governance officer | `UE-GOVERNANCE-OFFICER-CANONICAL-2.1.md` | 30 | 30 | 0 | 0 | yes |

Total: 182 identifiers, 124 individually defined.

Unresolved detail:

- Steward: no action universe exists. `UE-OMIT-STEWARD-CANONICAL-ABSENT` (gate 10, `SOURCE_UNSPECIFIED`) owns the gap. The earlier out-of-scope record for the Steward was removed, because absent specs are debt and not an exclusion.
- Representative: individually defined `REP-NAV-1..7` and `REP-ACT-01..25`. Grouped only `R03 R04 R05 R06 R10 R16 R17 R18 R19 R20 R21 R22 R23 R24`. Unspecified `R01 R02 R07 R08 R09 R11 R12 R13 R14 R15`. Owner `UE-OMIT-REP-CANONICAL-ABSENT`. Two source findings are tracked separately: `UE-OMIT-REP-CORRESPONDENCE` (gate 11, `PARTIAL`) and `UE-OMIT-REP-TRANSITION-REASON-LEAK` (gate 10, `NOT_IMPLEMENTED`).
- Financial officer: individually defined `F08 F09 F10 F19`. Grouped only `F11 F12 F13 F14 F17 F18`. Unspecified `F01–F07 F15 F16 F20–F28 FJ01–FJ10`. Owner `UE-OMIT-FINANCE-RANGE-UNSPECIFIED`. No title or action text was invented for any unspecified identifier.

No canonical source was invented. The three unresolved personas make Gate 0 `IN_PROGRESS` until the repository contains those sources.

## Route and method ownership

The 993-route manifest is unchanged: 993 routes, 1644 route-method pairs. `ue-route-capability-ownership.json` owns every pair with a route, method, rule, capability, disposition, actor, control category, audit code, and privacy code (or a justified non-applicability). Rules carry evidence from the register, the frozen persona sources, or the capability registry. `matrix.routeOwnership.entriesHash` covers the entries, so deleting an entry fails validation even when the route hash is unchanged.

| Disposition | Operations |
| --- | --- |
| `OWNED` | 355 |
| `RETIRED_501` | 97 |
| `STUB_501` | 31 |
| `SYSTEM` | 9 |
| `SCOPE_UNDECIDED` | 1152 |
| Total | 1644 |

The validator rejects an operation without an entry, an entry without a capability, an owner that is not a capability, an owner that differs from the rule-derived owner, two owners for one operation, an entry for a route that is not in the manifest, a route that matches no rule, and a route file on disk that is neither in the manifest nor recorded as uninventoried.

Exceptions:

- `SCOPE_UNDECIDED` is 1152 operations, owned by `UE-OMIT-ROUTE-DOMAIN-SCOPE` (gate 13, `SOURCE_UNSPECIFIED`). Their control owner stays the guard-class owner. No register entry, persona source, or registry record names a business owner for those domains, and none was guessed. This blocks Gate 0 until each domain is decided.
- `reviews/route.ts` (GET, POST) exists on disk and is absent from the manifest. It is recorded as uninventoried and owned by `UE-CAP-REVIEW-INTAKE`. Regenerating the manifest belongs to `UE-CONV-K-008` and was not done here.
- 42 operations are unauthenticated without a recorded justification. The matrix summary counts them. They are not accepted as justified.
- 0 mutating operations have an absent audit code.

## Capabilities

56 capabilities: 52 preserved plus 4 new records, `UE-OMIT-STEWARD-CANONICAL-ABSENT`, `UE-OMIT-REP-CORRESPONDENCE`, `UE-OMIT-REP-TRANSITION-REASON-LEAK`, and `UE-OMIT-ROUTE-DOMAIN-SCOPE`.

| Status | Count |
| --- | --- |
| `NOT_IMPLEMENTED` | 12 |
| `PARTIAL` | 27 |
| `SOURCE_IMPLEMENTED` | 2 |
| `SOURCE_VERIFIED` | 5 |
| `NATIVE_PENDING` | 2 |
| `EXTERNAL_GATE` | 4 |
| `SOURCE_UNSPECIFIED` | 4 |

By primary gate: 1:7, 2:1, 3:1, 4:2, 5:5, 6:4, 7:3, 8:3, 9:5, 10:8, 11:3, 12:2, 13:3, 14:3, 15:5, schema-census:1.

No capability has a native or browser qualification of `PASS`.

## Source-verification evidence

`SOURCE_VERIFIED` now requires an executed record in `evidence/gate0-source-verification.json` with the command, the tested revision, the suite and assertion family, the executed result, the capability, the exclusions, the blob hashes of the cited test and source files, and a log hash. The validator rejects a record whose cited blobs changed, whose run failed, skipped tests, or ran no tests, whose tested revision is not a commit, or whose recorded output does not match its hash. A test file that exists but has no execution record no longer qualifies.

Tested revision for every record: `8c40e84d6`.

| Capability | Suite | Result | Status |
| --- | --- | --- | --- |
| `UE-CAP-F-001` | authority kernel resources and lifecycle PGlite | 69 passed | `SOURCE_VERIFIED` |
| `UE-CAP-G-001` | counsel boundary, resources, counsel PGlite | exit 1, 53 passed, 13 skipped | `PARTIAL` (downgraded from `SOURCE_VERIFIED`) |
| `UE-CAP-H-001` | anti-theatre scan | 33 passed | `SOURCE_VERIFIED` |
| `UE-CAP-K-002` | anti-theatre scan | 33 passed | `SOURCE_VERIFIED` |
| `UE-CAP-H-005` | admin seed route | 2 passed | `SOURCE_VERIFIED` |
| `UE-CAP-K-001` | migration lineage certification | 9 passed | `SOURCE_VERIFIED` |
| `UE-CAP-K-003` | convergence checker | 12 passed | `PARTIAL` (evidence recorded, status not raised) |
| `UE-CAP-REVIEW-INTAKE` | review-intake PGlite, route, component | 12 passed | `PARTIAL` (evidence recorded, status not raised) |
| `UE-OMIT-DELIVERY-EVIDENCE` | delivery reconciliation | 9 passed | `NATIVE_PENDING` |

`UE-CAP-G-001` was `SOURCE_VERIFIED` on the strength of a referenced test file. Executing the counsel PGlite suite fails at setup with `REFERRAL_SCOPE_REQUIRED`, raised by a migration 0037 trigger, so 13 tests skip. The capability is downgraded to `PARTIAL` and the suite is tracked as a defect blocking Gate 7. No test or migration was changed.

Recorded exclusions: PGlite results are not native PostgreSQL proof, anti-theatre scans do not prove runtime behaviour, and none of these runs is a credentialed browser run. Counsel execution stays `UE-CONV-G-003` (`EXTERNAL_GATE`) and has no HTTP route.

## Independent capability lock

`ue-gate0-capability-lock.json` is a second list of the mandatory capability IDs. It carries `anchorCommit` `2247978bd642a89a7d4f8bd720b978f789cb4437`, and the validator reads that commit's matrix with `git show`. Deleting a capability from both the matrix `capabilities` array and the matrix's own `lockedCapabilityIds` array still fails, because the anchored matrix and the lock file still name it. A capability leaves the lock only through a `retirements` entry with `schemaVersion` 2 or later, a reason of at least 20 characters, and an evidence file that exists. A capability in the matrix without a lock entry also fails. The lock holds 56 IDs.

## Ratchet defects

`node tooling/scripts/check-ue-convergence.mjs` exits 1 on two ratchets that fail on this branch. Neither implementation file and neither allowlist was changed. Each defect has one owning capability, and the validator fails when a live ratchet failure is untracked or when a tracked defect no longer reproduces and is not recorded as resolved.

| Defect | File | Owner | Blocks acceptance of |
| --- | --- | --- | --- |
| `MUTABLE-REP-IDENTIFIER` | `apps/union-eyes/lib/authority/store/case-ownership-backfill.ts` | `UE-CAP-B-001` | Gate 2 |
| `DIRECT-MANDATORY-AUDIT-IMPORT` | `apps/union-eyes/lib/voting/election-succession.ts` | `UE-CAP-K-005` | Gates 14 and 12 |
| `COUNSEL-PGLITE-SUITE-FAILS-AT-SETUP` | `apps/union-eyes/db/__tests__/authority-kernel-counsel.pglite.test.ts` | `UE-CAP-G-001` | Gate 7 |
| `P0-F2-TRANSITION-REASON-LEAK` | `apps/union-eyes/app/api/cases/[caseId]/transition/route.ts` | `UE-OMIT-REP-TRANSITION-REASON-LEAK` | Gate 10 |

The checker's global failure is unresolved debt, not a pass. The stale allowlist note for `apps/union-eyes/app/api/grievances/[id]/convert/route.ts` is non-failing and was not edited.

## Tests

Run from `/home/ubuntu/ue-cursor-final-closure` on Monday, October 26, 2026, America/Toronto, against the tree at `489f16277`.

| Command | Result |
| --- | --- |
| `node --test tooling/scripts/lib/ue-gate0-scope-lock.test.mjs` | 33 passed, 0 failed |
| `node --test tooling/scripts/lib/ue-convergence-check.test.mjs` | 12 passed, 0 failed |
| `node tooling/scripts/check-ue-convergence.mjs` | exit 1. Register valid (41 entries). Migration lineage verified. Two ratchet failures, above. |

The 33 Gate 0 tests are the 14 original tests plus 19 new tests. The new negative tests cover: a missing Steward, a missing Representative, a Financial Officer marked complete while specs are unresolved, an existing route with no capability owner, an unrelated or invalid owner, deleted ownership with an unchanged route hash, `SOURCE_VERIFIED` backed by a test file with no execution evidence, a capability removed from both the matrix and its in-matrix lock array, and global convergence failures omitted from tracked debt. Further cases cover orphan, conflicting, and unclassified entries, an uninventoried route, stale or tampered evidence, a lock retirement without a reason, a capability added without a lock entry, a single owner per ratchet defect, and a verdict that disagrees with the blockers.

The matrix validator returns 0 problems and 5 blocker groups. A problem is a rule violation. A blocker is unfinished Gate 0 scope.

## Remaining Gate 0 blockers

1. Steward action universe is absent from the repository.
2. Representative canonical 2.2 file is absent; 10 identifiers are unspecified and 14 are grouped only.
3. Financial Officer canonical file is absent; 28 identifiers are unspecified and 6 are grouped only.
4. 1152 route operations are `SCOPE_UNDECIDED`.
5. `reviews/route.ts` is on disk and not in the route-coverage manifest.

Gate acceptance debt that is tracked and not a Gate 0 blocker: the four defects above.

## Not done

No runtime migration, application source, security allowlist, or census change. No Docker, native PostgreSQL, or Next server run. Migrations 0031–0037 and cache 0028 are not applied. Gate 1 does not start. The next action is an independent adversarial review of these artifacts.
