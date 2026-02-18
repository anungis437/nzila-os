# 🧭 Feature Flag Management Protocol

**Owner:** Aubert

### **1. Purpose**

This protocol defines how Memora uses **feature flags** to:
- Deploy new features to controlled user groups (e.g., pilot clinics, caregivers)
- Isolate **risky or evolving components** like Companion modes, gamification UX, or dashboard exports
- Support **A/B testing**, **regression safety**, and **phased rollout**
- Ensure compliance with Law 25, PIPEDA, and accessibility standards by enabling **per-role and per-region control**

---

### **2. Feature Flag Types**

| Type | Description | Use Case |
| --- | --- | --- |
| **Release Flags** | Hide incomplete features in production | Companion v2 personalization |
| **Operational Flags** | Control behavior across environments | Enable dashboard sync for pilot only |
| **Role-Based Flags** | Activate features by user type | Caregiver-only prompt previews |
| **Region-Based Flags** | Target language or jurisdiction | Quebec-only consent variant |
| **Kill Switches** | Emergency disable toggle | Companion nudge engine pause |
| **Gradual Rollout Flags** | Enable for % of users | Game Set v2 A/B test (Phase 2) |

---

### **3. Flag Infrastructure**

| Component | Tool |
| --- | --- |
| **Feature Flag Service** | Supabase Remote Config or LaunchDarkly (planned Phase 2) |
| **Storage** | Encrypted JSON config + backend cache |
| **Evaluation Layer** | Backend API → role-based check before rendering |
| **Refresh Interval** | Cached per session, rechecked on login or dashboard load |
| **Fallback Handling** | All flags must include `default: false` and `fail-safe path` |

---

### **4. Flag Naming Conventions**

| Format | Example |
| --- | --- |
| `scope.feature.version` | `companion.streak_praise.v1` |
| `region.scope.toggle` | `qc.consent.notice_v2` |
| `role.feature.experiment` | `caregiver.prompt_reactions.a` |
| `infra.emergency.kill` | `companion.queue.halt` |

---

### **5. Roles That Can Use Flags**

| User Role | Access |
| --- | --- |
| **Super Admin (Internal)** | Full access to toggle/edit/test |
| **Pilot QA (Pre-Prod)** | Can view/test gated features |
| **Clinic Admin / Caregiver** | Can only receive flags scoped to their role |
| **Patient** | Never sees flag toggle — receives filtered experience only |

---

### **6. Deployment Protocol**

| Stage | Action |
| --- | --- |
| **Dev** | Flags tested locally, always set `default=false` |
| **Staging** | Enabled for test roles (QA, bilingual audit) |
| **Pilot** | Gradually enabled for designated clinic IDs |
| **Production** | Requires manual approval, rollback path, and audit log entry |

---

### **7. Flag Lifecycle Management**

| Phase | Protocol |
| --- | --- |
| **Create** | Document in Notion + add fallback |
| **Test** | Add QA case with `enabled/disabled` states |
| **Rollout** | Announce in changelog, update dashboard if applicable |
| **Monitor** | Flag metrics logged if applicable (Phase 2 SDK) |
| **Retire** | Remove flag from code within 1 release cycle of finalization |

---

### **8. Sample Feature Flags (Live or Planned)**

| Flag | Type | Status |
| --- | --- | --- |
| `companion.streak_praise.v1` | Release | ✅ Live (pilot only) |
| `dashboard.export_toggle.v1` | Role-Based | ✅ Staging |
| `qc.consent.notice_v2` | Region-Based | ✅ Live |
| `companion.memory_ref.v2` | Release | ⏳ Phase 2 |
| `caregiver.prompt_reactions.a` | Experiment | ⏳ Phase 2 |
| `infra.companion_engine.halt` | Kill Switch | ✅ Defined |

---

### **9. Monitoring & Logging**

| Log Type | Fields Captured |
| --- | --- |
| Flag evaluation | `flag_name`, `user_id`, `role`, `env`, `value` |
| Flag override | Admin ID, timestamp, previous + new state |
| Emergency toggle | Justification, rollback plan, email to compliance |
| A/B path (Phase 2) | Experiment group, outcome ID, companion state |

---

### **10. Governance & Compliance**

| Requirement | Enforcement |
| --- | --- |
| Law 25 alignment | Consent flags gated by jurisdiction |
| Accessibility control | Animation, narration flags are scoped to preference & region |
| Audit trail | Flag changes logged in system + Notion |
| Pilot role separation | Only pre-approved roles receive beta flags |
| Security | No flag data embedded in mobile bundle; evaluated via secure API only |

---

### **11. Linked Documentation**

- 🧪 Testing & QA Strategy
- 🧠 Companion Logic Engine Spec
- 🔐 Auth & Permissions Model
- 🛠️ [Monitoring & Incident Response Plan]
- 📊 [Clinic Dashboard Pipeline Spec]
- ♿ [Accessibility Implementation Guide]
- 🔌 [Developer SDK / API Reference]
