# Vendor Assurance Index

Purpose: single index of third-party assurance artifacts required for SOC2 evidence completeness (CC9.2) and enterprise procurement review.

Last updated: 2026-06-07
Owner: Compliance PM

## Required Providers

| Provider | Service Surface | Required Artifact | Current Status | Evidence Location | Renewal/Review Cadence |
|---|---|---|---|---|---|
| Microsoft Azure | Hosting, database, identity, key management | SOC report package + shared responsibility statement | Pending aggregation | `reports/compliance/vendor-assurance/azure/` | Annual |
| GitHub | Source control + CI/CD | SOC report package | Pending aggregation | `reports/compliance/vendor-assurance/github/` | Annual |
| OpenAI / Azure OpenAI | AI model processing | DPA + SOC/security report package | Pending aggregation | `reports/compliance/vendor-assurance/openai/` | Annual |
| Vercel (if applicable) | Edge/runtime deployment surfaces | SOC report package + subprocessor list | Pending aggregation | `reports/compliance/vendor-assurance/vercel/` | Annual |
| Stripe | Billing and payment processing | PCI AoC + SOC/security packet | Pending aggregation | `reports/compliance/vendor-assurance/stripe/` | Annual |
| Intuit (QBO, if enabled) | Finance integration | Security/compliance documentation packet | Pending aggregation | `reports/compliance/vendor-assurance/intuit/` | Annual |

## Evidence Rules

1. Store only buyer-safe artifacts in-repo; place restricted documents in approved secure vault and reference retrieval ticket IDs.
2. Record artifact version/date and reviewer sign-off for each provider.
3. Update `docs/compliance/soc2/evidence-inventory.md` whenever a provider packet is added or refreshed.

## Completion Criteria

This index is considered complete when:

1. All providers in scope have current artifacts and review dates.
2. Evidence locations are populated and discoverable.
3. `docs/compliance/soc2/gap-log.md` item `SOC2-004` can be closed with evidence references.
