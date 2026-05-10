# Flow — Revenue Product Profile

> **Classification:** SELL NOW · Pilot-safe · Priority 2  
> **Truth anchor:** `governance/portfolio/product-catalog.json` · `nzila-truth-manifest.json`  
> **Last updated:** April 2026

---

## The One-Sentence Pitch

> "Grow without the chaos — the SMB ops platform that connects CRM, invoicing, pipeline, and follow-ups so operators stop losing money to their own spreadsheet stack."

---

## Problem

SMB operators lose deals and cash every week not because of competition — but because of internal chaos:

- Customer relationships managed in spreadsheets and DMs
- Quotes sent in email, never followed up
- Invoices late or missed entirely
- No visibility into the pipeline — owner guesses what's closing
- Follow-up gaps let warm leads go cold
- No connection between sales activity and actual cash flow

No SMB wants 6 different tools to solve this. They want one system, set up in under an hour, that just works.

---

## Solution

Flow is the SMB ops platform that runs a complete commercial operation — from first contact through payment — in a single governed system.

### Core Capabilities

| Module | Code Evidence | Status |
|--------|---------------|--------|
| CRM — clients, contacts, accounts | `app/[locale]/dashboard/clients/` | ✅ Implemented |
| Quotes + proposal builder | `app/quote/`, `app/proposal/`, `app/[locale]/dashboard/quotes/` | ✅ Implemented |
| Invoicing | `app/[locale]/dashboard/invoices/` | ✅ Implemented |
| Payments | `app/[locale]/dashboard/payments/` | ✅ Implemented |
| Orders management | `app/[locale]/dashboard/orders/` | ✅ Implemented |
| Purchase orders | `app/[locale]/dashboard/purchase-orders/` | ✅ Implemented |
| Products + inventory | `app/[locale]/dashboard/products/`, `inventory/` | ✅ Implemented |
| Suppliers | `app/[locale]/dashboard/suppliers/` | ✅ Implemented |
| Production tracking | `app/[locale]/dashboard/production/` | ✅ Implemented |
| Analytics dashboard | `app/[locale]/dashboard/analytics/` | ✅ Implemented |
| Integrations (Shopify, Stripe, etc.) | `app/[locale]/dashboard/integrations/` | ✅ Partial |
| System settings | `app/[locale]/dashboard/settings/` | ✅ Implemented |

### What This Means

Flow is not a CRM with some invoicing bolted on. It has:

- A full purchase-order → production → supplier → inventory → order → invoice → payment chain
- A quote-to-proposal flow with a public signing URL
- Analytics across all commercial activity
- Integration hooks for Shopify operators (ecommerce → ops sync)
- Revenue event emission via `@nzila/platform-revenue` — all financial events are governed

---

## Why Flow Wins

| Competitor | Gap vs. Flow |
|------------|-------------|
| HubSpot / Zoho CRM | CRM-heavy; invoicing is an add-on; Africa/diaspora SMB not a first-class segment |
| QuickBooks | Finance-heavy; no CRM or pipeline; no Shopify ops integration |
| Shopify alone | Commerce only; no B2B sales ops, no custom quoting, no supplier/inventory chain |
| Wave / FreshBooks | Invoice-only; no CRM, no pipeline, no ops chain |

**Flow unique moat:**

1. Full ops chain from quote → purchase order → production → invoice → payment — not just CRM + billing
2. Revenue events governed by `@nzila/platform-revenue` — auditable commercial trail built-in
3. Africa/diaspora SMB operator as primary segment — underserved by every major player
4. Shopify integration for ecommerce operators running B2B and distribution in parallel
5. Multi-language support (i18n framework wired throughout)

---

## Readiness Truth

| Gate | Status |
|------|--------|
| Product tier | PRODUCTION |
| Deployment status | pilot |
| Readiness tier | pilot-safe |
| Can claim pilot-ready | ✅ YES |
| Can claim audit-hardened | ✅ YES |
| Can claim production deployment | ❌ NOT YET |

**Honest summary:** Flow has extensive implemented modules and is pilot-safe. It is NOT yet in production with a paying customer. The sales motion and pilot path are the immediate gap — the code is ahead of the commercial process.

---

## ICP Summary

**Target buyer:** SMB owners and operators who manage a commercial process involving quotes, orders, and invoices

| Segment | Example |
|---------|---------|
| Distribution operators | Imports, resells, manages suppliers and purchase orders |
| Service businesses | Quotes work, invoices clients, tracks cash |
| Retail with B2B layer | Shopify front + B2B order management |
| Franchise / multi-location | Needs pipeline visibility across locations |

**Geography:** Canada, West Africa (ShopMoiCa-type operators)  
**Trigger events:**

- Missed invoice = missed rent
- Losing deals because follow-up was manual
- Owner doesn't know what's closing this month
- Team grown past 5 people and spreadsheet-based ops is breaking

---

## Sales Narrative

> "Most SMB software was built for Silicon Valley SaaS companies. Flow was built for operators — the people who actually make things, sell things, and ship things. One system. No 6-tool stack. From your first quote to your last payment, everything is in one place."

---

## Pricing Hypothesis

| Package | Price | For |
|---------|-------|-----|
| Starter | $49/month | Solo operators or 2-person teams |
| Growth | $99/month | Teams up to 10 users |
| Operator | $149/month + per seat | Distributors, multi-location |
| Pilot contract | Free 30-day or $2k–5k fixed fee | Proof of concept |

**Note:** Pricing is a hypothesis. No pricing is committed. Validate with first 3 operators.

---

## Onboarding Path

1. **Day 0:** Org provisioned, contacts/clients imported (CSV or Shopify sync)
2. **Day 1:** First quote created and sent to a real client
3. **Day 2:** Quote signed, converted to order + invoice
4. **Day 3:** Payment tracked, analytics show first real data
5. **Demo time:** Full walkthrough in < 10 minutes for a warm prospect

---

## Next Milestones

- [ ] Define and document ICP in a one-pager for outbound use
- [ ] Run ShopMoiCa-type operator pilot (3–5 businesses)
- [ ] Document pilot outcomes: invoices sent, deals closed, time-to-payment delta
- [ ] Build public product page on `apps/web`
- [ ] Create demo script for sales calls
- [ ] Define revenue milestone for "production-deployed" status claim
