'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  Home,
  Briefcase,
  Inbox,
  Users,
  MessageSquare,
  FileText,
  BarChart3,
  ShieldCheck,
  Building2,
  Settings,
  Activity,
  Award,
  Bell,
  CircleDot,
  Menu,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getDashboardExperience,
  getNavigationForExperience,
  type NavigationItem,
} from '@/lib/dashboard/role-experience';

interface BottomNavProps {
  className?: string;
  /**
   * Server-resolved role for the current user. When omitted, falls back to
   * the 'member' experience via {@link getDashboardExperience}.
   */
  userRole?: string;
}

/**
 * Map a SOT navigation label to a lucide icon. Unknown labels fall back to
 * a neutral `CircleDot` so the bar always renders. Keep this map narrow:
 * label-to-icon is a presentation concern of BottomNav, not of the SOT.
 */
const ICON_BY_LABEL: Record<string, LucideIcon> = {
  Home: Home,
  'My Cases': Briefcase,
  Cases: Briefcase,
  'Representation Cases': Briefcase,
  Workbench: Briefcase,
  'Casework Console': Briefcase,
  Inbox: Inbox,
  'Submit Request': FileText,
  'Open Representation Case': FileText,
  Members: Users,
  Messages: MessageSquare,
  Communications: MessageSquare,
  Documents: FileText,
  Reports: BarChart3,
  'Organizational Reports': BarChart3,
  Priorities: Activity,
  'Commitments & Deadlines': Activity,
  'Executive Overview': BarChart3,
  'Continuity Insights': Activity,
  'Operational Health': Activity,
  'Continuity Operations': Activity,
  'Governance Visibility': ShieldCheck,
  'Governance Overview': ShieldCheck,
  'Trust & Explainability': ShieldCheck,
  'Continuity Review': Briefcase,
  'Policy Alignment': ShieldCheck,
  'Continuity Signals': Activity,
  'Audit & Evidence': ShieldCheck,
  Outcomes: Award,
  'Member Outcomes Ledger': Award,
  'Leadership Continuity': Users,
  'Trust & Oversight': ShieldCheck,
  Notifications: Bell,
  Organization: Building2,
  'Users & Roles': Users,
  'Profile & Settings': Settings,
  'Help & Support': MessageSquare,
};

function iconFor(label: string): LucideIcon {
  return ICON_BY_LABEL[label] ?? CircleDot;
}

/**
 * Bottom navigation bar for mobile devices.
 *
 * Drives entries from the role-experience SOT (`getNavigationForExperience`)
 * so the mobile surface always matches the desktop sidebar taxonomy. The bar
 * shows the first four entries plus an always-visible "More" link to settings
 * (the universal overflow surface across every experience). A future workstream
 * can replace the static overflow with a sheet revealing the full SOT list.
 */
export function BottomNav({ className, userRole }: BottomNavProps) {
  const pathname = usePathname();
  const locale = useLocale();

  const experience = useMemo(() => getDashboardExperience(userRole), [userRole]);

  const items = useMemo<NavigationItem[]>(() => {
    const nav = getNavigationForExperience(experience);
    const primary = nav.slice(0, 4);
    return [...primary, { label: 'More', href: '/dashboard/settings' }];
  }, [experience]);

  const withLocale = (href: string) => `/${locale}${href}`;

  const isActive = (href: string) => {
    const hrefPath = href.split('?')[0];
    const localizedPath = withLocale(hrefPath);
    if (pathname === localizedPath) return true;
    return hrefPath !== '/dashboard' && pathname.startsWith(`${localizedPath}/`);
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb',
        'flex items-center justify-around py-2 px-4 shadow-lg',
        className,
      )}
      aria-label="Primary mobile navigation"
    >
      {items.map((item) => {
        const Icon = item.label === 'More' ? Menu : iconFor(item.label);
        const active = isActive(item.href);

        return (
          <Link
            key={`${item.label}:${item.href}`}
            href={withLocale(item.href)}
            className={cn(
              'flex flex-col items-center justify-center py-1 px-3 rounded-lg',
              'transition-colors duration-200',
              active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <span className="block w-6 h-6">
              <Icon className="w-6 h-6" aria-hidden />
            </span>
            <span className="text-xs mt-1 font-medium truncate max-w-16">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomNav;
