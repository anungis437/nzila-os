# 🏗️ Multi-Product Operating Architecture

Owner: Aubert

**Nzila Ventures | 2025 Edition**

---

## 🔍 Executive Summary

Nzila Ventures is a **mission-aligned, multi-product platform** supporting innovations across caretech (Memora, OptivaCare, NeuroBridge) and edtech (MyLearning Companion). Each venture addresses a unique need, but all benefit from a **shared operational spine** — enabling speed, scale, and trust without duplicating effort.

This document outlines the architecture, deployment, and governance principles that ensure all ventures remain secure, explainable, efficient, and user-first.

---

### 🧠 Architecture Model: *Shared Core, Modular Verticals*

| Layer | Description | Shared Across Ventures |
| --- | --- | --- |
| **Companion AI Layer** | Adaptive, tone-sensitive agent with long-term memory | ✅ Core to all ventures |
| **User Identity & Security** | SSO, multi-role support, caregiver linking, child/student modes | ✅ |
| **Data Privacy & Logging** | Consent workflows, PIPEDA/Law 25/GDPR compliance, audit logs | ✅ |
| **Analytics Layer** | Unified behavior tracking, adherence, engagement, and A/B support | ✅, with per-product filters |
| **Design System** | Shared UI kit (e.g., Memora UI → Optiva reuse); accessibility defaults | ✅ |
| **Clinic/Admin Interfaces** | Dashboards, flag logs, cohort management | Optional per venture |
| **Product UIs** | Distinct applications: Memora App, OptivaCare Portal, Puzzle Loop B2C | ❌ Venture-specific |
| **Gameplay & Learning Logic** | Cognitive modules, milestone engines, challenge pacing | ❌ Built independently but follow shared templates |
| **Family/Support Layer** | Caregiver messages, student guardian access, encouragement templates | ✅ Across health + edtech |

---

### 🔄 Integration & Delivery Principles

| Principle | Application |
| --- | --- |
| **Privacy by Design** | No required PHI collection; Companion functions without identifiable data |
| **EMR & School System Agnostic** | Optional exports to Medesync, DSQ, and learning management tools |
| **Multi-Device Access** | Mobile-first Companion; desktop dashboards for clinics and parents |
| **Localization Support** | All core experiences default to EN/FR, with layered tone libraries |
| **Adaptive AI Core** | Same prompt logic and behavior model power Memora, MyLearning, Puzzle Loop, etc. |

---

### 🧪 Environment & Deployment Strategy

| Environment | Description | Ownership |
| --- | --- | --- |
| **Staging** | Shared testing environment across all ventures | Central DevOps |
| **Production** | CI/CD pipelines deployed per venture (e.g., Memora ≠ OptivaCare) | Per-product team |
| **QA/Regression** | Shared Companion behavior validation suite | QA team with product input |
| **Data Lake** | Centralized storage with RBAC segmentation per venture | Strategy & Engineering |
| **Beta Channels** | Select ventures (Memora, Puzzle Loop) support opt-in pilot modes | Product-specific |

---

### 🔐 Cross-Product Governance Structure

| Function | Centralized? | Description |
| --- | --- | --- |
| **Security & Compliance** | ✅ | Shared policy stack and legal enforcement |
| **IP Management** | ✅ | All behavioral and AI IP held at Nzila HQ |
| **Legal & Contracting** | ✅ | Brand, license, pilot, and SDK terms controlled centrally |
| **Design & UX** | ✅ | System-wide standards, with local customization |
| **Engineering Pods** | Hybrid | Shared backend & Companion devs; product-specific front-end squads |
| **AI Prompt Library** | ✅ | Shared logic across all Companion-powered products |
| **Roadmap Control** | ❌ | Fully decentralized per venture |

---

### 🧩 Product Mapping Snapshot

| Venture | Studio | Companion? | Target User | Platform |
| --- | --- | --- | --- | --- |
| **Memora** | Healthtech | ✅ | Aging adults, caregivers, clinics | Mobile app + web |
| **Memora Tablet** | Healthtech | ✅ | In-clinic use | Dedicated tablet |
| **Memora Home** | Healthtech | ✅ | Family/solo cognitive users | Web + smart display |
| **OptivaCare** | Healthtech | ✅ | Long-term care residents, staff | Portal + mobile |
| **Cognition Passport** | Healthtech | ✅ | Patients, clinicians | Web only |
| **NeuroBridge** | Healthtech | ✅ | Dementia caregivers, researchers | Web |
| **Puzzle Loop** | Healthtech | ✅ | Public B2C (daily brain health) | Mobile-first |
| **MyLearning Companion** | Edtech | ✅ | Students, guardians | Mobile + LMS sync |
| **Cognitive Library** | Healthtech | ❌ (reference only) | All teams | Knowledge base |

---

### 🧭 Summary

Nzila’s multi-product model succeeds because it is **purpose-built to balance stability and specialization**:

- We protect users’ privacy and time through unified governance.
- We reduce build time by sharing IP, design, and infrastructure.
- We scale trust by embedding empathy and explainability from Day 1.

Each venture builds boldly — but never in isolation.
