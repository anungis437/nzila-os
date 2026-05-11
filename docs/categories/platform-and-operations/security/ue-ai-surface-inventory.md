# Union Eyes — AI Surface Inventory

> **OWASP AI Testing Guide alignment.**  
> AI may assist users, but AI must never become an authority layer.  
> AI must never: execute mutations directly, bypass RBAC, bypass org isolation, bypass decision-core,  
> write or modify NAR/audit records directly, expose cross-org data, be treated as authoritative decision output,  
> run without feature flag + entitlement + rate limit + audit event.

Last updated: 2025

## Legend

| Status | Meaning |
|--------|---------|
| `compliant` | All six gates present: feature flag · entitlement · RBAC · org-scope · rate limit · no unauthorized mutation |
| `partial` | One or more gates missing; hardening PR in progress |
| `blocker` | Multiple critical gaps; full rewrite required |
| `admin-internal` | Admin/steward-only internal tool; lower public exposure risk |

---

## AI Routes

| File path | Route | User-facing | Feature flag | Entitlement | Min role | Org-scope | Rate limit | Data classes | Mutation capable | OWASP risk | Status |
|-----------|-------|-------------|--------------|-------------|----------|-----------|------------|--------------|-----------------|------------|--------|
| `app/api/ai/copilot/query/route.ts` | POST /api/ai/copilot/query | Yes | ✅ STEWARD_COPILOT | ✅ ai_advanced_insights | steward | ✅ | ✅ AI_COMPLETION | grievance_legal, internal | No | LLM03 prompt injection | `compliant` |
| `app/api/ai/copilot/sessions/[id]/route.ts` | PATCH /api/ai/copilot/sessions/:id | Yes | ✅ STEWARD_COPILOT | ✅ ai_advanced_insights | steward | ✅ | ❌ missing | grievance_legal, internal | ✅ recordCopilotOutcome | LLM09 overreliance, LLM01 mutation | `partial` |
| `app/api/ai/employers/[id]/risk/route.ts` | GET /api/ai/employers/:id/risk | Yes | ✅ EMPLOYER_RISK | ✅ | member | ✅ | ✅ | internal | No | LLM09 overreliance | `compliant` |
| `app/api/ai/feedback/route.ts` | POST,GET /api/ai/feedback | Yes | ❌ missing | ❌ missing | member | ✅ | ✅ | internal | ✅ inserts feedback row | LLM09, LLM06 data leakage | `partial` |
| `app/api/ai/finance/analysis/route.ts` | POST /api/ai/finance/analysis | Yes | ✅ FINANCIAL_ANALYSIS | ✅ | officer | ✅ | ✅ | pension_financial, restricted | No | LLM06 data leakage | `compliant` |
| `app/api/ai/grievances/triage/route.ts` | POST /api/ai/grievances/triage | Yes | ✅ GRIEVANCE_TRIAGE | ✅ | member | ✅ | ✅ | grievance_legal | No | LLM09 overreliance | `compliant` |
| `app/api/ai/grievances/[id]/triage/route.ts` | POST /api/ai/grievances/:id/triage | Yes | ✅ GRIEVANCE_TRIAGE | ✅ | member | ✅ | ✅ | grievance_legal | No | LLM09 overreliance | `compliant` |
| `app/api/ai/grievances/[id]/clause-reasoning/route.ts` | POST /api/ai/grievances/:id/clause-reasoning | Yes | ❌ missing | ❌ missing | steward | ✅ | ❌ missing | grievance_legal, confidential | No | LLM03, LLM06 | `partial` |
| `app/api/ai/insights/[reportType]/route.ts` | GET /api/ai/insights/:reportType | Yes | ✅ EXECUTIVE_INSIGHTS | ✅ | officer | ✅ | ✅ | internal, confidential | No | LLM06 data leakage | `compliant` |
| `app/api/ai/insights/summary/route.ts` | GET /api/ai/insights/summary | Yes | ✅ EXECUTIVE_INSIGHTS | ✅ | officer | ✅ | ✅ | internal, confidential | No | LLM06 data leakage | `compliant` |
| `app/api/ai/ingest/route.ts` | POST /api/ai/ingest | Yes | ❌ missing | ❌ missing | ❌ no RBAC | ✅ | ❌ missing | confidential, member_personal | ✅ multipart ingest | LLM04 data poisoning, LLM01 | `blocker` |
| `app/api/ai/mamba/route.ts` | POST,GET /api/ai/mamba | Yes | ❌ missing | ❌ missing | ❌ no RBAC | ❌ no org scope | ❌ missing | confidential | No | LLM01 prompt injection, LLM02 insecure output, LLM06 | `blocker` |
| `app/api/ai/match-precedents/route.ts` | POST /api/ai/match-precedents | Yes | ❌ missing | ✅ ai_match_precedents | member | ✅ | ✅ | grievance_legal | No | LLM06 | `partial` |
| `app/api/ai/pension/plans/[id]/funding/route.ts` | GET /api/ai/pension/plans/:id/funding | Yes | ✅ PENSION_FUNDING_ANALYSIS | ✅ | officer | ✅ | ✅ | pension_financial | No | LLM06 | `compliant` |
| `app/api/ai/pension/plans/[id]/trustee-summary/route.ts` | GET /api/ai/pension/plans/:id/trustee-summary | Yes | ✅ PENSION_TRUSTEE_SUMMARY | ✅ | officer | ✅ | ✅ | pension_financial | No | LLM06 | `compliant` |
| `app/api/ai/pension/members/[id]/projection/route.ts` | GET /api/ai/pension/members/:id/projection | Yes | ✅ PENSION_BENEFIT_PROJECTION | ✅ | member | ✅ | ✅ | pension_financial, member_personal | No | LLM06 | `compliant` |
| `app/api/ai/search/route.ts` | GET,POST /api/ai/search | Yes | ❌ missing | ✅ ai_search | member | ✅ | ✅ | internal | No | LLM03, LLM06 | `partial` |
| `app/api/ai/semantic-search/route.ts` | POST /api/ai/semantic-search | Yes | ❌ missing | ✅ ai_semantic_search | member | ✅ | ✅ | internal | No | LLM03, LLM06 | `partial` |
| `app/api/ai/summarize/route.ts` | POST /api/ai/summarize | Yes | ❌ missing | ✅ ai_search (reuses) | member | ✅ | ✅ | internal | No | LLM03, LLM06 | `partial` |
| `app/api/ai/extract-clauses/route.ts` | POST /api/ai/extract-clauses | Yes | ❌ missing | ✅ ai_extract_clauses | member | ✅ | ✅ | grievance_legal | No | LLM03, LLM06 | `partial` |
| `app/api/ai/cache-stats/route.ts` | GET /api/ai/cache-stats | No (admin) | ✅ | ✅ | admin | ✅ | N/A | internal | No | — | `compliant` |

---

## Chatbot Routes

| File path | Route | User-facing | Feature flag | Entitlement | Min role | Org-scope | Rate limit | Data classes | Mutation capable | OWASP risk | Status |
|-----------|-------|-------------|--------------|-------------|----------|-----------|------------|--------------|-----------------|------------|--------|
| `app/api/chatbot/messages/route.ts` | POST /api/chatbot/messages | Yes | ❌ missing | ❌ missing | ❌ no RBAC | ❌ no org scope | ❌ missing | internal, grievance_legal | No | LLM01, LLM03, LLM06 | `blocker` |
| `app/api/chatbot/sessions/route.ts` | GET,POST /api/chatbot/sessions | Yes | ❌ missing | ❌ missing | ❌ no RBAC | ❌ no org scope | ❌ missing | internal | ✅ POST creates session | LLM01, LLM06 | `blocker` |

---

## ML Routes

| File path | Route | User-facing | Feature flag | Entitlement | Min role | Org-scope | Rate limit | Data classes | Mutation capable | OWASP risk | Status |
|-----------|-------|-------------|--------------|-------------|----------|-----------|------------|--------------|-----------------|------------|--------|
| `app/api/ml/query/route.ts` | POST /api/ml/query | Yes | ❌ missing | ❌ missing | member | ✅ | ✅ ML_PREDICTIONS | internal | No | LLM01, LLM03 | `partial` |
| `app/api/ml/predictions/sla-breach-risk/route.ts` | POST /api/ml/predictions/sla-breach-risk | Yes | ❌ missing | ✅ grievance_case_suite | steward | ✅ | ✅ ML_PREDICTIONS | internal | No | LLM09 overreliance | `partial` |
| `app/api/ml/recommendations/route.ts` | GET,POST /api/ml/recommendations | Yes | ❌ missing | ❌ missing | member/steward | ✅ | ❌ missing | internal | ✅ POST | LLM09, LLM01 | `partial` |
| `app/api/ml/monitoring/metrics/route.ts` | GET /api/ml/monitoring/metrics | admin-internal | ❌ missing | ❌ missing | member | ✅ | ✅ ML_PREDICTIONS | internal | No | LLM06 | `partial` |
| `app/api/ml/monitoring/alerts/route.ts` | GET,POST /api/ml/monitoring/alerts | admin-internal | ❌ missing | ❌ missing | member | ✅ | ✅ ML_PREDICTIONS | internal | ✅ POST | LLM06 | `partial` |
| `app/api/ml/monitoring/drift/route.ts` | GET,POST /api/ml/monitoring/drift | admin-internal | ❌ missing | ❌ missing | member/steward | ✅ | ❌ missing | internal | ✅ POST | LLM06 | `partial` |
| `app/api/ml/monitoring/usage/route.ts` | GET,POST /api/ml/monitoring/usage | admin-internal | ❌ missing | ❌ missing | member/steward | ✅ | ❌ missing | internal | ✅ POST | LLM06 | `partial` |

---

## Lower-Priority Grievance AI Routes

| File path | Route | User-facing | Feature flag | Entitlement | Min role | Org-scope | Rate limit | Data classes | Mutation capable | OWASP risk | Status |
|-----------|-------|-------------|--------------|-------------|----------|-----------|------------|--------------|-----------------|------------|--------|
| `app/api/grievances/[id]/recommend-steward/route.ts` | POST | steward | ❌ missing flag | ✅ | steward | ✅ | ✅ | grievance_legal | No | LLM09 | `partial` |
| `app/api/grievances/[id]/intelligence/route.ts` | GET | steward | ❌ missing flag | ✅ | member | ✅ | N/A | grievance_legal | No | LLM09 | `partial` |

---

## OWASP AI Top 10 Reference

| Code | Risk |
|------|------|
| LLM01 | Prompt Injection |
| LLM02 | Insecure Output Handling |
| LLM03 | Training Data Poisoning |
| LLM04 | Model Denial of Service |
| LLM05 | Supply Chain Vulnerabilities |
| LLM06 | Sensitive Information Disclosure |
| LLM07 | Insecure Plugin Design |
| LLM08 | Excessive Agency |
| LLM09 | Overreliance |
| LLM10 | Model Theft |

---

## Hardening Checklist

### Blockers (must fix — full rewrites)
- [ ] `app/api/ai/ingest/route.ts` — add `withRoleAuth('officer')`, rate limit, `guardAiFeature(AI_INGEST)`, `requireEntitlement('ai_advanced_insights')`; remove raw `getCurrentUser()`
- [ ] `app/api/ai/mamba/route.ts` — remove `@nzila/platform-auth/entra/server` import (edge runtime crash), add all six gates + org scope
- [ ] `app/api/chatbot/messages/route.ts` — add all six gates
- [ ] `app/api/chatbot/sessions/route.ts` — add all six gates

### Partials (surgical additions)
- [ ] `ai/copilot/sessions/[id]/route.ts` — add rate limit; add `enforceAISafety({ canMutate: false })` for `recordCopilotOutcome`
- [ ] `ai/feedback/route.ts` — add `guardAiFeature(AI_FEEDBACK)`, `requireEntitlement('ai_feedback')`
- [ ] `ai/grievances/[id]/clause-reasoning/route.ts` — add rate limit, `guardAiFeature(CLAUSE_REASONING)`, `requireEntitlement`
- [ ] `ai/match-precedents/route.ts` — add `guardAiFeature(AI_MATCH_PRECEDENTS)`
- [ ] `ai/search/route.ts` — add `guardAiFeature(AI_SEARCH)`
- [ ] `ai/semantic-search/route.ts` — add `guardAiFeature(AI_SEMANTIC_SEARCH)`
- [ ] `ai/summarize/route.ts` — add `guardAiFeature(AI_SUMMARIZE)`
- [ ] `ai/extract-clauses/route.ts` — add `guardAiFeature(AI_EXTRACT_CLAUSES)`
- [ ] `ml/query/route.ts` — add `guardAiFeature(ML_QUERY)`, `requireEntitlement`
- [ ] `ml/predictions/sla-breach-risk/route.ts` — add `guardAiFeature(ML_PREDICTIONS)`
- [ ] `ml/monitoring/metrics/route.ts` — add `guardAiFeature(ML_MONITORING)`, `requireEntitlement`
- [ ] `ml/monitoring/alerts/route.ts` — add `guardAiFeature(ML_MONITORING)`, `requireEntitlement`
- [ ] `ml/recommendations/route.ts` — add `entitlement` to factory
- [ ] `ml/monitoring/drift/route.ts` — add `entitlement` to factory
- [ ] `ml/monitoring/usage/route.ts` — add `entitlement` to factory
