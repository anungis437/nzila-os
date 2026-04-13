# Governed Monetization

> Revenue is a governed artifact in Nzila OS. Every payment, payout, fee, and transaction is auditable, traceable, and exportable — just like governance workflows.

---

## Principles

1. **Single Revenue System** — All revenue flows through `@nzila/platform-revenue`. No app processes payments independently.
2. **Audit by Default** — Every revenue event generates a governance audit log entry (`revenue_event_recorded`, `revenue_payout_issued`, `revenue_fee_collected`).
3. **Evidence-Grade Traceability** — Revenue records link to evidence packs via `orgId` + `eventId`, creating a tamper-evident chain from transaction to financial report.
4. **CFO as Canonical View** — The CFO app is the single source of truth for platform-wide financial state, consuming `@nzila/platform-revenue` summaries.

---

## Revenue → Governance Pipeline

```
App (Zonga / Flow / CFO / Partners / Trade)
  │
  ▼
@nzila/platform-revenue — emitRevenueEvent()
  │
  ├──▶ UnifiedRevenueRecord validated (Zod)
  ├──▶ RevenueEvent persisted
  ├──▶ Governance audit entry written (platform-governance)
  │      event_type: revenue_event_recorded
  │      actor: app service identity
  │      policy_result: pass | fail
  │
  └──▶ Evidence artifact created (platform-evidence-pack)
         controlFamily: financial-controls
         eventType: revenue
```

---

## Governed Event Types

| Governance Event Type | Trigger | What It Records |
|-|-|-|
| `revenue_event_recorded` | Any revenue event via `emitRevenueEvent()` | Amount, currency, app source, org, status |
| `revenue_payout_issued` | Creator/partner payout disbursed | Payout amount, recipient org, net after fees |
| `revenue_fee_collected` | Platform fee deducted | Fee amount, fee rate, associated transaction |

---

## Linking Revenue to Evidence

Every revenue record carries:

| Field | Purpose |
|-------|---------|
| `orgId` | Scopes to tenant for isolation |
| `appSource` | Identifies originating app |
| `revenueType` | Classifies: subscription / transaction / event / payout |
| `grossAmount`, `platformFee`, `netAmount` | Full financial breakdown |
| `status` | Lifecycle: pending → settled → (failed / refunded) |
| `metadata` | Extensible context (Stripe charge ID, invoice ref, etc.) |

These fields enable:
- **Export** — CFO can export all revenue events for a period as evidence pack artifacts.
- **Audit Trail** — Every event is time-stamped and linked to a governance audit timeline entry.
- **Compliance Reporting** — Revenue summaries feed into `GovernanceStatusReport.findings`.

---

## Contract Enforcement

The following contract tests enforce governed monetization:

| Test File | What It Enforces |
|-----------|-----------------|
| `revenue-enforcement.test.ts` | REV-001–REV-005 — no bypass of platform-revenue |
| `org-semantic-convergence.test.ts` | `orgId` used everywhere (no `entityId` in revenue) |
| `control-plane-authority.test.ts` | Control plane aggregates revenue state |

---

## Revenue-Capable Apps

| App | Revenue Model | Integration |
|-----|--------------|-------------|
| **Zonga** | Streaming royalties, creator payouts | `zonga-monetization` → `platform-revenue` |
| **CFO** | Subscription SaaS, financial services | Direct `platform-revenue` consumer |
| **Flow** | Commerce transaction fees | `commerce-services` → `platform-revenue` |
| **Partners** | Commission tracking | `platform-revenue` for payout recording |
| **Trade** | Trade deal commissions | `platform-revenue` for transaction recording |

---

## CFO as Financial Authority

CFO consumes `@nzila/platform-revenue` summaries to provide:

- **Ledger view** — All revenue across all apps, rolled up by org.
- **Fee reconciliation** — Platform fees vs. net payouts.
- **Tax reporting** — Revenue by jurisdiction, currency, and period.
- **Compliance attestation** — Revenue data backs evidence packs for auditors.

No financial data exists outside this pipeline.
