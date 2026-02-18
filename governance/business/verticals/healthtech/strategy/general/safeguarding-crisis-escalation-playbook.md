# ⚖️ Safeguarding & Crisis Escalation Playbook

**Owner:** Aubert

This playbook provides a structured, trauma-informed response framework when Memora detects or is informed of a **safeguarding incident**, ranging from abuse disclosures and self-harm signals to caregiver distress and program-level breakdowns. It prioritizes **emotional safety**, **informed consent**, and **cultural context** — with both **offline and online escalation options**.

---

## 🎯 Core Principles

| Principle | Meaning |
| --- | --- |
| 🛡️ **Do No Harm** | Never push for details or override user comfort |
| 🧭 **Local-First Response** | Escalation flows prioritize known caregivers or coordinators |
| 🔐 **Privacy-Aware Routing** | Sensitive data is never logged unless consent is confirmed |
| 🤝 **Shared Responsibility** | Companion suggests human support, never replaces it |
| 🧘 **Trauma-Informed Action** | Responses are paced, affirming, and never punitive |

---

## 🚨 Incident Types Covered

| Type | Example Indicators | Priority Tier |
| --- | --- | --- |
| **Abuse Disclosure** | “He hit me,” “They hurt me,” “I'm scared at home” | 🚨 Critical |
| **Self-Harm Risk** | “I wish I wasn’t here,” “I hurt myself” | 🚨 Critical |
| **Neglect / Basic Needs** | “No one feeds me,” “I don’t sleep,” “I’m always alone” | ❗ High |
| **Mental Health Distress** | Frequent crying, silence, confusion, withdrawal | ❗ High |
| **Caregiver Burnout** | “I don’t know what else to do,” “I feel like giving up” | ❗ High |
| **Emotional Misfire** | Companion triggers distress (e.g. misunderstood tone) | ⚠️ Medium |
| **Field-Level Breakdown** | Device lost, user unsafe, program breach | 🚨 Critical |

---

## 🔁 Standard Escalation Flow

1. **Companion Detects Risk (or Field Report Filed)**

↳ Uses Escalation Detection Prompts or NGO Safeguarding Card
1. **Pause All Prompts Immediately**

↳ Companion switches to silent mode; user told “We’ll rest now.”
1. **Trigger Local Safeguarding Path**

↳ Companion checks for configured contact (caregiver, case worker, NGO lead)
1. **Flag + Package Event**

↳ Minimal metadata saved locally or to NGO dashboard if permitted (no content)
1. **Field Staff Notified + Action Logged**

↳ In offline zones, printout or device tag indicates review needed
1. **Optional Re-Engagement or Companion Reassignment**

↳ Once cleared, user can rejoin, start fresh, or be referred onward

---

## 📦 Required Response Kits

| Kit Component | Purpose |
| --- | --- |
| 🧾 **Safeguarding Report Form** | Paper or digital form capturing minimal incident facts |
| 📄 **Printable Disclosure Acknowledgement** | Optional caregiver copy (for follow-up) |
| 🧠 **Reintroduction Script** | Rebuild trust with user if Companion misunderstood situation |
| 📱 **Local Contact Sheet** | NGO/clinic list of approved escalation points |
| 🎗️ **Quiet Reflection Module** | For post-incident use (non-stimulating Companion mode) |

---

## 🔐 Data Privacy Rules

- **No full content logs** unless explicitly consented
- **No escalation stored in memory layer** unless caregiver enables it
- **Flagged session IDs are rotated**, not linked to user ID
- **Printed materials** include no reflection content — only flags or coded indicators
- **All escalation is opt-out recoverable**: users can choose not to continue with Companion afterward

---

## 🧑‍⚕️ Field & Partner Roles

| Role | Responsibility |
| --- | --- |
| **Caregiver** | Offer presence, report upstream, pause Companion if needed |
| **Field Staff / NGO Lead** | Handle form completion, contact local safeguarding lead |
| **Clinic / Education Partner** | Evaluate continued fit, follow referral or closure protocol |
| **Memora HQ Ethics Team** | If escalated, review anonymized flag patterns for prompt tuning or Companion drift |

---

## 📁 Templates & Linked Docs

- Safeguarding Report Form (Multilingual + Offline)
- Escalation Detection Prompt Pack
- Companion Quiet Mode UX Guide
- Disclosure Acknowledgement Template (Caregiver)
- NGO Emergency Contact Sheet Generator
- Incident Flag Audit Log (for reviewers only)
- Trauma-Informed Reintroduction Script (Post-Escalation)
- Referral Routing Card (Mental Health, Child Services, etc.)

---

## 🧭 Field Notes for Cultural Context

- Avoid over-pathologizing silence or sadness in high-grief regions
- Always include a **"nothing is wrong" exit path** for users
- Some cultures may consider disclosure shameful — Companion must never prompt “tell me more”
- Local scripts may need adaptation (e.g., replacing “grown-up” with "trusted person")
