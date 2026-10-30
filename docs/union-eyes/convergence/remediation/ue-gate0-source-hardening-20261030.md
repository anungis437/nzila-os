# Union Eyes Gate 0 — additive remediation evidence (2026-10-30)

This is an additive engineering work log, **not** a change to frozen Gate 0 classification, institutional decisions, or defect closure. All 777 frozen defects remain in scope. The cumulative register and its generated views must be reconciled by the canonical register builder after qualification; no count is advanced by this note.

## Source and test changes

- `c3691e915b0bc0d15ed8be63b5d7c25b57efde70`: corrected MIL-INT-004's obsolete expectation that a retired `/api/billing/send-invoice` operation must perform an entitlement check. The route intentionally returns HTTP 501 and performs no delivery or generation. The contract now requires an authenticated, fail-closed handler and forbids apparent invoice sending. This is **not** completion of invoice delivery.
- `488b48eea7862d1bfe8fdb2108267a1a56481cb6`: updated chatbot tests to use a valid, explicit moderation-provider response rather than treating a missing API key as permission to bypass moderation; isolated one-shot session mocks and added missing-credential and malformed-provider fail-closed regressions. Production moderation remains fail-closed.
- `4772129569f90740d81fccbc46a6e8782b11e6a6` and `fd8e4ec2aa76b3823a758fc625f0d689ebc53651`: required tenant identity before RAG knowledge embedding or retrieval, enforced both tenant SQL predicate and RLS transaction context, and added an absent-tenant refusal test.
- `547135519d4564de8178be42db4a06277001002d` and `3562f6822fc22430ad54515a960b06f873a087a2`: constrained AI document summarization lookup to the authenticated organization at the SQL predicate (not a post-fetch `isPublic` check), rejected missing organization context, and added AI knowledge isolation source-contract tests. Related frozen item: `DEF-0B2-AI-PUBLIC-KNOWLEDGE-CROSS-TENANT`. This work does **not** establish that all ways to set the public flag are governed or that the whole defect is closed.

## Verification and evidence boundaries

The prior inspected HEAD `b8dbb081936eaed075011a32d883d42a948cbe45` had native PostgreSQL, security regression, App Floor Check and governance workflows passing, but whole-contract regression failed **1/10,102** on the retired send-invoice route and whole-app regression failed **6/21,569** in chatbot tests. These failures motivated the changes above; they are not proof that the changes pass.

At inspection of `3562f6822fc22430ad54515a960b06f873a087a2`, exact-HEAD native PG15/16, whole application, whole contract, security, HTTP/browser, App Floor Check and governance workflows were **queued**, not passed. No deployed staging proof or human approval was obtained. No frozen evidence changed and no defect was marked CLOSED.

**Gate 0: NO_GO.** The independent reviewer, owner-persona ratification and institutional authority decisions remain outstanding. Continue all 777 items, 111 capabilities and full member/steward/officer/financial/WorkAid journeys; do not treat this work log as a substitute for the canonical cumulative register or release qualification.
