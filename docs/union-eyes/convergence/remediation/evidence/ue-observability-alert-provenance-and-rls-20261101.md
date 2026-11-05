# UE Gate 0 — realtime alert tenant read and SLA provenance (engineering evidence only)

- Parent HEAD: `9276e9ca6859e884b191285a6d8a84962d507505`.
- Defect associations: `DEF-0B3-ALERT-INBOX-MEMBER-FLOOR-NO-REDACTION` (supplemental; officer redaction still unresolved), `DEF-0B9-ML-SLA-SCORE-IS-LITERAL-WEIGHTS-OVER-CALLER-VALUES-PRESENTED-AS-A-MODEL-WITH-CONSTANT-CONFIDENCE` (supplemental).
- Source: getRecentRealtimeAlerts executes inside the authenticated organization's RLS transaction; missing organization or invalid direct-call limit fails closed. The system alert sweep excludes v1 caller-influenced SLA scores. No alternative unapproved v2 threshold is invented; the independent SLA watchdog retains overdue/at-risk alert delivery.
- Regression tests authored: RLS context propagation/failure, missing tenant and invalid limit; real SQL PGlite legacy-v1 score suppression.
- Source-level: patch authored. Unit/contract: NOT VERIFIED. Native PG15/16: NOT VERIFIED. HTTP/browser/staging: NOT VERIFIED. Independent reviewer, persona and institutional authority: OUTSTANDING.
- Remaining: validate real runtime alert deliveries and administrator inbox redaction; agree an institutional policy for risk-indicator alert thresholds. No CLOSED or count credit.
