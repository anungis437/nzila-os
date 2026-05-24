# OCI Procurement FAQ

DOCTRINE_VERSION: 1.0.0

> **Posture.** OCI™ is the **human continuity layer** beneath operational resilience and governance continuity systems. It complements ISO and COBIT frameworks; it does not replace them.

---

**Q1. Does OCI replace our ISO 22301 BCMS?**

No. OCI complements a BCMS by characterising the human continuity fabric that a BCMS implicitly assumes is documented. See [`../compliance/OCI_ISO22301_CROSSWALK.md`](../compliance/OCI_ISO22301_CROSSWALK.md).

**Q2. Is OCI an ISO certification?**

No. OCI is a doctrine and methodology, not a certification regime. We do not certify compliance with any standard.

**Q3. Does OCI produce risk scores?**

No. OCI produces categorical **bands** (e.g., `CONCENTRATED`, `PATTERNED`, `SEVERE`) accompanied by **confidence envelopes**. It does not assign numerical risk scores and it does not rank risks.

**Q4. Does OCI rank institutions against each other?**

No. The methodology forbids cross-institutional ranking. Bands are contextual; comparisons across institutions require reviewer-led interpretation and are not produced by the methodology itself.

**Q5. Does OCI infer anything about individuals?**

No. The OCI Anti-Surveillance Position™ forbids inspection of holder names, free-text notes, or individual identities. OCI operates on aggregates only.

**Q6. What is a confidence envelope?**

A standardised structure attached to every OCI output: `confidence` (HIGH/MODERATE/LOW/INSUFFICIENT), `sampleSize`, `dataCompleteness`, `stability`, `decay`, and a list of caution states. See [`OCI_CONFIDENCE_INTERPRETATION_GUIDE.md`](./OCI_CONFIDENCE_INTERPRETATION_GUIDE.md).

**Q7. How do you ensure two reviewers reach the same reading?**

Via the Entropy Audit Packet™. Identical canonicalised observations produce identical SHA-256 `reproducibilityHash` values. Reviewer-variance signals are tracked by the Reviewer Consistency Layer™.

**Q8. What happens when readings get stale?**

The Confidence Decay model degrades the confidence band by age:

| Age | Decay | Confidence consequence |
|---|---|---|
| < 90 d | NONE | None |
| 90 – 179 d | MILD | HIGH → MODERATE |
| 180 – 364 d | MODERATE | HIGH/MODERATE → MODERATE/LOW |
| ≥ 365 d | SEVERE | Any band → INSUFFICIENT |

A `SEVERE` decay collapses the envelope to `INSUFFICIENT`; refresh is mandatory before further reliance.

**Q9. How does OCI use HHI and Gini?**

HHI and Gini are **statistical anchors** that contextualise stewardship concentration and continuity-burden distribution. They do **not** replace OCI interpretation; the methodology forbids using them as risk scores or rankings.

**Q10. What if your statistical output contradicts our internal view?**

The methodology treats contradictions as a signal for reviewer-led re-examination, not a verdict. The Evidence Sufficiency Engine™ downgrades any `sufficient` verdict to `partial` in the presence of contradictions and raises an escalation flag.

**Q11. Is OCI AI-driven?**

No. OCI produces no behavioural inferences and uses no machine learning to classify individuals or institutions. Reviewer-led interpretation is constitutive. See whitepaper §15.

**Q12. Who maintains the doctrine?**

The doctrine maintainers recorded in [`CODEOWNERS`](../../../CODEOWNERS) under `docs/oci/`. Every change is logged in [`../methodology/METHODOLOGY_CHANGELOG.md`](../methodology/METHODOLOGY_CHANGELOG.md).

See also: [`../compliance/OCI_PROCUREMENT_POSITIONING.md`](../compliance/OCI_PROCUREMENT_POSITIONING.md), [`OCI_AUDITOR_QUICK_REFERENCE.md`](./OCI_AUDITOR_QUICK_REFERENCE.md).
