# EdTech-Cybersecurity — Product Roadmap

> Quarterly feature roadmap for CyberLearn (2025–2028) — cybersecurity training LMS with phishing simulation.

---

## Platform Overview

### CyberLearn
- **Entity count**: 50 database tables
- **Stack**: Django/Python, PostgreSQL, Supabase (planned migration), React frontend
- **Core modules**: Training courses, assessments, phishing simulation, reporting, user management
- **Current state**: Core LMS with initial cybersecurity course library

---

## 2025 — MVP & MSP Channel

### Q3 2025 — Core LMS Launch
- [x] Course library: 20+ cybersecurity awareness modules
- [x] User management: individual accounts, basic roles
- [x] Assessment engine: quizzes, pass/fail, certificates
- [x] Reporting: completion rates, scores, compliance status
- [ ] Multi-tenant architecture: MSP → client organization separation
- [ ] White-label: MSP branding on training portal (logo, colors, domain)
- [ ] Admin dashboard: MSP admin view across all client organizations

### Q4 2025 — Engagement & Content
- [ ] Gamification engine: points, badges, leaderboards
- [ ] Course categories: phishing, passwords, social engineering, physical security, data handling
- [ ] Microlearning: 3-5 minute bite-sized modules for busy employees
- [ ] Automated enrollment: new employee auto-assignment, deadline management
- [ ] Email reminders: automated nudges for incomplete training
- [ ] French content library: Quebec-market compliance (translate all courses)
- [ ] Certificate generator: branded completion certificates (PDF)

---

## 2026 — Phishing Simulation & Scale

### Q1 2026 — Phishing Simulation Engine
- [ ] Email phishing templates: 50+ realistic scenarios (banking, shipping, IT helpdesk)
- [ ] SMS phishing (smishing): simulated text message attacks
- [ ] Campaign builder: schedule, target groups, template selection
- [ ] Click tracking: who clicked, when, how quickly, device info
- [ ] Just-in-time training: immediate micro-lesson when user clicks phishing link
- [ ] Reporting: click rates, repeat offenders, department comparison, trend over time

### Q2 2026 — Compliance & Reporting
- [ ] Compliance frameworks: PIPEDA, PCI-DSS, HIPAA, SOC 2 training tracks
- [ ] Audit-ready reports: per-framework compliance status with evidence
- [ ] Risk scoring: per-user risk profile based on training completion + phishing performance
- [ ] Dark web monitoring alerts: notify when employee credentials appear in breaches
- [ ] Manager dashboards: department-level compliance visibility
- [ ] API v1: integration endpoints for PSA/RMM platforms

### Q3 2026 — MSP Integration
- [ ] ConnectWise Manage integration: sync clients, users, billing
- [ ] Datto Autotask integration: client sync, ticket creation on failures
- [ ] NinjaRMM integration: device-to-user mapping, deployment
- [ ] HaloPSA integration: Canadian MSP favorite
- [ ] Bulk operations: mass enrollment, org cloning, template campaigns
- [ ] MSP billing: automated usage-based billing per client organization

### Q4 2026 — Advanced Content
- [ ] Industry-specific tracks: healthcare, legal, financial, manufacturing, retail
- [ ] Video content: produced training videos (not just slides + quizzes)
- [ ] Interactive scenarios: branching decision-tree simulations
- [ ] Policy management: distribute and track security policy acknowledgments
- [ ] Custom content builder: MSPs create their own training modules
- [ ] Content milestone: 100+ courses, 200+ phishing templates

---

## 2027 — Hands-On Labs & US Market

### Q1 2027 — Cyber Range (Labs)
- [ ] Simulated environments: browser-based lab environments (no client install)
- [ ] Lab scenarios: identify phishing emails, secure a workstation, incident response basics
- [ ] Skill levels: beginner → intermediate → advanced tracks
- [ ] Lab assessment: practical skills testing (not just knowledge quizzes)
- [ ] Cloud sandboxes: isolated per-user lab instances (Docker-based)

### Q2 2027 — Advanced Phishing
- [ ] Vishing (voice phishing): AI-generated voice call simulations
- [ ] QR code phishing (quishing): simulated malicious QR codes
- [ ] USB drop simulation: track who plugs in unknown USB devices
- [ ] Multi-stage campaigns: chained attacks (email → landing page → credential harvest)
- [ ] Spear phishing: personalized phishing using OSINT (job title, recent activity)
- [ ] Callback phishing: simulated tech support callback schemes

### Q3 2027 — Certification Program
- [ ] CyberLearn Certified Security Aware Professional (CCSAP) certification
- [ ] Exam engine: proctored online assessments
- [ ] Digital badges: Credly integration for LinkedIn display
- [ ] Renewal: annual recertification requirement
- [ ] Volume pricing: enterprise certification programs

### Q4 2027 — Intelligence & Analytics
- [ ] Behavioral analytics: ML-based user risk profiling
- [ ] Threat intelligence feed: real-world phishing trends → new templates
- [ ] Benchmark reports: compare client security posture vs industry average
- [ ] Executive summary reports: board-level security awareness reporting
- [ ] Predictive risk: which users are most likely to fail next phishing test

---

## 2028 — Platform Maturity & Scale

### Q1-Q2 2028 — Enterprise Features
- [ ] SCIM provisioning: Azure AD / Okta user sync
- [ ] SAML/OIDC SSO: enterprise identity provider integration
- [ ] SOC 2 / ISO 27001 training modules: audit-prep training tracks
- [ ] Incident response training: tabletop exercise simulations
- [ ] Security culture assessment: organization-wide security culture survey + scoring
- [ ] Content milestone: 250+ courses, 500+ phishing templates, 50+ lab scenarios

### Q3-Q4 2028 — Scale
- [ ] Multi-language: Spanish, Portuguese (Latin American expansion)
- [ ] AI tutor: personalized learning paths based on role, risk score, learning style
- [ ] Marketplace: third-party content provider marketplace
- [ ] Mobile app: iOS/Android for microlearning on-the-go
- [ ] User milestone: 100,000 active learners
- [ ] Revenue milestone: $300K+ MRR

---

## Technical Milestones

| Quarter | Milestone | KPI |
|---|---|---|
| Q3 2025 | MVP launch | 10 MSP beta partners |
| Q4 2025 | Gamification + FR content | 75% completion rate |
| Q1 2026 | Phishing sim engine | 50 templates deployed |
| Q3 2026 | PSA/RMM integrations | 3 integrations live |
| Q1 2027 | Cyber range labs | 10 lab scenarios |
| Q3 2027 | Certification program | 100 certified professionals |
| Q4 2027 | Behavioral analytics | ML risk scoring live |
| Q4 2028 | 100K users, marketplace | $300K MRR |

---

## Dependencies & Risks

### Critical Dependencies
- MSP channel adoption (must win first 10 MSPs quickly for validation)
- Phishing simulation email deliverability (must not get flagged as real spam)
- Content production pipeline (need continuous new courses and templates)
- PSA/RMM vendor API access (ConnectWise, Datto partnership approval)

### Key Risks
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| MSP channel slow adoption | Medium | High | Free beta, ROI calculator, case studies |
| KnowBe4 price reduction | Medium | Medium | Compete on Canadian compliance + MSP UX, not price alone |
| Phishing sim emails marked as spam | High | Medium | Dedicated sending infrastructure, email warming, admin whitelisting guides |
| Content staleness | Medium | Medium | Monthly content updates, user-generated content marketplace |
| Regulatory changes (Bill C-26) | Low | High | Monitor CCCS updates, rapid content response team |
