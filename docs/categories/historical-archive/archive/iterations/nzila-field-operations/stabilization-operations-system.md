# Stabilization Operations System

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-field-operations-index.md](./master-field-operations-index.md)

This document operationalizes stabilization-first field operations.

---

## 1. Posture

Stabilization is the **default operational state**. Active change is
the exception. Every operational system in Nzila reads this way.

---

## 2. Stabilization interpretation

A tier is "stabilizing" when its continuity window is open. A tier
is "stable" when its window has closed and recent attestations are
clean. A tier is "observed" when stable and under cadence review.

These are not health scores. They are operational interpretations.

---

## 3. Operational pacing

During stabilization:

- no new promotions to the tier
- no onboarding phase transitions on the tier
- no executive cadence acceleration
- only continuity-safe operator activity

---

## 4. Rollout cooldowns

A cooldown is the visible representation of the continuity window.
The Continuity Window panel in the Control Plane is the canonical
surface. The cooldown closes automatically on window expiry.

---

## 5. Escalation posture

Escalation during stabilization is biased toward **wait**. Operators
escalate only when continuity is at risk. Operators do not escalate
to shorten cooldowns.

---

## 6. Continuity-safe operational recovery

If an unexpected event occurs during stabilization, the operational
recovery posture is:

1. observe
2. record an interpretive note in the reviews ledger
3. extend cadence calm
4. defer promotion

Recovery is paced, not heroic.

---

## 7. Governance-safe stabilization guidance

The Stabilization Guidance panel surfaces:

- the open window and time remaining
- the recommended posture (defer / observe / interpret)
- the most recent promotion that opened the window

Guidance is short. Guidance does not nudge toward acceleration.

---

## 8. Reduction of operational anxiety

The stabilization system intentionally reduces operator anxiety by:

- making stabilization legible
- making stabilization the default
- removing accelerator affordances
- recording calm as a legitimate state

A calm operator is a healthy operator.
