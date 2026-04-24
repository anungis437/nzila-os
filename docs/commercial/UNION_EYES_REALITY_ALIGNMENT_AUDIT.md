# UNION EYES REALITY ALIGNMENT AUDIT

Date: 2026-04-23
Scope: Marketing/commercial copy alignment to shipped reality

Official slogan:

- EN: Global vision, local action
- FR: Vision globale, action locale

## Outcome

Status: PASS WITH CONDITIONS

- Major unsupported absolutes were reduced in trust and AI feature marketing pages.
- Remaining risk is governance drift: future copy can overstate capabilities unless a release copy gate is enforced.

## Audit Coverage

Reviewed in this pass:

- Marketing trust page
- AI workbench feature page
- Public routes and redirects (`/pricing`, `/trust`, `/status`, pilot request flows)

## Corrections Applied

1. Trust/security copy adjusted to avoid unverifiable absolutes:

- Removed hard claim that all processing is exclusively Canada Central in every case.
- Replaced strict TLS version/key-vault absolutes with policy-based language.
- Reframed audit immutability claim to reflect implemented tamper-evident controls varying by flow.
- Reframed AI handling claim to advisory/provider-governed language.

2. AI workbench copy adjusted:

- Replaced "every AI decision includes a reasoning chain" with "confidence/rationale where available".
- Replaced broad pilot market claim with controlled-pilot language.

## Required Slogan Placement (Approved)

Use these exact lines in commercial assets where tagline is shown:

- Global vision, local action
- Vision globale, action locale

Recommended insertion points:

- Buyer deck title/footer
- Pilot offer page
- Security/trust one-pager footer

## Remaining Reality Gaps

- Staging hostnames currently serve a production-configured runtime; marketing and ops messaging must avoid implying clean isolated staging today.
- Mobile-ready claims must stay scoped; do not claim all enterprise surfaces are mobile-first.
- AI claims must remain advisory-only and tied to feature-flag control language.

## Commercial Guardrail

Before publishing any Union Eyes marketing update:

1. Confirm claim is evidenced by:

- runtime endpoint proof,
- code path proof,
- or signed runbook proof.

2. Reject claims that imply:

- universal certifications not held,
- universal mobile readiness,
- universal AI explainability across all endpoints,
- topology separation that is not currently true.

## Verdict

- Marketing alignment is materially improved and usable for pilot-facing collateral.
- Production-grade claim discipline still requires an explicit release copy check.
