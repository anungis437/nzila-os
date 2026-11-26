# Union Eyes V2 Step 2 adversarial review

Reviewed against the S2.00 package before the plan was frozen. Each finding is either in a work package or has a disposition. No finding is closed by calling a deferred capability passed.

`STEP_2_PLANNING_COMPLETE = YES` means the plan is executable. `STEP_2_ENGINEERING_COMPLETE = NO`. `STEP_2_ACCEPTED = NO`. `STAGING_GO = HELD`. `PRODUCTION_GO = HELD`. `UE_SAAS_OPERATIONAL_READINESS = NO_GO`. `fullReadiness = NOT_YET_PROVEN`.

## Findings

| # | Challenge | Disposition |
| --- | --- | --- |
| 1 | A role title is being treated as authority. | The matrix rule requires identity, active membership, capacity and resource authority. Every required role has its own C08 boundary row. Platform and affiliated titles deny local case access. Package S2.04-MANDATE. |
| 2 | An executive can see an unassigned case. | S2.05-CASE acceptance says an unassigned case is hidden from an office title. The row is unexecuted. |
| 3 | Affiliation grants cross-union access. | SA16 and the five affiliated roles expect `DENY_WITHOUT_MATTER_MANDATE`. PM03 is a required variant and still needs a live mandate. PM05 stays deferred. |
| 4 | Counsel documents leak through a professional title. | SA17 is deferred. Its matrix rows are `DENY_DEFERRED_ACTOR_IS_NOT_A_PASS`. There is no counsel portal in Step 2. |
| 5 | External actors have no boundary. | SA15, SA18, SA19 and SA22 are required and have denial or recipient-grant rows. S2.04-EXTERNAL executes them. A deferred tribunal or regulator is a denial, not a positive portal. |
| 6 | Recipient delivery is inferred from a queue row. | C02 stays `SOURCE_PRESENT_RUNTIME_UNPROVEN`. S2.06-INBOX requires a controlled inbox and a correlated provider state. O01 cannot pass on a queued status. |
| 7 | Closure or evidence release is inferred from intake. | C08 closure, C14 export and C13 staging bytes are unexecuted. Local shard 4 on `b00a362` is disposable evidence only. S2.05-DOCS and S2.05-CASE own the deployed proof. |
| 8 | Mandate revocation is delayed or ignored. | S2.04-ENTRA and S2.04-MANDATE require a revoked session and an expired mandate to be refused on the serving revision. The disposable sign-out proof does not transfer. |
| 9 | A failed audit is reported as a successful write. | Step 1 corrected two local cases. S2.05-RECOVERY requires the same failure mode on the serving revision, and a failed audit is not a pass. |
| 10 | The forward upgrade loses rows. | Historical rehearsals failed and rolled back. S2.02-REHEARSAL and S2.02-FORWARD require a new preimage comparison. Those old failures are not a successful rehearsal. |
| 11 | Tests from another image are credited to the candidate. | Every later package says evidence must name the serving SHA. Register proof status stays `UNEXECUTED` in this package. |
| 12 | Thirty-five stakeholder families are claimed from seven profiles. | The register counts 26 required and 9 deferred. The seven profiles are named as a subset. Deferred families have denial rows only. |
| 13 | O09, O10 or PM05 is counted as done. | The validator rejects a deferred operation whose disposition is not `DEFERRED_NOT_A_PASS`, and a deferred actor whose expected result is an allow. |
| 14 | Bilingual, mobile or accessibility proof is missing. | S2.07-UX owns O11 and O12 on the serving revision, including a narrow viewport. O10 stays deferred. The Step 1 local browser matrix is not that package. |
| 15 | Backup and restore evidence is missing. | S2.07-OPS owns O04, O05, O07, O08 and O15. Fresh receipts are required. Historical backup notes do not transfer. |
| 16 | Finance is accidentally enabled. | Union finance and dues are excluded. Every required role has a finance denial row. S2.05-FINANCE is the deployed proof. Financial Officer 2.1 is out of scope. |
| 17 | The Step 1 legacy skip is reused as a waiver. | Applicability is `APPLICABLE_UNTIL_DISPROVEN`. S2.02-LEGACY-GATE decides from the fresh preimage. A current bootstrap is not a substitute. The four cases are not passes. |
| 18 | The serving SHA is chosen from the favourable receipt. | Resolution is `CONFLICTED_HISTORICAL`. S2.00 did not inspect Azure. S2.02-PREIMAGE is a stop condition. |
| 19 | File 26's RLS failure is either ignored or treated as the current database. | The deployment plan cites the different app name, revision and source. S2.02-PREIMAGE reads the V2 catalog. Neither the failure nor a later repair is inferred. |
| 20 | The advisory local-regression PASS is counted in the 20. | `LOCAL_HOLISTIC_REGRESSION` is advisory in `UE_STAGING_GO_CONTRACT.json`. The register counts 20 required criteria and marks each `UNEXECUTED`. |
| 21 | The action ledger's unqualified state erases Step 1. | The ledger is older than `b00a362`. Step 1 acceptance stays on the PR description. Staging acceptance is not inferred from it. |
| 22 | The full admin console was historically out of pilot and is now silently required. | One row in `historicalPilotScope.excluded` has scope `REQUIRED` and joins C01, C05, C06, C19 and C22. C19 stays in S2.05-LEAD. The historical exclusion is not the current ceiling. |

## Residual risk

The plan can be executed. The serving database and revision are still unknown until S2.02-PREIMAGE. That is a sequenced stop, not an open scope hole. No institutional mandate exists for case-scope backfill, so that backfill is outside the execution sequence. Customer adoption is not claimed.

O09 and O10 remain deferred. Their absence is a known availability and device-coverage limit, recorded here so a later staging decision cannot treat them as qualified.
