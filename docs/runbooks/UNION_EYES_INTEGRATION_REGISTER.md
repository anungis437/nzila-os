# UNION EYES INTEGRATION REGISTER

Date: 2026-04-23
Scope: Client-facing and system-facing dependencies for pilot and production

Legend:

- Status: live | partial | missing | unknown
- Direction: inbound | outbound | both

| Integration | Purpose | Direction | Pilot required | Prod required | Env/secret dependency | Current status | Fallback | Owner | Client-visible impact |
|---|---|---|---|---|---|---|---|---|---|
| Entra ID / Microsoft identity | SSO and enterprise identity | inbound | No (optional) | No (optional) | `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, client secret in runtime secret store | partial | Local auth + magic-link (if policy allows) | Platform Auth | Login method availability |
| Local auth (platform-auth) | Email/password and sessions | inbound | Yes | Yes | Auth/session DB + `AUTH_SECRET` | live | none (core path) | Platform Auth | Users cannot log in if broken |
| Magic-link auth | Passwordless login recovery/convenience | inbound/outbound | No | No | Email transport + auth token tables | partial | Local auth/SSO | Platform Auth | Convenience/recovery degraded |
| Resend | Transactional email delivery | outbound | Yes | Yes | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | partial | Manual token sharing in controlled ops; retry | Platform Auth / Comms | Invite, magic-link, reset flows affected |
| Azure OpenAI (AI SDK workloads) | Summaries, analysis, AI workflows | outbound | No (feature-scoped) | No (feature-scoped) | AI control plane keying (`AI_SERVICE_KEY`, AI provider config) | partial | Advisory feature disable/feature flag off | AI Platform | AI screens/features unavailable |
| Azure OpenAI Whisper | Voice transcription upload/transcribe | outbound | No | No | `AZURE_OPENAI_WHISPER_ENDPOINT`, `AZURE_OPENAI_WHISPER_API_KEY`, deployment | partial | Reject voice with clear error; manual text entry | AI Platform | Voice-assisted workflows unavailable |
| Azure Speech SDK | Alternate speech-to-text service path | outbound | No | No | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | partial | Use non-speech paths | AI Platform | Some voice endpoints degrade |
| Stripe | Billing/subscriptions/payments | outbound/inbound webhooks | No (depends pilot scope) | Yes (for paid plans) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, publishable key | partial | Manual invoicing or pilot waiver | Finance Platform | Billing/checkout unavailable |
| Twilio | SMS notifications and comms | outbound | No | No (optional by tenant) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, sender number | partial | Email/push notifications | Comms Platform | SMS channel unavailable |
| HubSpot CRM | Contact/deal sync | outbound | No | No (optional by tenant) | `HUBSPOT_API_KEY` or tokenized equivalent | partial | Manual CRM export/import | GTM Ops | CRM sync unavailable |
| Upstash Redis / Redis | Rate limit/cache/session support paths | both | Yes | Yes | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` or Redis URL | partial | In-memory/degraded modes where implemented | Platform | Performance/limits degrade |
| Azure Blob / document storage layer | File upload/evidence/document persistence | outbound | Yes (if file workflows in scope) | Yes | Blob storage connection settings/secrets | partial | Disable upload-heavy flows | Platform | Document/evidence workflows impacted |
| Sentry | Error monitoring and tracing | outbound | No (strongly recommended) | Yes (recommended) | Sentry DSN/runtime config | partial | Logs-only troubleshooting | Platform SRE | Slower incident response |
| Microsoft Graph calendar sync | Calendar integration and callbacks | both | No | No (optional by tenant) | OAuth app config and callback routes | partial | Disable calendar sync | Integrations | Sync feature unavailable |
| Shopify/Whop webhook routes (present in code) | Commerce/webhook processing | inbound | No | No (tenant-specific) | Provider webhook secrets | unknown | Disable routes if unused | Integrations | None unless tenant enabled |

## Critical Path Dependencies

Pilot-critical minimum set:

1. Local auth/session path healthy.
2. Core DB connectivity and schema presence.
3. Health/readiness endpoints green.
4. Email channel available if invite/magic-link are in pilot scope.

Production-critical minimum set:

1. Pilot-critical set plus topology separation (staging vs production).
2. Monitoring/alerting live.
3. Billing and notification dependencies validated for contracted features.

## Graceful Failure Expectations

- AI and voice capabilities must fail closed with user-facing advisory messages.
- Optional integrations must not block core claims/auth workflows.
- Billing and auth channels are not graceful if contracted as mandatory.

## Open Gaps

- Several integrations are code-present/configurable but not fully proven live end-to-end in this audit.
- Integration ownership and runbook proof links should be attached per release for production gate.
