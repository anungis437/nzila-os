# CFO Legacy Migration Tracker

> **Source**: `C:/apps/legacy/cfo` (Vite 6 + React 18 SPA, formerly Base44 SDK — migrated to NzilaOS)
> **Target**: `apps/cfo/` (Next.js 16, React 19, TypeScript, Clerk Auth)
> **Brand**: LedgerIQ — AI-Powered Virtual CFO Platform

---

## Quick Stats

| Metric | Count |
|---|---|
| Total source files | 134 |
| Total LOC (approx) | ~14,672 |
| Pages | 19 |
| Custom components | 54 |
| shadcn/ui components | 49 |
| Legacy Base44 entities | 18 |
| Legacy Base44 integrations | 6 |
| console.error/log instances | ~72 across 35 files |

---

## Legacy Base44 Entities → API Migration

All entities below used `@base44/sdk` `createClient().entities.EntityName` pattern (now migrated).
Each must be migrated to a proper API layer backed by the monorepo's database/services.

| Entity | Legacy Usage | Target API | Status |
|---|---|---|---|
| Account | Ledger, Dashboard | `api/accounts` | ⬜ Not started |
| AdvisoryReport | Reports, ClientDetail | `api/advisory-reports` | ⬜ Not started |
| AIInsight | AIInsights page | `api/ai-insights` | ⬜ Not started |
| Alert | Alerts page | `api/alerts` | ⬜ Not started |
| AuditLog | Audit page | `api/audit-logs` | ⬜ Not started |
| BackupRecord | Security page | `api/backup-records` | ⬜ Not started |
| ChatSession | Messages page | `api/chat-sessions` | ⬜ Not started |
| Client | Clients, ClientDetail, Dashboard | `api/clients` | ⬜ Not started |
| ClientAccess | ClientPortal page | `api/client-access` | ⬜ Not started |
| Document | Documents page | `api/documents` | ⬜ Not started |
| Firm | Settings, PlatformAdmin | `api/firms` | ⬜ Not started |
| IncidentResponse | Security page | `api/incidents` | ⬜ Not started |
| IndustryTemplate | Settings page | `api/industry-templates` | ⬜ Not started |
| Integration | Integrations page | `api/integrations` | ⬜ Not started |
| Journal / JournalEntry | Ledger page | `api/journals` | ⬜ Not started |
| Note | ClientDetail | `api/notes` | ⬜ Not started |
| Notification | Notifications component | `api/notifications` | ⬜ Not started |
| SecurityEvent | Security page | `api/security-events` | ⬜ Not started |
| Task | Tasks page | `api/tasks` | ⬜ Not started |
| User | Layout, Settings | Clerk (AuthN) + `api/users` (profile) | ⬜ Not started |
| WorkflowInstance | WorkflowExecution | `api/workflow-instances` | ⬜ Not started |
| WorkflowTemplate | WorkflowBuilder | `api/workflow-templates` | ⬜ Not started |

## Legacy Base44 Integrations → Service Migration

| Integration | Legacy Usage | Target Service | Status |
|---|---|---|---|
| InvokeLLM | AdvisoryAI, AIInsights, Reports | `@nzila/ai-sdk` | ⬜ Not started |
| SendEmail | Tasks, Alerts, Notifications | `@nzila/commerce-events` | ⬜ Not started |
| UploadPrivateFile | Documents | `@nzila/blob` | ⬜ Not started |
| UploadFile | Documents, ClientDetail | `@nzila/blob` | ⬜ Not started |
| CreateFileSignedUrl | Documents | `@nzila/blob` | ⬜ Not started |
| ExtractDataFromUploadedFile | Documents, Ledger | `@nzila/ai-sdk` | ⬜ Not started |

---

## Pages Migration Status

| Page | Legacy File | Key Components | Status |
|---|---|---|---|
| Dashboard | `pages/Dashboard.jsx` | StatsCard, RecentActivity, QuickActions, MetricsChart, ClientOverview | ⬜ Not started |
| Clients | `pages/Clients.jsx` | ClientCard, ClientFilters | ⬜ Not started |
| ClientDetail | `pages/ClientDetail.jsx` | 11 sub-components (Overview, Financials, Documents, etc.) | ⬜ Not started |
| ClientPortal | `pages/ClientPortal.jsx` | PortalHeader, SharedDocuments, RequestForm | ⬜ Not started |
| Documents | `pages/Documents.jsx` | DocumentList, UploadDialog, FolderTree | ⬜ Not started |
| Ledger | `pages/Ledger.jsx` | JournalEntryTable, AccountsPane, ReconciliationView | ⬜ Not started |
| Tasks | `pages/Tasks.jsx` | TaskBoard, TaskCard, TaskFilters | ⬜ Not started |
| Reports | `pages/Reports.jsx` | ReportGenerator, ReportViewer, ExportOptions | ⬜ Not started |
| Settings | `pages/Settings.jsx` | FirmSettings, UserPrefs, IntegrationConfig | ⬜ Not started |
| Messages | `pages/Messages.jsx` | ChatList, ChatWindow, MessageBubble | ⬜ Not started |
| AdvisoryAI | `pages/AdvisoryAI.jsx` | AIChat, InsightsFeed, PromptTemplates | ⬜ Not started |
| AIInsights | `pages/AIInsights.jsx` | InsightCard, TrendChart, ActionRecommendations | ⬜ Not started |
| Alerts | `pages/Alerts.jsx` | AlertList, AlertDetail, AlertRules | ⬜ Not started |
| Audit | `pages/Audit.jsx` | AuditTimeline, AuditFilters | ⬜ Not started |
| Integrations | `pages/Integrations.jsx` | IntegrationCard, ConnectFlow | ⬜ Not started |
| Security | `pages/Security.jsx` | SecurityDashboard, IncidentLog, BackupStatus | ⬜ Not started |
| PlatformAdmin | `pages/PlatformAdmin.jsx` | AdminDashboard, FirmManagement | ⬜ Not started |
| WorkflowBuilder | `pages/WorkflowBuilder.jsx` | WorkflowCanvas, NodePalette, FlowEditor | ⬜ Not started |
| WorkflowExecution | `pages/WorkflowExecution.jsx` | ExecutionLog, StepStatus | ⬜ Not started |

---

## Security Findings (Must Fix Before Production)

| Finding | Severity | Details | Status |
|---|---|---|---|
| Token in localStorage | HIGH | Auth token stored in localStorage — XSS risk | ⬜ Fixed by Clerk migration |
| Token via URL params | HIGH | Token passed in URL query string | ⬜ Fixed by Clerk migration |
| requiresAuth: false routes | MEDIUM | Some routes skip auth entirely | ⬜ Fixed by middleware.ts |
| Demo fallback user | MEDIUM | Layout falls back to demo user if no auth | ⬜ Fixed by Clerk migration |
| Hardcoded mock client IDs | LOW | Test data IDs embedded in components | ⬜ Not started |
| Hardcoded demo emails | LOW | Demo email addresses in code | ⬜ Not started |

---

## SSR-Breaking Patterns (Must Fix for Next.js)

| Pattern | Occurrences | Fix Strategy |
|---|---|---|
| `window.location` | Multiple | Use Next.js `useRouter()` / `usePathname()` |
| `window.history` | Several | Use Next.js router |
| `window.open` | Several | Use `<Link target="_blank">` or server action |
| `window.confirm` | Several | Use dialog component |
| `window.matchMedia` | Several | Use `useMediaQuery` hook with SSR guard |
| `window.localStorage` | Multiple | Replace with Clerk session / cookies |
| `document.getElementById` | Several | Use React refs |
| `window.self !== window.top` | 1 | Remove iframe detection |

---

## Dependency Rationalization

| Legacy Dep | Keep / Replace | Notes |
|---|---|---|
| `moment` | ❌ Remove | Replace with `date-fns` (already in target) |
| `react-hot-toast` | ❌ Remove | Use `sonner` (monorepo standard) |
| `three.js` | ❌ Remove | Barely used, not needed |
| `date-fns` | ✅ Keep | Already in target deps |
| `recharts` | ✅ Keep | Already in target deps |
| `lucide-react` | ✅ Keep | Already in target deps |
| `framer-motion` | ✅ Keep | Already in target deps |
| `zod` | ✅ Keep | Already in target deps |
| `react-router-dom` | ❌ Remove | Replaced by Next.js App Router |
| `@base44/sdk` | ❌ Removed | Replaced by `@nzila/*` packages |

---

## Migration Priority Order

1. **Phase 1** (Shell — DONE ✅): Config, auth, i18n, marketing page, dashboard layout
2. **Phase 2** (Core Data): Client entity + API, Dashboard page with real data
3. **Phase 3** (Financial Core): Ledger, Accounts, Journal Entries
4. **Phase 4** (Documents): Upload, storage, signed URLs via `@nzila/blob`
5. **Phase 5** (AI Features): Advisory AI, Insights via `@nzila/ai-sdk`
6. **Phase 6** (Collaboration): Tasks, Messages, Alerts, Notifications
7. **Phase 7** (Admin): Settings, Security, PlatformAdmin, Audit
8. **Phase 8** (Advanced): WorkflowBuilder, WorkflowExecution
9. **Phase 9** (Hardening): Full security audit, performance, accessibility
