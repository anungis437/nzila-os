# ✅ Testing & QA Strategy

**Owner:** Aubert

### **1. Purpose**

This strategy governs Memora’s approach to testing and quality assurance across all technical components, ensuring:
- A **stable, fatigue-aware experience** for users
- **Clinically safe** and predictable outcomes in pilot environments
- Readiness for accessibility reviews, bilingual delivery, and regulatory audits
- Scalable, automated practices that can grow with the product

---

### **2. QA Philosophy**

| Pillar | Practice |
| --- | --- |
| **Emotional safety** | Companion, nudges, and gameplay are tested for tone, pacing, and fatigue risk |
| **Accessibility-first** | WCAG 2.1 AA compliance checks are built into core flows |
| **Bilingual validation** | All tests are run in both **English and French** |
| **Regression-aware** | Automated suites maintain legacy integrity across evolving modules |
| **Pilot-grade readiness** | Clinical workflows (e.g., dashboard data rollups) are tested for precision and summarization boundaries |

---

### **3. Test Categories**

| Category | Scope | Owner |
| --- | --- | --- |
| **Unit Tests** | Business logic for Companion, game engine, data layer | Engineering |
| **Integration Tests** | Frontend–backend flows, caregiver linkage, dashboard refresh | Engineering |
| **Behavioral Testing** | Companion tone shifts, rest-day detection, prompt pacing | Product Ops |
| **Accessibility Audits** | Mobile + web tests using Axe, Lighthouse, and manual screen reader flows | Design QA |
| **Localization QA** | Validation of EN/FR prompt parity, dashboard labels, and field formats | Bilingual QA |
| **Compliance Testing** | Consent flows, access revocation, audit trail coverage | Security & Privacy Team |
| **Clinical Dashboard Accuracy** | Weekly aggregates, streak flags, mute statuses | Pilot Success Lead |

---

### **4. Testing Toolchain**

| Layer | Tool / Method |
| --- | --- |
| **Unit & Integration** | Jest, React Testing Library, Postman, Supabase mocks |
| **E2E Automation** | Cypress (mobile and dashboard) |
| **Accessibility** | Axe-core, Lighthouse CI, manual NVDA/VoiceOver sessions |
| **Localization** | YAML diff scripts + bilingual QA matrix |
| **CI/CD Integration** | GitHub Actions (triggered on PR merge or staging deploy) |

---

### **5. QA Schedule by Environment**

| Env | Trigger | Coverage |
| --- | --- | --- |
| **Dev** | On feature branch push | Unit + lint only |
| **Staging** | On merge to `main` | Full integration, localization, Companion tone sim |
| **Pilot / Pre-Prod** | Weekly prior to live demo | Manual QA walkthrough + dashboard validation |
| **Production** | Biweekly deploy cycle | Regression tests + smoke test |

---

### **6. Companion-Specific QA Logic**

| Scenario | Test |
| --- | --- |
| 3-day streak | Prompt tone must shift to reinforcement mode |
| Missed 2 days | “Gentle recovery” tone triggers |
| Companion muted | Companion suppresses prompts but remains visually present |
| Game-linked prompt | Companion reflects correct game context with tone variation |
| Bilingual mirror test | EN/FR prompts return with same intent and emotional cadence |

---

### **7. QA for Compliance Features**

| Area | Test |
| --- | --- |
| Consent Logs | Each consent type (account, caregiver, clinic) generates a log entry |
| Revocation | Revoking caregiver/clinic removes dashboard access within 5 mins |
| Data Minimization | Companion prompt logs contain no PII |
| Audit Trails | Admin access logs appear in CloudTrail + frontend access layer |
| Right-to-Erasure | Deletion cascade anonymizes session and prompt history |

---

### **8. Accessibility QA Matrix (WCAG 2.1-AA)**

| Feature | WCAG Area | Status |
| --- | --- | --- |
| Large touch targets | 2.5.5 | ✅ |
| Contrast ratio | 1.4.3 | ✅ |
| Screen reader support | 1.3.1 / 4.1.2 | ✅ |
| Language attributes | 3.1.1 / 3.1.2 | ✅ |
| Keyboard navigation | 2.1.1 | ✅ |
| Companion prompt dismissal | 3.2.1 | ✅ |

*All accessibility tests run in both English and French environments.*

---

### **9. Pilot-Specific QA Protocols**

| Activity | Responsible |
| --- | --- |
| Clinic dashboard verification (aggregates, tiles) | Pilot Success Lead |
| Caregiver-patient link workflow | QA + Bilingual Testers |
| Consent + unlink test flows | Product QA |
| Accessibility stress testing | Manual testers using screen readers and high-contrast settings |
| Daily nudge fatigue simulation | Companion QA lead using synthetic prompt history |

---

### **10. Known Limitations & QA Debt (MVP Acknowledged)**

| Area | Notes | Phase |
| --- | --- | --- |
| Voice Companion (narration mode) | Manual test only; no automated coverage yet | Phase 2 |
| Clinic reassignment | Not supported in MVP | Phase 2 |
| Emotion-adaptive Companion | Out of scope by design | Not planned |
| Real-time dashboard alerts | Static testing only (no live feed) | Phase 2 |

---

### **11. Linked QA Artifacts & Docs**

- 🧪 Test Case Repository (Notion/GitHub)
- 🧠 Companion State QA Map
- 🌍 Bilingual Prompt QA Matrix
- ♿ Accessibility Coverage Sheet
- 🔐 Consent Flow Regression Suite
- 📋 Pilot QA Protocol Checklist
- ✅ QA Sign-Off Log Template
