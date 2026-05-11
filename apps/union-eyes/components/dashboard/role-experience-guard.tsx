"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { usePilotMode } from "@/contexts/pilot-mode-context";
import {
  canAccessDashboardPath,
  getDashboardExperience,
  getRoleLandingPath,
} from "@/lib/dashboard/role-experience";

type RoleExperienceGuardProps = {
  userRole?: string | null;
};

export default function RoleExperienceGuard({ userRole }: RoleExperienceGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const { isPilotMode } = usePilotMode();

  const experience = useMemo(() => getDashboardExperience(userRole), [userRole]);
  const landing = useMemo(() => getRoleLandingPath(userRole), [userRole]);

  useEffect(() => {
    if (!pathname.includes("/dashboard")) return;

    // Derive locale from current path first (e.g. /en-CA/dashboard) to avoid
    // mismatches when the hook locale differs from the route segment format.
    const pathLocaleMatch = pathname.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)(?=\/|$)/);
    const effectiveLocale = pathLocaleMatch?.[1] ?? locale;
    const localePrefix = `/${effectiveLocale}`;
    const pathWithoutLocale = pathname.startsWith(localePrefix)
      ? pathname.slice(localePrefix.length) || '/'
      : pathname;
    const allowed = canAccessDashboardPath(pathWithoutLocale, experience, isPilotMode);
    const localizedLanding = `${localePrefix}${landing}`;

    const isDashboardRoot = pathWithoutLocale === '/dashboard' || pathWithoutLocale === '/dashboard/';
    if (isDashboardRoot && pathname !== localizedLanding) {
      router.replace(localizedLanding);
      return;
    }

    if (!allowed && pathname !== localizedLanding) {
      router.replace(localizedLanding);
    }
  }, [pathname, locale, experience, isPilotMode, landing, router]);

  return null;
}
