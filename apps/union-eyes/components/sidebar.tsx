"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
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
  MessageSquare,
  Scale,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { SelectProfile } from "@/db/schema/domains/member";
import { useOrganization } from "@/contexts/organization-context";
import { usePilotMode } from "@/contexts/pilot-mode-context";
import { Badge } from "@/components/ui/badge";
import {
  ROLE_EXECUTION_CHROME_LABEL,
  ROLE_EXECUTION_DESTINATIONS_LABEL,
  honestyForNavigationItem,
  roleHomeHubCue,
} from "@/lib/dashboard/dual-nav-honesty";
import {
  getDualNavHomes,
  getVisibleNavigationForExperience,
  type NavigationGroup,
  type NavigationItem,
} from "@/lib/dashboard/role-experience";

import { useDashboardNavigation } from '@/components/dashboard/navigation-context';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { navigationDestination, selectedNavigationDestination } from '@/lib/dashboard/navigation-selection';

import { navigationCopyKey } from '@/lib/dashboard/navigation-copy';

interface SidebarProps {
  profile: SelectProfile | null;
  userEmail?: string;
  whopMonthlyPlanId: string;
  whopYearlyPlanId: string;
  userRole?: string;
  platformOrgId?: string;
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
}: SidebarProps) {
  const locale = useLocale();
  const translations = useTranslations('experienceNavigation');
  const copy = useCallback((text: string) => translations(navigationCopyKey(text)), [translations]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const navigation = useDashboardNavigation();
  const { organization } = useOrganization();
  const { isPilotMode } = usePilotMode();
  const [isMounted, setIsMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const mobileOpen = navigation?.open ?? fallbackOpen;
  const setMobileOpen = navigation?.setOpen ?? setFallbackOpen;

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
  }, [pathname, search, setMobileOpen]);

  const isViewingTenantOrg = !!(
    platformOrgId &&
    organization?.id &&
    organization.id !== platformOrgId
  );

  const homes = useMemo(() => getDualNavHomes(userRole), [userRole]);
  const hubCue = useMemo(() => roleHomeHubCue(homes, copy), [homes, copy]);

  const items = useMemo<NavigationItem[]>(
    () => getVisibleNavigationForExperience(homes.experience, isPilotMode, userRole),
    [homes.experience, isPilotMode, userRole],
  );

  // Build ordered groups from the nav. Use demo-defined order when available;
  // otherwise derive groups from the items themselves in encounter order.
  const groups = useMemo<{ group: NavigationGroup; items: NavigationItem[] }[]>(() => {
    const hasGroups = items.some((i) => i.group);
    if (!hasGroups) {
      return [{ group: { key: "__flat", label: "" }, items }];
    }

    const order = Array.from(
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
  }, [items]);

  const identityLabel = userEmail || profile?.email || "User";

  const withLocale = (href: string) => `/${locale}${href}`;

  const selectedDestination = selectedNavigationDestination(items, pathname, search);
  const isActive = (href: string) => navigationDestination(href) === selectedDestination;

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

  const renderHubCue = (showLabels: boolean) => {
    if (!hubCue.show) return null;
    const href = withLocale(hubCue.hubHref);
    if (!showLabels) {
      return (
        <div className="mb-3 flex justify-center px-2" data-nav-role="hub-cue">
          <Link
            href={href}
            data-nav-role="hub"
            aria-label={hubCue.linkLabel}
            title={hubCue.linkLabel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            <LayoutDashboard size={16} aria-hidden="true" />
          </Link>
        </div>
      );
    }
    return (
      <div
        className="mx-2 mb-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800"
        data-nav-role="hub-cue"
      >
        <p>{hubCue.message}</p>
        {hubCue.intelligenceNote ? (
          <p className="mt-1">{hubCue.intelligenceNote}</p>
        ) : null}
        <Link
          href={href}
          data-nav-role="hub"
          className="mt-1 inline-flex font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
        >
          {hubCue.linkLabel}
        </Link>
      </div>
    );
  };

  const renderNav = (variant: "desktop" | "drawer") => {
    const showLabels = variant === "drawer" ? true : !collapsed;
    return (
      <div>
        {renderHubCue(showLabels)}
        <nav
          aria-label={copy(ROLE_EXECUTION_DESTINATIONS_LABEL)}
          data-nav-role="legacy-side"
          className="px-2 space-y-3"
        >
        {groups.map(({ group, items: groupItems }) => {
          const isFlat = group.key === "__flat";
          const isGroupCollapsed = !isFlat && collapsedGroups.has(group.key);
          const groupId = `nav-group-${variant}-${group.key}`;

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
                  <span>{copy(group.label)}</span>
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
                  const honesty = honestyForNavigationItem(item, homes.roleHomeHref, copy);
                  return (
                    <li key={`${item.href}-${item.label}`}>
                      <Link
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        title={!showLabel ? honesty.collapsedTitle : undefined}
                        aria-label={
                          honesty.accessibleName || item.label
                        }
                        aria-current={active ? "page" : undefined}
                        data-nav-role={honesty.navRole}
                        className={`relative flex gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                          showLabel ? "items-start" : "items-center justify-center"
                        } ${
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-foreground hover:bg-muted"
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
                          <span className="min-w-0">
                            <span className="block whitespace-normal break-words leading-5">{copy(item.label)}</span>
                            {honesty.visibleQualifier ? (
                              <Badge
                                variant="outline"
                                className={`mt-1 h-auto max-w-full whitespace-normal px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight ${
                                  active
                                    ? "border-blue-200 bg-transparent text-blue-50"
                                    : "border-gray-200 bg-white text-gray-600"
                                }`}
                              >
                                {honesty.visibleQualifier}
                              </Badge>
                            ) : null}
                          </span>
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
      </div>
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
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-2 hover:bg-gray-100 ${
        showLabel ? "" : "justify-center"
      }`}
      title={!showLabel ? identityLabel : undefined}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white">
        {isMounted ? (
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "w-8 h-8",
                userButtonTrigger: "w-11 h-11 rounded-full",
              },
            }}
          />
        ) : (
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
        )}
      </div>
      {showLabel && (
        <Link href={withLocale("/dashboard/profile")} onClick={() => setMobileOpen(false)} className="min-w-0 min-h-11 rounded-md">
          <p className="break-words text-sm font-medium text-gray-900">
            {identityLabel}
          </p>
          <p className="text-xs text-gray-500">{copy("Profile")}</p>
        </Link>
      )}
    </div>
  );

  const desktopWidth = collapsed ? "md:w-16" : "md:w-72";

  return (
    <>
      {/* Desktop sidebar (hidden on small screens) */}
      <aside
        className={`ue-sidebar hidden shrink-0 flex-col justify-between border-r border-gray-200 bg-white py-4 transition-[width] duration-200 ease-out md:flex ${desktopWidth}`}
        aria-label={copy(ROLE_EXECUTION_CHROME_LABEL)}
        data-nav-role="legacy-side"
        data-nav-surface="desktop"
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
                aria-label={copy("Collapse sidebar")}
                title={copy("Collapse sidebar")}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
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
                aria-label={copy("Expand sidebar")}
                title={copy("Expand sidebar")}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
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

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" id="ue-mobile-drawer" data-nav-role="legacy-side"
          aria-describedby={undefined}
          onCloseAutoFocus={event => { event.preventDefault(); document.getElementById("ue-navigation-trigger")?.focus(); }}
          data-nav-surface="drawer" className="ue-navigation-drawer w-[min(22rem,90vw)] overflow-y-auto">
          <SheetTitle className="sr-only">{copy(ROLE_EXECUTION_CHROME_LABEL)}</SheetTitle>
          <div className="mb-6 pr-12">{renderBrand(true)}</div>
          {renderNav("drawer")}
          <div className="mt-6 border-t border-border pt-4">{renderProfile(true)}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
