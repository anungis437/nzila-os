# UE Cursor Document Lane Integration — Evidence

`UE_CURSOR_DOCUMENT_INTEGRATION = PASS` — an **engineering** verdict. It is not credentialed acceptance, institutional adoption, staging qualification or release. `UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO`; no staging or production promotion is authorized.

## Source boundaries

Cursor branch `agents/ue-cursor-documents-convergence`, tip `7c17ecf7a597cbcdbc332308b24b95b3349384b0`, development baseline `fde81a81a088a1c8c4aa6d498b2b3a52e0dea298` (an ancestor of both tips). Sixteen commits, none applied twice. Tranche 1's two commits had already been integrated and were re-validated by ancestry and patch content; the other fourteen were cherry-picked in order with `-C` so author and message are preserved, and PR #997 was not merged.

| Range | Commits | Integrated as |
| --- | --- | --- |
| Tranche 1 `fde81a81a..74aed8ec9` | `38e002e54`, `74aed8ec9` | `34c1222bf`, `146da419f` (corrections `b56f71bd0`) |
| Tranche 2 `74aed8ec9..ca7f4d23c` | `3e4a9733f`, `fcab56096`, `1af25ce62`, `796173834`, `7e88b3e56`, `1b8337a09`, `6c0c07ae8`, `911358c74`, `ca7f4d23c` | `018a3a0c5`, `1a70c38ea`, `bb2c626c6`, `fe12a9066`, `78eadb37c`, `720f35733`, `939f03a11`, `8540f47f7`, `69d574926` |
| Tranche 3 implementation `ca7f4d23c..e913eab4d` | `f32c2ba26`, `45c7bb5d7`, `e913eab4d` | `4c82602d4`, `a45fc1e33`, `295e64864` |
| Tranche 3 qualification `e913eab4d..7c17ecf7a` | `baad35639`, `7c17ecf7a` | `801f93d11`, `c1aa39996` |

Full SHAs and the integration mapping are in `UE_AGENT_COORDINATION.json` (`integratedCursorCommitProvenance`). The canonical contracts and corrections are `756abaea1`; the recoverable checkpoints are the tags `ue-pre-cursor-t2t3-checkpoint` (before the tranche 2 and 3 picks) and `ue-post-cursor-t2t3-integration`.

Conflicts were resolved deliberately, never with blanket `ours` or `theirs`: the generated inventory outputs were taken from the integration tree and regenerated; Cursor's `app/api/documents/[id]/ocr/route.ts` (which passed `hasCaseAccess: true` and `isStewardPlus: true`) was not accepted and the canonical route replaced it; Cursor's `ocr-authorization.ts` was a parallel authorization model and was removed in favour of the kernel-backed `ocr-authority.ts`; the consumer matrix was re-overlaid with the integrator's resolutions.

## Contracts delivered

| Contract | Delivery | Where |
| --- | --- | --- |
| 1 Temporary intake `open → accepted \| expired \| cancelled` | `document_intakes` bound to principal, organization, exact server-issued key, server checksum, MIME type, size, timestamps and operation. Acceptance binds atomically with the document or version and its audit; an accepted intake is terminal; an object a version references can never be marked deletable. A row is written before its object, so no object exists without a row. Cancellation and cleanup use the key recorded on the row, never a client path; a retrying reaper expires abandoned uploads and records failed deletions with a bounded attempt count. | `db/migrations-platform/0022_*`, `lib/documents/intake-lifecycle.ts`, `app/api/documents/intakes/**`, `app/api/cron/document-intake-reaper` |
| 2 Create audit | Every repository create and version append audits through `persistAtomicAudit` in the same transaction; a failed audit commits nothing and leaves the intake open. The kernel now decides whether a principal may file evidence against a case (previously anyone could link a document to any case). The legacy upload route uses the same atomic audit. | `app/api/documents/repository/**`, `upload/route.ts` |
| 3 Governed OCR | Kernel action `case:process_ocr` (effective permission `canProcessOcr`), an explicit `can_process_ocr` grant, or the uploader under an **adopted** member policy. Viewing, downloading, role seniority and the legacy representative-identifier column are not inputs; recusal, revocation and expiry remove the case relationship first. | `lib/documents/ocr-authority.ts`, `lib/authority/*`, `lib/services/case-access-service.ts` |
| 4 Reviewed transcription | Append-only machine extraction, human draft, human-reviewed and published-as-evidence records, separate from the immutable original: provenance, reviewer identity, classification, contiguous revisions, independent review, optimistic concurrency, mandatory audit. Publication is a separate, once-only act on the head reviewed revision. | `lib/documents/transcripts.ts`, `app/api/documents/[id]/transcript/**` |
| External SAS | Principal, representative organization, authority, matter grant, matter, document and version are recorded before the link is returned; the link and its signature are never recorded; the link is withheld when the audit or signing fails. | `app/api/external/documents/[id]/download/route.ts` |
| Signature provider status | `decideProviderSync`: only external providers report; terminal states are final; observations move forward only; completion time is the provider's own event time (`provider_acknowledged_at`, immutable) or none, while the local receipt time is kept apart (`provider_status_observed_at`). Change, signer updates and audit commit together and are conditional on the judged status, so a replay or a concurrent sync applies once. No provider was contacted. | `db/migrations-platform/0023_*`, `lib/signature/provider-sync.ts`, `signature-service.ts` |

The stable intake request and response contract is published in `UE_AGENT_COORDINATION.md`; Cursor's consumers (`ocr-intake.ts`, `ocr-upload.tsx`) now hold only the intake id and save corrections as a draft revision through the transcript route.

## Retained consumers

Seventeen paths are `RETAINED_REQUIRED_CONSUMER`; none is deleted. Review of their callers: the legacy documents routes already answer 501 (they no longer carry competing authorization). The two real callers were migrated: the pension console lists pension documents from the canonical repository, and the offline sync queue refuses document operations (a document needs a server-issued intake) and fails any already queued. The smoke script still asserts the 501. Folders and categories have no canonical contract and stay retired and retained; the CMS portal routes are not the repository. Zero verified retirements is accepted: required consumers and the missing folder, category, sharing and retention contracts still exist and are accounted for.

## Qualification

| Evidence | Result |
| --- | --- |
| `tsc --noEmit`, ESLint on every changed file | clean (0 errors) |
| New and changed document, signature and kernel suites on PGlite | `document-intake.pglite` 39, `transcripts.pglite` 20, `ocr-authority` 19, OCR route 14, external download 6, signature sync 13, provider decision 10 |
| **Native PostgreSQL 15.19 and 16.15**: fresh Django `migrate` + the approved bootstrap (applies platform 0022, 0023 and RLS 0022; storage-authority grants activated; ledger verified) | authority-kernel-combined 10/10, thread-assignment 3/3, atomic-audit-fault 6/6, canonical-schema-census 4/4, **document-intake 10/10**, on each version |
| Native document suite scope | the real application code as the runtime and system roles under forced RLS and the manifest grants: tenant isolation, forged inserts refused, no DELETE, two truly concurrent acceptances on separate connections (one winner), audit rollback with a fault trigger on the real audit table, reaper under Canonical V2, transcript immutability and independence, signature acknowledgment constraint and trigger |
| Repository contract tests (`pnpm contract-tests`) | all pass except two that need Python, WSL and bash |
| Lineage, convergence ratchets, route-coverage and mutation-scope ratchets, storage-authority composition, catalog contract | pass |
| Full `union-eyes` suite (`vitest run`, after the final change) | 1,446 files and 20,194 tests passed, 3 files and 26 tests skipped (the PostgreSQL suites that need a database URL), none failed |

Two defects were found **only** by native runtime roles (PGlite has no roles) and fixed: `SELECT … FOR UPDATE` on the append-only `document_versions` is denied to the runtime role (the transcript lock now takes the document row, the same lock a version append takes), and the system role cannot read `document_versions` for the reaper's reference check and the guard trigger (the manifest now grants it `SELECT` only). The system role also cannot write `audit_security.audit_logs`; outside Canonical V2 the reaper therefore fails closed, and the native suite pins that behaviour and proves the deployed (V2) path.

Do not read this as equivalent to live acceptance: PGlite, jsdom journeys, mocked OCR and the stood-in object store, case kernel and provider are not credentialed runs.

## Residual engineering issues

- Sharing, disclosure, export, retention execution and hold release remain unimplemented and fail closed (`document-share-disclosure`, `document-retention-execution`). They need an institutional disclosure and retention policy before an action can be authorized; viewing, downloading and processing never imply them.
- Document folders and categories have no canonical contract.
- Outside Canonical V2 the intake reaper cannot audit as the system role (see above); deployment must run V2, as the approved bootstrap does.
- The legacy backfill has not been run against any customer data.

## External activation requirements (not done, not claimed)

| Item | Prerequisite |
| --- | --- |
| Signed-in member, representative and staff browser journeys | An authorized non-production candidate with credentialed test principals |
| Real OCR bytes and storage behaviour | OCR processor and blob credentials and an approved corpus |
| Signature provider acceptance | Sandbox provider accounts, signed webhook secrets, an approved envelope set (none was contacted; no signature was fabricated) |
| SharePoint acceptance | Tenant, client id and secret for a non-production site |
| Live external SAS issuance | Real blob credentials |
| Member OCR processing for non-participants | The institution adopting a member processing policy (none is adopted) |

## Verdicts

UE_CURSOR_DOCUMENT_INTEGRATION PASS (engineering); CREDENTIALED_END_TO_END_ACCEPTANCE NOT STARTED; INSTITUTIONAL_POLICY_ADOPTION NOT ADOPTED; STAGING_QUALIFICATION NOT STARTED; PRODUCTION_RELEASE NO-GO.
