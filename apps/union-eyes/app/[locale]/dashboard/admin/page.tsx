"use client";

/**
 * Platform administration console.
 *
 * Every figure and list here is read from a route that backs it (/api/admin/stats/*, /api/admin/users, /api/admin/organizations,
 * /api/admin/database/*), and every one of those routes needs platform authority. A request that fails is shown as the failure it
 * is, with the reason the route gives, never as "..." or "No users found". What the application does not have behind it (system
 * settings, a security overview, a reports hub) says so with CapabilityUnavailable instead of showing switches, counts or an audit
 * trail that nothing produces.
 */

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from 'next-intl';
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { CapabilityUnavailable } from "@/components/system/capability-unavailable";
import { ApiShapeError, envelopeData, isRecord, readApiError } from "@/lib/client/api-envelope";
import {
  Users,
  Settings,
  Shield,
  BarChart3,
  Database,
  Building2,
  FileText,
  Search,
  Trash2,
  Activity,
  RefreshCw,
  Sparkles,
  Loader2,
  AlertCircle,
} from "lucide-react";

type AdminSection =
  | "overview"
  | "users"
  | "locals"
  | "system"
  | "security"
  | "reports"
  | "database"
  | "ai-testing";

interface PlatformStats {
  /** null: not measured here. A count of every organization's roster is tenant content, not a platform entitlement (#1118). */
  totalMembers: number | null;
  activeOrganizations: number;
  totalOrganizations: number;
  totalStorage: number;
  /** null: not measured here, as totalMembers. */
  activeToday: number | null;
}

interface ActivityItem {
  id: string;
  description: string;
  timestamp: string | null;
}

/** An organization's tenancy record: no member counts, officer names or contacts, which are its content (#1116). */
interface LocalSection {
  id: string;
  number: string | null;
  name: string;
  region: string | null;
  status: string;
}

interface SystemUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
  organizationId: string;
  organizationName: string;
  status: string;
}

interface DatabaseHealth {
  dbSizeMb: number;
  activeConnections: number;
  tableCount: number;
  checkedAt: string | null;
  tenantUser: string | null;
  systemUser: string | null;
}

// GET /api/admin/users refuses a search shorter than this (lib/platform/user-directory.ts, kept here because that module is server code).
const MIN_USER_SEARCH = 3;

// The hub's entries: where each goes, and the catalog key (adminConsolePage.hub.<key>) that words it.
const HUB_LINKS = [
  { key: "checklist", href: "/dashboard/admin/onboarding" },
  { key: "invites", href: "/dashboard/admin/members" },
  { key: "structure", href: "/dashboard/structure" },
  { key: "taxonomy", href: "/dashboard/admin/members" },
] as const;

type LoadSubject = "stats" | "activity" | "users" | "locals" | "health";

/** The page's own words, from the message catalogs (adminConsolePage), in the language of the page. */
function useCopy() {
  const t = useTranslations("adminConsolePage");
  return {
    retry: t("retry"),
    loading: t("loading"),
    notRecorded: t("notRecorded"),
    couldNotLoad: (subject: LoadSubject) => t(`${subject}Failed`),
    membersChanged: (count: number) => t("membersChanged", { count }),
    orgsTotal: (count: number) => t("orgsTotal", { count }),
    databaseSize: t("databaseSize"),
    databaseSizeNote: t("databaseSizeNote"),
    noActivity: t("noActivity"),
    searchTooShort: t("searchTooShort", { min: MIN_USER_SEARCH }),
    noUsers: t("noUsers"),
    usersScopeNote: t("usersScopeNote"),
    noOrganizations: t("noOrganizations"),
    directoryOnlyNote: t("directoryOnlyNote"),
    organization: t("organization"),
    removeUser: t("removeUser"),
    toggleStatus: t("toggleStatus"),
    confirmRemove: t("confirmRemove"),
    userRemoved: t("userRemoved"),
    statusUpdated: t("statusUpdated"),
    removeFailed: t("removeFailed"),
    statusFailed: t("statusFailed"),
    setupHubTitle: t("setupHubTitle"),
    setupHubBody: t("setupHubBody"),
    hub: HUB_LINKS.map((entry) => ({ href: entry.href, title: t(`hub.${entry.key}.title`), body: t(`hub.${entry.key}.body`) })),
    databaseTitle: t("databaseTitle"),
    activeConnections: t("activeConnections"),
    tables: t("tables"),
    checkedAt: t("checkedAt"),
    connectedAs: t("connectedAs"),
    tenantRole: t("tenantRole"),
    systemRole: t("systemRole"),
    refresh: t("refresh"),
    optimizeTitle: t("optimizeTitle"),
    optimizeBody: t("optimizeBody"),
    optimize: t("optimize"),
    optimizeDone: t("optimizeDone"),
    optimizeFailed: t("optimizeFailed"),
    systemTitle: t("systemTitle"),
    securityTitle: t("securityTitle"),
    reportsTitle: t("reportsTitle"),
    aiTitle: t("aiTitle"),
    aiBody: t("aiBody"),
  };
}

// ─── What the routes answer with ─────────────────────────────────────────────

const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
/** A count arrives as a number, or as a numeric string when it comes from a SQL aggregate. */
const count = (value: unknown): number | null => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The rows of a list route: withApi answers { success, data: rows }. */
function rowsOf(body: unknown): Record<string, unknown>[] {
  if (!isRecord(body) || !Array.isArray(body.data)) throw new ApiShapeError("no list");
  return body.data.map((row): Record<string, unknown> => {
    if (!isRecord(row)) throw new ApiShapeError("a row that is not a record");
    return row;
  });
}

function readStats(body: unknown): PlatformStats {
  const data = envelopeData(body);
  const totalMembers = count(data.totalMembers);
  const activeOrganizations = count(data.activeOrganizations);
  const totalOrganizations = count(data.totalOrganizations);
  const totalStorage = count(data.totalStorage);
  const activeToday = count(data.activeToday);
  // Member figures may be null (not measured here); the organization and storage figures must be present.
  if ((data.totalMembers !== null && totalMembers === null) || (data.activeToday !== null && activeToday === null) ||
      activeOrganizations === null || totalOrganizations === null || totalStorage === null) {
    throw new ApiShapeError("incomplete statistics");
  }
  return { totalMembers, activeOrganizations, totalOrganizations, totalStorage, activeToday };
}

function readActivity(body: unknown): ActivityItem[] {
  return rowsOf(body).map((row) => {
    const id = text(row.id);
    const description = text(row.description);
    if (!id || !description) throw new ApiShapeError("an activity entry without an id or description");
    return { id, description, timestamp: text(row.timestamp) };
  });
}

function readUsers(body: unknown): SystemUser[] {
  return rowsOf(body).map((row) => {
    const id = text(row.id);
    const name = text(row.name);
    const role = text(row.role);
    const organizationId = text(row.organizationId);
    if (!id || !name || !role || !organizationId) throw new ApiShapeError("a user without the expected fields");
    return {
      id,
      name,
      email: text(row.email),
      role,
      organizationId,
      organizationName: text(row.organizationName) ?? "",
      status: text(row.status) ?? "",
    };
  });
}

function readLocals(body: unknown): LocalSection[] {
  return rowsOf(body).map((row) => {
    const id = text(row.id);
    const name = text(row.name);
    if (!id || !name) throw new ApiShapeError("an organization without the expected fields");
    return {
      id,
      number: text(row.number),
      name,
      region: text(row.region),
      status: text(row.status) ?? "",
    };
  });
}

function readHealth(body: unknown): DatabaseHealth {
  const data = envelopeData(body);
  const dbSizeMb = count(data.dbSizeMb);
  const activeConnections = count(data.activeConnections);
  const tableCount = count(data.tableCount);
  if (dbSizeMb === null || activeConnections === null || tableCount === null) throw new ApiShapeError("incomplete database health");
  const principal = (value: unknown): string | null => (isRecord(value) ? text(value.currentUser) : null);
  return {
    dbSizeMb,
    activeConnections,
    tableCount,
    checkedAt: text(data.checkedAt),
    tenantUser: principal(data.tenantPrincipal),
    systemUser: principal(data.systemPrincipal),
  };
}

interface Remote<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

/** Reads `url` (when there is one) and keeps the outcome: the data, the failure, or neither while it loads. */
function useRemote<T>(url: string | null, read: (body: unknown) => T, reload: number): Remote<T> {
  const [state, setState] = useState<Remote<T>>({ loading: url !== null, error: null, data: null });
  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    const load = async () => {
      setState({ loading: true, error: null, data: null });
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(await readApiError(response, `HTTP ${response.status}`));
        setState({ loading: false, error: null, data: read(await response.json()) });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ loading: false, error: errorText(error), data: null });
      }
    };
    load();
    return () => controller.abort();
  }, [url, read, reload]);
  return state;
}

function LoadFailure({ title, detail, retryLabel, onRetry }: { title: string; detail: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="space-y-2">
          <p className="font-semibold">{title}</p>
          <p>{detail}</p>
          <button onClick={onRetry} className="rounded border border-red-300 bg-white px-3 py-1 font-medium hover:bg-red-100">
            {retryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AI endpoint tester ──────────────────────────────────────────────────────

type CallState =
  | { kind: "idle" }
  | { kind: "running"; label: string }
  | { kind: "done"; status: number; ok: boolean; text: string }
  | { kind: "failed"; message: string };

function useEndpointCall() {
  const [state, setState] = useState<CallState>({ kind: "idle" });
  const run = async (label: string, request: () => Promise<Response>) => {
    setState({ kind: "running", label });
    try {
      const response = await request();
      const raw = await response.text();
      let shown = raw;
      try {
        shown = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        // Not JSON: the answer is shown exactly as received.
      }
      setState({ kind: "done", status: response.status, ok: response.ok, text: shown });
    } catch (error) {
      setState({ kind: "failed", message: errorText(error) });
    }
  };
  return [state, run] as const;
}

function ResultPanel({ state }: { state: CallState }) {
  const t = useTranslations("adminConsolePage");
  if (state.kind === "idle") return null;
  if (state.kind === "running") {
    return <div className="mt-4 rounded-lg bg-gray-100 p-4 font-mono text-xs">{state.label}</div>;
  }
  if (state.kind === "failed") {
    return (
      <pre role="alert" className="mt-4 max-h-64 overflow-auto rounded-lg border border-red-200 bg-red-50 p-4 font-mono text-xs">
        {`${t("ai.networkError")}\n\n${state.message}`}
      </pre>
    );
  }
  return (
    <pre
      role={state.ok ? "status" : "alert"}
      className={`mt-4 max-h-64 overflow-auto rounded-lg border p-4 font-mono text-xs ${
        state.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
      }`}
    >
      {`${state.ok ? t("ai.ok") : t("ai.error")} (${state.status})\n\n${state.text}`}
    </pre>
  );
}

const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500";
const callButtonClass = "rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50";

function AiEndpointTester({ title, body }: { title: string; body: string }) {
  const t = useTranslations("adminConsolePage");
  const [queryId, setQueryId] = useState("");
  const [rating, setRating] = useState("good");
  const [comment, setComment] = useState("");
  const [getQueryId, setGetQueryId] = useState("");
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState("5");
  const [submitted, submit] = useEndpointCall();
  const [fetched, fetchFeedback] = useEndpointCall();
  const [searched, search] = useEndpointCall();

  return (
    <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
          <Sparkles className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600">{body}</p>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h3 className="mb-1 text-lg font-semibold text-gray-900">{t("ai.submitHeading")}</h3>
        <p className="mb-4 text-sm text-gray-600">POST /api/ai/feedback</p>
        <div className="space-y-4">
          <div>
            <label htmlFor="feedback-query-id" className="mb-2 block text-sm font-medium text-gray-700">{t("ai.queryId")}</label>
            <input id="feedback-query-id" value={queryId} onChange={(e) => setQueryId(e.target.value)} placeholder={t("ai.queryIdPlaceholder")} className={inputClass} />
          </div>
          <div>
            <label htmlFor="feedback-rating" className="mb-2 block text-sm font-medium text-gray-700">{t("ai.rating")}</label>
            <select id="feedback-rating" value={rating} onChange={(e) => setRating(e.target.value)} className={inputClass}>
              <option value="good">{t("ai.good")}</option>
              <option value="bad">{t("ai.bad")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="feedback-comment" className="mb-2 block text-sm font-medium text-gray-700">{t("ai.comment")}</label>
            <input id="feedback-comment" value={comment} onChange={(e) => setComment(e.target.value)} className={inputClass} />
          </div>
          <button
            disabled={queryId.trim() === "" || submitted.kind === "running"}
            onClick={() =>
              submit(t("ai.submitting"), () =>
                fetch("/api/ai/feedback", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ query_id: queryId.trim(), rating, comment: comment || undefined }),
                }),
              )
            }
            className={callButtonClass}
          >
            {t("ai.submit")}
          </button>
          <ResultPanel state={submitted} />
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h3 className="mb-1 text-lg font-semibold text-gray-900">{t("ai.getHeading")}</h3>
        <p className="mb-4 text-sm text-gray-600">GET /api/ai/feedback?query_id=...</p>
        <div className="space-y-4">
          <div>
            <label htmlFor="get-feedback-query-id" className="mb-2 block text-sm font-medium text-gray-700">{t("ai.queryId")}</label>
            <input id="get-feedback-query-id" value={getQueryId} onChange={(e) => setGetQueryId(e.target.value)} placeholder={t("ai.queryIdPlaceholder")} className={inputClass} />
          </div>
          <button
            disabled={getQueryId.trim() === "" || fetched.kind === "running"}
            onClick={() =>
              fetchFeedback(t("ai.loadingFeedback"), () =>
                fetch(`/api/ai/feedback?query_id=${encodeURIComponent(getQueryId.trim())}`, { method: "GET", credentials: "include" }),
              )
            }
            className={callButtonClass}
          >
            {t("ai.get")}
          </button>
          <ResultPanel state={fetched} />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h3 className="mb-1 text-lg font-semibold text-gray-900">{t("ai.searchHeading")}</h3>
        <p className="mb-4 text-sm text-gray-600">POST /api/ai/search {t("ai.usesOpenAi")}</p>
        <div className="space-y-4">
          <div>
            <label htmlFor="search-query" className="mb-2 block text-sm font-medium text-gray-700">{t("ai.searchQuery")}</label>
            <input id="search-query" value={query} onChange={(e) => setQuery(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="search-max-results" className="mb-2 block text-sm font-medium text-gray-700">{t("ai.maxResults")}</label>
            <input id="search-max-results" type="number" min="1" max="20" value={maxResults} onChange={(e) => setMaxResults(e.target.value)} className={inputClass} />
          </div>
          <button
            disabled={query.trim() === "" || searched.kind === "running"}
            onClick={() =>
              search(t("ai.searching"), () =>
                fetch("/api/ai/search", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ query: query.trim(), max_results: Number.parseInt(maxResults, 10) }),
                }),
              )
            }
            className={callButtonClass}
          >
            {t("ai.search")}
          </button>
          <ResultPanel state={searched} />
        </div>
      </div>
    </Card>
  );
}

// ─── The page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const t = useTranslations();
  const locale = useLocale();
  const copy = useCopy();
  const numberLocale = locale.toLowerCase().startsWith("fr") ? "fr-CA" : "en-CA";
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [overviewReload, setOverviewReload] = useState(0);
  const [usersReload, setUsersReload] = useState(0);
  const [localsReload, setLocalsReload] = useState(0);
  const [healthReload, setHealthReload] = useState(0);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchQuery.trim()), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchTooShort = search.length > 0 && search.length < MIN_USER_SEARCH;
  const usersUrl = `/api/admin/users${search.length >= MIN_USER_SEARCH ? `?search=${encodeURIComponent(search)}` : ""}`;
  const localsUrl = `/api/admin/organizations${search ? `?search=${encodeURIComponent(search)}` : ""}`;

  const stats = useRemote(activeSection === "overview" ? "/api/admin/stats/overview" : null, readStats, overviewReload);
  const activity = useRemote(activeSection === "overview" ? "/api/admin/stats/activity?limit=10" : null, readActivity, overviewReload);
  const users = useRemote(activeSection === "users" ? usersUrl : null, readUsers, usersReload);
  const locals = useRemote(activeSection === "locals" ? localsUrl : null, readLocals, localsReload);
  const health = useRemote(activeSection === "database" ? "/api/admin/database/health" : null, readHealth, healthReload);

  const handleDeleteUser = async (user: SystemUser) => {
    if (!confirm(copy.confirmRemove)) return;
    setBusy(`delete-${user.id}`);
    try {
      const response = await fetch(`/api/admin/users/${user.id}?organizationId=${encodeURIComponent(user.organizationId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readApiError(response, `HTTP ${response.status}`));
      toast.success(copy.userRemoved);
      setUsersReload((n) => n + 1);
    } catch (error) {
      toast.error(`${copy.removeFailed}: ${errorText(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const handleToggleUserStatus = async (user: SystemUser) => {
    setBusy(`status-${user.id}`);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleStatus" }),
      });
      if (!response.ok) throw new Error(await readApiError(response, `HTTP ${response.status}`));
      toast.success(copy.statusUpdated);
      setUsersReload((n) => n + 1);
    } catch (error) {
      toast.error(`${copy.statusFailed}: ${errorText(error)}`);
    } finally {
      setBusy(null);
    }
  };

  // The route states how much it could analyze; that statement, not a general "completed", is what is reported.
  const handleOptimizeDatabase = async () => {
    setBusy("optimize");
    try {
      const response = await fetch("/api/admin/database/optimize", { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      const message = isRecord(body) ? text(body.message) ?? text(body.error) : null;
      if (response.ok && isRecord(body) && body.success === true) {
        toast.success(message ?? copy.optimizeDone);
        setHealthReload((n) => n + 1);
      } else {
        toast.error(message ?? `${copy.optimizeFailed} (HTTP ${response.status})`);
      }
    } catch (error) {
      toast.error(`${copy.optimizeFailed}: ${errorText(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const adminSections = [
    { id: "overview", label: t('admin.sections.overview'), icon: <BarChart3 className="w-5 h-5" />, color: "bg-blue-100 text-blue-700" },
    { id: "users", label: t('admin.sections.userManagement'), icon: <Users className="w-5 h-5" />, color: "bg-purple-100 text-purple-700" },
    { id: "locals", label: t('admin.sections.localSections'), icon: <Building2 className="w-5 h-5" />, color: "bg-green-100 text-green-700" },
    { id: "system", label: t('admin.sections.systemSettings'), icon: <Settings className="w-5 h-5" />, color: "bg-orange-100 text-orange-700" },
    { id: "security", label: t('admin.sections.security'), icon: <Shield className="w-5 h-5" />, color: "bg-red-100 text-red-700" },
    { id: "reports", label: t('admin.sections.reports'), icon: <FileText className="w-5 h-5" />, color: "bg-indigo-100 text-indigo-700" },
    { id: "database", label: t('admin.sections.database'), icon: <Database className="w-5 h-5" />, color: "bg-pink-100 text-pink-700" },
    { id: "ai-testing", label: t('admin.sections.aiTesting'), icon: <Sparkles className="w-5 h-5" />, color: "bg-purple-100 text-purple-700" },
  ];

  const roleConfig: Record<string, { label: string; color: string }> = {
    admin: { label: t('admin.roles.admin'), color: "bg-red-100 text-red-700" },
    lro: { label: t('admin.roles.lro'), color: "bg-blue-100 text-blue-700" },
    steward: { label: t('admin.roles.steward'), color: "bg-green-100 text-green-700" },
    member: { label: t('admin.roles.member'), color: "bg-gray-100 text-gray-700" },
  };

  const section = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, className: "space-y-6" };
  const panel = "p-6 bg-white/80 backdrop-blur-sm border-gray-200";
  const searchBox = (placeholder: string, focus: string) => (
    <div className="relative mb-6">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className={`w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 ${focus} focus:border-transparent`}
      />
    </div>
  );

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('admin.title')}</h1>
          <p className="text-gray-600">{t('admin.subtitle')}</p>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
          {adminSections.map((entry) => (
            <motion.button
              key={entry.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveSection(entry.id as AdminSection)}
              className={`p-4 rounded-lg transition-all ${
                activeSection === entry.id
                  ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                  : "bg-white text-gray-700 hover:shadow-md border border-gray-200"
              }`}
            >
              <div className={`flex items-center justify-center mb-2 ${activeSection === entry.id ? "" : entry.color}`}>{entry.icon}</div>
              <p className="text-xs font-medium text-center">{entry.label}</p>
            </motion.button>
          ))}
        </div>

        {/* Overview Section */}
        {activeSection === "overview" && (
          <motion.div {...section}>
            {stats.error !== null && (
              <LoadFailure title={copy.couldNotLoad("stats")} detail={stats.error} retryLabel={copy.retry} onRetry={() => setOverviewReload((n) => n + 1)} />
            )}
            {stats.error === null && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{t('admin.overview.totalMembers')}</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.data ? (stats.data.totalMembers === null ? copy.notRecorded : stats.data.totalMembers.toLocaleString(numberLocale)) : copy.loading}</p>
                    </div>
                    <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-7 h-7 text-blue-600" />
                    </div>
                  </div>
                  {stats.data && stats.data.activeToday !== null && <p className="text-xs text-gray-600 font-medium">{copy.membersChanged(stats.data.activeToday)}</p>}
                </Card>

                <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{t('admin.overview.localSections')}</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.data ? stats.data.activeOrganizations.toLocaleString(numberLocale) : copy.loading}</p>
                    </div>
                    <div className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-7 h-7 text-green-600" />
                    </div>
                  </div>
                  {stats.data && <p className="text-xs text-gray-600 font-medium">{copy.orgsTotal(stats.data.totalOrganizations)}</p>}
                </Card>

                <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{copy.databaseSize}</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {stats.data ? `${stats.data.totalStorage.toLocaleString(numberLocale, { maximumFractionDigits: 2 })} GB` : copy.loading}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Database className="w-7 h-7 text-orange-600" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">{copy.databaseSizeNote}</p>
                </Card>
              </div>
            )}

            <Card className={panel}>
              <h2 className="text-xl font-bold text-gray-900 mb-4">{copy.setupHubTitle}</h2>
              <p className="text-sm text-gray-600 mb-5">{copy.setupHubBody}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {copy.hub.map((entry) => (
                  <Link
                    key={entry.title}
                    href={`/${locale}${entry.href}`}
                    className="text-left rounded-lg border border-gray-200 p-4 hover:shadow-sm hover:border-blue-300 transition-all"
                  >
                    <p className="font-semibold text-gray-900">{entry.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{entry.body}</p>
                  </Link>
                ))}
              </div>
            </Card>

            {/* Recent Activity */}
            <Card className={panel}>
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('admin.overview.recentActivity')}</h2>
              {activity.error !== null ? (
                <LoadFailure title={copy.couldNotLoad("activity")} detail={activity.error} retryLabel={copy.retry} onRetry={() => setOverviewReload((n) => n + 1)} />
              ) : activity.loading ? (
                <div className="text-center py-8 text-gray-500">{copy.loading}</div>
              ) : !activity.data || activity.data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{copy.noActivity}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.data.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <p className="text-sm font-medium text-gray-900">{item.description}</p>
                      <p className="text-xs text-gray-500">{item.timestamp ? new Date(item.timestamp).toLocaleString(numberLocale) : copy.notRecorded}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* User Management Section */}
        {activeSection === "users" && (
          <motion.div {...section}>
            <Card className={panel}>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('admin.users.title')}</h2>
              <p className="text-xs text-gray-600 mb-4">{copy.usersScopeNote}</p>
              {searchBox(t('admin.users.searchPlaceholder'), "focus:ring-blue-500")}
              {searchTooShort && <p className="mb-4 text-sm text-gray-600">{copy.searchTooShort}</p>}

              <div className="overflow-x-auto">
                {users.error !== null ? (
                  <LoadFailure title={copy.couldNotLoad("users")} detail={users.error} retryLabel={copy.retry} onRetry={() => setUsersReload((n) => n + 1)} />
                ) : users.loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="ml-3 text-gray-600">{copy.loading}</span>
                  </div>
                ) : !users.data || users.data.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{copy.noUsers}</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.users.table.name')}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.users.table.email')}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.users.table.role')}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{copy.organization}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.users.table.status')}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.users.table.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.data.map((user) => (
                        <tr key={`${user.id}-${user.organizationId}`} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">{user.name}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{user.email ?? copy.notRecorded}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleConfig[user.role]?.color ?? "bg-gray-100 text-gray-700"}`}>
                              {roleConfig[user.role]?.label ?? user.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{user.organizationName || copy.notRecorded}</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleUserStatus(user)}
                              disabled={busy === `status-${user.id}`}
                              title={copy.toggleStatus}
                              className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 disabled:opacity-50 ${
                                user.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {user.status || copy.notRecorded}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                              aria-label={copy.removeUser}
                              disabled={busy === `delete-${user.id}`}
                              onClick={() => handleDeleteUser(user)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Local Sections Management */}
        {activeSection === "locals" && (
          <motion.div {...section}>
            <Card className={panel}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('admin.locals.title')}</h2>
              {searchBox(t('admin.locals.searchPlaceholder'), "focus:ring-green-500")}
              <p className="text-xs text-gray-600 mb-4">{copy.directoryOnlyNote}</p>

              {locals.error !== null ? (
                <LoadFailure title={copy.couldNotLoad("locals")} detail={locals.error} retryLabel={copy.retry} onRetry={() => setLocalsReload((n) => n + 1)} />
              ) : locals.loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                  <span className="ml-3 text-gray-600">{copy.loading}</span>
                </div>
              ) : !locals.data || locals.data.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{copy.noOrganizations}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {locals.data.map((local) => (
                    <Card key={local.id} className="p-5 bg-linear-to-br from-white to-gray-50 border-gray-200 hover:shadow-lg transition-all">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">
                            {local.number ? `${t('admin.locals.localPrefix')} ${local.number}` : local.name}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              local.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {local.status || copy.notRecorded}
                          </span>
                        </div>
                        {local.number && <p className="text-sm font-medium text-gray-700">{local.name}</p>}
                        <p className="text-xs text-gray-600">{local.region ?? copy.notRecorded}</p>
                      </div>

                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Sections with nothing behind them */}
        {activeSection === "system" && (
          <motion.div {...section}>
            <Card className={panel}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{copy.systemTitle}</h2>
              <CapabilityUnavailable locale={locale} capability="UE-ADMIN-SYSTEM-SETTINGS" />
            </Card>
          </motion.div>
        )}

        {activeSection === "security" && (
          <motion.div {...section}>
            <Card className={panel}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{copy.securityTitle}</h2>
              <CapabilityUnavailable locale={locale} capability="UE-ADMIN-SECURITY-OVERVIEW" />
            </Card>
          </motion.div>
        )}

        {activeSection === "reports" && (
          <motion.div {...section}>
            <Card className={panel}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{copy.reportsTitle}</h2>
              <CapabilityUnavailable locale={locale} capability="UE-ADMIN-REPORTS-HUB" />
            </Card>
          </motion.div>
        )}

        {/* Database Section */}
        {activeSection === "database" && (
          <motion.div {...section}>
            <Card className={panel}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{copy.databaseTitle}</h2>
                <button
                  onClick={() => setHealthReload((n) => n + 1)}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  {copy.refresh}
                </button>
              </div>

              {health.error !== null ? (
                <LoadFailure title={copy.couldNotLoad("health")} detail={health.error} retryLabel={copy.retry} onRetry={() => setHealthReload((n) => n + 1)} />
              ) : health.loading || !health.data ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="ml-3 text-gray-600">{copy.loading}</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-gray-600">{copy.databaseSize}</p>
                      <p className="text-xl font-bold text-gray-900">{health.data.dbSizeMb.toLocaleString(numberLocale, { maximumFractionDigits: 2 })} MB</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-600">{copy.activeConnections}</p>
                      <p className="text-xl font-bold text-blue-600">{health.data.activeConnections.toLocaleString(numberLocale)}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-sm text-gray-600">{copy.tables}</p>
                      <p className="text-xl font-bold text-purple-600">{health.data.tableCount.toLocaleString(numberLocale)}</p>
                    </div>
                  </div>
                  <p className="mb-8 text-xs text-gray-600">
                    {health.data.checkedAt && `${copy.checkedAt} ${new Date(health.data.checkedAt).toLocaleString(numberLocale)}. `}
                    {health.data.tenantUser && health.data.systemUser &&
                      `${copy.connectedAs}: ${health.data.tenantUser} (${copy.tenantRole}), ${health.data.systemUser} (${copy.systemRole}).`}
                  </p>
                </>
              )}

              <div className="p-6 border border-gray-200 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{copy.optimizeTitle}</h3>
                <p className="text-sm text-gray-600 mb-4">{copy.optimizeBody}</p>
                <button
                  onClick={handleOptimizeDatabase}
                  disabled={busy === "optimize"}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy === "optimize" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {copy.optimize}
                </button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* AI Testing Section */}
        {activeSection === "ai-testing" && (
          <motion.div {...section}>
            <AiEndpointTester title={copy.aiTitle} body={copy.aiBody} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
