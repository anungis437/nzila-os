# Boundary-Scan Checklist

> **Internal operating template. Not public copy. Not for external use unless separately reviewed and approved.**

## 1. Purpose

Provide repeatable scan discipline so every proof run is checked for public/product drift, real-institution
leakage, and domain-boundary violations before completion.

## 2. Required scan categories

- Governance scan
- SAGE productization scan
- Real-institution containment scan
- Regulator boundary scan (regulator or regulator-adjacent runs)
- Tribunal / ombuds boundary scan (tribunal, ombuds, or adjudication-adjacent runs)
- Health / PHI premature-claim scan

## 3. Governance scan

```
rg -n -i "book a demo|buy assessment|start pilot|view pricing|try the platform|UnionEyes for government|ABR detection|racism detector|automated racism|automated discrimination|automated legal advice|automated HR|SOW|pricing|UnionEyes|CourtLens|SR&ED|AI dashboard" docs/public-service/operations docs/public-service apps/web/app messages || true
```

## 4. SAGE productization scan

```
rg -n -i "SAGE.*product|SAGE.*platform|SAGE.*available|SAGE.*launched|SAGE.*demo|SAGE.*pilot|SAGE.*pricing|SAGE.*procurement" docs/public-service/operations docs/public-service || true
```

## 5. Real-institution containment scan

```
rg -n -i "CBC|Radio-Canada|real institution|actual institution" docs/public-service/operations || true
```

## 6. Regulator boundary scan

```
rg -n -i "investigation|enforcement|inspection|licensing|compliance determination|penalty|sanction|adjudicative|quasi-adjudicative|complaint handling|regulated-entity|regulated entity|privileged legal advice|personal information" docs/public-service/operations || true
```

## 7. Tribunal / ombuds boundary scan

```
rg -n -i "complaint intake|complaint screening|complaint files|investigation files|protected-disclosure files|adjudicative records|evidence records|witness records|complainant|respondent|whistleblower|draft findings|draft reasons|draft recommendations|remedy deliberations|privileged legal advice|personal information|case outcome|case-outcome|procedural fairness|protected disclosure|protected-disclosure|finding influence|recommendation influence|remedy conclusion|public-guidance-versus-case-material" docs/public-service/operations || true
```

## 8. Health / PHI premature-claim scan

```
rg -n -i "health-system ready|clinical ready|PHI ready|health-record ready|medical validation|clinical validation|patient data|health records|personal health information" docs/public-service/operations || true
```

## 9. Expected-match review

A scan hit is acceptable only if it appears in no-go language, boundary language, expected-match guidance,
exclusions, prohibited-material lists, prohibited-conclusion lists, not-proven language, or scan
instructions. Any hit that appears as a capability, recommendation, product claim, evidence target, decision
object, public copy, outreach language, or validation claim is a blocker.

## 10. Failure handling

- If a hit is a blocker, stop and reword to boundary/negation language, or remove the offending content.
- Re-run the affected scan until only acceptable expected-match hits remain.
- Do not merge or complete a run while any blocker remains.

## 11. Scan record template

| Scan | Command run | Result | Blockers? | Reviewer | Notes |
| --- | --- | --- | --- | --- | --- |
| Governance | | | | | |
| SAGE productization | | | | | |
| Real-institution containment | | | | | |
| Regulator boundary | | | | | |
| Tribunal / ombuds boundary | | | | | |
| Health / PHI premature-claim | | | | | |
