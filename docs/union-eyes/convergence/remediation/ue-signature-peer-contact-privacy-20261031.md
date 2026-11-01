# UE Gate 0 — signature peer-contact privacy (2026-10-31)

Defect: `DEF-0B11-SOC-SIGNATURE-STATUS-AND-AUDIT-DISCLOSE-EVERY-SIGNER-ADDRESS-IP-USER-AGENT-AND-LOCATION-TO-EVERY-OTHER-SIGNER`.

Source correction: `lib/signature/signer-privacy.ts` removes peer signer email addresses, contact variants, IP, user-agent and geolocation from document status and audit responses. Free-form event descriptions from other actors are withheld because they may embed the same protected data. Nested signer rows are always filtered, even when an outer report has the viewer's user ID. Sender-visible evidence remains available, preserving the accountable audit workflow.

Regression: `lib/signature/__tests__/b44-signer-privacy.test.ts` adds peer-email, nested-report, unstructured-description and sender assertions.

Qualification: SOURCE IMPLEMENTED / PARTIAL; no exact-HEAD executable, native PostgreSQL, HTTP/browser or staging pass is asserted. Existing frozen register and independent institutional gates remain unchanged.
