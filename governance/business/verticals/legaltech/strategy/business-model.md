# Court Lens — Business Model

> Revenue model, unit economics, and financial projections for Court Lens AI legal analytics platform targeting Canadian legal professionals.

---

## Revenue Streams

### 1. SaaS Subscriptions (Primary — 70% of Revenue)

| Tier | Monthly Price | Annual Price | Features | Target Segment |
|------|-------------|-------------|----------|----------------|
| Solo Practitioner | $99/mo | $999/yr | 50 predictions/mo, basic search, 5 judge profiles | Solo lawyers (22K+ in Ontario) |
| Small Firm | $299/mo | $2,999/yr | 200 predictions/mo, full search, team dashboard, 50 judge profiles | 2-10 lawyer firms (4,500+) |
| Large Firm | $699/mo | $6,999/yr | Unlimited predictions, API access, custom reports, opposing counsel analytics | 11-50 lawyer firms (800+) |
| Enterprise | $1,500+/mo | Custom | White-label, dedicated support, custom models, bulk API, SLA | Bay Street / national firms (150+) |

### 2. API Licensing (15% of Revenue)
- Legal publishers (LexisNexis, Thomson Reuters) — prediction data feeds
- Practice management tools (Clio, PracticePanther) — embedded analytics
- Legal research platforms — Court Lens prediction overlay
- Pricing: $0.50–$2.00 per API call (volume discounts for partners)

### 3. Custom Analytics Reports (10% of Revenue)
- Bespoke litigation risk assessments for specific cases or portfolios
- Judicial tendency deep dives for upcoming trials
- Industry-specific outcome analyses (medical malpractice trends, securities litigation)
- Pricing: $500–$5,000 per report depending on complexity

### 4. CLE & Education Revenue (5% of Revenue)
- Continuing Legal Education workshops on legal analytics and AI
- Law school academic licenses (subsidized — funnel for future subscribers)
- Conference presentations and sponsored research publications
- Pricing: $50–$200 per CLE attendee, $500/yr per law school seat

---

## Unit Economics

### Key Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| LTV (Lifetime Value) | $7,200 | Based on 36-month avg retention × $200 ARPU |
| CAC (Customer Acquisition Cost) | $150 | Blended across all channels |
| LTV/CAC Ratio | 48x | Best-in-class for legal SaaS |
| Monthly ARPU | $200 | Blended across tiers |
| Payback Period | < 1 month | $200 ARPU vs $150 CAC |
| Target Monthly Churn | < 2.5% | Legal workflows are sticky once adopted |
| Gross Margin | 80% | High margin — primary costs are Azure compute/AI |

### CAC by Channel

| Channel | CAC | Conversion Rate | Notes |
|---------|-----|-----------------|-------|
| CLE Workshops | $80 | 15% | Warm leads, demonstration of value |
| Legal Conferences | $250 | 5% | Brand awareness, broad reach |
| Content/SEO | $50 | 3% | Blog posts, judicial trend reports |
| Law School Pipeline | ~$0 | 8% (post-graduation) | Long-term funnel, zero marginal cost |
| Referral Program | $60 | 25% | 2 months free = $200 cost / high conversion |
| Bar Association Endorsement | $100 | 10% | Credibility-driven conversion |

### Revenue Per Tier Breakdown

| Tier | % of Subscribers | ARPU | Revenue Contribution |
|------|-----------------|------|---------------------|
| Solo | 50% | $99/mo | 25% |
| Small Firm | 30% | $299/mo | 45% |
| Large Firm | 15% | $699/mo | 20% |
| Enterprise | 5% | $1,500/mo | 10% |

---

## Financial Projections (2025–2030)

| Year | Subscribers | ARR | Revenue Growth | Key Milestone |
|------|------------|-----|---------------|---------------|
| 2025 | 400 | $480K | – | Ontario launch, 78% prediction accuracy |
| 2026 | 800 | $960K | 100% | Pan-Canadian (CBA partnership), French model |
| 2027 | 1,500 | $1.8M | 88% | Advanced AI features, 85% accuracy |
| 2028 | 3,000 | $3.6M | 100% | UK/AU international expansion |
| 2029 | 5,000 | $6.0M | 67% | Multi-jurisdiction prediction |
| 2030 | 8,000 | $9.6M | 60% | Global common law platform |

### Conservative Scenario (SOM Target)
- 2030 SOM target: $300K (conservative portfolio-level projection)
- Achievable with just 125 subscribers at blended $200 ARPU
- Represents < 0.5% penetration of Ontario lawyers alone

---

## Cost Structure

### Variable Costs (per query/prediction)
- Azure OpenAI API: $0.02–$0.10 per prediction (embedding + GPT-4 reasoning)
- PostgreSQL/pgVector compute: $0.005 per query
- Estimated COGS per prediction: $0.05–$0.15

### Fixed Monthly Costs (at scale)

| Category | Monthly Cost | % of Revenue |
|----------|-------------|-------------|
| Azure Infrastructure | $3,000–$8,000 | 5-8% |
| Azure OpenAI API | $2,000–$5,000 | 3-5% |
| Data Pipeline (CanLII) | $1,000 | 1-2% |
| Legal Domain Experts | $5,000 | 5-8% |
| Engineering Team | $25,000 | 25-30% |
| Sales & Marketing | $10,000 | 10-15% |
| Customer Support | $5,000 | 5-8% |
| Compliance/Legal | $3,000 | 3-5% |
| **Total Monthly Costs** | **$54,000–$62,000** | **55-65%** |

### Path to Profitability
- Breakeven: ~$65K MRR (~325 subscribers at blended $200 ARPU)
- Target breakeven: Q3 2025
- Post-breakeven gross margin: 75-80%

---

## Growth Metrics & KPIs

### Activation Metrics
- Time to first prediction: < 5 minutes from signup
- Day 7 retention: > 60% (used prediction in first week)
- Day 30 retention: > 45%

### Engagement Metrics
- Predictions per user per month: target 15+ (Solo), 50+ (Firm)
- Search queries per session: target 5+
- Judge profiles viewed per month: target 10+ per user
- Report exports per month: target 2+ per Firm/Enterprise user

### Revenue Metrics
- Net Revenue Retention (NRR): target 120%+ (upselling Solo → Firm tiers)
- Expansion revenue: tier upgrades + additional seats
- Logo churn: < 5% annually

---

## Funding Strategy

### Pre-Seed (Completed)
- Nzila Corp internal allocation
- Focus: MVP development, CanLII data pipeline, initial prediction model

### Seed Round (2025 Target — $500K)
- Legal-focused angel investors (lawyers turned investors)
- Canadian tech accelerators (Creative Destruction Lab, MaRS)
- Use of funds: team expansion (2 ML engineers), Ontario market launch

### Series A (2027 Target — $3M)
- Legal-focused VCs (Legaltech Fund, Bessemer Venture Partners)
- Impact of 85% prediction accuracy + 1,500 subscribers as proof points
- Use of funds: international expansion, enterprise sales team, French NLP model

### Government Grants
- IRAP (Industrial Research Assistance Program) — AI/ML R&D support
- SRED (Scientific Research and Experimental Development) — tax credits on ML development
- Ontario Scale-Up Voucher Program — market expansion support
