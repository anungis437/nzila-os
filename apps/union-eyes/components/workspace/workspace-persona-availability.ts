/**
 * Union Eyes Workspace — persona-nav honesty map (EC-003).
 *
 * Config-driven availability for the seven canonical tabs × the six R6
 * persona classes. This is an honesty label, not a journey proof and not an
 * authorization change. Route access stays on `canAccessDashboardPath`.
 *
 * Source of the cells: Lane D PERSONA_NAV_HONESTY_RECON (hypotheses only).
 *   - HYP primary / HYP secondary → `available` (in-role orientation; data
 *     may still be empty). Not Golden Journey PROVEN.
 *   - UNKNOWN recon cells → `stub`.
 *   - A missing cell, an unrecognized role, or a role this map does not
 *     alias → `stub`. Never silent `available`.
 *
 * Seed role strings (tooling/seeds/r6-persona-corpus.sql) are accepted as
 * written (`executive`, `steward`, `governance`, `onboarding`,
 * `procurement`, `degraded`). `getUserRole()` collapses some of those
 * strings (`executive` → `president`, `governance` → `officer`) and does
 * not know `procurement` / `onboarding` / `degraded` (those grants are
 * `procurement` or `member`). Aliases below cover the collapse. Platform
 * ops roles are intentionally absent so they fail closed to stub.
 *
 * Onboarding and degraded-runtime seed rows store org role `member`, so a
 * live session cannot be told apart from an ordinary member. Both resolve
 * to stub for every tab. That is the conservative label, not a claim that
 * the member journey was audited.
 */

import {
  WORKSPACE_TABS,
  type WorkspaceTabId,
} from "@/components/workspace/workspace-config";
import {
  canAccessDashboardPath,
  type DashboardExperience,
} from "@/lib/dashboard/role-experience";

export const R6_PERSONA_CLASSES = [
  "executive",
  "steward",
  "governance",
  "onboarding",
  "procurement",
  "degraded-runtime",
] as const;

export type R6PersonaClass = (typeof R6_PERSONA_CLASSES)[number];

/** Nav honesty states. `unknown` is not stored — it resolves to `stub`. */
export type WorkspaceTabAvailability = "available" | "stub" | "unavailable";

const STUB_ROW: Record<WorkspaceTabId, WorkspaceTabAvailability> = {
  overview: "stub",
  "case-operations": "stub",
  members: "stub",
  governance: "stub",
  continuity: "stub",
  financial: "stub",
  documents: "stub",
};

export const WORKSPACE_PERSONA_TAB_AVAILABILITY = {
  executive: {
    overview: "available",
    "case-operations": "stub",
    members: "stub",
    governance: "available",
    continuity: "available",
    financial: "stub",
    documents: "stub",
  },
  steward: {
    overview: "available",
    "case-operations": "available",
    members: "available",
    governance: "stub",
    continuity: "available",
    financial: "stub",
    documents: "stub",
  },
  governance: {
    overview: "available",
    "case-operations": "stub",
    members: "stub",
    governance: "available",
    continuity: "available",
    financial: "stub",
    documents: "stub",
  },
  onboarding: STUB_ROW,
  procurement: STUB_ROW,
  "degraded-runtime": STUB_ROW,
} as const satisfies Record<
  R6PersonaClass,
  Record<WorkspaceTabId, WorkspaceTabAvailability>
>;

/**
 * Explicit role string → R6 class. Anything absent is unknown.
 * Comparison is case-insensitive; hyphens and spaces become underscores
 * only for the degraded-runtime spellings listed here.
 */
const ROLE_TO_R6_PERSONA: Record<string, R6PersonaClass> = {
  executive: "executive",
  ceo: "executive",
  president: "executive",
  vice_president: "executive",
  secretary_treasurer: "executive",
  national_officer: "executive",
  steward: "steward",
  chief_steward: "steward",
  governance: "governance",
  officer: "governance",
  onboarding: "onboarding",
  procurement: "procurement",
  degraded: "degraded-runtime",
  degraded_runtime: "degraded-runtime",
  "degraded-runtime": "degraded-runtime",
};

export function resolveWorkspacePersonaClass(
  role: string | null | undefined,
): R6PersonaClass | null {
  if (typeof role !== "string") return null;
  const trimmed = role.trim().toLowerCase();
  if (!trimmed) return null;
  return ROLE_TO_R6_PERSONA[trimmed] ?? null;
}

/** Fail closed: unknown role and missing cells are stub, never available. */
export function availabilityFromCell(
  cell: string | null | undefined,
): WorkspaceTabAvailability {
  if (cell === "available" || cell === "stub" || cell === "unavailable") {
    return cell;
  }
  return "stub";
}

export function getWorkspaceTabAvailability(
  role: string | null | undefined,
  tabId: WorkspaceTabId,
): WorkspaceTabAvailability {
  const persona = resolveWorkspacePersonaClass(role);
  if (!persona) return "stub";
  const row = WORKSPACE_PERSONA_TAB_AVAILABILITY[persona] as
    | Partial<Record<WorkspaceTabId, WorkspaceTabAvailability>>
    | undefined;
  return availabilityFromCell(row?.[tabId]);
}

/**
 * First in-role tab, otherwise the canonical default (overview), which is
 * then a stub rather than a silent available tab.
 */
export function initialWorkspaceTab(
  role: string | null | undefined,
): WorkspaceTabId {
  const available = WORKSPACE_TABS.find(
    (tab) => getWorkspaceTabAvailability(role, tab.id) === "available",
  );
  return available?.id ?? "overview";
}

/**
 * Which string the shell should label from.
 * Raw session org role wins so seed strings are not collapsed first.
 * A resolved RBAC role is used only when the session has no org role.
 * Null means the shell fail-closes to stub.
 */
export function selectWorkspaceRoleInput(input: {
  orgRole?: string | null;
  resolvedRole?: string | null;
}): string | null {
  const raw = input.orgRole?.trim();
  if (raw) return raw;
  const resolved = input.resolvedRole?.trim();
  if (resolved) return resolved;
  return null;
}

function dashboardExperienceForPersona(
  persona: R6PersonaClass,
): DashboardExperience | null {
  switch (persona) {
    case "executive":
      return "executive";
    case "steward":
      return "staff";
    case "governance":
      return "governance";
    case "onboarding":
    case "procurement":
    case "degraded-runtime":
      return null;
  }
}

export type WorkspaceDeepWorkGate =
  | { allowed: true }
  | {
      allowed: false;
      reason: "unknown-role" | "stub-section" | "unavailable-section" | "out-of-role";
    };

/**
 * Deep-work launch gate. Does not grant access.
 * Stub and unavailable sections do not launch workflows.
 * Available sections still have to pass the existing dashboard path policy
 * (including pilot exclusions). Unknown roles never launch.
 */
export function gateWorkspaceDeepWork(
  role: string | null | undefined,
  tabId: WorkspaceTabId,
  href: string,
  isPilotMode: boolean,
): WorkspaceDeepWorkGate {
  const persona = resolveWorkspacePersonaClass(role);
  if (!persona) return { allowed: false, reason: "unknown-role" };

  const availability = getWorkspaceTabAvailability(role, tabId);
  if (availability === "unavailable") {
    return { allowed: false, reason: "unavailable-section" };
  }
  if (availability === "stub") {
    return { allowed: false, reason: "stub-section" };
  }

  const experience = dashboardExperienceForPersona(persona);
  if (!experience) return { allowed: false, reason: "out-of-role" };

  const path = href.split("?")[0] ?? href;
  if (!canAccessDashboardPath(path, experience, isPilotMode)) {
    return { allowed: false, reason: "out-of-role" };
  }
  return { allowed: true };
}

/**
 * EC-005 coherence. The availability map above is unchanged and this layer
 * does not grant path access. When an AVAILABLE tab's doctrine href is
 * outside the persona's existing path policy, the control is remapped to an
 * already-allowed surface or kept blocked with a recovery link to one.
 * Staff allow-list prefixes are not widened here.
 */
export const WORKSPACE_DEEP_WORK_COHERENCE_SCOPE = [
  { role: "steward", tabId: "case-operations" },
  { role: "steward", tabId: "members" },
  { role: "steward", tabId: "continuity" },
  { role: "executive", tabId: "continuity" },
  { role: "executive", tabId: "governance" },
  { role: "governance", tabId: "continuity" },
  { role: "governance", tabId: "governance" },
] as const satisfies ReadonlyArray<{ role: string; tabId: WorkspaceTabId }>;

export interface WorkspaceDeepWorkRecoveryTarget {
  href: string;
  labelKey: string;
  labelFallback: string;
}

export type WorkspaceDeepWorkResolution =
  | { kind: "reachable" }
  | {
      kind: "remapped";
      href: string;
      labelKey: string;
      labelFallback: string;
      reasonKey: string;
      reasonFallback: string;
    }
  | {
      kind: "blocked";
      reason: "unknown-role" | "stub-section" | "unavailable-section" | "out-of-role";
      recovery?: WorkspaceDeepWorkRecoveryTarget;
    };

interface DeepWorkRemap {
  persona: R6PersonaClass;
  tabId: WorkspaceTabId;
  fromPath: string;
  href: string;
  labelKey: string;
  labelFallback: string;
  reasonKey: string;
  reasonFallback: string;
}

/**
 * Paths that pass the staff prefix list but bounce a steward off the page.
 * `/dashboard/operations` requires platform_lead and redirects everyone else
 * to `/dashboard`, so it is not a casework destination.
 */
const STEWARD_CASE_OPS_PAGE_DEAD_ENDS = new Set(["/dashboard/operations"]);

const DEEP_WORK_REMAPS: readonly DeepWorkRemap[] = [
  {
    persona: "steward",
    tabId: "case-operations",
    fromPath: "/dashboard/cases",
    href: "/dashboard/workbench",
    labelKey: "deepWork.destinations.caseworkConsole",
    labelFallback: "Casework console",
    reasonKey: "deepWork.remapReason.caseworkConsole",
    reasonFallback: "Opens the casework console. The cases list is outside your role.",
  },
  {
    persona: "steward",
    tabId: "continuity",
    fromPath: "/dashboard/continuity-intelligence",
    href: "/dashboard/intelligence",
    labelKey: "deepWork.destinations.institutionalIntelligenceReports",
    labelFallback: "Institutional intelligence reports",
    reasonKey: "deepWork.remapReason.institutionalIntelligenceReports",
    reasonFallback:
      "Opens institutional intelligence reports. Continuity intelligence is outside your role.",
  },
];

const DEEP_WORK_RECOVERY: Partial<
  Record<R6PersonaClass, Partial<Record<WorkspaceTabId, WorkspaceDeepWorkRecoveryTarget>>>
> = {
  steward: {
    "case-operations": {
      href: "/dashboard/workbench",
      labelKey: "deepWork.destinations.caseworkConsole",
      labelFallback: "Casework console",
    },
    members: {
      href: "/dashboard/members",
      labelKey: "deepWork.destinations.membersRoster",
      labelFallback: "Members roster",
    },
    continuity: {
      href: "/dashboard/intelligence",
      labelKey: "deepWork.destinations.institutionalIntelligenceReports",
      labelFallback: "Institutional intelligence reports",
    },
  },
  executive: {
    continuity: {
      href: "/dashboard/continuity-intelligence",
      labelKey: "deepWork.destinations.continuityIntelligence",
      labelFallback: "Continuity intelligence",
    },
    governance: {
      href: "/dashboard/governance-center",
      labelKey: "deepWork.destinations.governanceCenter",
      labelFallback: "Governance center",
    },
  },
  governance: {
    continuity: {
      href: "/dashboard/continuity-intelligence",
      labelKey: "deepWork.destinations.continuityIntelligence",
      labelFallback: "Continuity intelligence",
    },
    governance: {
      href: "/dashboard/governance",
      labelKey: "deepWork.destinations.governanceOverview",
      labelFallback: "Governance overview",
    },
  },
};

/**
 * Resolves how a configured deep-work href should be presented.
 * Reachable doctrine links stay as configured. Out-of-role links on an
 * in-scope AVAILABLE tab remap to an allowed surface, or stay blocked with
 * a recovery link, only when that alternate itself passes the path gate.
 */
export function resolveWorkspaceDeepWork(
  role: string | null | undefined,
  tabId: WorkspaceTabId,
  href: string,
  isPilotMode: boolean,
): WorkspaceDeepWorkResolution {
  const gate = gateWorkspaceDeepWork(role, tabId, href, isPilotMode);
  if (gate.allowed) return { kind: "reachable" };
  if (gate.reason !== "out-of-role") return { kind: "blocked", reason: gate.reason };

  const persona = resolveWorkspacePersonaClass(role);
  const path = href.split("?")[0] ?? href;
  if (!persona) return { kind: "blocked", reason: "out-of-role" };

  const remap = DEEP_WORK_REMAPS.find(
    (candidate) =>
      candidate.persona === persona && candidate.tabId === tabId && candidate.fromPath === path,
  );
  const remapIsDeadEnd =
    persona === "steward" &&
    tabId === "case-operations" &&
    remap != null &&
    STEWARD_CASE_OPS_PAGE_DEAD_ENDS.has(remap.href);
  if (
    remap &&
    !remapIsDeadEnd &&
    gateWorkspaceDeepWork(role, tabId, remap.href, isPilotMode).allowed
  ) {
    return {
      kind: "remapped",
      href: remap.href,
      labelKey: remap.labelKey,
      labelFallback: remap.labelFallback,
      reasonKey: remap.reasonKey,
      reasonFallback: remap.reasonFallback,
    };
  }

  const recovery = DEEP_WORK_RECOVERY[persona]?.[tabId];
  const recoveryPath = recovery?.href.split("?")[0];
  const recoveryIsDeadEnd =
    persona === "steward" &&
    tabId === "case-operations" &&
    recoveryPath != null &&
    STEWARD_CASE_OPS_PAGE_DEAD_ENDS.has(recoveryPath);
  if (
    recovery &&
    recoveryPath &&
    recoveryPath !== path &&
    !recoveryIsDeadEnd &&
    gateWorkspaceDeepWork(role, tabId, recovery.href, isPilotMode).allowed
  ) {
    return { kind: "blocked", reason: "out-of-role", recovery };
  }

  return { kind: "blocked", reason: "out-of-role" };
}
