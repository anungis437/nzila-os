# 🗂️ Engineering & Technical Documentation Index

**Owner:** Aubert

### ⚙️ **CORE INFRASTRUCTURE & ARCHITECTURE**

| Document | Summary | Owner |
| --- | --- | --- |
| **Technical Architecture Diagram** | End-to-end system layout covering app clients, backend, storage, and dashboard layers | CTO |
| **Infrastructure & Hosting Specification** | Details on AWS-based deployment, container use, uptime controls, and cloud boundary enforcement | CTO |
| **CI/CD Pipeline Overview** | GitHub Actions–based release flow with QA gates, blue/green deploy, and rollback support | Engineering |
| **Data Encryption & Key Management Overview** | AES-256 encryption layers, KMS policy, token handling, and secrets management across environments | Security / CTO |

---

### 🔐 **SECURITY, PRIVACY & COMPLIANCE**

| Document | Summary | Owner |
| --- | --- | --- |
| **Consent & Privacy Flow** | Law 25–compliant user journey for consent, revocation, and caregiver/clinic relationships | Privacy Officer |
| **Auth & Permissions Model** | Role-based access structure with consent-tied account linking and clinic data segregation | CTO |
| **Anonymization & Data Lifecycle Policy** | Data minimization schema, user data purging, and research-compatible anonymization protocols | Privacy Officer |
| **Monitoring, Logging & Incident Response Plan** | Log coverage, Sentry/CloudWatch integration, escalation workflows, and breach response SOP | Security / Engineering |
| **Rate Limiting & Abuse Prevention Ruleset** | Protection against Companion spam, dashboard scraping, and token misuse | Engineering |
| **Privacy-Respecting Inference Architecture** | Defines safe, per-user inference for future ML without PII exposure or cross-context scoring | CTO / ML Lead |

---

### 🧠 **AI / ML & PERSONALIZATION**

| Document | Summary | Owner |
| --- | --- | --- |
| **AI/ML Model Strategy Document** | Enterprise stance on where ML is used, where it is not, and ethical boundaries for adoption | CTO / Product |
| **Personalization Engine Specification** | Phase 2 roadmap for game difficulty adaptation, Companion memory, and engagement modeling | ML Lead / Product |
| **AI Governance & Ethics Charter** | AI use cases classified by Allow / Restrict / Prohibit, with board approval flow and audit rules | Governance Board |
| **Explainability & Control UX Plan** | UX transparency controls for every adaptive behavior, with opt-out and Companion memory reset | Product / UX |

---

### 🧩 **DATA & APPLICATION LAYER**

| Document | Summary | Owner |
| --- | --- | --- |
| **Game Engine Specifications** | MVP game logic, telemetry hooks, difficulty controller, and Companion event integration | Engineering |
| **Companion Logic Engine Specification** | Prompt scheduler, tone modulation, cooldowns, and consent-based behavior model | UX / Engineering |
| **Clinic Dashboard Data Pipeline Specification** | Engagement scoring logic, inactivity flags, and data aggregation for clinic reporting | Engineering / Product |
| **Data Schema Overview** | Entity-by-entity database structure with consent hooks, role segmentation, and compliance tagging | Engineering / Privacy |

---

### 🧰 **PLATFORM CONTROLS**

| Document | Summary | Owner |
| --- | --- | --- |
| **Notification System Specification** | Companion nudge logic, reminder cooldowns, clinic dashboard alerts, and in-app delivery architecture | Product / Engineering |
| **Feature Flag Management Protocol** | Release toggles, kill switches, region- and role-specific flags for phased feature rollout | Engineering |
| **Developer SDK / API Reference** | External integration documentation (current + future) for clinics, research, or partners | CTO / Product |

---

### 🧪 **QA, UX & ACCESSIBILITY**

| Document | Summary | Owner |
| --- | --- | --- |
| **Testing & QA Strategy** | Unit, integration, localization, and accessibility testing protocol with regression coverage | QA / Engineering |
| **Accessibility Implementation Guide** | WCAG 2.1 AA–aligned interface, narration-readiness, contrast toggles, and keyboard navigation | UX / Product |
