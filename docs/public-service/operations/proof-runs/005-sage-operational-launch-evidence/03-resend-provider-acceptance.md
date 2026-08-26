# 03 — Resend Provider Acceptance (staging)

## Purpose

Verify that the **staging Resend provider is reachable, the Key-Vault API key is
valid, and a SAGE-style message is accepted with a provider message id** —
without emailing any real or customer recipient, and without overstating what a
provider acceptance proves.

`resend-api-key` was read from `nzila-staging-kv` into process environment only
and never printed. The message was sent to Resend's **official test sink**
`delivered@resend.dev` and contained a synthetic marker only.

## Result

```
Resend provider connectivity:          PASS
Provider API-key validity:             PASS
Provider acceptance to test sink:      PASS (HTTP 200)
Provider response ID:                  captured
SAGE stable grant-scoped identity:     NOT_EXECUTED
SAGE provider-idempotency propagation: NOT_EXECUTED
SAGE outbox persistence/recovery:      NOT_EXECUTED
Human mailbox receipt:                 NOT_PROVEN
```

## Interpretation and limits

- The provider is reachable, the stored key is valid, and a message is accepted
  with a provider-assigned id.
- The returned Resend id is the **provider's** message id. It is **not** SAGE's
  grant-scoped stable message identity (`sage-delivery-invitation:${grantId}`),
  which is minted and persisted by the deployed SAGE delivery service. This proof
  does **not** exercise that composition, provider-idempotency-key propagation,
  duplicate-send deduplication, outbox persistence/recovery, or mailbox receipt.
- No exactly-once claim is made. SAGE's design is at-least-once delivery attempts
  with a stable message identity and provider deduplication where supported.

G6 (recipient delivery security) is strengthened by confirmed provider
reachability but remains `PASS_WITH_CONDITIONS` pending the deployed SAGE
delivery composition and a human mailbox-receipt confirmation.
