# Union Eyes Gate 0 — unsubscribe scope and consent engineering evidence (2026-10-31)

**Disposition:** source correction committed; executable qualification and independent acceptance outstanding. Not CLOSED and not GO.

**Frozen defects referenced:**
- `DEF-0B5-UNSUBSCRIBE-WRITES-NOT-ATOMIC` (PARTIAL)
- `DEF-0B5-UNSUBSCRIBE-NO-CONSENT-RECORD-WITHOUT-CAMPAIGN` (IMPLEMENTED_PENDING_QUALIFICATION, issuance still unproven)
- `DEF-0B5-UNSUBSCRIBE-LEAVES-LIST-SUBSCRIPTIONS-ACTIVE` (IMPLEMENTED_PENDING_QUALIFICATION)

**Source commits:** `122e8a20682a73b7a22ae93ba508013caf846023`, `5adb4a31c466d299cf4673d40be3cfa348c4b46e`, `d89af2198879512865cf03622ed0273336b04319`.
**Regression commits:** `43adf66eaaa32059c7dd3997125a97b7b54be95a`, `883c3c7142e0ffc813150afa0f114c43fefe71cd`, `7e864982f40696e0a1fadac5c1a1c9f83dd51882`, `6ba20d96f3f4e505fb316d34e1b36c8df9d9ed1b`, `420400938d302fe5cfdb8d93a4fdbc86aeccc2b3`.

The original campaignless `recipientId:unsubscribe` token was accepted as authority to revoke preferences and consent across every organization linked to that recipient. That token does not express an all-organizations action. The route now refuses the ambiguous legacy capability. Campaign links must be signed for `campaignId:recipientId:unsubscribe`; they can affect only the campaign's organization and cannot return success for a nonexistent campaign. An intentional global opt-out is still supported, but requires `scope=all` and the distinct `recipientId:unsubscribe-all` signature. The global lookup is bounded to 100 organizations and refuses oversized or absent targets without committing a partial result. All preference, distribution-list and consent changes remain inside the same system-role transaction. Unsubscribe reasons are now allowlisted to prevent storing arbitrary query-string personal information; invalid or ambiguous scope parameters are refused.

Unit and PGlite regression sources were updated for campaign-only, explicitly global, cross-organization isolation, invalid token, nonexistent target and bounded-scan cases. The code changes and assertions were inspected, **not independently executed** in this evidence record. Full Vitest/contract, real PG15/16, HTTP/browser and staging outcomes must be tied to an exact final HEAD before qualification credit.

**Remaining:** verify that all real email senders issue the correct campaign-bound or explicitly global token, confirm product-approved global opt-out semantics, evaluate state-changing GET versus scanner-safe one-click POST, and run native and end-to-end acceptance. Do not claim these decisions or runtime proofs from source changes alone. The frozen 777-defect register and Gate 0C.4 authority requirements are unchanged.
