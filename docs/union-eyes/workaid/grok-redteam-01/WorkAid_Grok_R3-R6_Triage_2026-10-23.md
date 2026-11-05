# WorkAid × Union Eyes — Grok R3–R6 independent triage

**Date:** 2026-10-23 (America/Toronto)  
**Reviewed baseline:** GitHub `anungis437/nzila-os` main `38a824918cf2e7d7cfb7fcb0e796cbde45433be8`  
**Evidence:** User-supplied `WA_GROK_REDTEAM_01_DELIVERABLES.zip` (9 files), `WA_GROK_EXECUTIVE_VERDICT.md`, source readback and official AWS/WSIB/WSIAT reference pages.  
**Authorization:** Analysis and separate synthetic-only design preparation. **Not** authorization for merge, staging changes, live WorkAid pilot, customer data, or deployment.

## Decision

- **Accept** Grok's overall **NOT DESIGN_COMPLETE / NOT PILOT_READY** disposition and prefer **Option B — split responsibility** as a *provisional* architecture for design. Clio remains the professional file of record; Union Eyes coordinates referrals, controlled publications and optional WSIB receipt tasks **only if Domenic agrees to one authoritative task queue**. No automatic Clio writeback.
- **Do not** merge platform-wide security fixes from the WorkAid worktree. Route them to Codex/the current platform release owner as independently reproducible findings and require coordination with the active staging candidate.
- **Do not** treat static source findings as observed runtime exploitation, or 503 maintenance as evidence of an intrusion.

## Evidence integrity

- R3 contains **26 findings: P0 8, P1 15, P2 3**, verified by reading all 26 severity headings.
- R4–R6 contain **31 findings: CRITICAL 7, HIGH 15, MEDIUM 8, LOW 1**.
- R3 + R4–R6 are **57 new finding entries**, not necessarily 57 independent defects. Prior R1/R2 items overlap; reconcile by stable IDs instead of adding counts naïvely.
- The executive verdict's R3 footer says **8/14/4**; use **8/15/3** per the detailed findings file and correct the verdict.
- R3-017 and R3-025 largely express the same UE NO-GO dependency; one platform gating record should reference both IDs.
- The R4–R6 research clone (`34f441d3`) did not have the pack SHA, while the sibling R3 clone did. Cite each source assessment against its actual SHA; runtime proof is separate.

## Source-confirmed platform issues — route to Codex/platform owner

| IDs | Confirmed code observation | Disposition / required proof |
|---|---|---|
| WA-R3-001 | `tooling/contract-tests/server-action-org-scoping.test.ts` scans `content.includes("'use server'")`, skipping double-quoted directives. | **SOURCE DEFECT CONFIRMED.** Add both-quote/real directive parser and deliberately failing negative fixture; inventory coverage and exceptions. No assertion of a live IDOR yet. |
| WA-R3-006 | `apps/union-eyes/lib/services/document-storage-service.ts` passes `expiresIn: 365 * 24 * 60 * 60` to AWS-compatible S3/R2 signer. | **UNSAFE INTENT CONFIRMED; ONE-YEAR-LINK EXPOSURE NOT PROVEN.** AWS S3 SigV4 maximum is seven days; test actual SDK/storage-backend behavior, fail closed, impose short TTL, and check post-revocation mint denial. |
| WA-R3-005/013 | Universal search filters candidate docs by title/filename before applying app-level visibility and admits a broad unlinked-document case-access path. | **SOURCE CONCERN CONFIRMED; DATA LEAK NOT PROVEN.** Execute synthetic under-/cross-matter read and timing tests; require pre-authorized DB query and deny-by-default for restricted/unlinked docs. |
| WA-R3-008/015 | `revokeRepresentationAuthority` updates authority, then writes audit, with no grant-table cascade in that function. | **SOURCE GAP CONFIRMED; EFFECTIVE BYPASS UNPROVEN.** Evaluate all call paths for authority re-check, audit atomicity and grant-cache invalidation. Do not indiscriminately kill sessions in unrelated orgs. |
| WA-R3-017/025 | Source production-readiness document remains NO_GO; R3 reports public staging endpoints returned maintenance 503. | **RELEASE GATE, NOT A NEW SECURITY VULNERABILITY.** Codex retains sole staging control; need version-bound runtime isolation, identity, worker, UX and release proof. |

## New independent issues discovered in this intake

| ID | Severity for triage | Observation at inspected SHA | Required negative proof |
|---|---|---|---|
| WA-INT-001 | P1 privacy | `document-storage-service.ts` uses `${timestamp}-${randomBytes}-${doc.documentName}` in the blob object **key** and logs that key. Metadata also includes human-readable documentName. Removing metadata alone does not remove sensitive titles from blob paths or logs. | Opaque object identifiers only; synthetic clinical-name canary must be absent from key, metadata, audit-adjacent logs and URLs. |
| WA-INT-002 | P1 security/reliability | Azure branch says "Generate read-only SAS URL valid for 1 year" but constructs `${blobServiceClient.url}${this.bucket}/${key}` without creating a SAS token. Actual blob accessibility depends on container ACL; neither public exposure nor successful private download has been proven. | Private-container deny test + correctly authorized short-lived download; assert no anonymous access, wrong-origin leakage or false success result. |
| WA-INT-003 | P1 data integrity | S3/R2 branch performs PutObject **before** requesting a signature with an overlong expiration. If signing throws, upload returns an error after storage succeeded, leaving an untracked or orphaned object. | Inject signer failure after upload and prove compensating cleanup, recoverable durable object reference or idempotent reconciliation; no silent orphan/success confusion. |

These three are analyst hypotheses grounded in current code, **not** executed exploit findings.

## WorkAid-specific owner — isolated VS Code worktree

- **Authority** (`WA-R3-007/009`, R4-03/09, R5-03/07): Keep technical access grant, WorkAid engagement acceptance and WSIB DOA/instrument evidence separate, auditable, with fail-closed professional actions.
- **Domain** (R4-01/02, R5-01/02): Model Person → WSIBClaim (employer provenance) → WSIBDecision/Issue → Objection/ITO. Historical numbers remain internal; outbound ITO uses a professionally confirmed disclosure allow-list.
- **Outbound submission** (R4-04/05, R5-08): `DRAFT / REVIEWED / APPROVED / DISPATCHED / DELIVERY_ACK / RECEIPT_CONFIRMED / REJECTED / WITHDRAWN` or justified equivalent; forbidden transitions; WSIB receipt and legal filing must never be inferred from send/HTTP/task completion.
- **Reminders** (R3-023, R4-06/07/10/11): Pure WorkAid `DeadlineObligation` and `ReceiptFollowUpTask` contracts. Existing grievance recipient graph stays untouched; single authoritative receipt-task queue, retry, dedup, overdue display, local calendar and human-confirmed legal clocks.
- **Publication** (R3-011, R6-04): Explicit, deny-by-default member and union-safe projections. No professional notes or medical document titles in member notifications or searches.
- **Clio** (R3-024, R4-10, R6-01): Option B candidate; no connector; no writeback; no unapproved second open task. Option A' fallback if Domenic rejects UE-owned receipt tasks.
- **Procedure** (R5-01–10): Version official WSIB/WSIAT source, effective date, retrieved date, approval actor, rule interval and form kind. No autofile or legal advice from the system.
- **Acceptance**: Ingest WA-T081–WA-T100 as **DESIGNED_NOT_EXECUTED**. Maintain and reconcile the existing 80 cases; execute isolated synthetic-only cases on WorkAid branch. Do not report `FIXED_PROVEN` without traceable test output.

## Explicit validation dependencies

**Domenic:** next business versus calendar day for WSIB receipt calls; one queue for follow-up tasks; ITO grouping within one claim; urgent incomplete-referral handling; level of Clio linking.  
**Angelo:** WSIAT artifacts, current Hearing Ready/COA workflow, exact supervisory approvals, member-facing ARO language, extraordinary deadline applicability.  
**Security/privacy owner:** professional content classes, publication rights, revocation and retention; independent staged tenant-isolation authorization and evidence.

## Minimum evidence per finding before closure

`finding_id | source_sha | exact file/line | theory/observed | owner | repro_fixture | before_result | patch_or_spec_delta | after_result | environment | reviewer | disposition`.

Allowed dispositions: `OPEN`, `PARTIALLY_MITIGATED`, `BLOCKED_EXTERNAL_EVIDENCE`, `FIXED_PROVEN`, `ACCEPTED_RISK_SIGNED`, `OUT_OF_SCOPE_WITH_BOUNDARY`.

Never equate source-test pass to staging/runtime pass. Keep the two agent worktrees untouched by one another. Codex alone controls staging modifications under its existing release governance.

## Supporting verification references

- GitHub inspected source: `https://github.com/anungis437/nzila-os/blob/38a824918cf2e7d7cfb7fcb0e796cbde45433be8/tooling/contract-tests/server-action-org-scoping.test.ts`
- GitHub inspected storage: `https://github.com/anungis437/nzila-os/blob/38a824918cf2e7d7cfb7fcb0e796cbde45433be8/apps/union-eyes/lib/services/document-storage-service.ts`
- GitHub inspected deadline resolver: `https://github.com/anungis437/nzila-os/blob/38a824918cf2e7d7cfb7fcb0e796cbde45433be8/apps/union-eyes/lib/deadline-engine/recipient-resolver.ts`
- Official AWS S3 SigV4 maximum: `https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sigv4-query-string-auth.html`
- Current official WSIB process: `https://www.wsib.ca/en/appeals-practices-and-procedures`
- WSIAT Hearing Ready flow: `https://www.wsiat.ca/en/practiceDirectionsAndGuides/pd8.html`
