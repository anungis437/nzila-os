# Union Eyes signature read tenant binding — source evidence (unqualified)

Baseline: `f1eba75eb1746b14c69588d12bdf9c9c74ad7d13` on `agents/ue-cursor-final-closure`.

Defect: `DEF-0B11-SOC-SIGNATURE-READS-AND-ACCESS-CHECK-USE-THE-BARE-DB-HANDLE-WITH-NO-ORGANIZATION-PREDICATE-AND-ACCEPT-ANY-USER-ID-A-SENDER-TYPED-AS-SIGNER`.

The document status, sender, access, provider-sync and audit-report paths previously read document records through the shared database handle by ID alone. The repaired reads now require the caller's authenticated organization and execute inside its RLS context with explicit organization predicates. Audit entries are constrained by a subquery of documents owned by that organization. Audit report chain verification uses the same RLS transaction. Missing organization fails closed; no provider refresh or document disclosure is permitted without organization-bound sender authority.

Regression cases were authored for missing organization, cross-tenant document refusal, organization predicates and route-level organization propagation. They are **not yet executable-qualified**. Full Vitest/contract, native PG15/16 with real RLS, HTTP/browser/staging and institutional acceptance remain outstanding. Existing signer role, external-provider and workflow behavior require further adversarial review. No independent CLOSED or GO claim.

Frozen Gate 0 classification files, the 777-item provenance and original completion counts remain unchanged.
