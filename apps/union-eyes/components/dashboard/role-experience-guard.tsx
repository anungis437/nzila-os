"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { usePilotMode } from "@/contexts/pilot-mode-context";
import { verifyWorkbenchRouteAccess } from '@/lib/dashboard/workbench-route-access';
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
    if (isDashboardRoot) {
      return;
    }

    if (!allowed && pathname !== localizedLanding) {
      // An executive may also hold explicit casework standing. The menu policy
      // cannot erase it, and a title alone cannot establish it. Keep the normal
      // menu while asking the existing caller-scoped queue before redirecting.
      if (experience === 'executive' && pathWithoutLocale === '/dashboard/workbench') {
        const controller = new AbortController();
        let cancelled = false;
        const timeout = setTimeout(() => controller.abort(), 10000);
        void verifyWorkbenchRouteAccess(controller.signal)
          .then(hasAccess => { if (!cancelled && !hasAccess) router.replace(localizedLanding); })
          .catch(() => { if (!cancelled) router.replace(localizedLanding); })
          .finally(() => clearTimeout(timeout));
        return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
      }
      router.replace(localizedLanding);
    }
  }, [pathname, locale, experience, isPilotMode, landing, router]);

  return null;
}
