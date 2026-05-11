# Procurement Checklist — Union Eyes Pilot

> Make procurement frictionless. This checklist tells the buyer exactly what is required across Legal, IT, Operations, and Finance — and exactly what we provide on each line.

**Use:** Day 2 of the close sequence. Send to the buyer's procurement lead with a short note: *"Most of these are already pre-packaged. The only items needing your input are flagged 🟡."*

**Pilot terms reference:** [`pilot-offer-cupe.md`](../pilot-offer-cupe.md) · [`pricing-framework.md`](../pricing-framework.md)

---

## Legal

| Item | We provide | Buyer provides | Typical effort |
|---|---|---|---|
| Pilot agreement (2 pages) | ✅ Standard template | 🟡 Counter-signature | 1 business day |
| Master Services Agreement (MSA) | ✅ Standard template | 🟡 Review by general counsel | 5–10 business days |
| Data Processing Agreement (DPA) | ✅ [vendor-risk-pack/dpa.md](../vendor-risk-pack/dpa.md) | 🟡 Counter-signature | 3–5 business days |
| Subprocessor list | ✅ [vendor-risk-pack/subprocessor-list.md](../vendor-risk-pack/subprocessor-list.md) | — | — |
| Privacy Impact Assessment (PIA) input | ✅ Data-flow diagram, retention statement | 🟡 PIA authoring (if required by org policy) | 5 business days |
| Liability/insurance certificate | ✅ Provided on request | — | 1 business day |

---

## IT

| Item | We provide | Buyer provides | Typical effort |
|---|---|---|---|
| Vendor security questionnaire (VSQ) | ✅ Pre-filled answers from [trust-center/](../trust-center/) | 🟡 Internal review | 3–5 business days |
| SSO configuration | ✅ Microsoft Entra setup guide + service-principal walkthrough | 🟡 Tenant admin to register the app + assign group | ~2 hours of admin time |
| MFA enforcement | ✅ Per-org policy in product (`/admin/auth-policy`) | 🟡 Decide which roles require MFA | 30 min decision |
| DNS / allowlists | 🟡 Domains: `*.unioneyes.app`, `*.canadacentral.azurecontainerapps.io` | 🟡 Add to firewall allowlist if egress-restricted | 1 business day |
| Data residency confirmation | ✅ Written confirmation + Azure region attestation | — | — |
| Disaster-recovery summary | ✅ [vendor-risk-pack/backup-restore-summary.md](../vendor-risk-pack/backup-restore-summary.md) | — | — |
| Incident-response runbook | ✅ [vendor-risk-pack/incident-response-summary.md](../vendor-risk-pack/incident-response-summary.md) | 🟡 Designate a security contact for breach notifications | 30 min |
| User offboarding workflow | ✅ Documented in [trust-center/04](../trust-center/04-access-control-model.md) | 🟡 Decide: SSO-managed vs. in-app deprovision | 30 min decision |
| Audit-log export | ✅ Available via API / on-request CSV | — | — |

---

## Operations

| Item | We provide | Buyer provides | Typical effort |
|---|---|---|---|
| Pilot sponsor (1 named exec) | — | 🟡 Name + email | — |
| Pilot coordinator (1 staff, ~2h/week) | — | 🟡 Name + calendar slot for weekly check-in | — |
| List of rep/steward users | 🟡 CSV template provided | 🟡 Populate name, email, role | 1 business day |
| Active-grievance import | ✅ CSV template + import service | 🟡 Export from current tool / spreadsheet | 1–3 business days |
| CA step structure | 🟡 Configuration template | 🟡 Provide CA document or step description | 30 min meeting |
| Success criteria (3–5 measurable outcomes) | ✅ Recommended set from [`UNION_EYES_COGNITION_ROI.md`](../UNION_EYES_COGNITION_ROI.md) | 🟡 Confirm + add any local-specific KPIs | 1 hour meeting |
| Onboarding date | — | 🟡 Pick within 5 business days of contract | — |
| Steward training sessions (2 × 90 min) | ✅ Delivered live, recorded | 🟡 Schedule + invite participants | — |

---

## Finance

| Item | We provide | Buyer provides | Typical effort |
|---|---|---|---|
| Pilot invoice ($12,000 CAD + HST) | ✅ Issued on contract signature | — | — |
| PO / vendor setup | ✅ Vendor info package: WSIB, GST/HST registration, banking | 🟡 PO if required by AP system | 1–3 business days |
| Billing contact | — | 🟡 Name + email | — |
| Payment terms | ✅ Net 30 standard; Net 45 on request | — | — |
| Currency | ✅ CAD | — | — |
| Subscription quote (post-pilot) | ✅ Issued at week 10 of pilot, based on confirmed membership band | 🟡 Renewal decision by week 12 | — |

---

## Timeline (target dates from contract signature)

| Milestone | Target | Owner |
|---|---|---|
| Pilot agreement signed | Day 0 | Legal (both sides) |
| Azure tenant provisioned | Day +1 | Union Eyes |
| Data import template delivered | Day +1 | Union Eyes |
| User list received | Day +3 | Buyer ops |
| Active-grievance CSV received | Day +5 | Buyer ops |
| SSO configured (if applicable) | Day +5 | Buyer IT |
| **Go-live** | Day +14 | Joint |
| Steward onboarding session 1 | Day +15 | Union Eyes |
| Steward onboarding session 2 | Day +21 | Union Eyes |
| Mid-pilot review | Day +60 | Joint |
| Pilot close-out + ROI report | Day +90 | Union Eyes |
| Renewal decision | Day +90 | Buyer exec |

---

## RACI — single-page summary

| Workstream | R (Responsible) | A (Accountable) | C (Consulted) | I (Informed) |
|---|---|---|---|---|
| Legal review | Buyer counsel | Buyer GC | Union Eyes legal | Union Eyes account owner |
| IT setup | Buyer IT admin | Buyer CIO/IT director | Union Eyes solutions engineer | Pilot sponsor |
| Data migration | Buyer ops coordinator | Pilot sponsor | Union Eyes onboarding | Stewards |
| Training | Union Eyes onboarding | Pilot sponsor | Stewards | Members (post-go-live) |
| Renewal decision | Pilot sponsor | Exec board | COO + Treasurer | Members |

---

## Anti-friction tips

- 🚀 **Fast track:** if the buyer's IT already runs Microsoft Entra and has used Azure-hosted SaaS, the IT review collapses to ~3 business days.
- 🧷 **Pre-empt the security review:** send the entire `vendor-risk-pack/` folder + `trust-center/` index on the same day as the pilot agreement.
- 💸 **Pre-empt the AP friction:** request the buyer's vendor-onboarding form before the contract is signed; submit in parallel.
- 📅 **Anchor the kickoff date:** propose a specific go-live date in the agreement (Day +14). It collapses the calendar Tetris.
