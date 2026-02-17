# Virtual-CFO — Business Model

> Revenue model, unit economics, and financial projections for Insight CFO — fractional CFO analytics for Canadian SMBs.

---

## Revenue Model

### Pricing Tiers

#### SMB Direct Plans
| Plan | Monthly | Annual | Target Segment | Features |
|---|---|---|---|---|
| **Starter** | $49/mo | $490/yr (17% off) | Solopreneurs, <$500K rev | Dashboard, P&L, cash flow basic, 1 QBO connection |
| **Growth** | $149/mo | $1,490/yr | SMBs $500K–$5M rev | Full analytics, forecasting, tax readiness, KPIs, advisory insights |
| **Pro** | $299/mo | $2,990/yr | SMBs $5M–$25M rev | Multi-entity, scenario planning, board reports, API access, priority support |

#### CPA Firm Plans
| Plan | Monthly | Annual | Target | Features |
|---|---|---|---|---|
| **CPA Starter** | $199/mo | $1,990/yr | Solo CPA, up to 10 clients | Multi-client dashboard, white-label reports |
| **CPA Practice** | $499/mo | $4,990/yr | 2–5 partner firm, up to 50 clients | Client health scoring, automated alerts, branded portal |
| **CPA Enterprise** | $999/mo | $9,990/yr | 5+ partner firm, unlimited clients | Custom integrations, dedicated support, SLA |

#### Add-Ons
| Add-On | Price | Description |
|---|---|---|
| Extra QBO/Xero connection | $19/mo each | Multi-entity businesses |
| AI Advisory Reports | $49/mo | GPT-powered monthly narrative reports |
| Fractional CFO Matching | 15% placement fee | Connect with vetted fractional CFOs |
| Custom Dashboards | $99/mo | Drag-and-drop KPI dashboard builder |
| Bank Feed Direct (Plaid) | $29/mo | Real-time bank connection (no accounting software needed) |

---

## Unit Economics

### SMB Direct (Growth Plan — Core Segment)

| Metric | Value | Notes |
|---|---|---|
| **ARPU** | $149/mo ($1,788/yr) | Growth plan (most popular) |
| **Gross margin** | 88% | Supabase infra is extremely low cost |
| **CAC** | $200 | Content marketing + QBO marketplace + trial conversion |
| **LTV** | $5,364 | 36-month avg retention × $149/mo |
| **LTV:CAC** | 26.8x | Excellent unit economics |
| **Payback period** | 1.3 months | Very fast payback |
| **Monthly churn** | 2.5% | Target: reduce to 1.5% by 2027 |
| **Net revenue retention** | 110% | Upsell Starter → Growth, add connections |
| **Trial conversion** | 20% | 14-day free trial → paid |

### CPA Firm (Practice Plan — Core Segment)

| Metric | Value | Notes |
|---|---|---|
| **ARPU** | $499/mo ($5,988/yr) | CPA Practice plan |
| **Gross margin** | 90% | Higher margin — multi-client SaaS |
| **CAC** | $1,500 | Direct sales + CPA events + longer sales cycle |
| **LTV** | $23,952 | 48-month avg retention × $499/mo |
| **LTV:CAC** | 16.0x | Strong enterprise-like economics |
| **Payback period** | 3.0 months | |
| **Monthly churn** | 1.5% | CPA firms are sticky — client data locked in |
| **Net revenue retention** | 120% | Add clients, upgrade plans |

### Blended Metrics
| Metric | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Blended ARPU | $167/mo | $185/mo | $210/mo |
| Blended gross margin | 85% | 88% | 90% |
| Blended LTV:CAC | 15x | 20x | 25x |
| Blended churn | 3.0% | 2.5% | 2.0% |

---

## Cost Structure

### Year 1 (2025)
| Category | Monthly | Annual | % Revenue |
|---|---|---|---|
| **Infrastructure (Supabase)** | $50 | $600 | 9% |
| **QBO API costs** | $100 | $1,200 | 18% |
| **Development (contract)** | $2,000 | $24,000 | 36% |
| **Marketing** | $500 | $6,000 | 9% |
| **Support tools** | $100 | $1,200 | 2% |
| **Total costs** | $2,750 | $33,000 | 50% |
| **Revenue** | $5,500 | $66,000 | — |
| **Net margin** | $2,750 | $33,000 | 50% |

### Year 2 (2026)
| Category | Monthly | Annual | % Revenue |
|---|---|---|---|
| **Infrastructure** | $200 | $2,400 | 1% |
| **API costs** | $500 | $6,000 | 1% |
| **Development (2 contractors)** | $8,000 | $96,000 | 19% |
| **Marketing** | $3,000 | $36,000 | 7% |
| **Sales (1 CPA channel rep)** | $5,000 | $60,000 | 12% |
| **Support (1 part-time)** | $2,000 | $24,000 | 5% |
| **Total costs** | $18,700 | $224,400 | 45% |
| **Revenue** | $41,700 | $500,000 | — |
| **Net margin** | $23,000 | $275,600 | 55% |

---

## Revenue Projections

### Conservative Scenario
| Year | SMBs | CPA Firms | MRR | ARR | Growth |
|---|---|---|---|---|---|
| 2025 | 40 | 5 | $6,700 | $80K | — |
| 2026 | 250 | 20 | $42K | $500K | 525% |
| 2027 | 800 | 50 | $125K | $1.5M | 200% |
| 2028 | 1,500 | 100 | $250K | $3.0M | 100% |
| 2029 | 2,500 | 150 | $400K | $4.8M | 60% |
| 2030 | 4,000 | 200 | $600K | $7.2M | 50% |

### Revenue Mix Evolution
| Year | SMB Direct | CPA Channel | Add-Ons | Services |
|---|---|---|---|---|
| 2025 | 70% | 20% | 5% | 5% |
| 2026 | 55% | 30% | 10% | 5% |
| 2027 | 45% | 35% | 15% | 5% |
| 2028 | 40% | 35% | 20% | 5% |

---

## Funding & Investment Strategy

### Bootstrap Phase (2025)
- Initial development: self-funded from Nzila Corp operating budget
- Target: $80K ARR before seeking external capital
- Burn rate: ~$2,750/mo (lean Supabase stack)
- Runway: 18+ months at current burn

### Seed Round (Late 2026 / Early 2027)
- Target raise: $500K–$1M
- Use of funds:
  - Engineering team (2 full-time devs): 50%
  - Marketing & CPA channel development: 25%
  - US market entry preparation: 15%
  - Operations & legal: 10%
- Target investors: Canadian fintech / accounting tech angels, BDC, MaRS IAF

### Key Financial Milestones
| Milestone | Target Date | Metric |
|---|---|---|
| First paying customer | Q1 2025 | Revenue > $0 |
| Product-market fit signal | Q3 2025 | NPS > 50, <3% monthly churn |
| Break-even (monthly) | Q4 2025 | MRR > monthly costs |
| $500K ARR | Q4 2026 | 250 SMBs + 20 CPA firms |
| Cash flow positive (cumulative) | Q2 2026 | Cumulative revenue > cumulative costs |
| $1M ARR | Q2 2027 | Seed round validation |
| $3M ARR | Q4 2028 | Series A readiness |

---

## Competitive Pricing Analysis

### Price-Value Matrix
| Solution | Monthly Cost | Features | Target |
|---|---|---|---|
| **DIY (Excel)** | $0 | Manual, error-prone, no forecasting | <$100K rev |
| **LivePlan** | $20–$40 | Business planning, basic forecasting | Pre-revenue startups |
| **Fathom** | $49–$250 | Reporting, KPIs, no advisory | All SMBs |
| **Insight CFO** | $49–$299 | Dashboard + forecasting + advisory + tax | Growing SMBs |
| **Jirav** | $800+ | Full FP&A, complex | $5M+ companies |
| **Fractional CFO** | $3K–$10K | Full advisory, limited capacity | $2M+ companies |

### Insight CFO Value Proposition
- **40% cheaper** than Fathom at comparable feature level
- **20x cheaper** than a fractional CFO with 60% of the output automated
- **Only Canadian-first** platform with CRA tax calendar and bilingual support
- **CPA channel** pricing creates lock-in (clients can't easily migrate away from CPA's chosen platform)
