# 10 — Grok R3–R6 findings reconciliation

**Inputs ingested** (verbatim copies in [`grok-redteam-01/`](grok-redteam-01/)): the nine artifacts of `WA_GROK_REDTEAM_01_DELIVERABLES.zip` (every file byte-identical to its zip entry — verified by SHA-256), plus `WA_GROK_EXECUTIVE_VERDICT.md` and the independent triage `WorkAid_Grok_R3-R6_Triage_2026-10-23.md`. Original finding ids are preserved everywhere; nothing was renumbered.
**Register:** [09](09_ADVERSARIAL_FINDINGS_REGISTER.md) (generated) and `data/findings-register.json`. **Status words:** `ACCEPTED`, `REJECTED_WITH_EVIDENCE`, `NEEDS_VALIDATION`, `BLOCKED` (mission §9).

## 1. Count reconciliation

| Question | Answer | How it was established |
|---|---|---|
| R3 severity split | **8 P0, 15 P1, 3 P2 = 26** | Counted from the 26 `### WA-R3-nnn · … · Severity **Pn**` headings by `parseR3()`; test `R3 contains 26 findings: 8 P0, 15 P1, 3 P2` |
| Executive verdict | Internally inconsistent: its table says 8/15/3, its footer says **8/14/4** | Test `the executive verdict contradicts itself…` asserts both strings exist. The detailed findings file governs; the verdict should be corrected by its author. Not edited here (source evidence preserved) |
| R4–R6 | **31 entries**: CRITICAL 7, HIGH 15, MEDIUM 8, LOW 1; split R4 12 / R5 10 / R6 9 | `parseExtension()`; test `R4-R6 contain 31 findings…` |
| Total source entries | R1 22 + R2 9 + R3 26 + R4–R6 31 + INT 3 = **91 entries** | `allSourceFindings()` |
| Independent defects | **Not 91.** The 91 entries collapse into **23 overlap groups** plus ungrouped entries. Several entries restate one defect (for example SERVER-ACTION-GOVERNANCE, STORAGE, REVOCATION, PLATFORM-GATE) | Overlap map in the register; adding counts naively over-states risk |
| `WA-R3-017` / `WA-R3-025` | One platform release gate — "Union Eyes remains NO_GO" — recorded once as group `PLATFORM-GATE` with both ids | Neither is a new vulnerability; both are `CODEX_PLATFORM`-owned |
| Source commit of R4–R6 | Their research clone was `34f441d3`, which lacks the pack SHA; the R3 clone is at `38a824918` | All source claims were re-read from `38a824918` here (see [01](01_WORKAID_REALITY_BASELINE.md)); R4–R6 findings about code are accepted only where re-confirmed |

## 2. Overlap with R1/R2

Representative consolidations (full list in the register's `Overlaps` and `Group` columns):

| Group | Entries |
|---|---|
| `AUTHORITY-SEPARATION` | R1-05, R2-05, R3-007, R3-009 |
| `REVOCATION` | R1-13, R3-008, R3-015, R4-09 |
| `STORAGE` | R3-006, R3-012, INT-001, INT-002, INT-003 |
| `SEARCH-AUTHZ` | R3-005, R3-013 |
| `CLAIM-GRAPH` / `ITO-GROUPING` / `CROSS-EMPLOYER` | R1-06, R2-01, R2-02, R4-01, R4-02, R5-01, R5-02 |
| `RECEIPT-SEMANTICS` | R1-04, R4-04, R5-08 |
| `DEADLINE-HUMAN` / `DATE-RULES` | R1-01, R2-03, R5-09 / R1-11, R4-07 |
| `CLIO-ARCHITECTURE` | R1-10, R1-20, R3-024, R4-10, R6-01, R6-09 |
| `TRIBUNAL` | R2-07, R2-08, R5-05, R5-06, R5-07, R6-02 |
| `PLATFORM-GATE` | R3-017, R3-025 |

## 3. Evaluation of WA-INT-001 … WA-INT-003 (source-grounded hypotheses)

Each was checked against the **pinned blob** of `apps/union-eyes/lib/services/document-storage-service.ts` by an executable test, then reproduced synthetically. Status: **ACCEPTED** as source-confirmed; **exposure NOT proven** (no storage backend was contacted).

| ID | Source observation at `38a824918` | Test | Result | What remains unproven |
|---|---|---|---|---|
| WA-INT-001 | Line 169: `key = organization/${organizationId}/${timestamp}-${randomBytes}-${doc.documentName}`; metadata includes `documentName` (183, 216); error log includes `documentName` (252). Unsanitized name also means path characters in a user-supplied name land in the key | `[WA-INT-001] source builds the object key from the human document name and logs it`; `[WA-INT-001][WA-T097] a clinical-name canary appears in the legacy key, metadata and log context but not in the opaque design` | Confirmed; canary reaches key, metadata and log context | Whether keys surface in URLs, listings or logs outside this function |
| WA-INT-002 | Lines 196–197: comment "Generate read-only SAS URL valid for 1 year", then `const url = ${blobServiceClient.url}${this.bucket}/${key}` — no SAS token is generated | `[WA-INT-002] source says "SAS URL valid for 1 year" but returns a bare container URL with no signature` | Confirmed: the returned URL carries no signature | Whether the container ACL is private (then the URL is unusable) or public (then it is anonymous access). Neither exposure nor a working private download is proven |
| WA-INT-003 | S3/R2 branch awaits `PutObjectCommand` (≈221) and only then `getSignedUrl(... expiresIn: 365*24*60*60)` (236); both inside one `try` whose `catch` logs and rethrows; no delete | `[WA-INT-003] source puts the object before it signs, inside one try that rethrows`; `[WA-INT-003] reproduction: a signing failure after put leaves an orphan…` | Confirmed; reproduction leaves the object stored while the caller sees an error | Whether the AWS SDK actually throws for a one-year presign (see §4) |

## 4. Independent engineering findings that differ from, or add to, Grok

1. **WA-R3-006 may be an availability and orphan defect more than a one-year exposure.** S3 SigV4 query-string signing is capped at seven days (the triage cites AWS); a one-year `expiresIn` is therefore expected to be *rejected by the signer* rather than honoured. If so, uploads would fail *after* the object was stored — exactly WA-INT-003. The unsafe *intent* is confirmed; the *exposure* and the expected failure mode are both **`NEEDS_VALIDATION`** by running the real SDK against a mock endpoint in Codex's environment. Severity is left as sourced (P0) until that test runs.
2. **Recipient snapshot versus reassignment.** Grok's reusable-contract note says "recipient snapshot at schedule time, not live re-resolve". A pure snapshot contradicts WA-T048 (never notify a former assignee). The harness keeps the snapshot **and** adds epoch-based supersession plus a delivery-time re-validation (`[WA-ADV-11]`). Recommend the platform do the same for any WSIB receipt reminder.
3. **`wcb_claim` is not a WSIB specialization.** Agreed with the Grok architecture note, and strengthened: every external route hard-rejects any matter type except `'grievance'`, so WSIB matter access is `NOT_IMPLEMENTED`, not merely unproven.
4. **`representativeOrganizationId` is optional in `evaluateRepresentationAuthority`** (check is skipped when omitted) and the authority `scope` array is not read by the evaluators. Neither is in the Grok findings; both are routed to Codex as observations to confirm across all call sites.
5. **Mixed confidence in WA-R3-002/-004/-018.** They are `PARTIALLY_MITIGATED`/`BLOCKED_EXTERNAL_EVIDENCE` at source; no harness test can move them.

## 5. Disposition summary

`FIXED_PROVEN`: **0**. No finding is closed. WorkAid-owned findings whose contract is exercised by passing synthetic tests are `PARTIALLY_MITIGATED` with `proofLevel = SYNTHETIC_CONTRACT`; platform-owned findings stay `OPEN` even though a reproduction passes (`SYNTHETIC_REPRO_OF_PLATFORM_DEFECT`). `REJECTED_WITH_EVIDENCE`: **0** — several findings were narrowed (R3-006, R3-017/025 reclassified as gates, R3-024 as a boundary) but none was disproven. Current counts are in the first table of [09](09_ADVERSARIAL_FINDINGS_REGISTER.md).

## 6. Acceptance delta

`WA_GROK_ACCEPTANCE_DELTA.csv` adds exactly WA-T081 … WA-T100 (20 rows; no id collision with the 80 existing cases; every cited finding id resolves to a real R3 finding — both tested). They are merged with the 80 into `data/WORKAID_ACCEPTANCE_MATRIX_v0.2.csv` (100 rows) with columns `State_v0_2`, `Prior_state` (Grok's own status preserved), `Proof_level`, `Runtime_gate` and `Evidence`. Counts by state are in [08](08_SYNTHETIC_TEST_REPORT.md).

## 7. Routing

Platform-owned items go to Codex with exact references in [13](13_INTEGRATION_HANDOFF_CONTRACT.md). This worktree patches none of them.
