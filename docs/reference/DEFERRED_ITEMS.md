# UnionEyes CUPE Pilot — Deferred Items Log

**Purpose:** Track intentional post-pilot features to keep scope airtight.  
**Status:** LIVE (updated each phase)  
**Last Updated:** 2026-03-24

---

## Summary

Post-pilot features deferred to maintain **2-4 week pilot timeline** for single CUPE local scope. All items are tracked for Q2/Q3 roadmap prioritization.

---

## Phase 0 Deferrals (Baseline Validation)

**Decision Made:** 2026-03-24

- **Multi-CUPE-local federation** — Requires org-hierarchy refactor; scope creep risk. Planned for Phase 8 (post-pilot).
- **Per-org vocabulary customization** — System defaults sufficient for v0.1; per-org overrides deferred to Phase 8.
- **Evidence import / audit reconstruction** — Out of scope; legal hold covered by export-only model.
- **Advanced analytics (composition, disparity analysis)** — Dashboard MVP sufficient for pilot; advanced analytics Phase 9.
- **Mobile app / offline workbench** — Not in pilot scope; roadmap item for Phase 10+.
- **Bulk case import from legacy systems** — Manual entry via admin console sufficient for ~100–200 pilot cases.
- **Multi-brand / white-label support** — Early-stage pilots don't require this; Phase 8+.
- **Integration with CUPE education platform** — Out of scope until post-pilot feedback; Phase 9.

---

## Phase 1 Deferrals (Domain Fit)

*(Will be populated during PR-010–PR-012 implementation)*

---

## Phase 2 Deferrals (Workflow Hardening)

*(Will be populated during PR-020–PR-023 implementation)*

---

## Phase 3 Deferrals (Governance & Evidence)

*(Will be populated during PR-030–PR-033 implementation)*

---

## Phase 4 Deferrals (Attachments & Trust)

*(Will be populated during PR-040–PR-042 implementation)*

---

## Phase 5 Deferrals (Reporting & Polish)

*(Will be populated during PR-050–PR-052 implementation)*

---

## Phase 6 Deferrals (Admin & Onboarding)

*(Will be populated during PR-060–PR-062 implementation)*

---

## Phase 7 Deferrals (Readiness Seal)

*(Will be populated during PR-070–PR-072 implementation)*

---

## Pilot-Specific Known Limitations

**These are NOT deferred; they are accepted constraints for v0.1:**

### Operational Constraints

- **ClamAV availability:** If scanning fails, attachment uploads marked `scan_status=unavailable`. Control boundary documented in `docs/pilot/cupe/CUPE_MALWARE_CONTROL_BOUNDARY.md`. Network isolation + user training compensate.
- **Dashboard caching:** 5-minute TTL. Users may see slightly stale metrics. Manual "Refresh" button available.
- **User invites:** No bulk import; manual form entry only. Acceptable for ~10 pilot users.
- **SLA thresholds:** Fixed per workflow stage (no per-case overrides). Platform admin can adjust before pilot.
- **Attachment count limit:** Max 50 attachments per case. Unlikely to affect pilot; soft-documented limit.

### Feature Constraints

- **Export scope:** Single case export only; multi-case export deferred.
- **Taxonomy:** System-wide defaults; no per-org customization.
- **Support scope:** Business hours Monday–Friday, 8am–6pm Eastern. Escalations 24/7 on-call.
- **Workflow:** Linear case FSM (no complex branching or parallel stages).
- **Vocabulary:** CUPE defaults fixed; customization post-pilot.

### Security Trade-Offs (Intentional Design Decisions)

- **Malware scanning:** ClamAV covers file-based threats; social engineering/phishing out of scope (user education).
- **Attachment versions:** Single version per upload; version history deferred.
- **Role-based access:** 7 pre-defined roles; custom roles post-pilot.
- **Data retention:** No auto-archive for pilot (manual QA); retention policies Phase 8.

---

## Post-Pilot Backlog (Candidate Features for Q2/Q3)

### Phase 8 — Advanced Configuration & Federation (Q2/2026)

- [ ] Per-org vocabulary customization (overrides on CUPE defaults)
- [ ] Multi-CUPE-local federation with cross-local reporting
- [ ] Role-based workspace customization
- [ ] Advanced workflow rules (escalation, auto-assignment, conditional routing)
- [ ] Case template library + bulk actions
- [ ] SLA per-case overrides + exceptions
- [ ] Retention policies + auto-archive

### Phase 9 — Analytics & Insights (Q3/2026)

- [ ] Advanced analytics dashboard (composition trends, disparity analysis)
- [ ] Anomaly detection + proactive SLA alerts
- [ ] Steward performance analytics + coaching recommendations
- [ ] Union-wide reporting + benchmarking
- [ ] Integration with CUPE education platform

### Phase 10+ — Platform Extension (Q4/2026+)

- [ ] Mobile app + offline-capable workbench
- [ ] SMS/voice notifications for assignments
- [ ] Chatbot case assistant (FAQ, status queries)
- [ ] Integration with union dues/payroll systems
- [ ] White-label / multi-brand tenant support
- [ ] Export formats beyond CSV (DOCX reports, PDF with graphics)
- [ ] Keyboard shortcuts + accessibility polish (WCAG AAA)
- [ ] Voting/representative module integration
- [ ] Legal document automation (e.g., grievance letters)
- [ ] Multilingual support (French, Spanish)

---

## How to Use This Log

1. **During phase implementation:** Add items to appropriate phase section as decisions are made to defer features.
2. **Post-phase review:** Review deferred items for escalation to roadmap planning.
3. **Post-pilot:** Transfer items from this log to product backlog (Jira/GitHub Projects) with updated scope + effort estimates.
4. **Stakeholder comms:** Use this log to justify scope boundaries in go/no-go reviews.

---

## Legend

- **Phase N Deferrals:** Features intentionally deferred during that phase to maintain pilot timeline.
- **Pilot-Specific Known Limitations:** Design constraints accepted by stakeholders; not tracked as backlog items.
- **Post-Pilot Backlog:** Candidate features for future phases; requires re-prioritization post-pilot.

---

**Last Reviewed:** 2026-03-24  
**Next Review:** Post-PR-020 (after Phase 2 intake hardening complete)  
**Custodian:** Product Lead (for roadmap prioritization)
