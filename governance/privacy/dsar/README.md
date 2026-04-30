# Data Subject Access Request (DSAR) Runbook

**Doc ID:** DSAR-2026-001
**Owner:** Privacy Lead
**Status:** ACTIVE

## 1. Rights covered

| Right | GDPR | PIPEDA | CCPA/CPRA | Default SLA |
|-------|------|--------|-----------|-------------|
| Access | Art. 15 | Princ. 9 | §1798.110 | 30 days (extendable +60) |
| Rectification | Art. 16 | Princ. 9 | §1798.106 | 30 days |
| Erasure ("right to be forgotten") | Art. 17 | n/a (correction-only) | §1798.105 | 30 days |
| Restriction of processing | Art. 18 | n/a | n/a | 30 days |
| Portability | Art. 20 | n/a | §1798.130 | 30 days |
| Object | Art. 21 | Princ. 3 | n/a (opt-out of sale) | 30 days |
| Object to automated decision-making | Art. 22 | OPC AI Proposal | n/a | 30 days |

GDPR statutory ceiling is **one calendar month**, extendable by two further
months for complex requests with notice within the first month.

## 2. Intake

Channels:

- Email: privacy@nzila.example (TODO: configure)
- In-app: each consumer-facing app exposes "Privacy → Submit a request"
- Postal (legal address): TODO

Required from requester:

- Identity (verified per §3)
- Type of request
- Description (what data, what timeframe)

## 3. Identity verification

| Tier | Verification |
|------|--------------|
| Authenticated user (logged-in session via `@nzila/platform-auth`) | Session sufficient + secondary factor |
| Unauthenticated requester | Email confirm + 2 facts only the data subject would know (e.g., last login date, account creation date, recent transaction id) |
| Sensitive (Restricted data) | Government-ID verification + secondary factor |

Reject only when reasonable doubt; document the reason.

## 4. Routing

| Surface | Owner | Stores to search |
|---------|-------|------------------|
| Identity / auth | Platform Lead | `auth_users`, `auth_user_sessions`, audit log |
| Consumer site / web | Web Lead | `apps/web` user data |
| Zonga | Zonga Lead | profile, voice transcripts, blob audio |
| Union-Eyes | UE Lead | cases.*, cognition outputs |
| Partners | Partners Lead | partner records |
| CFO | CFO Lead | financial records (subject to legal-hold checks) |
| Marketing / analytics | Web Lead | GA4, email tools |

## 5. Fulfilment workflow

1. **Acknowledge** within 3 business days.
2. **Verify identity** (§3).
3. **Determine scope** — which surfaces / data classes apply.
4. **Search** each routed surface; collect outputs to a secure workspace.
5. **Apply exemptions** — legal hold, ongoing investigation, third-party privacy. Redact accordingly. Document each redaction.
6. **Package** — machine-readable (JSON for portability; PDF or CSV for access).
7. **Deliver** — via authenticated download link (single-use, 7-day expiry); never email Confidential+ data unencrypted.
8. **Log** — record in DSAR log (TODO `governance/privacy/dsar/log.csv`) with id, type, intake date, completion date, outcome.
9. **Close**.

## 6. Erasure specifics

- Pre-check legal/regulatory retention obligations (e.g., financial records subject to 7-year hold).
- Cascade through related records via documented foreign-key paths.
- Anonymize (irreversible) where deletion would break referential integrity for analytics; otherwise hard delete.
- Confirm to requester with a high-level description of what was deleted.

## 7. Refusal

Permitted when:

- Identity not adequately verified
- Request is "manifestly unfounded or excessive" (GDPR Art. 12(5)) — document
- Specific exemption applies (e.g., legal privilege)

Always inform the requester of their right to complain to the supervisory authority.

## 8. Metrics (feed into [`../metrics/privacy-metrics.md`](../metrics/privacy-metrics.md))

- Total DSARs / month
- % completed within SLA
- Average completion time
- % refused (with reason breakdown)

## 9. Engineering work needed (gaps)

- [ ] Build DSAR submission endpoint in `apps/web` and `apps/zonga`
- [ ] Build per-surface "export-my-data" worker
- [ ] Build cascading erasure worker with legal-hold check
- [ ] Build DSAR log table + admin dashboard (likely in `apps/console`)
