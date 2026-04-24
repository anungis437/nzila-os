# 09 — Contact and SLA

_Trust Center · Last revised: 2026-04-24_

## Channels

| Audience | Channel |
|---|---|
| Security disclosures | [security@unioneyes.app](mailto:security@unioneyes.app) |
| Privacy and DPA requests | [privacy@unioneyes.app](mailto:privacy@unioneyes.app) |
| Customer support (general) | [support@unioneyes.app](mailto:support@unioneyes.app) |
| Procurement / vendor risk pack | [support@unioneyes.app](mailto:support@unioneyes.app) |
| Sales / pilot enquiries | [sales@unioneyes.app](mailto:sales@unioneyes.app) |

PGP key for `security@`: published at
[unioneyes.app/.well-known/security.txt](https://unioneyes.app/.well-known/security.txt)
(when public site is live).

## Response targets

| Severity | Definition | First response | Status update | Resolution target |
|---|---|---|---|---|
| **Critical** | Active data exposure, total auth bypass, ransomware-class incident | 1 hour | Every 4 h | 24 h workaround / 72 h fix |
| **High** | Single-tenant outage; partial-data exposure; MFA bypass for one user | 4 h | Daily | 5 business days |
| **Medium** | Degraded performance; non-blocking auth-policy bug | 1 business day | Weekly | 30 days |
| **Low** | Cosmetic / docs / non-critical request | 5 business days | On change | Best effort |

## Operational hours

- **Monitoring**: 24 / 7 (automated alerting on auth-event anomalies, audit-log gaps, email-delivery failures).
- **Human on-call**: business hours (Eastern Time, Mon–Fri). Critical-severity alerts page on-call out-of-hours.
- **Maintenance windows**: announced ≥ 5 business days ahead; default window Sunday 02:00–04:00 ET.

## Notification commitments

- Customer-impacting incidents: notification within **2 business hours** of confirmation.
- Confirmed security incident affecting member data: written notification within **24 hours** of confirmation, with a follow-up post-incident review within 10 business days.
- Subprocessor changes: minimum **30 days** advance notice for material changes.

## Escalation

If you do not get a response within the stated target, escalate to
[security@unioneyes.app](mailto:security@unioneyes.app) (security
matters) or [support@unioneyes.app](mailto:support@unioneyes.app)
(operational matters) with the original ticket reference. Escalations
are reviewed daily by the platform team lead.

## What is **not** covered

- Custom 24×7 support tiers are not part of the standard pilot or
  starter contract. They are negotiable per enterprise agreement.
- We do not currently operate a status page (status.unioneyes.app is
  reserved). Status is communicated by email to customer admins.
