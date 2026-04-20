# Zonga Pilot Commercial Model (MS Celebrations)

## Commercial Terms (Pilot Baseline)
- Ownership: Content ownership remains with label/artist unless a separate written agreement states otherwise.
- Pilot term: 90 days from activation date.
- Rev share: Default pilot rev share is negotiated per revenue stream; if not specified, existing platform fee schedule applies.
- Payout timing: Monthly payout cycle, net 30 after month close.
- Reporting cadence: Weekly operational snapshot + monthly financial close report.
- Content takedown: Valid rights claims are reviewed immediately and actioned within 48 hours.
- Territory limitations: Territory defaults to partner-selected release regions; global only when explicitly selected.
- Exclusivity: Default is non-exclusive unless negotiated in writing.
- Promotional rights: Zonga may promote pilot content in product and campaign surfaces during active term.
- Data access rights: Partner gets dashboard access plus CSV/PDF exports for pilot performance data.
- Termination: Either party may terminate with written notice per agreement; unresolved rights obligations survive termination.

## In-Product Trust Surfaces
- Rights summary panel: [apps/zonga/components/dashboard/rights-terms-panel.tsx](../../apps/zonga/components/dashboard/rights-terms-panel.tsx)
- Terms acceptance log API: [apps/zonga/app/api/rights/terms/route.ts](../../apps/zonga/app/api/rights/terms/route.ts)
- Downloadable agreement copy: [apps/zonga/app/api/rights/terms/agreement/route.ts](../../apps/zonga/app/api/rights/terms/agreement/route.ts)

## Governance Notes
- All acceptance actions are logged to audit trail for accountability.
- Rights disputes and moderation queues are separated but cross-referenced by operators.
- Default stance is clarity over aggressive lock-in during founding-partner pilot.
