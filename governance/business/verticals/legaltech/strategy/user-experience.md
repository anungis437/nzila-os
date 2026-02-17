# Court Lens — User Experience Strategy

> UX strategy for Court Lens AI legal analytics platform serving Canadian legal professionals from solo practitioners to Bay Street firms.

---

## User Personas

### 1. Solo Litigator — "Sarah"
- **Profile**: 12 years experience, runs own civil litigation practice in Toronto
- **Pain Points**: Can't afford research associates, spends 40% of time on case research, uncertainty on case prospects for contingency decisions
- **Needs**: Fast outcome predictions, quick judge lookups, settlement range estimates
- **Usage Pattern**: 5-10 predictions/week, mobile access between court appearances
- **Value Prop**: "A junior associate's research in 30 seconds for $99/month"

### 2. Mid-Firm Associate — "David"
- **Profile**: 4 years experience, associate at 20-lawyer firm specializing in insurance defence
- **Pain Points**: Partner demands data-driven case assessments, billing pressure to minimize research time
- **Needs**: Comprehensive case analytics for memos, opposing counsel win rates, precedent packages
- **Usage Pattern**: 20-30 queries/week, exports PDFs for partner review, team collaboration
- **Value Prop**: "Impress partners with data-driven case strategies"

### 3. Senior Partner — "Catherine"
- **Profile**: 25 years experience, managing partner at mid-size firm, approves contingency cases
- **Pain Points**: Needs quick viability assessments for incoming files, portfolio risk analysis
- **Needs**: High-level prediction summaries, settlement ranges, case intake recommendations
- **Usage Pattern**: 5-10 strategic queries/week, dashboard overview daily, reviews team predictions
- **Value Prop**: "Make better contingency decisions with data, not gut feel"

### 4. Legal Aid Lawyer — "Marcus"
- **Profile**: 6 years experience, Legal Aid Ontario clinic, criminal defence
- **Pain Points**: Overwhelming caseload (80+ files), minimal research budget, needs quick sentencing data
- **Needs**: Sentencing range predictions, judge tendency for specific charges, fast bail condition benchmarks
- **Usage Pattern**: Quick lookups between duty counsel appearances, 15-20/week
- **Value Prop**: "Better outcomes for underserved clients through data-driven advocacy"

### 5. Law Student — "Priya"
- **Profile**: 2L at Osgoode Hall, interested in litigation, using Court Lens for research papers
- **Pain Points**: Learning legal research methodology, understanding judicial reasoning patterns
- **Needs**: Educational access, citation exploration, practice area exploration
- **Usage Pattern**: Academic research projects, moot court preparation
- **Value Prop**: "Graduate with AI-native legal research skills" (→ future paying subscriber)

---

## Core UX Workflows

### Workflow 1: Prediction Query
```
Enter Case Details                    Review Prediction
┌─────────────────────┐              ┌─────────────────────┐
│ Practice Area: [▼]  │              │ Outcome Prediction   │
│ Jurisdiction: [▼]   │     →       │ ████████░░ 78%       │
│ Judge: [auto-fill]  │              │ Plaintiff Likely Wins│
│ Key Facts: [______] │              │                      │
│ [Predict Outcome]   │              │ Confidence: HIGH     │
└─────────────────────┘              │ Based on 47 similar  │
                                     │ cases                │
                                     └─────────────────────┘
```

### Workflow 2: Precedent Discovery
```
Search Query → Results Ranked by Relevance + Outcome
    → Click case → Full summary + citation network
    → "Find similar cases" → pgVector similarity search
    → Save to case folder → Export precedent package (PDF)
```

### Workflow 3: Judge Profile Lookup
```
Search Judge Name → Profile Page
    ├── Win rates by practice area (bar chart)
    ├── Sentencing tendencies (criminal — box plot)
    ├── Damage award ranges (civil — histogram)
    ├── Writing style indicators (lengthy/concise, citations frequency)
    ├── Scheduling patterns (motion dates, trial length averages)
    └── Compare with other judges in same court
```

---

## Prediction Results UX

### Information Hierarchy
1. **Primary**: Outcome prediction (large, clear — "78% Plaintiff Wins")
2. **Secondary**: Confidence level badge (High/Medium/Low) + basis count ("Based on 47 similar cases")
3. **Tertiary**: Comparable cases list (3-5 most similar, with outcome and key differences)
4. **Supporting**: Settlement range (25th–75th percentile), estimated litigation cost, timeline estimate

### Visualization Components
- **Outcome Gauge**: Semi-circular gauge (0-100%) with color coding (green/yellow/red)
- **Confidence Intervals**: Error bars showing prediction range
- **Comparable Cases Cards**: Mini case summary cards with similarity score
- **Judge Heatmap**: Color-coded grid of judge's outcomes by practice area
- **Citation Network**: Interactive graph visualization of how cases cite each other
- **Timeline**: Gantt-style predicted case lifecycle (filing → discovery → trial → decision)

### Presentation Mode
- One-click "Client Presentation" export — sanitized prediction summary
- PDF generation with Court Lens branding (or white-label for Enterprise)
- PowerPoint slide export for partner meetings

---

## Bilingual Experience (English/French)

### Language Strategy
- **Default**: Browser language detection → route to EN or FR
- **Toggle**: Persistent language toggle in header (EN | FR)
- **Search**: Query in either language → results from both corpora
- **Predictions**: Output language matches query language
- **Case Summaries**: Available in both languages (GPT-4 translation for non-native decisions)

### Quebec-Specific UX
- Civil Code references (vs common law) — visual distinction in search results
- Quebec court structure navigation (Cour supérieure, Cour d'appel)
- Notarial law features (non-contentious matters)
- Barreau du Québec terminology and conventions

---

## Onboarding Flow

### Step 1: Account Setup (2 minutes)
- Email/password or SSO via Microsoft/Google
- Select practice area(s): Civil Litigation, Family, Criminal, Immigration, Corporate, Other
- Select jurisdiction(s): Ontario, BC, Alberta, Quebec, Federal, All Canada
- Select tier: Solo / Small Firm / Large Firm / Enterprise

### Step 2: Guided First Prediction (3 minutes)
- Pre-filled sample case matching user's selected practice area
- Walk-through of prediction input fields
- Explanation of prediction results (outcome %, confidence, comparable cases)
- "Your first real prediction is free — try it now"

### Step 3: Value Demonstration (ongoing)
- Weekly email: "3 notable decisions in [your practice area] this week"
- Monthly email: "Your prediction accuracy review" (did predictions match outcomes?)
- In-app tooltips for features user hasn't discovered yet

### Activation Metrics
- **Target**: First prediction within 5 minutes of signup
- **Day 7**: ≥3 predictions completed
- **Day 30**: ≥10 predictions + 1 saved search/folder

---

## Information Architecture

### Primary Navigation
```
┌─────────────────────────────────────────────────┐
│  🔍 Search   📊 Predict   👤 Judges   📁 Cases │
├─────────────────────────────────────────────────┤
│                                                  │
│  Dashboard                                       │
│  ├── Recent Predictions                          │
│  ├── Saved Searches                              │
│  ├── Watched Judges                              │
│  └── Case Portfolio                              │
│                                                  │
│  Tools                                           │
│  ├── Settlement Calculator                       │
│  ├── Litigation Cost Estimator                   │
│  ├── Opposing Counsel Lookup                     │
│  └── Citation Explorer                           │
│                                                  │
│  Reports                                         │
│  ├── Export to PDF                                │
│  ├── Client Presentation                         │
│  └── Practice Area Trends                        │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Accessibility & Compliance

### AODA (Accessibility for Ontarians with Disabilities Act)
- WCAG 2.1 AA compliance target
- Keyboard navigation for all workflows (prediction, search, judge profiles)
- Screen reader support: ARIA labels on charts, alt text for visualizations
- High contrast mode for courtroom environments (glare-resistant)
- Focus management for single-page application navigation

### Responsive Design
- Desktop-first (primary use case: lawyer at desk)
- Tablet: optimized for courtroom/hearing reference
- Mobile: simplified prediction and judge lookup (between appearances)
- Minimum supported: 1024px desktop, 768px tablet, 375px mobile

### Performance
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Prediction response: < 3s (including AI processing)
- Search results: < 2s
- Offline: cached judge profiles for courtroom access (Service Worker)
