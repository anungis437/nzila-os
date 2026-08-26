'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type DashboardLandingRedirectProps = {
  destination: string;
};

export function DashboardLandingRedirect({ destination }: DashboardLandingRedirectProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === destination) {
      return;
    }

    router.replace(destination);
  }, [destination, pathname, router]);

  return null;
}
