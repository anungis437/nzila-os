/**
 * Union Eyes Workspace — canonical configuration.
 *
 * Single source of truth for the seven workspace tabs (Club360-style pattern).
 * Mirrors docs/workspace/UNION_EYES_TAB_SCHEMA.md — keep both in sync.
 *
 * Doctrine: docs/workspace/UNION_EYES_WORKSPACE_DOCTRINE.md
 */

export const WORKSPACE_ID = "union-eyes" as const;

export type WorkspaceTabId =
  | "overview"
  | "case-operations"
  | "members"
  | "governance"
  | "continuity"
  | "financial"
  | "documents";

/**
 * Client-emittable workspace telemetry events. These are the ONLY events the
 * client emitter and the telemetry endpoint accept. See
 * UNION_EYES_TELEMETRY_SCHEMA.md.
 */
export const WORKSPACE_CLIENT_TELEMETRY_EVENTS = [
  "workspace.view",
  "tab.view",
  "deep_work.clicked",
  "legacy_page.visited",
] as const;

/**
 * Derived-only events. These are NEVER emitted by the client — they are
 * computed server-side / analytically from repeated client events. Emitting
 * them from the client would turn a claim into self-reported evidence.
 */
export const WORKSPACE_DERIVED_TELEMETRY_EVENTS = [
  "absorbed_by_workspace",
] as const;

/** All workspace telemetry events (client + derived). */
export const WORKSPACE_TELEMETRY_EVENTS = [
  ...WORKSPACE_CLIENT_TELEMETRY_EVENTS,
  ...WORKSPACE_DERIVED_TELEMETRY_EVENTS,
] as const;

export type WorkspaceClientTelemetryEvent =
  (typeof WORKSPACE_CLIENT_TELEMETRY_EVENTS)[number];
export type WorkspaceDerivedTelemetryEvent =
  (typeof WORKSPACE_DERIVED_TELEMETRY_EVENTS)[number];
export type WorkspaceTelemetryEvent = (typeof WORKSPACE_TELEMETRY_EVENTS)[number];

/** Allow-listed telemetry payload keys (defense-in-depth, PII-free). */
export const WORKSPACE_TELEMETRY_PAYLOAD_KEYS = [
  "workspace",
  "tab",
  "route",
  "timestamp",
] as const;

export type WorkspaceTelemetryPayloadKey =
  (typeof WORKSPACE_TELEMETRY_PAYLOAD_KEYS)[number];

/** A single Current State signal. Renders an honest empty state until wired. */
export interface WorkspaceStateSignal {
  /** Human label for the signal (e.g. "Open cases"). */
  label: string;
  /** Honest empty state shown until a canonical data source is connected. */
  emptyState: string;
}

/** A Deep Work link to an existing legacy route. Stored WITHOUT locale prefix. */
export interface WorkspaceDeepWorkLink {
  label: string;
  /** Route path without locale prefix, e.g. "/dashboard/cases". */
  href: string;
}

export interface WorkspaceTabConfig {
  id: WorkspaceTabId;
  /** Tab label shown in the tab strip. */
  label: string;
  /** The one operational question this tab answers. */
  question: string;
  /** Current State signals (honest empty states until canonical sources exist). */
  currentState: WorkspaceStateSignal[];
  /** Required Actions section copy. */
  requiredActions: { emptyState: string };
  /** Deep Work links into existing legacy execution surfaces. */
  deepWork: WorkspaceDeepWorkLink[];
}

export const WORKSPACE_TABS: readonly WorkspaceTabConfig[] = [
  {
    id: "overview",
    label: "Overview",
    question: "How healthy is the union today?",
    currentState: [
      { label: "Open cases", emptyState: "Awaiting first case data." },
      { label: "Active grievances", emptyState: "Awaiting first grievance data." },
      { label: "Outstanding actions", emptyState: "No outstanding actions connected yet." },
      { label: "Upcoming governance events", emptyState: "No governance events connected yet." },
      { label: "Continuity alerts", emptyState: "Awaiting continuity assessment." },
      { label: "Recent document activity", emptyState: "No document activity connected yet." },
    ],
    requiredActions: {
      emptyState: "No cross-surface attention items connected yet.",
    },
    // Overview invariant: Overview SUMMARIZES every tab but does not own any
    // deep workflow directly. Each link below points at a route already owned
    // by another tab (Cases→Case Operations, Members→Members,
    // Continuity→Continuity, Governance→Governance, Documents→Documents).
    deepWork: [
      { label: "Cases", href: "/dashboard/cases" },
      { label: "Members", href: "/dashboard/members" },
      { label: "Continuity", href: "/organizational-continuity-risk" },
      { label: "Governance", href: "/dashboard/governance" },
      { label: "Documents", href: "/dashboard/documents" },
    ],
  },
  {
    id: "case-operations",
    label: "Case Operations",
    question: "What representation work requires attention?",
    currentState: [
      { label: "Open cases", emptyState: "Awaiting first case data." },
      { label: "Active grievances", emptyState: "Awaiting first grievance data." },
      { label: "Investigations", emptyState: "No investigations connected yet." },
      { label: "Appeals", emptyState: "No appeals connected yet." },
    ],
    requiredActions: {
      emptyState: "No representation work flagged for attention yet.",
    },
    deepWork: [
      { label: "Cases", href: "/dashboard/cases" },
      { label: "Claims", href: "/dashboard/claims" },
      { label: "Grievances", href: "/dashboard/grievances" },
      { label: "Intake Queue", href: "/dashboard/inbox?type=intake" },
      { label: "Priorities", href: "/dashboard/priorities" },
    ],
  },
  {
    id: "members",
    label: "Members",
    question: "What is the state of member service and representation?",
    currentState: [
      { label: "Member roster", emptyState: "No member roster connected yet." },
      { label: "Representation status", emptyState: "Awaiting representation data." },
      { label: "Member service requests", emptyState: "No member service requests connected yet." },
    ],
    requiredActions: {
      emptyState: "No member service items flagged for attention yet.",
    },
    deepWork: [
      { label: "Members roster", href: "/dashboard/members" },
      { label: "Member service", href: "/dashboard/member" },
      { label: "Stewards", href: "/dashboard/stewards" },
      { label: "Member requests (Inbox)", href: "/dashboard/inbox" },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    question: "Can leadership explain and defend institutional decisions?",
    currentState: [
      { label: "Policies", emptyState: "No policies connected yet." },
      { label: "Meetings & resolutions", emptyState: "No governance records connected yet." },
      { label: "Compliance posture", emptyState: "Awaiting compliance data." },
      { label: "Decision records", emptyState: "No decision records connected yet." },
    ],
    requiredActions: {
      emptyState: "No governance items flagged for attention yet.",
    },
    deepWork: [
      { label: "Governance", href: "/dashboard/governance" },
      { label: "Governance Center", href: "/dashboard/governance-center" },
      { label: "Compliance", href: "/dashboard/compliance" },
      { label: "Audits & Evidence", href: "/dashboard/audits" },
      { label: "Committees", href: "/dashboard/committees" },
      { label: "Elections", href: "/dashboard/elections" },
    ],
  },
  {
    id: "continuity",
    label: "Continuity",
    question: "Where is organizational continuity at risk?",
    currentState: [
      { label: "Continuity risk profile", emptyState: "Awaiting continuity assessment." },
      { label: "Officer transitions", emptyState: "No officer transitions connected yet." },
      { label: "Institutional memory capture", emptyState: "No knowledge capture connected yet." },
      { label: "Recommendations", emptyState: "No continuity recommendations connected yet." },
    ],
    requiredActions: {
      emptyState: "No continuity risks flagged for attention yet.",
    },
    deepWork: [
      { label: "OCRA — Organizational Continuity Risk", href: "/organizational-continuity-risk" },
      { label: "OCI — Institutional Continuity Risk", href: "/institutional-continuity-risk" },
      { label: "Continuity Assessment", href: "/continuity-assessment/start" },
      { label: "Continuity Intelligence", href: "/dashboard/continuity-intelligence" },
      { label: "Continuity Planning", href: "/dashboard/continuity-planning" },
      { label: "Institutional Memory", href: "/dashboard/institutional-memory" },
      { label: "Knowledge Transfer", href: "/dashboard/knowledge-transfer" },
      { label: "Leadership Continuity", href: "/dashboard/leadership" },
      { label: "Governance Recommendations", href: "/dashboard/governance-recommendations" },
    ],
  },
  {
    id: "financial",
    label: "Financial",
    question: "What financial obligations and signals require attention?",
    currentState: [
      { label: "Dues status", emptyState: "Awaiting dues data." },
      { label: "Revenue & budgets", emptyState: "No financial data connected yet." },
      { label: "Forecasts", emptyState: "No forecasts connected yet." },
      { label: "Payment status", emptyState: "No payment data connected yet." },
    ],
    requiredActions: {
      emptyState: "No financial obligations flagged for attention yet.",
    },
    deepWork: [
      { label: "Dues", href: "/dashboard/dues" },
      { label: "Finance", href: "/dashboard/finance" },
      { label: "Financial", href: "/dashboard/financial" },
      { label: "Strike Fund", href: "/dashboard/strike-fund" },
      { label: "Pension", href: "/dashboard/pension" },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    question: "Can critical organizational information be located and trusted?",
    currentState: [
      { label: "Document repository", emptyState: "No documents connected yet." },
      { label: "Collective agreements", emptyState: "No agreements connected yet." },
      { label: "Templates & retention", emptyState: "No templates connected yet." },
      { label: "Evidence files", emptyState: "No evidence files connected yet." },
    ],
    requiredActions: {
      emptyState: "No document items flagged for attention yet.",
    },
    deepWork: [
      { label: "Documents", href: "/dashboard/documents" },
      { label: "Agreements", href: "/dashboard/agreements" },
      { label: "Clause Library", href: "/dashboard/clause-library" },
      { label: "Knowledge Base", href: "/dashboard/knowledge-base" },
      { label: "Precedents", href: "/dashboard/precedents" },
    ],
  },
] as const;

export const DEFAULT_WORKSPACE_TAB: WorkspaceTabId = "overview";

export function getWorkspaceTab(id: string): WorkspaceTabConfig | undefined {
  return WORKSPACE_TABS.find((tab) => tab.id === id);
}

/**
 * The complete set of known static deep-work routes (locale-free, query-free).
 * Telemetry `route` values must be one of these — anything else is dropped so
 * that instance routes carrying case/member identifiers can never be recorded.
 */
export const WORKSPACE_KNOWN_ROUTES: ReadonlySet<string> = new Set(
  WORKSPACE_TABS.flatMap((tab) => tab.deepWork.map((link) => link.href.split("?")[0])),
);

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT = /^\d+$/;
const LONG_HEX_SEGMENT = /^[0-9a-f]{12,}$/i;

/**
 * Returns true only for safe, static workspace routes.
 *
 * Rejects:
 *  - non-absolute routes
 *  - any segment that looks like a UUID, a numeric id, or a long hex id
 *  - routes deeper / different from the known static route set
 *
 * This protects telemetry against accidentally leaking case or member
 * identifiers via dynamic routes. See UNION_EYES_TELEMETRY_SCHEMA.md.
 */
export function isAllowedTelemetryRoute(route: string): boolean {
  if (typeof route !== "string" || !route.startsWith("/")) return false;
  const path = route.split("?")[0];

  for (const segment of path.split("/").filter(Boolean)) {
    if (UUID_SEGMENT.test(segment)) return false;
    if (NUMERIC_SEGMENT.test(segment)) return false;
    if (LONG_HEX_SEGMENT.test(segment)) return false;
  }

  // Must be a known static workspace route — never a deeper/instance route.
  return WORKSPACE_KNOWN_ROUTES.has(path);
}

