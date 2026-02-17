# EdTech-Cybersecurity — User Experience Strategy

> UX strategy for CyberLearn — cybersecurity awareness training for non-technical employees, managed by MSPs and IT admins.

---

## User Personas

### 1. MSP Administrator — "Carlos"
- **Profile**: 38, managed services operations manager, oversees 15 client organizations, 800 end-users
- **Pain Points**: Managing separate training portals per client, no unified compliance view, manual reporting
- **Needs**: Single dashboard for all clients, automated enrollment, bulk campaign management, branded portals
- **Usage**: Daily check-ins (15 min), weekly client reporting, monthly campaign reviews
- **Value Prop**: "Manage all your clients' security training from one dashboard — bill automatically"

### 2. IT Administrator — "Jennifer"
- **Profile**: 45, IT manager at 150-person accounting firm, responsible for security compliance
- **Needs**: Easy setup, compliance reports for partners, phishing baseline, proof for cyber insurance
- **Usage**: Monthly training reviews, quarterly compliance reports, annual insurance renewal prep
- **Value Prop**: "Show your insurer and partners that your team is security-trained — in 10 minutes"

### 3. Employee Learner — "David"
- **Profile**: 29, accounts receivable clerk, non-technical, mandatory security training every quarter
- **Pain Points**: Finds security training boring, interrupts workflow, doesn't see relevance
- **Needs**: Short modules (<5 min), relevant to his job, not condescending, mobile-friendly
- **Usage**: Quarterly assigned training (30 minutes total), phishing tests (ongoing)
- **Value Prop**: "Learn to spot threats in 5 minutes — protect your inbox, protect your company"

### 4. Company Executive — "Sarah"
- **Profile**: 52, CFO at law firm, needs board-level security reporting, making cyber insurance decisions
- **Pain Points**: Can't quantify security risk, no visibility into employee security behavior
- **Needs**: Executive dashboard, risk score trending, insurance compliance evidence
- **Usage**: Monthly report review, quarterly board updates
- **Value Prop**: "Know your company's human security risk score — and show the board"

---

## Core UX Flows

### MSP Admin Dashboard
```
┌─────────────────────────────────────────────────────────┐
│ CyberLearn MSP Dashboard                    Carlos ⚙️   │
│                                                         │
│ Portfolio Overview:                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ 15       │ │ 812      │ │ 78%      │ │ 12%      │  │
│ │ Clients  │ │ Users    │ │ Trained  │ │ Phish    │  │
│ │          │ │          │ │ This Qtr │ │ Click %  │  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
│ Client Risk Ranking:                                    │
│ ⬤ Smith & Co Law (82 users)     Risk: ■■■□□ Medium    │
│ ⬤ Bay Street Finance (45 users)  Risk: ■■□□□ Low      │
│ ⬤ Maple Dental (23 users)       Risk: ■■■■□ High     │
│   └ 3 users failed phishing 2x — recommend remediation │
│                                                         │
│ [New Campaign] [Generate Reports] [Add Client]          │
└─────────────────────────────────────────────────────────┘
```

### Learner Training Experience
```
┌─────────────────────────────────────────────────────────┐
│ 🛡️ CyberLearn — Your Training                          │
│                                                         │
│ Welcome, David! You're 2/5 modules complete this quarter│
│ ████████░░░░░░░░░░░░ 40%                               │
│                                                         │
│ 📋 Assigned Training:                                   │
│ ┌───────────────────────────────────────────────┐       │
│ │ ✅ Module 1: Phishing Basics (5 min) — Score: 90% │  │
│ │ ✅ Module 2: Password Security (4 min) — Score: 85%│  │
│ │ ▶️ Module 3: Social Engineering (5 min)           │  │
│ │ ○ Module 4: Data Handling (3 min)                  │  │
│ │ ○ Module 5: Physical Security (4 min)              │  │
│ └───────────────────────────────────────────────┘       │
│ Deadline: March 31, 2025                                │
│                                                         │
│ 🏆 Your Stats:    Points: 450 │ Rank: #12 of 150       │
│ 🎯 Phishing Tests: 3/3 caught │ Badge: 🥇 Phish Hunter │
└─────────────────────────────────────────────────────────┘
```

### Phishing Test — User Click Flow
```
User clicks phishing link:
┌─────────────────────────────────────────────────────────┐
│ 🐟 Oops! This was a simulated phishing email.          │
│                                                         │
│ Don't worry — this was just a test.                     │
│ No data was compromised.                                │
│                                                         │
│ Here's what you should have noticed:                    │
│                                                         │
│ ⚠️ Sender: "IT-Support@yourc0mpany.com"                │
│   → Misspelled domain (zero instead of 'o')            │
│                                                         │
│ ⚠️ Urgency: "Password expires in 1 hour"               │
│   → Legitimate IT never creates false urgency           │
│                                                         │
│ ⚠️ Link: "login.yourc0mpany-secure.com"                 │
│   → Domain doesn't match your real company domain       │
│                                                         │
│ What to do next time:                                   │
│ 1. Hover over links before clicking                     │
│ 2. Check the sender's email address carefully           │
│ 3. Report suspicious emails using the 🚩 Report button │
│                                                         │
│ [▶ Take 2-Minute Refresher] [✓ I Understand]           │
└─────────────────────────────────────────────────────────┘
```

---

## Gamification System

### Points & Badges
| Action | Points | Frequency |
|---|---|---|
| Complete a training module | 50 | Per module |
| Pass quiz (80%+) | 25 | Per quiz |
| Perfect quiz score (100%) | 50 bonus | Per quiz |
| Catch phishing test (report) | 100 | Per test |
| Complete quarterly training on time | 200 | Quarterly |
| 30-day streak (no phishing clicks) | 150 | Monthly |

### Badges
- 🥉 **Rookie**: Complete first module
- 🥈 **Vigilant**: Pass 5 phishing tests
- 🥇 **Phish Hunter**: Report 10 simulated phishing emails
- 💎 **Security Champion**: 100% completion + zero phishing clicks for 1 year
- 🏆 **Team Leader**: Highest score in department for the quarter

### Leaderboards
- Individual: rank within your organization
- Department: team competition (avg score, completion rate)
- Organization: cross-org (anonymized) benchmarking for MSP clients

---

## Onboarding Flows

### MSP Partner Onboarding (30 minutes)
1. Account setup: MSP profile, admin users, branding (logo + colors)
2. First client: create organization, import users (CSV or Azure AD sync)
3. Training assignment: select courses, set deadlines, configure reminders
4. Phishing baseline: launch first simulated phishing campaign
5. Reporting walkthrough: compliance reports, phishing results, risk scoring
6. Billing setup: Stripe billing with per-user metering

### Employee Learner Onboarding (2 minutes)
1. Welcome email: invitation link from IT admin
2. Account activation: set password (or SSO)
3. Quick profile: name, department, role
4. First module: auto-assigned "Security Awareness 101" (5 minutes)
5. Done → return to regular workflow, next module auto-scheduled

---

## Design System

### Visual Language
- **Primary**: Shield blue (#1E3A5F) — security, trust, professionalism
- **Accent**: Alert orange (#F97316) — attention, urgency (for phishing/warnings)
- **Success**: Green (#10B981) — completion, safe, verified
- **Danger**: Red (#EF4444) — threats, failed tests, critical items
- **Typography**: Inter (all text) — clean, professional, readable at all sizes

### Component Library
- Dashboard cards with KPI metrics
- Progress bars (linear + circular)
- Quiz components (multiple choice, drag-drop, scenario)
- Phishing email preview component (shows red flags)
- Leaderboard table with avatar, rank, badges
- Report generator with chart components (Chart.js)
- Timeline component (training history, events)

---

## Accessibility

### Standards
- WCAG 2.1 AA compliance (AODA mandatory for Ontario)
- Screen reader: full VoiceOver/NVDA support, ARIA labels on all interactive elements
- Keyboard: complete keyboard navigation, visible focus indicators
- Color: all information conveyed through color also has text/icon alternatives
- Captions: all video content captioned (EN + FR)
- Reading level: training content written at Grade 8 level (Flesch-Kincaid)

### Responsive Design
- **Desktop** (≥1280px): Full admin dashboard, side-by-side content + quiz
- **Tablet** (≥768px): Training modules optimized for iPad in conference rooms
- **Mobile** (≥375px): Microlearning modules, push notification-driven training
- **Email**: Responsive email templates for reminders and phishing simulations

### Inclusive Design Considerations
- Multilingual: English + French (complete parity for Quebec)
- Cognitive load: maximum 5 minutes per microlearning module
- Progress saving: resume training exactly where you left off
- Flexible deadlines: admin-configurable, with grace period options
- Non-punitive: failed phishing tests → training, not punishment
