"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { UserButton } from "@nzila/platform-auth/entra/client";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleDot,
  FolderOpen,
  Gavel,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Scale,
  Target,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { SelectProfile } from "@/db/schema/domains/member";
import { useOrganization } from "@/contexts/organization-context";
import { usePilotMode } from "@/contexts/pilot-mode-context";
import {
  getCupe4373DemoGroups,
  getCupe4373DemoNavigation,
  getDashboardExperience,
  getNavigationForExperience,
  type NavigationGroup,
  type NavigationItem,
} from "@/lib/dashboard/role-experience";

interface SidebarProps {
  profile: SelectProfile | null;
  userEmail?: string;
  whopMonthlyPlanId: string;
  whopYearlyPlanId: string;
  userRole?: string;
  platformOrgId?: string;
  isCupeDemo?: boolean;
}

const LS_COLLAPSED = "ue-sidebar-collapsed";
const LS_GROUPS = "ue-sidebar-collapsed-groups";

function IconForItem({ item }: { item: NavigationItem }) {
  const iconsByKey: Record<NonNullable<NavigationItem["icon"]>, LucideIcon> = {
    dashboard: LayoutDashboard,
    cases: BriefcaseBusiness,
    grievances: Scale,
    members: Users,
    agreements: BookOpen,
    calendar: CalendarDays,
    documents: FolderOpen,
    reports: BarChart3,
    inbox: Inbox,
    priorities: Target,
    communications: MessageSquare,
    governance: Gavel,
  };
  const iconsByHref: Record<string, LucideIcon> = {
    "/dashboard": LayoutDashboard,
    "/dashboard/cases": BriefcaseBusiness,
    "/dashboard/work": BriefcaseBusiness,
    "/dashboard/agreements": BookOpen,
    "/dashboard/calendar": CalendarDays,
    "/dashboard/reports": BarChart3,
  };
  const Icon = item.icon
    ? iconsByKey[item.icon]
    : iconsByHref[item.href] ?? CircleDot;
  return <Icon size={16} className="shrink-0" aria-hidden="true" />;
}

export default function Sidebar({
  profile,
  userEmail,
  userRole,
  platformOrgId,
  isCupeDemo = false,
}: SidebarProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const { organization } = useOrganization();
  const { isPilotMode } = usePilotMode();
  const [isMounted, setIsMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsMounted(true);
      try {
        const c = window.localStorage.getItem(LS_COLLAPSED);
        if (c === "1") setCollapsed(true);
        const g = window.localStorage.getItem(LS_GROUPS);
        if (g) setCollapsedGroups(new Set(JSON.parse(g) as string[]));
      } catch {
        /* ignore storage errors */
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMobileOpen(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  const isViewingTenantOrg = !!(
    platformOrgId &&
    organization?.id &&
    organization.id !== platformOrgId
  );

  const experience = useMemo(() => getDashboardExperience(userRole), [userRole]);

  const items = useMemo<NavigationItem[]>(() => {
    if (isCupeDemo) return getCupe4373DemoNavigation(userRole);
    const nav = getNavigationForExperience(experience);
    if (!isPilotMode) return nav;
    const pilotAllowed = new Set(nav.map((entry) => entry.href));
    return nav.filter((entry) => pilotAllowed.has(entry.href));
  }, [experience, isPilotMode, isCupeDemo, userRole]);

  // Build ordered groups from the nav. Use demo-defined order when available;
  // otherwise derive groups from the items themselves in encounter order.
  const groups = useMemo<{ group: NavigationGroup; items: NavigationItem[] }[]>(() => {
    const hasGroups = items.some((i) => i.group);
    if (!hasGroups) {
      return [{ group: { key: "__flat", label: "" }, items }];
    }

    const order = isCupeDemo
      ? getCupe4373DemoGroups()
      : Array.from(
          new Set(items.map((i) => i.group).filter(Boolean) as string[]),
        ).map((key) => ({ key, label: key }));

    const orderMap = new Map(order.map((g, i) => [g.key, i]));
    const byKey = new Map<string, NavigationItem[]>();
    for (const item of items) {
      const key = item.group ?? "__ungrouped";
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(item);
    }

    const result: { group: NavigationGroup; items: NavigationItem[] }[] = [];
    for (const g of order) {
      const list = byKey.get(g.key);
      if (list && list.length) result.push({ group: g, items: list });
    }
    // Append any nav items whose group key wasn't in the order map last.
    for (const [key, list] of byKey.entries()) {
      if (!orderMap.has(key)) {
        result.push({ group: { key, label: key === "__ungrouped" ? "" : key }, items: list });
      }
    }
    return result;
  }, [items, isCupeDemo]);

  const identityLabel = userEmail || profile?.email || "User";

  const withLocale = (href: string) => `/${locale}${href}`;

  const isActive = (href: string) => {
    const hrefPath = href.split("?")[0];
    const localizedHref = withLocale(href);
    const localizedPath = withLocale(hrefPath);
    if (pathname === localizedHref || pathname === localizedPath) return true;
    return hrefPath !== "/dashboard" && pathname.startsWith(`${localizedPath}/`);
  };

  const persistCollapsed = (next: boolean) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(LS_COLLAPSED, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(LS_GROUPS, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // ----- Render helpers -----

  const renderNav = (variant: "desktop" | "drawer") => {
    const showLabels = variant === "drawer" ? true : !collapsed;
    return (
      <nav
        aria-label="Primary"
        className="px-2 space-y-3 overflow-y-auto max-h-[calc(100vh-180px)]"
      >
        {groups.map(({ group, items: groupItems }) => {
          const isFlat = group.key === "__flat";
          const isGroupCollapsed = !isFlat && collapsedGroups.has(group.key);
          const groupId = `nav-group-${group.key}`;

          return (
            <div key={group.key} className="space-y-1">
              {!isFlat && showLabels && group.label && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={!isGroupCollapsed}
                  aria-controls={groupId}
                  className="group flex w-full items-center justify-between px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    size={12}
                    className={`shrink-0 transition-transform ${
                      isGroupCollapsed ? "-rotate-90" : "rotate-0"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              )}
              {!isFlat && !showLabels && (
                <div
                  className="mx-2 my-1 h-px bg-gray-100"
                  aria-hidden="true"
                />
              )}
              <ul
                id={groupId}
                hidden={!isFlat && isGroupCollapsed && showLabels}
                className="space-y-0.5"
              >
                {groupItems.map((item) => {
                  const href = withLocale(item.href);
                  const active = isActive(item.href);
                  const showLabel = showLabels;
                  return (
                    <li key={`${item.href}-${item.label}`}>
                      <Link
                        href={href}
                        title={!showLabel ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={`relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                          showLabel ? "" : "justify-center"
                        } ${
                          active
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {active && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-blue-300"
                          />
                        )}
                        <IconForItem item={item} />
                        {showLabel && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    );
  };

  const renderBrand = (showLabel: boolean) => (
    <Link
      href={withLocale("/dashboard")}
      className="flex items-center gap-2"
      aria-label="UnionEyes home"
    >
      <Image
        src="/images/brand/icon.png"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 rounded-md"
      />
      {showLabel && (
        <Image
          src="/images/brand/logo.png"
          alt="UnionEyes"
          width={120}
          height={30}
          className="h-6 object-contain"
        />
      )}
    </Link>
  );

  const renderProfile = (showLabel: boolean) => (
    <Link
      href={withLocale("/dashboard/profile")}
      className={`flex items-center gap-2 rounded-md px-2 py-2 hover:bg-gray-100 ${
        showLabel ? "" : "justify-center"
      }`}
      title={!showLabel ? identityLabel : undefined}
    >
      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white">
        {isMounted ? (
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "w-8 h-8",
                userButtonTrigger: "w-8 h-8 rounded-full",
              },
            }}
          />
        ) : (
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
        )}
      </div>
      {showLabel && (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">
            {identityLabel}
          </p>
          <p className="text-xs text-gray-500">Profile</p>
        </div>
      )}
    </Link>
  );

  const desktopWidth = collapsed ? "md:w-16" : "md:w-64";

  return (
    <>
      {/* Mobile hamburger trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        aria-controls="ue-mobile-drawer"
        className="fixed left-3 top-3 z-40 inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 shadow-sm md:hidden"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {/* Desktop sidebar (hidden on small screens) */}
      <aside
        className={`hidden h-screen shrink-0 flex-col justify-between border-r border-gray-200 bg-white py-4 transition-[width] duration-200 ease-out md:flex ${desktopWidth}`}
        aria-label="Primary navigation"
      >
        <div>
          <div
            className={`mb-5 flex items-center px-3 ${
              collapsed ? "justify-center" : "justify-between"
            }`}
          >
            {renderBrand(!collapsed)}
            {!collapsed && (
              <button
                type="button"
                onClick={() => persistCollapsed(true)}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <ChevronsLeft size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          {collapsed && (
            <div className="mb-3 flex justify-center">
              <button
                type="button"
                onClick={() => persistCollapsed(false)}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <ChevronsRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          {isViewingTenantOrg && organization && !collapsed && (
            <div className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Building2 size={12} aria-hidden="true" />
              <span className="truncate">Viewing: {organization.name}</span>
            </div>
          )}

          {renderNav("desktop")}
        </div>

        <div className="mx-2 border-t border-gray-200 pt-3">
          {renderProfile(!collapsed)}
        </div>
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${
          mobileOpen ? "" : "pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          onClick={() => setMobileOpen(false)}
          className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-200 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden="true"
        />
        <aside
          id="ue-mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Primary navigation"
          className={`relative ml-0 flex h-full w-72 max-w-[85vw] flex-col justify-between border-r border-gray-200 bg-white py-4 shadow-xl transition-transform duration-200 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div>
            <div className="mb-5 flex items-center justify-between px-3">
              {renderBrand(true)}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {isViewingTenantOrg && organization && (
              <div className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <Building2 size={12} aria-hidden="true" />
                <span className="truncate">Viewing: {organization.name}</span>
              </div>
            )}

            {renderNav("drawer")}
          </div>

          <div className="mx-2 border-t border-gray-200 pt-3">
            {renderProfile(true)}
          </div>
        </aside>
      </div>
    </>
  );
}
