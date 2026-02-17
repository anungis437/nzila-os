# Uniontech Vertical — User Experience Strategy

**Nzila Corp** | Last Updated: February 2026

---

## 1. Design Philosophy

Union Eyes and DiasporaCore serve users who are **not full-time software users** — they are shop stewards on factory floors, grievance officers managing caseloads between shifts, and volunteer treasurers balancing books after hours. The UX must be:

- **Zero-training intuitive** — core workflows completable without documentation
- **Mobile-first for field roles** — grievance intake, member lookup, campaign canvassing
- **Dashboard-driven for leadership** — executives and financial officers need KPIs, not data entry
- **Accessible by mandate** — AODA (Ontario), WCAG 2.1 AA, keyboard-navigable, screen-reader compatible

---

## 2. User Personas

### 2.1 Union Eyes Personas

| Persona | Role | Primary Tasks | Context | Pain Points |
|---------|------|--------------|---------|-------------|
| **Maria (Shop Steward)** | Front-line steward, manufacturing plant | File grievances, look up member info, check CBA clauses | Mobile-first; on factory floor; intermittent connectivity | Paper grievance forms lost; can't search CBA on phone; no status tracking |
| **Kwame (Grievance Officer)** | Full-time union staff | Manage grievance pipeline, prepare arbitration packages, track deadlines | Desktop-primary; manages 40–80 active cases | Spreadsheet tracking; missed deadlines; no outcome analytics |
| **Sandra (Union Executive / President)** | Elected union president | Review membership trends, approve budgets, monitor grievance health, manage elections | Dashboard consumer; weekly check-ins | No single view of union health; reports are manual and stale |
| **James (Financial Officer / Treasurer)** | Elected or appointed treasurer | Process dues, manage expenses, generate LM-2/LM-3 reports, track budgets | Desktop; quarterly/annual heavy usage | Excel-based accounting; audit anxiety; manual OLMS filings |
| **Anya (Organizer)** | Campaign organizer | Run organizing drives, collect authorization cards, track outreach, manage canvassers | Mobile-primary; door-to-door; evenings/weekends | No digital card-signing; paper tracking; can't measure campaign momentum |

### 2.2 DiasporaCore Personas

| Persona | Role | Primary Tasks | Context |
|---------|------|--------------|---------|
| **Amara (Remitter)** | Diaspora professional | Send money to family; compare rates; track delivery | Mobile-first; price-sensitive; trust-conscious |
| **Emmanuel (Savings Group Leader)** | Njangi/Tontine coordinator | Manage group contributions, enforce rotation, track balances | Mobile; manages 10–30 members; needs transparency tools |
| **Fatou (New Immigrant)** | Recently arrived in Canada | Open account, complete KYC, build financial history | Mobile-first; may have limited English/French; needs multilingual UI |

---

## 3. Onboarding Flow — 90-Day Implementation

### 3.1 Timeline

| Phase | Duration | Activities | Success Metrics |
|-------|----------|-----------|----------------|
| **Phase 1: Setup** | Days 1–14 | Account provisioning; admin configuration; SSO/directory integration; data migration kickoff | Platform accessible; admin accounts active |
| **Phase 2: Data Migration** | Days 7–30 | Import membership rolls, grievance history, CBA documents, financial records from legacy systems | >95% data fidelity; zero duplicate members |
| **Phase 3: Core Training** | Days 15–45 | Role-based training sessions (2 hours each): Stewards, Officers, Executives, Treasurers | >80% of trained users complete a core workflow unassisted |
| **Phase 4: Parallel Run** | Days 30–60 | Union runs both legacy and Union Eyes simultaneously; support team monitors | <5 support tickets/week; grievance filing parity with legacy |
| **Phase 5: Go-Live** | Days 45–75 | Legacy system decommissioned; Union Eyes is system of record | All active workflows on Union Eyes; zero data loss |
| **Phase 6: Optimization** | Days 60–90 | Usage analytics review; workflow customization; add-on module evaluation | Feature activation >70%; executive dashboard adoption |

### 3.2 In-App Onboarding

- **Progressive disclosure** — new users see simplified views; advanced features revealed as competency grows
- **Contextual tooltips** — triggered by first-time interactions with each module
- **Interactive walkthroughs** — guided grievance filing, member search, election setup
- **Onboarding checklist widget** — persistent sidebar showing completion of key setup tasks
- **Role-specific home screens** — stewards see grievance queue; treasurers see financial summary; presidents see union health dashboard

---

## 4. Mobile UX Strategy

### 4.1 Platform Approach

**React Native** — shared codebase for iOS and Android with native performance. Union Eyes Mobile is not a companion app but a **field-optimized interface** to the full platform.

### 4.2 Mobile-Priority Features

| Feature | Use Case | UX Pattern |
|---------|----------|-----------|
| **Grievance Intake** | Steward files grievance on factory floor | Camera (photo evidence), voice-to-text notes, offline draft queue |
| **Member Lookup** | Verify membership status, contact info, dues standing | Search-first UI with barcode/QR scan for member cards |
| **CBA Quick Reference** | Check contract clause during management conversation | Full-text search; bookmarked clauses; offline download |
| **Campaign Canvassing** | Door-to-door organizing with checklist and card signing | GPS-tagged visit logging; digital authorization card capture |
| **Push Notifications** | Grievance deadline alerts, election reminders, dues notices | Configurable per role; snooze and escalation logic |

### 4.3 Offline-First Architecture

- **SQLite local cache** for member directory, CBA documents, and pending grievances
- **Background sync** on connectivity restoration (<30 seconds to reconcile)
- **Conflict resolution** — last-write-wins for notes; server-authoritative for financial data
- **Bandwidth-aware** — image compression for evidence uploads on cellular networks

---

## 5. Dashboard Design — Union KPIs

### 5.1 Executive Dashboard (Sandra — Union President)

| KPI Card | Metric | Visualization | Alert Threshold |
|----------|--------|--------------|----------------|
| **Membership Health** | Total members, net growth rate, retention rate | Trend line (12-month rolling) | Retention <90% |
| **Grievance Pipeline** | Open cases, avg resolution time, outcomes (won/lost/settled) | Funnel chart + heatmap by department | Resolution >45 days |
| **Pension Health** | Plan funded ratio, contribution gap, forecast trajectory | Gauge + scenario projections | Funded ratio <80% |
| **Campaign Effectiveness** | Active campaigns, card sign rate, member engagement score | Progress bar + map overlay | Sign rate <30% |
| **Financial Summary** | Revenue (dues), expenses, budget variance, cash position | Bar chart (budget vs actual) | Variance >10% |
| **Election Readiness** | Upcoming elections, candidate registrations, quorum projections | Calendar timeline | Quorum risk <60% projected turnout |

### 5.2 Grievance Officer Dashboard (Kwame)

| Widget | Content |
|--------|---------|
| **My Caseload** | Active grievances sorted by deadline urgency (red/yellow/green) |
| **Arbitration Calendar** | Upcoming hearings with prep checklist status |
| **Outcome Trends** | Win/loss/settlement rates by grievance type (12 months) |
| **CBA Clause Usage** | Most-cited clauses in active grievances with precedent links |
| **Aging Report** | Grievances by step and days-in-step; bottleneck identification |

### 5.3 Design Principles

- **Glanceable** — critical status visible in <3 seconds
- **Drill-down** — every summary metric links to underlying detail
- **Role-filtered** — same data, different views per persona
- **Exportable** — PDF/Excel export for board reports, regulatory filings
- **Real-time where it matters** — election results live; financial data daily refresh

---

## 6. DiasporaCore UX Specifics

### 6.1 Remittance Flow (Target: <3 Minutes End-to-End)

1. Select recipient (saved or new) → 2. Enter amount → 3. See FX rate + fees + delivery estimate → 4. Confirm with biometric → 5. Track delivery status

### 6.2 Savings Group Interface

- Visual contribution tracker (who has paid, who is due)
- Rotation calendar with automatic payout scheduling
- Group chat integrated for coordination
- Transparency dashboard — all transactions visible to group members

### 6.3 Multilingual Support

| Language | Priority | Coverage |
|----------|----------|---------|
| English | P0 | Full UI + support |
| French | P0 | Full UI + support (Quebec compliance) |
| Lingala | P1 | Core flows (remittance, account) |
| Yoruba | P1 | Core flows |
| Swahili | P2 | Core flows |
| Pidgin English | P2 | Core flows |

---

## 7. Accessibility Requirements

### 7.1 Compliance Standards

| Standard | Scope | Deadline |
|----------|-------|---------|
| **WCAG 2.1 AA** | All web interfaces (Union Eyes + DiasporaCore) | Launch requirement |
| **AODA (Accessibility for Ontarians with Disabilities Act)** | Ontario-deployed services | Mandatory for Ontario unions |
| **ADA / Section 508** | US market entry (2027+) | Required for US public-sector unions |

### 7.2 Implementation Checklist

- [ ] Keyboard navigation for all interactive elements (no mouse-only interactions)
- [ ] Screen reader compatibility (ARIA labels on all form fields, tables, charts)
- [ ] Color contrast ratio ≥ 4.5:1 for text; ≥ 3:1 for large text and UI components
- [ ] Focus indicators visible on all interactive elements
- [ ] Alt text for all images, icons, and data visualizations
- [ ] Responsive design: functional at 320px–2560px viewport widths
- [ ] Reduced motion mode for animations (respects `prefers-reduced-motion`)
- [ ] Error messages associated with form fields via `aria-describedby`
- [ ] Data tables with proper `<th>`, `scope`, and `<caption>` elements
- [ ] Chart alternatives: all data visualizations accompanied by accessible data table views
- [ ] Automated accessibility testing in CI/CD (axe-core, Lighthouse)
- [ ] Quarterly manual accessibility audit by certified IAAP professional

---

## 8. Design System

**Uniontech Design System (UDS)** — shared component library across Union Eyes and DiasporaCore:

| Component Category | Examples | Status |
|-------------------|----------|--------|
| **Layout** | AppShell, SideNav, TopBar, PageHeader | Implemented |
| **Data Display** | DataTable, KPICard, StatusBadge, Timeline | Implemented |
| **Forms** | TextInput, Select, DatePicker, FileUpload, RichTextEditor | Implemented |
| **Feedback** | Toast, AlertBanner, ConfirmDialog, ProgressIndicator | In progress |
| **Charts** | LineChart, BarChart, FunnelChart, GaugeChart, HeatMap | In progress |
| **Mobile** | BottomNav, SwipeCard, CameraCapture, OfflineBanner | Planned (Q2 2027) |

Built on **Tailwind CSS** + **Radix UI primitives** for headless accessibility. Design tokens synchronized between web and React Native.

---

*Document owner: Design & Product | Review cycle: Bi-weekly design review, quarterly UX research sprint*
