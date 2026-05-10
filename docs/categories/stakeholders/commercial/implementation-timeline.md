# Union Eyes: Implementation Timeline

*Reference document for pilot conversations and procurement packages*

---

## Overview

A Union Eyes deployment follows a structured 12-week arc from contract signature to active use, with a defined pilot evaluation period and a clear conversion decision point.

Total elapsed time from "contract signed" to "first live grievance in the system": **14 business days**.

---

## Phase 1: Provisioning & Configuration (Week 1)

**What happens on our side**

| Day | Activity |
|---|---|
| Day 1 | Contract countersigned; provisioning ticket opened |
| Day 1–2 | Azure Canada Central environment provisioned (Container Apps, PostgreSQL, Key Vault) |
| Day 2 | Custom subdomain configured (e.g., `[local-name].unioneyes.app`) |
| Day 2–3 | Collective agreement structure mapped: step names, filing deadlines, issue type taxonomy |
| Day 3–5 | Historical grievance data imported (from CSV/Excel template provided) |
| Day 5 | Staging environment handed to pilot coordinator for acceptance testing |

**What we need from you (before Day 1)**

- Signed pilot agreement
- CA step structure document or description (email is fine)
- Historical grievance export or list (we provide the import template)
- List of rep/steward accounts: name, email, role
- Designated pilot coordinator (1 person, 2 hours/week commitment)

---

## Phase 2: Go-Live & Steward Onboarding (Week 2)

**Day 6–7**: Issues from acceptance testing resolved; production environment promoted  
**Day 8**: **Go-live** — system is live, all accounts active  
**Day 9–10**: Steward onboarding session 1 (90 min, recorded)  

- Grievance intake walkthrough  
- Case file management  
- Deadline dashboard  
- Q&A

**Day 11–12**: Steward onboarding session 2 (90 min, recorded)  

- Advanced case management  
- Evidence bundle export  
- Reporting dashboard  
- Communications module (if Track B included)

---

## Phase 3: Active Pilot (Weeks 3–10)

**Cadence**: Weekly 30-minute check-in call (optional — async Slack/Teams also available)

**Week 3–4**: Reps entering new grievances live; historical cases being worked  
**Week 5**: First pattern report available (requires minimum 10 active cases)  
**Week 6**: Mid-pilot check-in — issue log reviewed, any workflow adjustments  
**Week 8**: Mid-pilot review meeting (1 hour):

- Metrics reviewed: cycle time, case volume, rep utilization
- Feature requests logged and prioritized
- Renewal decision preview

**Ongoing**: Issue log monitored, patches applied without downtime, feature releases deployed automatically

---

## Phase 4: Evaluation & Decision (Weeks 11–12)

**Week 11**: Pilot close-out report prepared by Union Eyes team:

- Grievance cycle time comparison (before/after)
- Case volume handled during pilot
- Rep utilization and adoption metrics
- Outstanding issues log (all resolved or with timeline)
- Feature roadmap preview

**Week 12**: Decision meeting (1 hour):

- Review pilot report
- Commercial proposal for annual subscription
- If converting: transition to subscription pricing, pilot fee credited
- If not converting: data export package delivered within 5 business days

---

## Post-Conversion: Ongoing Operations

| Activity | Frequency |
|---|---|
| Product updates (automatic) | As released — no downtime |
| Security patches | Within 72 hours for critical CVEs |
| Quarterly business review | Optional, included in Council/Federation plans |
| User account management | Self-serve (admin console) |
| Data export | On request, within 5 business days |
| Support response | Email: next business day; critical: 4 hours |

---

## What Can Extend the Timeline

| Risk | Likelihood | Mitigation |
|---|---|---|
| Historical data quality issues (inconsistent CA steps, missing dates) | Medium | Import template minimizes this; clean-enough data proceeds, rest imported later |
| IT/security approval process (proxy, firewall, VPN) | Low | Union Eyes is cloud-hosted; no on-premise components; proxy access to `*.unioneyes.app` and `*.azurecontainerapps.io` is sufficient |
| Steward availability for onboarding sessions | Medium | Sessions are recorded; reps can self-onboard from recordings |
| CA structure complexity (multiple CBAs, multiple employers) | Low-Medium | Scoped to one CBA/employer for pilot; multi-CA support added post-pilot if needed |

---

## Contact

Pilot coordination: [support@unioneyes.app](mailto:support@unioneyes.app)  
Commercial questions: [commercial@unioneyes.app](mailto:commercial@unioneyes.app)  
Book a demo: [unioneyes.app/pilot-request](https://unioneyes.app/pilot-request)
