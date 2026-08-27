# 00 - Audit Charter And Baseline

## Mission

Determine whether the current Union Eyes repository can support a tailored executive recording and possible bounded discovery for LIUNA OPDC/CECOF, with emphasis on leadership continuity, institutional memory, federated authority, legal confidentiality, controlled transitions, and evidence defensibility.

## Engagement Facts

- Aubert Nungisa met with Sean McFarling.
- Sean showed broad interest in Union Eyes.
- The most material concern discussed was continuity through leadership changes.
- Aubert promised a tailored recording.
- An OCI-informed Leadership Continuity and Institutional Memory Workshop may be a good follow-on.
- No LIUNA body has authorized a purchase, pilot, deployment, endorsement, or broad internal sponsorship.

## Public Institutional Facts Used

- LIUNA describes itself as a half-million-member union in the United States and Canada.
- LIUNA members work across construction, infrastructure, energy, water/sewer, public-sector, health care, sanitation, road maintenance, emergency response, and related functions.
- LIUNA represents more than 70,000 public employees.
- LiUNA Canada describes Canadian locals and training centres as community-based membership and training infrastructure.
- These public facts support a federated, multi-body audit model, but do not define LIUNA OPDC/CECOF's actual deployment requirements.

Sources:
- https://www.liuna.org/
- https://www.liuna.org/about
- https://www.liuna.org/public-sector
- https://www.liuna.ca/

## Repository Baseline

- Repository: `C:\APPS\nzila-automation`
- Branch: `main`
- HEAD audited: `f1153931db09cf6720678b4b096ad80afbb64df4`
- Worktree before artifact creation: clean, `main...origin/main`
- Node: `v24.13.1`
- pnpm: `10.33.0`
- Repo LIUNA references before this audit: none found, except generic "laborers" occupational-code comments in `apps/union-eyes/app/api/cron/external-data-sync/route.ts`.

## Governing Question

Can Union Eyes preserve operational knowledge, decisions, obligations, active matters, deadlines, documents, authority, and accountability through leadership or personnel changes while maintaining appropriate confidentiality and autonomy across OPDC, CECOF, and affiliated bodies?

## Operating Rules

- Use synthetic data only.
- Do not modify runtime/product code.
- Do not alter Azure.
- Do not create or represent LIUNA tenant data.
- Do not claim solicitor-client privilege, legal compliance, immutability, chain of custody, bilingual completeness, or production behavior unless proven by appropriate controls and tests.
- Treat absence of client requirements as unknown, not as a product defect.

## Reused Audit Conventions

Reused from CUPE/Union Eyes audit corpus:

- Go/no-go separation by domain.
- Evidence registers and scenario matrices.
- Readiness verdicts with explicit limitations.
- Reality-remediation evidence levels.
- Negative authorization posture.

Not reused mechanically:

- CUPE-specific taxonomy and roles as final truth.
- CUPE single-local assumptions.
- CUPE demo/pilot status as proof of LIUNA suitability.
- CLC convention readiness language as proof of legal or federated operating readiness.

## Evidence Levels

- `RUNTIME_PROVEN`
- `TEST_PROVEN`
- `CODE_SUPPORTED_NOT_RUNTIME_PROVEN`
- `DOCUMENTED_ONLY`
- `INFERRED`
- `NOT_IMPLEMENTED`
- `NOT_ASSESSED`
