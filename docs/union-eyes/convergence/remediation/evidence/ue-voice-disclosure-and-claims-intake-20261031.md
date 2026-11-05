# Union Eyes Gate 0 — external voice disclosure and claim intake integrity

Date: 2026-10-31. Branch: `agents/ue-cursor-final-closure`.

## Frozen defect provenance

- `DEF-0B12-PLT-VOICE-ROUTES-SEND-THE-RECORDING-TO-AN-EXTERNAL-SERVICE-WITH-NO-CONSENT-OR-RECORD` (Gate 0B.12).
- Supplemental claim intake correction: final MediaRecorder audio chunks previously arrived after the synchronous stop handler attempted transcription.
- `DEF-0B12-PLT-VOICE-UPLOAD-CHECKS-THE-AI-SEARCH-ENTITLEMENT-AND-CONSUMES-NO-CREDIT` is **not** claimed repaired.

## Source implementation

- `lib/voice/disclosure-consent.ts` rejects external processing without a versioned, bilingual notice and explicit institutional approval reference configured on the server. Request fields cannot provide or override institutional authority.
- `GET /api/voice/disclosure` returns the current bilingual notice with `Cache-Control: no-store` and refuses missing configuration. GET never changes consent or calls a provider.
- Both `POST /api/voice/upload` and `POST /api/voice/transcribe` reject missing or stale notice versions and absent affirmative acknowledgment/participant-permission assertions **before** transmitting audio.
- Both endpoints write a tenant-bound, awaited audit event before the external service receives audio; failure to persist the audit prevents transmission. Neither audit event contains raw audio or transcript. Provider failure-body logging was removed from upload.
- The shared voice recorder and staff claim-intake form display the notice and require both confirmations. The claim-intake form now transcribes from `MediaRecorder.onstop` after the final chunk arrives, rechecks the latest consent state and normalizes the MIME type.
- Regression tests cover absent institutional configuration, stale notice versions, forged client approval metadata, missing acknowledgments, audit failure, and audit-before-provider ordering.

## Qualification state and remaining obligations

**SOURCE CHANGED; TESTS AUTHORED; NOT QUALIFIED; NOT CLOSED.** This record is additive engineering evidence, not an independent acceptance decision. No frozen classification, institutional approval, member consent record or reviewer ratification was manufactured.

Outstanding: execute focused and complete Vitest/contract suites on the exact HEAD; real PostgreSQL 15/16 tenant-bound audit qualification; real HTTP/browser with a configured institution-approved notice and real speech provider; privacy review of the actual bilingual notice and retention/cross-border terms; institution-specific approval and member/participant consent semantics; voice credit consumption/entitlement correctness; and all other recorded Gate 0 defects. Configuration requires `UE_VOICE_DISCLOSURE_NOTICE_VERSION`, `UE_VOICE_DISCLOSURE_NOTICE_EN_CA`, `UE_VOICE_DISCLOSURE_NOTICE_FR_CA` and `UE_VOICE_DISCLOSURE_APPROVAL_REFERENCE`. These must not be populated with fictitious approvals.

No implementation or qualification credit is added to the strict 777-defect elimination totals until the source and behavioral evidence are independently reconciled with the cumulative register.
