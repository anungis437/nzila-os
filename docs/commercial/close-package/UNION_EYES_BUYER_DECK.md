# Union Eyes — Buyer Deck

> 13 slides. Boardroom-ready. Designed to be exported to PowerPoint or rendered as PDF after the demo.

**Audience:** Union President / Secretary-Treasurer / COO / Director of Operations / Pilot Sponsor + their Executive Board.

**Use:** Day 0 follow-up to a 45-minute demo. Pair with the [Trust Visual Pack](./TRUST_VISUAL_PACK.md) and [Pilot ROI Calculator](./PILOT_ROI_CALCULATOR.md).

**Source claims:** [`UNION_EYES_COGNITION_ROI.md`](../UNION_EYES_COGNITION_ROI.md), [`pricing-framework.md`](../pricing-framework.md), [`pilot-offer-cupe.md`](../pilot-offer-cupe.md), [`why-union-eyes.md`](../why-union-eyes.md).

---

## Slide 1 — Title / Why Now

**Title:** Union Eyes — the operating system for modern Canadian unions

**Bullets:**

- Purpose-built for the work: grievance, governance, communications, member engagement
- Canadian-hosted, bilingual, governed AI
- 90-day pilot. No multi-year commitment.

**Speaker notes:** Why now: the gap between what unions need to defend members and what spreadsheets/email can do has stopped being acceptable. Three trends — younger members expecting digital service, employers using analytics in bargaining, and rising arbitration costs — make 2026 the inflection year.

---

## Slide 2 — Union Operational Pain (the honest list)

**Title:** Six predictable failures we see in every union we meet

**Bullets:**

- Missed contractual deadlines because nobody noticed a step-2 window expired
- Steward burnout: top 20% carry 60% of files
- Members drift away between contract cycles — no one saw the silence
- Precedent buried in PDFs; same case re-litigated from scratch
- No defensible numbers for the executive board, members, or arbitration
- Six-to-nine separate tools per local; institutional knowledge walks out with departing reps

**Speaker notes:** Read this slide slowly. Pause after each bullet. Ask which pains the room recognises. This sets up the rest of the deck.

---

## Slide 3 — Why Current Tools Fail

**Title:** The tools you have were not built for unions

**Bullets:**

- Email + spreadsheets: no deadline awareness, no precedent search
- Generic CRM: doesn't understand "Step 3" or "ULP" or "duty of fair representation"
- Microsoft 365 / Google Workspace: storage, not workflow
- Custom build: $400K–$1.2M, 18–36 months, ongoing maintenance burden on staff who have other jobs
- LaborSoft / UnionTrack: US-hosted, not bilingual, no AI, no governance/elections modules

**Speaker notes:** Reference [`why-union-eyes.md`](../why-union-eyes.md) competitive table. Don't bash competitors — state facts.

---

## Slide 4 — What Union Eyes Is

**Title:** A purpose-built union OS, in production today

**Bullets:**

- Grievance + case workflow that knows your contract steps
- Governance, motions, elections — built-in
- Member portal + bilingual communications
- Cognition: 5 advisory AI modules with published formulas
- Modern auth (passwordless, MFA, Entra SSO) — IT-approvable in days, not months
- Canadian-hosted (Microsoft Azure, Canada Central)

**Speaker notes:** "In production today" means we are not selling a roadmap. Every screen on the next two slides is a real shipped route.

---

## Slide 5 — Core Modules

**Title:** Six modules. One platform. No feature tiering.

**Bullets:**

- **Grievance & case management** — intake, timelines, evidence bundles, arbitration export
- **Cognition workbench** — 5 advisory modules, published KPIs (slide 6)
- **Governance** — motions, meeting minutes, voting records
- **Elections** — nominations, secure balloting, result certification
- **Member portal & communications** — bilingual, mobile-friendly, push-capable
- **Analytics & executive view** — backlog, fairness, engagement, ROI snapshot

**Speaker notes:** Every module included in the Local Plan. No upsell ladder. Add-ons exist (private deployment, integrations) — call out only if asked.

---

## Slide 6 — Cognition / Intelligence ROI

**Title:** Five intelligence modules. Ten KPIs with published formulas.

**Bullets:**

- **Grievance trajectory:** risk score + top-3 factors + recommended action
- **Steward workload balancer:** utilisation + fairness score + reassignment recs
- **Member disengagement risk:** tier + outreach channel + timing window
- **Precedent memory:** similar past cases (org-scoped, never cross-org)
- **Executive health summary:** one screen for the board

**Speaker notes:** Walk through one KPI formula on this slide — pick "Steward utilisation balance improved %" because it's the most boardroom-friendly. Hand off to slide 9 for the dollarised view.

---

## Slide 7 — Security & Trust

**Title:** Procurement-defensible from day one

**Bullets:**

- Microsoft Azure Canada Central — member data does not leave Canada
- Encryption: TLS 1.2+ / AES-256
- Identity: password (Argon2id) + magic-link + Microsoft Entra SSO
- MFA: TOTP self-enrol, role-enforceable; account lockout + risk step-up
- Lifecycle controls: invite → suspend → deprovision (sessions revoked on suspend)
- Append-only audit log: 25+ event types
- DPA, subprocessors, IR, backup/restore — pre-packaged
- Pre-SOC 2 (engaged); independent pen test on the roadmap — disclosed on the record

**Speaker notes:** Refer to the [Trust Visual Pack](./TRUST_VISUAL_PACK.md). Do not overclaim certifications. Honesty is the trust signal.

---

## Slide 8 — Pilot Plan (90 Days)

**Title:** Pilot in 14 days. Real outcomes in 90.

**Bullets:**

- Week 1: contract signed, data import template shared, Azure tenant provisioned
- Week 2: configured, accounts created, **go-live**
- Weeks 3–4: steward onboarding (2 × 90-min sessions, recorded)
- Weeks 5–8: active use, weekly check-ins
- Weeks 9–10: mid-pilot review with metrics
- Weeks 11–12: pilot close-out + ROI report + renewal decision

**Speaker notes:** $12,000 CAD pilot fee, fully credited to year-1 subscription on conversion. Source: [pilot-offer-cupe.md](../pilot-offer-cupe.md).

---

## Slide 9 — KPI Outcomes (the math slide)

**Title:** A typical 15-steward / 800-member local

**Bullets:**

- Precedent retrievals: 4/wk × 1.5h × 4w = **24h/month saved**
- Early-warning interventions: 6/wk × 0.75h × 4w = **18h/month saved**
- Accepted reassignments: 2/wk × 1.0h × 4w = **8h/month saved**
- **Total: 50h/month → CAD $3,250/month at $65/h loaded**
- Local Plan licence < $3,000/month → **ROI-positive on hours alone, before avoided-arbitration upside**

**Speaker notes:** This is illustrative — the [ROI Calculator](./PILOT_ROI_CALCULATOR.md) lets the buyer plug in their own assumptions. Encourage them to be conservative; the math still works.

---

## Slide 10 — Implementation Simplicity

**Title:** What we provide. What you provide.

**Bullets:**

- **We provide:** Azure tenant, configured workflow, steward onboarding (2 × 90 min), weekly check-ins, ROI report, 5-business-day data export on exit
- **You provide:** active grievance list (CSV — we provide the template), CA step structure, list of rep/steward users, 1 pilot coordinator (~2h/week)
- IT lift: SSO config (optional, ~2 hours) + add domain to email allowlist
- No on-premise install. No new servers. No DBA work.

**Speaker notes:** Reference [PROCUREMENT_CHECKLIST.md](./PROCUREMENT_CHECKLIST.md). Keep this slide tactical — it kills FUD about "implementation projects".

---

## Slide 11 — Commercial Model

**Title:** Pilot-first. Membership-based. No hidden costs.

**Bullets:**

- Pilot: $12,000 CAD / 90 days (Local tier, ≤5,000 members) — fully credited on conversion
- Local subscription: $18K–$52K/year, scaled by membership band
- Council subscription: $72K–$96K/year for 5K–25K members
- All modules included. Unlimited stewards. Unlimited grievance volume.
- No multi-year required. Annual renewals.

**Speaker notes:** Source: [pricing-framework.md](../pricing-framework.md). If asked about discounts: pilot credit is the discount mechanism — we do not run "BANT" pricing games.

---

## Slide 12 — Why Choose Us Now

**Title:** Five reasons that hold up under board scrutiny

**Bullets:**

- **Purpose-built**: knows the work, not a CRM with union labels
- **Canadian-hosted**: PIPEDA-aligned, no US data transit
- **Governed AI**: advisory only, every recommendation overridable
- **Procurement-ready**: DPA, subprocessors, IR, audit log — pre-packaged
- **Reversible**: 90-day pilot, full data export, no lock-in

**Speaker notes:** End on "no lock-in". Buyers have been burned by 3-year SaaS contracts. Reversibility is a feature.

---

## Slide 13 — Next Steps

**Title:** From here to go-live

**Bullets:**

- **Today:** receive this deck + Trust Pack + Pilot Outline (Day 0)
- **Day 2:** Procurement Checklist for your Legal/IT/Ops/Finance leads
- **Day 5:** ROI Calculator with your assumptions plugged in
- **Day 7:** stakeholder follow-up call (executive + IT + procurement)
- **Day 10:** signature target — pilot kickoff within 5 business days

**Speaker notes:** Source: [ENTERPRISE_CLOSE_SEQUENCE.md](./ENTERPRISE_CLOSE_SEQUENCE.md). This slide is the implicit ask: "Can we hold the Day 7 stakeholder call?"

---

## Appendix slides (use only if asked)

- **A1** — Cognition formulas in detail (cite [`UNION_EYES_COGNITION_ROI.md`](../UNION_EYES_COGNITION_ROI.md))
- **A2** — Full pricing matrix (cite [`pricing-framework.md`](../pricing-framework.md))
- **A3** — Trust appendix (5 slides from [Trust Visual Pack](./TRUST_VISUAL_PACK.md))
- **A4** — Competitive comparison table (from [`why-union-eyes.md`](../why-union-eyes.md))
- **A5** — What we don't claim today (honest gap list — copy from Trust Pack Section A)

---

## Speaker prep checklist

- [ ] Confirm buyer's CA structure ahead of slide 4–5 (so module talk is concrete)
- [ ] Have screenshots T-1 through T-5 from [Trust Visual Pack](./TRUST_VISUAL_PACK.md) loaded
- [ ] ROI calculator pre-filled with buyer's membership + steward count
- [ ] Procurement checklist printed for handoff at end of meeting
- [ ] Trust Pack PDF ready to email within 5 minutes of meeting end
