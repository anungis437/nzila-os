# Subprocessor List

Current subprocessors and scope align with docs/commercial/security-one-pager.md.

| Subprocessor | Purpose | Data classification |
|---|---|---|
| Microsoft Azure | Hosting, compute, storage, managed services | Production platform data (contracted controls) |
| Sentry | Error telemetry | Minimized diagnostics payloads only |
| Resend | Transactional email | Notification metadata |
| Stripe | Billing | Billing/business data only |

Notes:

- Member grievance payloads are not intentionally sent to non-core subprocessors.
- Any new subprocessor requires claims-ledger and procurement pack update before external disclosure.
