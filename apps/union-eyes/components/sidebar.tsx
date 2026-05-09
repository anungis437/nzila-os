"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { UserButton } from "@nzila/platform-auth/entra/client";
import { Building2, CircleDot } from "lucide-react";
import type { SelectProfile } from "@/db/schema/domains/member";
import { useOrganization } from "@/contexts/organization-context";
import { usePilotMode } from "@/contexts/pilot-mode-context";
import {
  getDashboardExperience,
  getNavigationForExperience,
  type NavigationItem,
} from "@/lib/dashboard/role-experience";

interface SidebarProps {
  profile: SelectProfile | null;
  userEmail?: string;
  whopMonthlyPlanId: string;
  whopYearlyPlanId: string;
  userRole?: string;
  platformOrgId?: string;
}

function iconForItem(item: NavigationItem) {
  return <CircleDot size={14} className="shrink-0" />;
}

export default function Sidebar({ profile, userEmail, userRole, platformOrgId }: SidebarProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const { organization } = useOrganization();
  const { isPilotMode } = usePilotMode();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isViewingTenantOrg = !!(platformOrgId && organization?.id && organization.id !== platformOrgId);

  const experience = useMemo(() => getDashboardExperience(userRole), [userRole]);

  const items = useMemo(() => {
    const nav = getNavigationForExperience(experience);

    // In pilot mode, keep only routes in the role-first IA shell.
    if (!isPilotMode) {
      return nav;
    }

    const pilotAllowed = new Set(nav.map((entry) => entry.href));
    return nav.filter((entry) => pilotAllowed.has(entry.href));
  }, [experience, isPilotMode]);

  const identityLabel = userEmail || profile?.email || "User";

  const withLocale = (href: string) => `/${locale}${href}`;

  const isActive = (href: string) => {
    const hrefPath = href.split("?")[0];
    const localizedHref = withLocale(href);
    const localizedPath = withLocale(hrefPath);
    if (pathname === localizedHref || pathname === localizedPath) return true;
    return hrefPath !== "/dashboard" && pathname.startsWith(`${localizedPath}/`);
  };

  return (
    <aside className="h-screen w-14 md:w-64 bg-white border-r border-gray-200 flex flex-col justify-between py-4 shrink-0">
      <div>
        <div className="px-2 md:px-4 mb-5">
          <Link href={withLocale("/dashboard")} className="flex items-center gap-2">
            <Image src="/images/brand/icon.png" alt="UnionEyes" width={32} height={32} className="w-8 h-8 rounded-md" />
            <Image src="/images/brand/logo.png" alt="UnionEyes" width={120} height={30} className="hidden md:block h-6 object-contain" />
          </Link>
        </div>

        {isViewingTenantOrg && organization && (
          <div className="hidden md:flex items-center gap-2 mx-3 mb-3 px-3 py-2 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs">
            <Building2 size={12} />
            <span className="truncate">Viewing: {organization.name}</span>
          </div>
        )}

        <nav className="px-1 md:px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          {items.map((item) => {
            const href = withLocale(item.href);
            const active = isActive(item.href);

            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={href}
                className={`flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {iconForItem(item)}
                <span className="hidden md:block truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-3 border-t border-gray-200 mx-1 md:mx-3">
        <Link
          href={withLocale("/dashboard/profile")}
          className="flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-2 rounded-md hover:bg-gray-100"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-white border border-gray-200 flex items-center justify-center">
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
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            )}
          </div>
          <div className="hidden md:block min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{identityLabel}</p>
            <p className="text-xs text-gray-500">Profile</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
