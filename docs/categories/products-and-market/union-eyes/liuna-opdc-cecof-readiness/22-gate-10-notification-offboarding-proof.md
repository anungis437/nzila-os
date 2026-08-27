# 22 - Gate 10 Notification Offboarding Proof

## Gate Decision

`LIUNA_GATE_10A_NOTIFICATION_OFFBOARDING = CLOSED`

Notification delivery now checks active organization membership whenever a payload identifies a `recipientId`. This closes the queued-notification part of the former-user/offboarding risk:

- immediate notification sends skip inactive/deleted recipients;
- pending queue processing reaches the same delivery-time guard;
- retry processing reaches the same delivery-time guard;
- queued payloads without an active membership return failed delivery instead of sending;
- email-only, SMS-only, and provider-level behavior remain unchanged when no member identity is supplied.

## Validation

Source and test:

- `apps/union-eyes/lib/services/notification-service.ts`
- `apps/union-eyes/lib/services/__tests__/notification-service.test.ts`

Command:

`pnpm --filter @nzila/union-eyes test -- lib/services/__tests__/notification-service.test.ts`

Result:

`PASS`; 1 file / 86 tests.

## Claim Boundary

This gate supports a truthful sensitive-readiness claim that queued Union Eyes notifications will not be delivered to a former or inactive organization member when the queue payload carries a member recipient id.

It does not prove full session invalidation, direct-link invalidation, cached browser state clearing, or identity-provider token revocation.

## Remaining Gate 10 Gap

`LIUNA_GATE_10B_SESSION_AND_DIRECT_LINK_OFFBOARDING = OPEN`

The next offboarding proof must cover:

- active sessions;
- direct document URLs;
- cached search results;
- pending AI/copilot actions;
- stale case assignments.
