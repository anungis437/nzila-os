# Archive

> **HISTORICAL.** Documents relocated from the repository root during cleanup. Retained for
> traceability, **not actively maintained**, and not current authority. Current authority is
> listed in [../README.md](../README.md).

## Contents

### [iterations/](iterations/)

Planning, convergence, phase, remediation, audit and handoff documents produced by completed
work programmes. Each describes the state of the repository at the time it was written.

### [audit-reports/](audit-reports/)

Point-in-time audit and certification reports from 2026-03 through 2026-07.
These were originally committed to the repository root.

| Report | Date |
|--------|------|
| ADVERSARIAL_CERTIFICATION_REPORT.md | 2026-03 |
| AUDIT_LEDGER_2026-03-25.md | 2026-03-25 |
| CLC_INTELLIGENCE_AUDIT_REPORT.md | 2026-04 |
| DECISION_INTELLIGENCE_AUDIT_2026-07-06.md | 2026-07-06 |
| EXECUTIVE_INTELLIGENCE_AUDIT_2026-04-08.md | 2026-04-08 |
| INTAKE_VS_CASE_AUTHORITY_AUDIT.md | 2026-04 |
| PREDEPLOYMENT_AUDIT_2026-04-09.md | 2026-04-09 |

### debug-logs/ (removed)

Raw build, lint, typecheck and test output logs were committed here. They were machine output
with no institutional value, and one file contained real user names and email addresses. They
were deleted rather than archived; such logs are gitignored for future runs (see root
`.gitignore`). The content remains recoverable from git history.

### auth-migration/ (never created)

The Clerk → `@nzila/platform-auth` migration left no archived artifacts. `@nzila/platform-auth`
is the current canonical authentication authority — see [../../../../ARCHITECTURE.md](../../../../ARCHITECTURE.md).
