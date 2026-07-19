# OCI / OCRA Consequence Model

> **Status:** Blueprint — Architecture Review Only (no implementation)
> **Audience:** Deputy ministers, crown corporation leadership, risk officers, procurement evaluators
> **Premise:** Government leaders do not buy scores. They buy **avoided consequences.**

---

## 1. Why a consequence model

A continuity finding is inert until a leader can see **what it could cost the
institution.** A deputy minister does not act on "transition_readiness = 41"; she
acts on "an unplanned departure would strand three statutory programs with no
documented authority to sign." The consequence model is the layer that converts
deterministic findings into **institutional stakes.**

**Constitutional constraint:** consequences are **reference mappings and reporting
framing — never score inputs.** A finding's consequence classification does not
move any dimension or composite. It changes *how the finding is prioritized and
narrated*, not its number.

---

## 2. The six consequence classes

| # | Class | Question it answers | Example |
| --- | --- | --- | --- |
| 1 | **Institutional** | Could the institution lose its capacity to function/persist? | Loss of decision authority on key departures |
| 2 | **Governance** | Could oversight, accountability, or legitimacy fail? | Board cannot demonstrate control |
| 3 | **Operational** | Could core operations degrade or stop? | Single-point process dependency |
| 4 | **Service Delivery** | Could citizens/members lose a service? | Program halts during transition |
| 5 | **Public Trust** | Could public confidence/reputation erode? | Unexplained service failure, audit finding |
| 6 | **Financial Risk** | Could the institution incur loss, liability, or penalty? | Regulatory sanction, reconstruction cost |

### 2.1 Consequence properties (reference fields)

Each consequence carries (as reference data only):

- `consequenceClassId`
- `severityScale` — qualitative (negligible / moderate / serious / severe), used
  for **reporting ordering**, not scoring
- `realizationTrigger` — the disruption that would realize it (departure,
  disaster, audit, transition, automation failure)
- `obligationAffinity` — which obligation classes most often drive it (links to
  the [obligation taxonomy](./OCI_OCRA_OBLIGATION_TAXONOMY.md))

---

## 3. Mapping findings → consequences

Mapping is **deterministic and table-driven**, conditioned on the finding theme,
the affected dimension(s), and the evidence/confidence envelope.

| Finding theme | Primary consequences | Realization trigger |
| --- | --- | --- |
| Undocumented succession authority | Institutional, Service Delivery, Governance | Unplanned departure |
| Records/decision retention gaps | Governance, Public Trust, Financial Risk | Audit, litigation, FOI request |
| Single-point operational dependency | Operational, Service Delivery | Absence, system failure |
| No COOP / BCM plan | Institutional, Service Delivery, Public Trust | Disaster, disruption |
| Board oversight gap | Governance, Public Trust | Audit, scandal |
| AI/automation without governance | Governance, Public Trust, Financial Risk | Automated error at scale |
| Knowledge concentrated in one person | Operational, Institutional | Departure, illness |

### 3.1 Confidence-gating of consequence claims

A consequence is only stated at full severity when the underlying finding's
**confidence** supports it:

- `HIGH/MODERATE` confidence → consequence stated directly.
- `LOW` confidence → consequence stated as **potential**, with the caution surfaced.
- `INSUFFICIENT` confidence → consequence **not asserted**; reported as "cannot be
  evidenced at this time."

This prevents the model from over-claiming catastrophe on thin evidence — the
fastest way to lose a public-sector audience.

---

## 4. Consequence severity vs. obligation tier (two independent axes)

A finding has **both** an obligation tier (accountability gravity) **and** a
consequence severity (institutional stakes). They are independent and both
reported:

```
                    CONSEQUENCE SEVERITY →
                 negligible  moderate  serious  severe
 OBLIGATION  T1  ░░          ▒▒        ▓▓       ██   ← lead with this finding
 TIER ↓      T4  ░░          ▒▒        ▓▓       ▓▓
             T7  ░          ░          ▒▒       ▓▓
```

**Reporting rule:** lead with findings that are **high on both axes** (high-tier
obligation × severe consequence). Neither axis feeds the score; both drive
**narrative precedence only.**

---

## 5. From consequence to calm recommendation

The consequence model **motivates** but never **coerces** the recommendation. The
existing recommendation tone (calm, non-coercive, sovereignty-preserving —
`recommendationsForBand()`) is preserved. The consequence supplies the *why now*
without manufacturing urgency:

> "An unplanned departure would strand the program's signing authority
> (Institutional + Service-Delivery consequence). A short delegation-of-authority
> document closes this. No urgency is implied; this is a standing exposure."

---

## 6. What the consequence model must NEVER do

1. **Never feed the score.** No consequence class adds or removes points.
2. **Never manufacture fear.** Severity is bounded by confidence; catastrophe is
   not asserted on `LOW`/`INSUFFICIENT` evidence.
3. **Never personalize.** Consequences are institutional, never about named
   individuals.
4. **Never replace the finding.** The consequence is *downstream of* a fully
   evidenced finding; it cannot exist without one.

---

## 7. Procurement value

This is the layer procurement evaluators feel most directly. It converts a
defensible methodology into a **decision-grade brief**: every exposure is named in
the currency a deputy minister manages — institutional survival, governance
legitimacy, service continuity, public trust, and financial liability — each
bounded by an explicit confidence envelope.

> Government leaders buy avoided consequences. The consequence model is how
> OCI/OCRA shows, finding by finding and within the limits of its evidence,
> exactly which consequences it helps a public institution avoid.
