# B-005 — Environment and secret inventory (name-only)

**Boundary:** Names and purpose only. No secret values.  
**Status:** `SOURCE_IMPLEMENTED` inventory — staging binding still `NOT_PROVEN`.

Values must come from Key Vault / GitHub Environment **staging** (never committed).

## Required for platform-admin SAGE composition

| Name | Purpose | Required for B-005 |
|---|---|---|
| `DATABASE_URL` | Isolated staging Postgres DSN | Yes |
| `NZILA_ENV` | Environment label (`staging`) | Yes |
| `PLATFORM_ADMIN_USER_IDS` | Bootstrap admin actor allow-list | Yes (test identities) |
| `NAR_SIGNING_KEY_ID` | Audit adapter signing key id | Yes (audit proof) |
| `SAGE_CRON_SECRET` | Internal notification / destruction routes | Yes (ops smoke) |
| `SAGE_NOTIFICATION_ENCRYPTION_KEY` | Notification readiness encryption | Yes if notifications exercised |
| `SAGE_DELIVERY_NOTIFIER` | Delivery adapter mode (`resend` or unset) | Optional |
| `SAGE_DELIVERY_FROM_ADDRESS` | Verified From for Resend | If notifier=resend |
| `SAGE_DELIVERY_REPLY_TO` | Reply-To | Optional |
| `SAGE_DELIVERY_CLAIM_ORIGIN` | Claim URL origin | If delivery exercised |
| `SAGE_DELIVERY_VERIFIED_CONTACTS_JSON` | Allow-listed contacts JSON | If delivery exercised |
| `RESEND_API_KEY` | Delivery provider | If notifier=resend |
| `UPSTASH_REDIS_REST_URL` | Delivery claim store | If claims exercised |
| `UPSTASH_REDIS_REST_TOKEN` | Delivery claim store | If claims exercised |

## Authenticated HTTP smoke (operator laptop / CI secret)

| Name | Purpose |
|---|---|
| `SAGE_B005_BASE_URL` | Must be `https://staging-admin.nzilaventures.com/` |
| `SAGE_B005_SESSION_COOKIE` | Session for a **fictional** test identity |
| `SAGE_B005_EXPECTED_SHA` | 40-char commit expected in `/api/health` |

## Explicitly forbidden

- Production RG credentials (`nzila-canada-prod-rg`)
- Production database URLs
- Real institutional identities or personal data in fixtures
- Elevating `b005Closure` from anonymous HTTP alone
