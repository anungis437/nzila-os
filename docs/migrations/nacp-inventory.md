# NACP Legacy App — Inventory Report

> **Source**: `C:\APPS\legacy\nacp` (read-only, DO NOT import)
> **Scanned**: 2026-02-24
> **Status**: Phase 0 — Inventory complete, migrated to NzilaOS (apps/nacp-exams)

---

## 1. Framework & Tech Stack (Legacy — Pre-Migration)

| Layer | Technology |
|---|---|
| Platform | **Base44** (low-code PaaS) — LEGACY, migrated to NzilaOS |
| Frontend | React 18 + Vite 6 + React Router 6 (SPA) |
| State/Data | TanStack React Query v5 — all pages fetched via `base44.entities.*.list()` (removed) |
| UI | Radix UI + Tailwind CSS 3 + shadcn/ui pattern |
| Serverless | **Deno** (`Deno.serve`) — 44 TypeScript cloud functions via `@base44/sdk@0.8.6` (removed) |
| Forms | react-hook-form + zod |
| Charts | Recharts |
| Maps | react-leaflet |
| PDF | jspdf + html2canvas |
| Payments | Stripe (react-stripe-js) |

---

## 2. Auth Model (Legacy)

- Was delegated to Base44 SDK: `base44.auth.me()`, `base44.auth.logout()`, `base44.auth.redirectToLogin()` — **now Clerk**
- Token-based (passed via `appParams.token`) with React Context wrapper (`AuthContext.jsx`)
- Role checks are **string-based** (`user?.role !== 'admin'`) — no RBAC middleware
- Frontend `RoleGuard` component for page-level gating
- MFA functions exist but were custom implementations on top of Base44 — **now Clerk MFA**
- `requiresAuth: false` on client — auth is optional at SDK level

---

## 3. Data Models (Entities)

All entities were defined in Base44 backend (no local schema files). Now in `packages/nacp-core`.
Inferred from usage:

| Domain | Entities |
|---|---|
| Registry | `Candidate`, `School`, `Center` |
| Exams | `ExamSession`, `Subject`, `TestCase` |
| Marking | `Script`, `Mark`, `MarkingBatch`, `ModerationReview` |
| Results | `CompiledResult`, `PublicationEvent`, `Appeal`, `ApprovalStage` |
| Materials | `MaterialRelease`, `ShipmentTracking`, `ChainOfCustodyLog` |
| Admin | `User`, `Role`, `AuditEvent`, `Incident`, `Report` |
| Operational | `HelpDesk`, `KnowledgeBase`, `Runbook` |

Key PII fields: `national_id`, `birth_certificate_number`, `fingerprint_hash`, `biometric_photo_url`.  
Result fields: `total_marks`, `final_grade`, `certificate_hash`.

---

## 4. Serverless Functions (44 Total)

| Category | Functions |
|---|---|
| Security | `securityAudit`, `encryptPII`, `sessionManagement`, `setupMFA`, `setupCandidateMFA`, `gdprCompliance`, `rateLimiter`, `predictiveFraudDetection` |
| Exam Processing | `processOMR`, `processHandwriting`, `faceRecognition`, `biometricCapture` |
| Results & Reports | `generateCertificate`, `generateResultsReport`, `generateExaminerReport`, `generateAttendanceReport`, `notifyResults`, `calculatePerformanceMetrics` |
| Audit | `enhanceAuditChain`, `monitoringLogger` |
| Analytics/AI | `detectAnomalies`, `detectAnomaliesML`, `analyzeIncidents`, `analyzeUsageTrends`, `assessBenchmark`, `predictCapacityNeeds`, `generateRecommendations`, `semanticSearchKB`, `suggestKBArticles`, `suggestRunbook`, `generateArticleSummary`, `detectHelpDeskAnomalies` |
| Infra/Ops | `backupDatabase`, `backupRestore`, `archiveOldData`, `autoApplyRunbook`, `getDashboardStats`, `globalSearch`, `publicAPI`, `webhookManager`, `configureSMS`, `sendSMSNotification`, `linkArticlesToTickets` |

---

## 5. Integrations

| Integration | Usage |
|---|---|
| Former Base44 Core SDK | Entity CRUD, file upload, email, LLM invocation — replaced by @nzila/* |
| Former Base44 LLM (AI) | OMR processing uses `InvokeLLM` — replaced by @nzila/ai-sdk |
| Stripe | Exam fee payment (deps present) |
| SMS | `configureSMS.ts`, `sendSMSNotification.ts` — vendor unclear |
| IndexedDB | Offline sync for chain-of-custody and signature capture |
| Web Crypto API | SHA-256 hashing (certificates, audit chain), AES-GCM (PII) |
| Webhooks | Outbound webhook dispatch via `webhookManager.ts` |

---

## 6. Risky Patterns

| Risk | Severity |
|---|---|
| No local schema/types — all entity shapes implicit | **HIGH** |
| `base44.entities.*` called directly in components — vendor lock-in (REMOVED) | **HIGH** |
| `console.error` in every catch block — information leakage | **HIGH** |
| `requiresAuth: false` on client — auth optional at SDK level | **HIGH** |
| String-based role checks — no enum, no middleware | **MEDIUM** |
| No pagination — `.list()` with no limit | **MEDIUM** |
| Offline sync with no conflict resolution or idempotency | **MEDIUM** |
| PII encryption is app-level (no key rotation, no HSM) | **HIGH** |
| LLM-as-OCR for OMR — non-deterministic, no fallback | **HIGH** |
| Audit chain rebuild action defeats tamper-evidence | **HIGH** |
| Certificate "blockchain" is cosmetic — no real ledger | **MEDIUM** |
| Zero test files | **HIGH** |

---

## 7. Extraction Plan

### Extract (rebuild in NzilaOS)

| Asset | Target |
|---|---|
| Entity schemas (Candidate, ExamSession, Subject, Script, Mark, CompiledResult) | `packages/nacp-core` (Zod + TS interfaces) |
| OMR / marking workflow logic | `packages/nacp-core` service layer |
| Exam session state machine (scheduled→opened→in_progress→sealed→exported→closed) | `packages/nacp-core/src/machines/` |
| Certificate generation & verification | `packages/nacp-core` with proper hash verification |
| Chain of custody + offline sync pattern | `packages/nacp-core` with idempotency keys |
| Audit trail model | Use existing `@nzila/commerce-audit` pattern |
| Security audit compliance checks | `governance/security/` policies |

### Discard

| Asset | Reason |
|---|---|
| Base44 SDK dependency | Proprietary PaaS lock-in (REMOVED) |
| Fake "blockchain" hashing | Security theater — replace with HMAC + append-only audit |
| Audit chain rebuild action | Defeats tamper-evidence |
| LLM-based OMR | Non-deterministic — replace with proper OMR pipeline |
| String-based role checks | Replace with typed RBAC from NzilaOS org package |
| `moment.js` + `three.js` | Unused/duplicate — remove |
| Base44 pages.config.js scaffold | Replaced with NzilaOS routing |
| App-level PII encryption | Replace with DB-level encryption or envelope encryption |
