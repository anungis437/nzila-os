'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';

const NavigationContext = createContext<{
  open: boolean; setOpen: (open: boolean) => void;
} | null>(null);

export function DashboardNavigationProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useDashboardNavigation() { return useContext(NavigationContext); }

export function DashboardMenuTrigger() {
  const navigation = useDashboardNavigation();
  const locale = useLocale();
  return <Button id="ue-navigation-trigger" type="button" variant="outline" size="icon" className="shrink-0 md:hidden"
    aria-label={locale === 'fr-CA' ? 'Ouvrir la navigation' : 'Open navigation'}
    aria-expanded={navigation?.open ?? false} aria-controls="ue-mobile-drawer"
    onClick={() => navigation?.setOpen(true)}><Menu aria-hidden="true" className="size-5" /></Button>;
}
