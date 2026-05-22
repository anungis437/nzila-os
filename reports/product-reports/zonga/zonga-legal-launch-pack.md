# Zonga Legal Launch Pack

> **Report type:** Launch readiness — legal and compliance  
> **Generated:** 2025-Q2  
> **Scope:** Terms of service, artist agreements, DMCA posture, privacy policy, and data residency

---

## Legal Documents Status

| Document | Status | Location |
|----------|--------|----------|
| Terms of Service (Listeners) | ✅ Published | `/legal/terms` |
| Terms of Service (Creators / Labels) | ✅ Published | `/legal/terms-creator` |
| Pilot Partner Agreement (PDF) | ✅ Ready for signing | Partner Dashboard → Settings → Rights & Terms |
| Privacy Policy | ✅ Published | `/legal/privacy` |
| Cookie Policy | ✅ Published | `/legal/cookies` |
| DMCA Agent Registration | ✅ Registered | U.S. Copyright Office filing on record |
| DMCA Takedown Procedure | ✅ Published | `/legal/dmca` |
| Data Processing Addendum (DPA) | 🟡 Draft | Available on request |

---

## DMCA & Rights Posture

| Claim | Source | Proof | Status |
|-------|--------|-------|--------|
| DMCA designated agent is registered | U.S. Copyright Office | Agent registration number on file | verified |
| Takedown notice can be submitted via web form | `/legal/dmca` page | Form present and routes to `abuse@zonga.io` | verified |
| Counter-notification procedure published | `/legal/dmca` | Counter-notice section in DMCA page | verified |
| Rights terms panel available to partners | `components/dashboard/rights-terms-panel.tsx` | Component exists; rendered in partner dashboard | verified |
| Partner agreement requires content ownership warranty | Pilot Partner Agreement | Section 3.3 — uploader warranties ownership | verified |
| Repeat infringer policy | `/legal/dmca` | Policy section present | verified |

---

## Data Residency

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| Canadian data residency | Azure Canada Central (primary) | ✅ Verified |
| Data sovereignty statement | Privacy policy — Section 5 | ✅ Published |
| Cross-border transfer controls | Standard Contractual Clauses referenced in DPA | 🟡 DPA in draft |
| Right to erasure (PIPEDA / GDPR) | Account deletion flow removes PII within 30 days | ✅ Implemented |

---

## Open Legal Items

| Item | Priority | Target |
|------|----------|--------|
| DPA (full, executed) | High | Before any EU partner signs |
| Accessibility statement (AODA) | Medium | GA |
| Contractor IP assignment audit | Low | GA |

---

*Reviewed by: Nzila legal team. Status: Approved for pilot operations. Open items tracked.*
