# SentryIQ360 — User Experience Strategy

## UX Vision

SentryIQ360 reduces the time an independent broker spends obtaining and comparing insurance quotes from hours to seconds. Every interface decision prioritizes speed, clarity, and confidence — enabling brokers to serve more clients with better coverage recommendations.

---

## User Personas

### 1. Solo Broker — "Sarah, The Generalist"
- **Profile**: Independent broker, 5+ years experience, manages 50-100 clients personally
- **Pain points**: Logs into 6-8 carrier portals individually, spends 45 min per client on quoting, tracks commissions in spreadsheets
- **Goal**: Quote across all carriers in one place, present professional comparisons to clients, track renewals
- **Tech comfort**: Intermediate — comfortable with web apps, prefers simple interfaces
- **SentryIQ360 value**: Saves 30+ min per client, presents more options, wins more business

### 2. Agency Principal — "Marcus, The Growth Leader"
- **Profile**: Owns a 10-broker agency, focuses on growth and carrier relationships
- **Pain points**: No visibility into team quoting activity, manual commission reconciliation, can't measure broker productivity
- **Goal**: Dashboard showing agency performance, team activity, revenue forecasting, carrier mix
- **Tech comfort**: Low — wants high-level dashboards, not detailed data entry
- **SentryIQ360 value**: Agency-wide analytics, team management, commission visibility

### 3. Client Service Representative (CSR) — "Priya, The Volume Processor"
- **Profile**: Agency CSR handling 20-30 quotes per day, renewals, endorsements, client calls
- **Pain points**: Repetitive data entry across carrier portals, slow quote turnaround delays client callbacks
- **Goal**: Fastest possible quoting workflow, minimal clicks, auto-populated forms
- **Tech comfort**: High — power user, wants keyboard shortcuts and batch processing
- **SentryIQ360 value**: Single-entry multi-carrier quoting, batch renewal processing

### 4. Carrier Underwriter — "James, The Risk Assessor"
- **Profile**: Reviews submissions from brokers, assesses risk, provides quotes or declinations
- **Pain points**: Incomplete submissions, missing documents, back-and-forth communication cycles
- **Goal**: Receive complete, properly formatted submissions every time
- **Tech comfort**: Moderate — uses carrier-specific systems, appreciates standardized inputs
- **SentryIQ360 value**: Standardized submissions reduce review time by 40%

---

## Core Workflow: Quote → Compare → Present → Bind

### Step 1: Client Intake
- Single unified form captures all client data: personal info, vehicles, properties, coverage history
- Smart defaults: pre-fill province-specific options, common coverage limits
- Address lookup: auto-populate property details from assessment databases
- VIN decoder: vehicle details auto-populated from VIN entry
- Prior claims import: structured claims history entry with CSIO-standard classifications

### Step 2: Multi-Carrier Quote Retrieval
- One-click "Get Quotes" launches parallel requests to all eligible carriers
- Real-time progress indicator: show each carrier's response status (loading, received, error, ineligible)
- Results stream in as available — no waiting for slowest carrier
- Carrier eligibility pre-filter: only query carriers whose appetite matches the risk profile

### Step 3: Side-by-Side Comparison
- **Comparison grid**: Carriers as columns, coverage items as rows
- **Rate sorting**: Sort by total premium, by coverage line, or by monthly payment
- **Coverage gap highlighting**: Red/yellow/green cells showing where carriers differ on limits or exclusions
- **Best value indicator**: Algorithm-suggested "best fit" based on coverage breadth and price
- **Drill-down**: Expand any carrier quote to see full coverage details, exclusions, conditions
- **Save comparison**: Bookmark comparison for follow-up with client

### Step 4: Client Presentation
- **PDF export**: Branded comparison report with broker agency logo and contact info
- **Email integration**: Send comparison directly to client from within SentryIQ360
- **Client portal link**: Generate unique URL for client to view comparison on their own device
- **E-signature ready**: Client can approve selected option and sign electronically
- **Notes**: Broker can add recommendation notes and coverage explanations for client context

### Step 5: Bind & Policy Management
- Submit selected quote for binding directly through carrier integration
- Track binding status: submitted → under review → approved → bound
- Policy documents auto-downloaded via CSIO eDocs integration
- Policy stored in client's SentryIQ360 file for full lifecycle visibility
- Renewal reminder auto-scheduled based on policy effective/expiry dates

---

## Dashboard Design

### Broker Dashboard
- **Today's queue**: Renewals due, pending submissions, client follow-ups
- **Quote activity**: Quotes run today/week/month, conversion rates
- **Commission tracker**: YTD earned commissions, pending payments, projected revenue
- **Client alerts**: Claims notifications, payment issues, coverage changes
- **Performance vs peers**: Anonymous benchmark against platform average (opt-in)

### Agency Principal Dashboard
- **Team scorecard**: Quotes per broker, conversion rates, revenue per broker
- **Revenue overview**: Total agency revenue, month-over-month growth, carrier mix
- **Renewal pipeline**: 30/60/90-day renewal calendar, risk of non-renewal flagging
- **Carrier relationships**: Quote volume per carrier, bind ratio, commission yield
- **Client portfolio**: Total clients, lines per client, retention rate

### Analytics Views
- **Market trends**: Rate movement by line and carrier over time
- **Geographic heat map**: Client distribution, claim density, competitive rates by region
- **Cross-sell opportunities**: Clients with single-line policies, recommended additional coverage
- **Loss ratio tracking**: Portfolio loss experience by segment

---

## Onboarding Experience

### Day 0: Agency Setup (30 minutes)
- Agency profile creation: name, license numbers, provincial registrations
- Branding upload: logo, colors for client-facing materials
- Team member invitations with role assignment (Broker, CSR, Admin)

### Day 1: Carrier Connection (60 minutes)
- Guided carrier credential entry: login/password for each carrier portal
- API connection testing: verify access to each carrier's quoting system
- Carrier appetite summary: display which lines each connected carrier supports
- Credential vault: encrypted storage with broker-controlled access

### Day 3: Book of Business Import
- Import wizard: upload CSV/Excel from Applied Epic, Power Broker, or other BMS
- Field mapping: visual mapper for column-to-SentryIQ360-field alignment
- Data validation: flag incomplete records, duplicate clients, missing fields
- Import preview: review 10 sample records before committing full import

### Week 1: Training & Activation
- In-app tutorial: 5-minute guided walkthrough of first quote workflow
- Video library: 2-3 minute modules on each major feature
- Live onboarding call: 30-minute screen share with customer success manager
- Activation milestone: first 10 quotes run = full platform familiarity confirmed

---

## Client-Facing Portal

### White-Label Design
- Custom subdomain per agency: `insurance.sarahbroker.ca`
- Agency branding: logo, color scheme, contact information, broker photo
- Responsive design: mobile-first for smartphone policy access

### Client Features
- **Policy wallet**: All active policies with coverage summaries, premium amounts, expiry dates
- **Digital pink card**: Ontario auto proof of insurance accessible on mobile
- **Claims reporting**: Guided form for first notice of loss with document/photo upload
- **Renewal hub**: 60-day advance renewal preview, option to request re-quoting
- **Document library**: Policy documents, endorsements, certificates of insurance on demand
- **Secure messaging**: Direct channel to assigned broker for questions and changes

---

## Accessibility & Compliance

### AODA Compliance (Accessibility for Ontarians with Disabilities Act)
- WCAG 2.1 Level AA compliance across all broker-facing and client-facing interfaces
- Keyboard navigation: full platform usable without mouse
- Screen reader support: ARIA labels, semantic HTML, logical heading hierarchy
- Color contrast: minimum 4.5:1 ratio for text, 3:1 for large text and UI components
- Focus indicators: visible focus states on all interactive elements
- Error handling: descriptive error messages with clear recovery instructions

### Bilingual Support
- English and French interface for Quebec market compliance
- Carrier-specific French translations for coverage terminology
- Language preference stored per user, overridable per session

### Responsive Design
- Desktop-first for broker workflow (primary use case is at desk with multiple monitors)
- Tablet-optimized for on-the-go client meetings
- Mobile-optimized client portal for policyholders accessing on smartphone

---

*Nzila Corp — SentryIQ360 User Experience Strategy v1.0 — Confidential*
