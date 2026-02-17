# Justice-Equity Vertical — Product Roadmap

**Last Updated: February 2026**
**Platform:** ABR Insights
**Architecture:** Next.js 14+ App Router, Azure PostgreSQL, Drizzle ORM, Clerk Auth, Azure OpenAI GPT-4

---

## 1. Roadmap Overview

ABR Insights is Canada's first AI-powered Anti-Black Racism learning platform. This roadmap details the quarterly feature plan from core LMS launch through national market leadership.

### Vision Timeline

| Phase | Period | Goal | Target Customers |
|-------|--------|------|-----------------|
| Foundation | Q2 2026 | Core LMS launch, 5 pilot customers | 5 |
| CE Expansion | Q3 2026 | CE credit integrations, 10 customers | 10 |
| Scale | Q4 2026 | Mobile app, 15 customers, $100K ARR | 15 |
| Intelligence | Q1 2027 | GPT-4 v2, adaptive learning | 25 |
| Enterprise | Q2 2027 | Multi-tenant, SCORM/xAPI | 40 |
| Growth | Q3-Q4 2027 | 60 customers, national partnerships | 60 |
| Leadership | 2028 | 80 customers, national market leader | 80 |

---

## 2. Q2 2026 — Foundation Launch

### Core LMS (April-June 2026)

| Feature | Description | Success Criteria |
|---------|-------------|-----------------|
| Course Library v1 | 10 foundational ABR courses (video, text, quizzes) | 10 courses published, avg rating ≥4.2/5 |
| Tribunal Database v1 | 10,000+ CanLII cases indexed, keyword + semantic search | <2s search latency, 90%+ relevance on top-5 results |
| GPT-4 Coach v1 | Conversational learning assistant (Companion Prompt Library) | 85%+ helpfulness rating, <3s response time |
| Gamification v1 | XP, badges, streaks, leaderboards (18-table engine) | 80%+ course completion rate |
| Admin Dashboard v1 | Learner progress tracking, completion reports | HR managers can export compliance reports |
| Clerk Auth Integration | SSO, email/password, social login | <500ms auth latency, 99.9% uptime |

### Technical Milestones

- Deploy 132 Supabase tables to Azure PostgreSQL via Backbone migration
- pgVector semantic search pipeline operational (CanLII embedding with `text-embedding-3-large`)
- Azure OpenAI GPT-4 integration with safety guardrails and prompt routing
- CI/CD pipeline (GitHub Actions → Azure Container Apps)
- Monitoring: Azure Application Insights + custom dashboards

### Success Criteria

- **5 pilot customers** onboarded (2 mid-market, 2 public sector, 1 association)
- **500+ active learners** across all accounts
- **80%+ course completion rate** (vs 25-30% industry avg)
- **<2s page load** on all core pages
- **Zero critical security incidents**

---

## 3. Q3 2026 — CE Credit Expansion

### CE Credit Integrations (July-September 2026)

| Feature | Description | Success Criteria |
|---------|-------------|-----------------|
| CPHR CE Credits | Accredited courses for CPHR members (28K+ professionals) | CPHR accreditation approval received |
| OAHPP CE Credits | Health professional CE credits (6K+ professionals) | OAHPP accreditation approval received |
| Certificate Generation | Automated PDF certificates with QR verification | <5s generation, tamper-proof verification |
| CE Tracking Dashboard | Learner CE credit accumulation, expiry alerts | 100% accurate credit tracking |
| Course Library v2 | Expand to 20 courses (sector-specific: healthcare, education, law) | 20 courses published |
| Assessment Engine v2 | Pre/post assessments, knowledge retention scoring | Measurable knowledge gain per learner |

### Partnership Milestones

- CPHR Ontario chapter partnership signed
- OAHPP pilot program with 3 health units
- 2 HR consulting firm referral agreements active

### Success Criteria

- **10 customers** (5 new from CE channel)
- **1,500+ active learners**
- **CE credits issued to 200+ professionals**
- **NPS ≥ 50** across all accounts

---

## 4. Q4 2026 — Scale

### Mobile & Growth Features (October-December 2026)

| Feature | Description | Success Criteria |
|---------|-------------|-----------------|
| Mobile App (PWA) | Responsive PWA for iOS/Android, offline course access | <3s load on 4G, offline mode for downloaded courses |
| Tribunal Database v2 | Advanced filters (province, year, sector, outcome), saved searches | 50%+ returning search users |
| Notification Engine | Email + push notifications (streak reminders, new courses, CE expiry) | 30%+ notification engagement rate |
| Analytics Dashboard v2 | ROI metrics for HR (cost-per-trained, compliance %, knowledge scores) | HR managers report positive ROI evidence |
| Bulk User Import | CSV/HRIS integration for enterprise onboarding | <5min for 500-user import |
| API v1 | REST API for HRIS integration (BambooHR, Workday connectors) | API documentation published, 2+ integrations |

### Success Criteria

- **15 customers** (5 new)
- **$100K ARR** achieved
- **3,000+ active learners**
- **Mobile usage ≥ 20%** of total sessions
- **CAC ≤ $5,000** (blended)

---

## 5. Q1 2027 — Intelligence

### GPT-4 v2 & Adaptive Learning (January-March 2027)

| Feature | Description | Success Criteria |
|---------|-------------|-----------------|
| GPT-4 Coach v2 | Role-play scenarios, microaggression simulations, tone adaptation | 90%+ learner satisfaction, realistic scenario ratings |
| Adaptive Learning Paths | AI-generated personalized course sequences based on role + knowledge gaps | 15%+ improvement in knowledge retention vs static paths |
| Companion Prompt Library v2 | 300+ prompts, domain-specific prompt chains, contextual triggering | Prompt coverage for all 20+ course topics |
| Sentiment Analysis | Real-time learner sentiment tracking during sensitive content | Early intervention alerts for facilitators |
| Course Recommendation Engine | Collaborative filtering + content-based recommendations | 40%+ recommendation acceptance rate |
| Advanced Gamification | Team challenges, department competitions, seasonal events | 85%+ completion rate, 60%+ leaderboard participation |

### Success Criteria

- **25 customers**
- **$250K ARR**
- **5,000+ active learners**
- **Adaptive paths improve assessment scores by ≥15%** vs control group

---

## 6. Q2 2027 — Enterprise

### Enterprise Features (April-June 2027)

| Feature | Description | Success Criteria |
|---------|-------------|-----------------|
| Multi-Tenant Dashboards | Org-level admin with department/team hierarchy views | Support 10+ department structures per org |
| SCORM/xAPI Export | Course packages exportable to existing enterprise LMS | SCORM 1.2, SCORM 2004, xAPI compliance certified |
| SSO/SAML Enterprise | Okta, Azure AD, OneLogin integrations | <1hr SSO setup for new enterprise accounts |
| Compliance Reporting v2 | Bill 67, AODA, ESG automated compliance reports | Auto-generated quarterly compliance packages |
| Custom Branding | White-label course experience per enterprise client | Full brand customization in <30 min |
| Manager Insights | Team readiness scores, intervention recommendations | Actionable insights per team manager |

### Success Criteria

- **40 customers**
- **$500K ARR**
- **8,000+ active learners**
- **Enterprise ACV ≥ $50K average**
- **NRR ≥ 125%**

---

## 7. Q3-Q4 2027 — Growth

| Feature | Timeline | Success Criteria |
|---------|----------|-----------------|
| Course Library v3 (40+ courses) | Q3 2027 | Industry-specific content (finance, tech, healthcare, legal) |
| Law Society CPD Credits | Q3 2027 | LSO accreditation for legal professionals |
| French Language Support | Q3 2027 | Full bilingual platform (Federal requirement) |
| HRIS Deep Integrations | Q4 2027 | Workday, ADP, BambooHR bi-directional sync |
| Analytics Export / BI Integration | Q4 2027 | Power BI, Tableau data connectors |
| Customer Success Automation | Q4 2027 | Health scoring, churn prediction, auto-intervention |

### Success Criteria

- **60 customers**, **$1M ARR**
- **15,000+ active learners**
- **NRR ≥ 135%**
- **3+ government contracts signed**

---

## 8. 2028 — National Leadership

| Goal | Target |
|------|--------|
| Total Customers | 80 |
| ARR | $2M |
| Active Learners | 30,000+ |
| Course Library | 60+ courses |
| CE Credit Partnerships | 5+ professional associations |
| Market Position | #1 ABR training platform in Canada |
| Team Size | 15-20 (engineering, content, sales, CS) |

### Key 2028 Initiatives

- National government partnership (CHRC endorsed platform)
- US market exploration (pilot with 5 US organizations)
- AI-generated course content pipeline (GPT-4 assisted authoring)
- Platform-as-a-Service model for DEI consulting firms
- SOC 2 Type II certification achieved

---

## 9. Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Bill 67 enforcement delayed | Revenue timing | Medium | Diversify beyond Ontario public sector |
| GPT-4 cost escalation | Margin compression | Low | Prompt caching, model optimization, fallback to GPT-3.5 |
| Enterprise sales cycle > 180 days | Cash flow | High | Focus mid-market first, build references |
| Competitor enters ABR niche | Market share | Medium | Accelerate moat (tribunal DB, CE credits, prompts) |
| Content sensitivity incident | Reputation | Low | Safety guardrails, legal review, rapid response plan |
