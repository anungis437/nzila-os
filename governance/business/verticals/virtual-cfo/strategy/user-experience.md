# Virtual-CFO — User Experience Strategy

> UX design principles, personas, and interaction flows for Insight CFO — making CFO-level finance accessible to non-financial users.

---

## Design Philosophy

> "Complex financial data, simple human decisions."

### Core UX Principles
1. **Plain language first**: No accounting jargon by default — translate GAAP concepts to business language
2. **Glanceable dashboards**: The most important number is always visible at the top
3. **Guided insights**: Don't just show data — explain what it means and what to do about it
4. **Progressive disclosure**: Simple summary → click for detail → drill into transaction
5. **Mobile-aware**: Dashboard designed for quick mobile check, admin on desktop

---

## User Personas

### Persona 1: Sarah — SMB Owner (Primary)
- **Role**: Owner of a 15-person marketing agency in Toronto
- **Financial literacy**: Basic — understands revenue and expenses, not ratios
- **Current tools**: QuickBooks Online, Excel for "forecasting", bookkeeper does monthly
- **Pain points**: "I never know my real cash position until month-end", "My bookkeeper gives me reports I don't understand", "Tax season is stressful — I'm always scrambling"
- **Goals**: See cash position instantly, know if she can afford to hire, prepare for taxes painlessly
- **Success metric**: Sarah checks Insight CFO dashboard 3x/week instead of logging into QBO

### Persona 2: Daniel — CPA Partner
- **Role**: Partner at a 4-person CPA firm in Montreal, manages 80 SMB clients
- **Financial literacy**: Expert — CPA, CFA
- **Current tools**: Caseware, QuickBooks Accountant, Excel
- **Pain points**: "I want to offer advisory but I'm buried in compliance work", "I can't monitor all 80 clients proactively", "My clients call me in panic when cash is low — I should have warned them"
- **Goals**: Portfolio-level client health view, automated alerts, scalable advisory
- **Success metric**: Daniel grows advisory revenue 40% without adding staff

### Persona 3: Marcus — Fractional CFO
- **Role**: Independent fractional CFO serving 6 SMB clients in Vancouver
- **Financial literacy**: Expert — MBA, 15 years corporate finance
- **Current tools**: Custom Excel models, PowerPoint for board decks
- **Pain points**: "I rebuild the same models for every client", "I spend 60% of my time on data gathering, 40% on advice", "I can't scale beyond 6-8 clients"
- **Goals**: Standardize deliverables, automate data collection, serve 15 clients
- **Success metric**: Marcus doubles client capacity while maintaining quality

### Persona 4: Raj — Bookkeeper / Financial Admin
- **Role**: Bookkeeper at a 40-person construction company in Calgary
- **Financial literacy**: Intermediate — bookkeeping diploma, 5 years experience
- **Current tools**: QuickBooks Desktop (migrating to Online), Excel
- **Pain points**: "My boss asks me questions I can't answer about forecasting", "Year-end prep takes 3 weeks", "I enter the same data in multiple places"
- **Goals**: Auto-sync from QBO, answer boss's ad-hoc financial questions, streamline year-end
- **Success metric**: Raj can generate a monthly financial summary in 5 minutes instead of 4 hours

---

## Key User Flows

### Flow 1: SMB Onboarding (Sarah)
```
Step 1: Sign Up
┌──────────────────────────────────┐
│ Welcome to Insight CFO           │
│                                  │
│ [Sign up with Google]            │
│ [Sign up with Email]             │
│                                  │
│ Business name: [_______________] │
│ Province: [Ontario          ▼]   │
│ Industry: [Professional Svcs ▼]  │
│ Annual revenue: [$1M - $5M   ▼]  │
│                                  │
│ [Get Started →]                  │
└──────────────────────────────────┘

Step 2: Connect Accounting Software
┌──────────────────────────────────┐
│ Connect your books               │
│                                  │
│ ┌──────────────┐ ┌────────────┐  │
│ │ ★ QuickBooks │ │   Xero     │  │
│ │   Online     │ │   (soon)   │  │
│ └──────────────┘ └────────────┘  │
│                                  │
│ ┌──────────────┐ ┌────────────┐  │
│ │   Wave       │ │ Upload CSV │  │
│ │   (soon)     │ │            │  │
│ └──────────────┘ └────────────┘  │
│                                  │
│ ℹ️ We only read your data.       │
│   We never modify your books.    │
└──────────────────────────────────┘

Step 3: Initial Sync (2-3 minutes)
┌──────────────────────────────────┐
│ Syncing 24 months of data...     │
│                                  │
│ ✅ Chart of accounts (32 accts)  │
│ ✅ Customers (47 contacts)       │
│ ✅ Vendors (23 contacts)         │
│ 🔄 Transactions (2,847 of ~3K)  │
│ ⏳ Invoices                      │
│ ⏳ Bills                         │
│                                  │
│ Building your dashboard...       │
│ ████████████████░░░░  78%        │
└──────────────────────────────────┘

Step 4: First Dashboard View
┌──────────────────────────────────┐
│ 🎉 Your CFO Dashboard is ready! │
│                                  │
│ Here's what we found:            │
│ • Cash position: $47,230         │
│ • Monthly burn: $38,500          │
│ • Runway: 1.2 months ⚠️         │
│ • AR outstanding: $62,400        │
│                                  │
│ ℹ️ Quick insight: You have 3     │
│ invoices over 60 days — chase    │
│ these for $28K cash injection.   │
│                                  │
│ [View Full Dashboard →]          │
└──────────────────────────────────┘
```

### Flow 2: Weekly Dashboard Check (Sarah)
```
┌────────────────────────────────────────────────────────┐
│ Insight CFO — Marketing Stars Inc.       🔔 2  👤     │
├────────────────────────────────────────────────────────┤
│                                                        │
│ 💰 Cash Position        📊 Monthly Revenue            │
│ $47,230                 $52,800                        │
│ ▼ $3,200 vs last week   ▲ 12% vs last month           │
│                                                        │
│ 🔮 Cash Forecast (90 days)                             │
│ ┌────────────────────────────────────────┐             │
│ │      $50K ─ ─ ─ ─╲                    │             │
│ │      $40K         ╲─ ─ ─ ─ ─ ─ ─     │             │
│ │      $30K                   ╲─ $32K   │             │
│ │      $20K                             │             │
│ │      $10K --------------------------------          │
│ │           Jan    Feb    Mar    Apr                   │
│ └────────────────────────────────────────┘             │
│ ⚠️ Cash may drop below $35K safety buffer by March    │
│                                                        │
│ 💡 Insights (3 new)                                    │
│ ┌────────────────────────────────────────┐             │
│ │ ⚠️ 3 invoices over 60 days ($28,400)  │ [Action →]  │
│ │ 📈 Office supplies up 34% vs avg      │ [Review →]  │
│ │ ✅ Gross margin healthy at 62%         │ [Details →] │
│ └────────────────────────────────────────┘             │
│                                                        │
│ 📋 Upcoming Tax Deadlines                              │
│ • GST/HST filing — Jan 31 (12 days)     [Prepare →]   │
│ • Payroll remittance — Jan 15 (2 days)   [Ready ✅]    │
│                                                        │
│ 📊 Key Metrics                                         │
│ Gross Margin: 62%  │ DSO: 47 days │ Current Ratio: 1.8│
│ (industry: 55%)    │ (target: 30) │ (healthy: >1.5)   │
└────────────────────────────────────────────────────────┘
```

### Flow 3: CPA Multi-Client Dashboard (Daniel)
```
┌────────────────────────────────────────────────────────┐
│ Insight CFO — Tremblay CPA Portfolio      🔔 5  👤    │
├────────────────────────────────────────────────────────┤
│ 80 clients │ 3 ⚠️ Alerts │ 12 Tax deadlines this month│
│                                                        │
│ Client Health Overview                                 │
│ ┌──────────────────────┬────────┬────────┬──────────┐  │
│ │ Client               │ Health │ Cash   │ Alert    │  │
│ ├──────────────────────┼────────┼────────┼──────────┤  │
│ │ Smith Consulting      │ 🟢 92  │ $125K  │ —        │  │
│ │ Alpine Construction   │ 🟡 61  │ $34K   │ Low cash │  │
│ │ LeBleu Marketing      │ 🔴 28  │ $8K    │ ⚠️ URGENT│  │
│ │ Patel Tech Solutions  │ 🟢 85  │ $89K   │ —        │  │
│ │ Rivera Restaurants    │ 🟡 55  │ $12K   │ AR aging │  │
│ │ ... 75 more           │        │        │          │  │
│ └──────────────────────┴────────┴────────┴──────────┘  │
│                                                        │
│ [Sort by: Health ▼] [Filter: All ▼] [Export Report]    │
│                                                        │
│ 📊 Portfolio Summary                                   │
│ Avg client health: 74 │ Avg cash runway: 3.2mo        │
│ Tax-ready clients: 64/80 │ Overdue AR total: $412K    │
└────────────────────────────────────────────────────────┘
```

---

## Design System

### Visual Language
- **Primary color**: Navy blue (#1B365D) — trust, professionalism, finance
- **Accent color**: Emerald green (#10B981) — growth, money, positive metrics
- **Warning**: Amber (#F59E0B) — attention needed
- **Critical**: Red (#EF4444) — urgent action required
- **Background**: Light gray (#F9FAFB) — clean, modern, minimal

### Typography
- **Headings**: Inter — clean, modern, highly legible
- **Body**: Inter — consistent, excellent for data-heavy screens
- **Numbers/Data**: JetBrains Mono — monospace for financial figures alignment
- **Size hierarchy**: Dashboard numbers (32px) → KPI labels (14px) → Detail text (13px)

### Data Visualization
- **Charts**: Recharts (React) — line charts for trends, bar charts for comparisons
- **Colors**: Green for positive, red for negative, gray for neutral/benchmark
- **Annotations**: Plain-language labels on charts ("You are here", "Danger zone below $20K")
- **Accessibility**: All charts have alt text + tabular data alternative

### Component Library
- Dashboard cards (KPI, insight, alert)
- Data tables with sorting, filtering, export
- Financial statements (P&L, balance sheet, cash flow — standard accounting layout)
- Forecast visualization (line + confidence interval band)
- Tax calendar (timeline + status badges)

---

## Accessibility & Localization

### Accessibility Standards
- **WCAG 2.1 Level AA** compliance
- Keyboard navigable dashboards and reports
- Screen reader compatible financial data (proper table headers, ARIA labels)
- Color-blind safe palette (shapes + labels supplement color coding)
- Minimum 4.5:1 contrast ratio for all text

### Bilingual Support
- **English + French** for all UI, reports, insights, and onboarding
- Language preference stored per user (not per organization)
- CPA reports generated in client's preferred language
- Financial terminology aligned with CPA Canada bilingual glossary
- Quebec-first: French as default for QC-based organizations

### Mobile Responsiveness
- Dashboard optimized for mobile (cards stack vertically)
- Key metrics visible without scrolling (cash + revenue + alerts)
- Touch-friendly chart interactions (tap for detail, swipe for periods)
- Offline mode: last-synced dashboard available without connection
