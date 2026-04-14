# Remediation Task List — Blindspots Assessment

**Generated**: 2026-04-14  
**Based on**: Blindspots Validation Report  
**Owner**: Platform Team  

---

## P0: Blocking Items (Start This Sprint)

### P0-1: AI Provider Fallback Chains
**Issue**: No graceful degradation if Azure OpenAI endpoint fails or hits quota.  
**Impact**: Production reliability risk; data loss if audit sealing attempted during provider outage.  
**Status**: COMPLETE  
**Work**:
- [x] Design fallback strategy (e.g., OpenAI fallback for non-critical paths)
- [x] Add circuit breaker pattern to `packages/ai-core/src/gateway.ts`
- [x] Implement timeout guards for provider calls
- [x] Add integration tests for provider failure scenarios
- [x] Document fallback policy in architecture

**Evidence Files**: `packages/ai-core/src/gateway.ts` (lines 1–240)  
**Effort**: 2–3 days  
**PR Template**: `feat: AI provider fallback chains + circuit breaker`

---

### P0-2: Governance Store Persistence
**Issue**: In-memory only; governance decisions lost on restart; audit compliance risk.  
**Impact**: Regulatory audit failure; cannot prove governance decisions were enforced historically.  
**Status**: COMPLETE  
**Work**:
- [x] Design `GovernanceStore` PostgreSQL backend
- [x] Add schema migrations (Drizzle) for governance tables (model registry, prompt versions, decisions, reviews)
- [x] Implement durable backend class alongside in-memory
- [x] Wire into test/prod environments via env config
- [x] Add schema versioning + audit trail for governance changes
- [x] Update package README with persistence architecture

**Evidence Files**: `packages/platform-ai-governance/src/store.ts` (lines 1–260)  
**Depends On**: DB schema extensions (coordinates with db@ team)  
**Effort**: 3–5 days  
**PR Template**: `feat: Durable governance store (PostgreSQL backend)`

---

## P1: Pre-Scale Items (Next Sprint)

### P1-1: 100K+ User Load Projection
**Issue**: k6 baseline (1 VU smoke test) insufficient; no evidence of 10x projection testing before Africa launch.  
**Impact**: Hidden latency/throughput ceiling could tank NRR in early apps at scale.  
**Status**: COMPLETE  
**Work**:
- [x] Design load test matrix (100 → 1K → 10K → 100K VUs)
- [x] Extend `tests/load/zonga.js` patterns to other apps (UE, Agrimo)
- [x] Establish latency SLOs per app (target: <2s p95)
- [x] Create centralized load config (`tests/load/config.js`) with SLO targets
- [x] Document capacity planning results (e.g., "10K concurrent users = 32 CPU + 64GB RAM")
- [x] Create runbook for vertical/horizontal scaling triggers

**Evidence Files**: 
- `tests/load/config.js` (centralized matrix, SLOs, capacity thresholds)
- `tests/load/zonga.js` (media platform load test, 5 profiles)
- `tests/load/union-eyes.js` (case management load test, realistic workload mix)
- `tests/load/agrimo.js` (cooperative management load test, realistic workload mix)
- `docs/LOAD_PROJECTION_CAPACITY_PLAN.md` (comprehensive capacity planning doc with scaling playbook)

**Effort**: 2–3 days  
**PR Template**: `test: 100K user load projection + SLO validation`

---

### P1-2: Multi-Jurisdiction Compliance Framework
**Issue**: Agrimo/NACP lack region-specific policy frameworks (tax, labor law, pension structures vary by jurisdiction).  
**Impact**: Launch blocker in new regions; regulatory fines if non-compliant code deployed.  
**Status**: COMPLETE  
**Work**:
- [x] Design jurisdiction compliance package structure with policies, validators, datasets
- [x] Create Kenya policy object (tax rates, labor law, pension, exam board specifics)
- [x] Create Uganda policy object (agricultural focus, exam board, pension structure)
- [x] Create Nigeria policy object (NBTE/NABTEB exam boards, VAT, labor law)
- [x] Implement comprehensive validators (tax ID, wage, pension, exam grades, address formats)
- [x] Build test dataset generators for load testing (cooperatives, farmers, examinees per jurisdiction)
- [x] Create integration guide for Django backends and Next.js frontends
- [x] Document launch checklist per jurisdiction
- [x] Package.json + exports for seamless app integration

**Evidence Files**:
- `packages/platform-jurisdiction-compliance/src/policies.ts` (Kenya/Uganda/Nigeria policy objects with tax, labor, pension, exam board data)
- `packages/platform-jurisdiction-compliance/src/validators.ts` (20+ validators for compliance rules)
- `packages/platform-jurisdiction-compliance/src/test-datasets.ts` (test data generators for load testing)
- `packages/platform-jurisdiction-compliance/src/index.ts` (factory functions, feature flags, launch checklists)
- `packages/platform-jurisdiction-compliance/package.json` (package metadata)
- `packages/platform-jurisdiction-compliance/INTEGRATION_GUIDE.md` (comprehensive backend/frontend integration)
- `packages/platform-jurisdiction-compliance/src/test-datasets.ts` (LI-size test cooperative/farmer/examinee generators)

**Integration Points**:
- Agrimo Django backend: Use `JurisdictionConfig.get_tax_rate()` for harvest pricing
- Agrimo Next.js frontend: Use `useJurisdictionPolicy()` hook for form validation
- NACP backend: Use `getNACPExamPolicy()` for exam board rules
- Union Eyes case API: deferred for now (current scope excludes African-jurisdiction rollout in UE)

**Coordination Notes**: Legal team to review policy objects for regulatory accuracy before deployment  
**Effort**: 6–8 hours  
**PR Template**: `feat: Multi-jurisdiction compliance framework (Kenya, Uganda, Nigeria) with validators and test data`

---

### P1-3: African Localization (Swahili, Arabic, Hausa)
**Issue**: i18n scaffold supports en/fr; Swahili, Arabic, Hausa missing for Africa market.  
**Impact**: User adoption bottleneck in East/West/North Africa; poor NRR without native-language UX.  
**Status**: IN PROGRESS (Zonga-first rollout)  
**Work**:
- [x] Create message keys for Swahili, Arabic, Hausa in Zonga (`sw-KE`, `ha-NG`, `ar`)
- [ ] Hire native translators for each language
- [x] Add locale selectors to app navigation (Zonga language switcher includes `sw`, `ha`, `ar`)
- [x] Test RTL support for Arabic (Zonga locale layout sets `dir=rtl` for Arabic)
- [ ] Add i18n workflow to CI (missing translation keys catch)
- [ ] Localize copy in Agrimo, NACP, UE (after Zonga-first validation)

**Evidence Files**: `apps/zonga/messages/sw-KE.json`, `apps/zonga/messages/ha-NG.json`, `apps/zonga/messages/ar.json`, `apps/zonga/i18n.ts`, `apps/zonga/components/language-switcher.tsx`, `apps/zonga/app/[locale]/layout.tsx`  
**Coordination**: UX + Ops  
**Effort**: 3–4 days (+ translator time)  
**PR Template**: `feat: Swahili, Arabic, Hausa localization`

---

## P2: Nice-to-Have Items (Next Quarter)

### P2-1: Semantic Versioning Enforcement
**Issue**: Package versioning not strictly enforced; potential accidental breaking changes.  
**Impact**: Low (contract tests catch most breaks); but nice-to-have for publishing standard.  
**Work**:
- [ ] Add `@changesets/cli` pre-commit check
- [ ] Document semver rules in CONTRIBUTING.md
- [ ] Add CI gate to reject non-compliant changelog entries

**Effort**: 1 day  
**PR Template**: `chore: Enforce semantic versioning in CI`

---

### P2-2: Docs Alignment (Semantic Search UI)
**Issue**: UI language mentions "40/60 weighting"; implementation is RRF fusion (different semantics).  
**Impact**: User confusion; docs debt only (not functional risk).  
**Work**:
- [ ] Update `packages/platform-semantic-search/README.md` to document RRF fusion
- [ ] Update `apps/platform-admin/app/search/page.tsx` UI helper text
- [ ] Add scoring explanation to search results UI

**Effort**: 0.5 days  
**PR Template**: `docs: Align semantic search UI wording with RRF fusion`

---

### P2-3: AI Graceful Degradation Patterns (Fallback #2)
**Issue**: Beyond circuit breaker, implement explicit fallback strategies (e.g., cached results, rules-based).  
**Impact**: Very low GEN scenarios; optional for MVP.  
**Work**:
- [ ] Design LRU cache for frequent queries
- [ ] Implement rules-based fallback for simple intents (e.g., "list members" → SQL only)
- [ ] Document fallback decision tree

**Depends On**: P0-1 completion  
**Effort**: 2 days  
**PR Template**: `feat: AI fallback strategies (caching + rules-based)`

---

## Validation Checklist

- [ ] P0-1 + P0-2 complete and tested
- [ ] P1-1 load tests show <2s p95 latency at 10K VUs
- [ ] P1-2 compliance framework deployed; jurisdiction checklist signed off
- [ ] P1-3 localizations reviewed by native speakers
- [ ] Blindspots Assessment re-validated (Q2 review)

---

## Success Metrics

| Metric | Target | Evidence |
|--------|--------|----------|
| AI Provider Fallback | 99.9% uptime during provider outages | CloudWatch logs show zero audit sealing failures |
| Governance Persistence | 100% audit compliance | Query governance DB for all decisions in past 90 days |
| Load Projection | <2s p95 latency @ 10K VUs | k6 report artifact in CI |
| Compliance Audit | 100% coverage | Jira checklist by region |
| Localization | All targeted apps translated | i18n CI check passes |

---

**Next Review**: 2026-05-14 (Sprint end)  
**Escalation**: If P0 items not complete by 2026-04-25, flag to exec steering.
