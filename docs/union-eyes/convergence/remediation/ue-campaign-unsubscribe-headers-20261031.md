# Union Eyes Gate 0 — outbound campaign unsubscribe capability (2026-10-31)

**Disposition:** Engineering source and regression tests committed, qualification pending, NOT CLOSED or GO.

**Existing frozen defects:** DEF-0B5-UNSUBSCRIBE-NO-CONSENT-RECORD-WITHOUT-CAMPAIGN and related communications unsubscribe family. No additional defect-count credit is claimed.

CampaignService now creates an action-bound HMAC token for each campaign/recipient pair, builds the unsubscribe URL from the Union Eyes app topology, and sends both RFC 8058 List-Unsubscribe and List-Unsubscribe-Post headers. A missing signing key or recipient/campaign binding refuses the email rather than falsely treating a non-unsubscribable campaign as sent. The Resend adapter already forwarded message headers; the SendGrid adapter now forwards them too. The companion route accepts direct one-click POST and keeps scanner GET read-only.

**Regression sources:** lib/services/messaging/__tests__/campaign-service.test.ts checks HMAC binding, header values and missing-secret refusal. lib/services/messaging/__tests__/email-service.test.ts checks SendGrid header propagation.

**Unproven:** These focused tests and complete contract/Vitest, native PG15/16, HTTP/browser, staging, actual Resend/SendGrid header acceptance and real mail-client one-click interoperability require exact-HEAD execution. Other email senders are not thereby qualified. Global opt-out semantics still require institutional approval.
