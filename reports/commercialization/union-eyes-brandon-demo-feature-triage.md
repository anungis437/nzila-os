# Union Eyes — Brandon Demo Feature Triage (Customer Zero Sprint)

Date: 2026-06-02
Scope: Feature requests and observations surfaced during Brandon/CUPE demo motion and immediate follow-up.
Decision rule: Only Tier 1 items are recommended for immediate implementation.

---

## 1. Classification Method

Each item is classified by:
1. Demo friction visibility.
2. Direct steward workflow impact.
3. Direct pilot adoption impact.
4. Material effect on pilot success probability.
5. Effort estimate.

Effort scale:
1. S: <= 1 day
2. M: 2-4 days
3. L: 5-10 days

Impact scale:
1. Low: limited pilot success impact
2. Medium: noticeable pilot success impact
3. High: likely changes pilot outcome

---

## 2. Tier 1 — Pilot-Critical (Build Immediately)

These are green-lit for the next sprint.

| Item | Why It Is Tier 1 | Effort | Pilot Success Impact | Recommendation |
|---|---|---:|---:|---|
| Pricing and offer clarity on pilot motion | This caused direct confusion in buyer interpretation (cadence, amount type, what is credited). | S | High | Keep language explicit and synchronized in all outbound collateral and pricing-adjacent pilot artifacts. |
| Proposal package completeness (proposal + SOW + success metrics + pilot plan) | Required to move from interest to internal approval. | S | High | Use generated artifact bundle as canonical package for Brandon-facing motion. |
| Operational pilot review surface (opportunity tier + commercial state + latest artifact/timeline) | Needed for operator control and no-loss handoff between sales and pilot operations. | M | High | Continue using current consolidated admin pilot view as the source of truth. |
| Package export for executive sharing | Directly supports internal stakeholder circulation and decision acceleration. | S | High | Use package export as mandatory outbound attachment in pilot decision flow. |
| Steward workflow friction fixes from live usage (case lifecycle visibility, note capture speed, follow-up tracking, lookup/search friction) | Real user friction in steward workflow directly affects pilot adoption and week-2 to week-8 retention. | M-L | High | Treat each observed friction as a targeted UX/workflow ticket tied to adoption KPI movement. |

Immediate implementation policy for Tier 1:
1. Ship only if tied to a specific observed friction and named pilot success KPI.
2. Keep changes narrow and reversible.
3. Add before/after expectation in ticket notes (what pilot behavior should improve).

---

## 3. Tier 2 — Pilot-Supporting (Queue)

Useful, but not required to convert or activate Customer Zero.

| Item | Why Tier 2 | Effort | Impact on Customer Zero | Recommendation |
|---|---|---:|---:|---|
| Additional reporting layers | Valuable for scale, not required to run first pilot decision cycle. | M | Medium | Queue post-activation unless specific sponsor asks for one report as deal blocker. |
| Additional exports beyond current pilot package | Helpful for later teams, not necessary for immediate pilot decision. | M | Medium | Keep in backlog; only pull if buyer-specific blocker. |
| Additional role-type granularity | Useful for broader org complexity, not needed for current pilot lock. | M-L | Low-Med | Defer until second pilot unless role mismatch blocks onboarding. |
| Extra dashboard widgets | Nice-to-have visibility expansion. | S-M | Low-Med | Defer; do not add without direct pilot-critical evidence. |

---

## 4. Tier 3 — Vision Expansion (Reject For Now)

These are explicitly frozen during Customer Zero sprint.

| Item | Why Tier 3 | Recommendation |
|---|---|---|
| New governance engines | Expands platform architecture without direct Customer Zero conversion benefit. | Freeze. |
| New doctrine modules | Strategic but not required for pilot conversion and activation. | Freeze. |
| New scoring frameworks beyond current C1.5 model | Current model is sufficient for objective qualification and tiering. | Freeze. |
| New intelligence layers/abstractions | Existing intelligence capture is adequate for first real pilot execution. | Freeze. |
| New commercialization subsystems | Current commercial memory and workflow stack is sufficient for Customer Zero. | Freeze. |

---

## 5. Immediate Implementation Recommendation (Tier 1 Only)

For next sprint, implement only these classes of changes:
1. Friction-proven steward workflow improvements observed in demo/pilot usage.
2. Outbound collateral quality and consistency improvements that shorten decision cycle.
3. Activation-path reliability improvements that reduce operator error in first pilot.

Do not implement:
1. New subsystem patterns.
2. New abstraction layers.
3. Vision-forward engines not required for Brandon/Customer Zero conversion.

---

## 6. Suggested Sprint Gate

Before any ticket enters in-progress, require this checklist:
1. Which observed friction does this solve?
2. Which pilot KPI should move if shipped?
3. Is this Tier 1, 2, or 3?
4. If not Tier 1, why is it in this sprint?

If item is not Tier 1, default decision is defer.
